package processor

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/controller"
	"go.miloapis.com/activity/internal/metrics"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// Config contains configuration for the Activity Processor.
type Config struct {
	// Kubernetes client for watching ActivityPolicy
	DynamicClient dynamic.Interface

	// RESTMapper for resolving resource names to kinds
	RESTMapper meta.RESTMapper

	// NATS configuration
	NATSInputURL       string
	NATSOutputURL      string
	NATSAuditSubject   string
	NATSEventSubject   string
	NATSActivityPrefix string

	// NATS TLS configuration
	NATSTLSEnabled  bool
	NATSTLSCertFile string
	NATSTLSKeyFile  string
	NATSTLSCAFile   string

	// Processing configuration
	Workers      int
	ResyncPeriod int

	// Health probe address
	HealthProbeAddr string
}

// Processor is the main Activity Processor that consumes audit logs and events,
// applies ActivityPolicy rules, and produces Activity records.
type Processor struct {
	config Config

	// NATS connections
	inputConn  *nats.Conn
	outputConn *nats.Conn

	// Policy cache for looking up translation rules
	policyCache *controller.PolicyCache

	// Informer for watching ActivityPolicy
	informerFactory dynamicinformer.DynamicSharedInformerFactory
	policyInformer  cache.SharedIndexInformer

	// Sub-processors
	auditProcessor *AuditProcessor

	// Publisher for activities
	publisher *Publisher

	// Health tracking
	mu      sync.RWMutex
	started bool
	healthy bool

	// NATS connection health tracking
	natsInputHealthy  bool
	natsOutputHealthy bool

	// Shutdown coordination
	shutdownOnce sync.Once
	shutdownChan chan struct{}
}

// ActivityPolicyGVR is the GroupVersionResource for ActivityPolicy.
var ActivityPolicyGVR = schema.GroupVersionResource{
	Group:    v1alpha1.GroupName,
	Version:  "v1alpha1",
	Resource: "activitypolicies",
}

// drainTimeout is the maximum time to wait for NATS connections to drain.
const drainTimeout = 30 * time.Second

// natsConnectionOptions returns standard NATS connection options with health tracking,
// metrics, and lame duck mode handling.
func (p *Processor) natsConnectionOptions(name string, lameDuckHandler func()) []nats.Option {
	opts := []nats.Option{
		nats.Name(name),
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1), // Unlimited reconnects
		nats.ReconnectWait(time.Second),
		nats.ReconnectJitter(100*time.Millisecond, time.Second),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			p.setNATSHealthy(name, false)
			metrics.NATSDisconnectsTotal.WithLabelValues(name).Inc()
			metrics.NATSConnectionStatus.WithLabelValues(name).Set(0)
			if err != nil {
				klog.ErrorS(err, "NATS disconnected", "connection", name)
			} else {
				klog.InfoS("NATS disconnected", "connection", name)
			}
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			p.setNATSHealthy(name, true)
			metrics.NATSReconnectsTotal.WithLabelValues(name).Inc()
			metrics.NATSConnectionStatus.WithLabelValues(name).Set(1)
			klog.InfoS("NATS reconnected", "connection", name, "url", nc.ConnectedUrl())
		}),
		nats.ClosedHandler(func(nc *nats.Conn) {
			p.setNATSHealthy(name, false)
			metrics.NATSConnectionStatus.WithLabelValues(name).Set(0)
			klog.InfoS("NATS connection closed", "connection", name)
		}),
		nats.ErrorHandler(func(nc *nats.Conn, sub *nats.Subscription, err error) {
			metrics.NATSErrorsTotal.WithLabelValues(name).Inc()
			subName := ""
			if sub != nil {
				subName = sub.Subject
			}
			klog.ErrorS(err, "NATS async error", "connection", name, "subject", subName)
		}),
		nats.LameDuckModeHandler(func(nc *nats.Conn) {
			metrics.NATSLameDuckEventsTotal.WithLabelValues(name).Inc()
			klog.InfoS("NATS server entering lame duck mode, initiating graceful shutdown", "connection", name)
			if lameDuckHandler != nil {
				lameDuckHandler()
			}
		}),
	}

	// Add TLS configuration if enabled
	if p.config.NATSTLSEnabled {
		tlsConfig, err := p.buildNATSTLSConfig()
		if err != nil {
			klog.ErrorS(err, "Failed to build NATS TLS config, connecting without TLS")
		} else {
			opts = append(opts, nats.Secure(tlsConfig))
			klog.V(2).InfoS("NATS TLS enabled", "connection", name)
		}
	}

	return opts
}

// buildNATSTLSConfig creates a TLS configuration for NATS connections.
func (p *Processor) buildNATSTLSConfig() (*tls.Config, error) {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	// Load client certificate if provided
	if p.config.NATSTLSCertFile != "" && p.config.NATSTLSKeyFile != "" {
		cert, err := tls.LoadX509KeyPair(p.config.NATSTLSCertFile, p.config.NATSTLSKeyFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load NATS client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
		klog.V(2).InfoS("Loaded NATS client certificate", "certFile", p.config.NATSTLSCertFile)
	}

	// Load CA certificate if provided
	if p.config.NATSTLSCAFile != "" {
		caCert, err := os.ReadFile(p.config.NATSTLSCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read NATS CA certificate: %w", err)
		}
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse NATS CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
		klog.V(2).InfoS("Loaded NATS CA certificate", "caFile", p.config.NATSTLSCAFile)
	}

	return tlsConfig, nil
}

// setNATSHealthy updates the health status for a NATS connection.
func (p *Processor) setNATSHealthy(name string, healthy bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	switch name {
	case "input":
		p.natsInputHealthy = healthy
	case "output":
		p.natsOutputHealthy = healthy
	}
}

// initiateGracefulShutdown signals the processor to shut down gracefully.
// Safe to call multiple times.
func (p *Processor) initiateGracefulShutdown() {
	p.shutdownOnce.Do(func() {
		klog.Info("Initiating graceful shutdown")
		close(p.shutdownChan)
	})
}

// ShutdownChan returns a channel that is closed when the processor should shut down.
func (p *Processor) ShutdownChan() <-chan struct{} {
	return p.shutdownChan
}

// drainConnections gracefully drains NATS connections with a timeout.
func (p *Processor) drainConnections() error {
	klog.Info("Draining NATS connections")

	var drainErr error

	// Drain input connection
	if p.inputConn != nil && !p.inputConn.IsClosed() {
		done := make(chan struct{})
		go func() {
			if err := p.inputConn.Drain(); err != nil {
				klog.ErrorS(err, "Failed to drain NATS input connection, forcing close")
				p.inputConn.Close()
				drainErr = err
			}
			close(done)
		}()

		select {
		case <-done:
			klog.Info("NATS input connection drained successfully")
		case <-time.After(drainTimeout):
			klog.Warning("NATS input drain timed out, forcing close")
			p.inputConn.Close()
		}
	}

	// Drain output connection if different from input
	if p.outputConn != nil && p.outputConn != p.inputConn && !p.outputConn.IsClosed() {
		done := make(chan struct{})
		go func() {
			if err := p.outputConn.Drain(); err != nil {
				klog.ErrorS(err, "Failed to drain NATS output connection, forcing close")
				p.outputConn.Close()
				drainErr = err
			}
			close(done)
		}()

		select {
		case <-done:
			klog.Info("NATS output connection drained successfully")
		case <-time.After(drainTimeout):
			klog.Warning("NATS output drain timed out, forcing close")
			p.outputConn.Close()
		}
	}

	return drainErr
}

// New creates a new Activity Processor.
func New(config Config) (*Processor, error) {
	// Create processor struct first so we can use it for NATS callbacks
	p := &Processor{
		config:            config,
		shutdownChan:      make(chan struct{}),
		natsInputHealthy:  true, // Assume healthy until first disconnect
		natsOutputHealthy: true,
	}

	// Create lame duck handler that initiates graceful shutdown
	lameDuckHandler := func() {
		p.initiateGracefulShutdown()
	}

	// Connect to NATS for input (audit logs, events)
	inputConn, err := nats.Connect(config.NATSInputURL, p.natsConnectionOptions("input", lameDuckHandler)...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS input: %w", err)
	}
	p.inputConn = inputConn
	metrics.NATSConnectionStatus.WithLabelValues("input").Set(1)

	// Connect to NATS for output (activities) - may be the same connection
	var outputConn *nats.Conn
	if config.NATSOutputURL == "" || config.NATSOutputURL == config.NATSInputURL {
		outputConn = inputConn
	} else {
		outputConn, err = nats.Connect(config.NATSOutputURL, p.natsConnectionOptions("output", lameDuckHandler)...)
		if err != nil {
			if drainErr := inputConn.Drain(); drainErr != nil {
				klog.ErrorS(drainErr, "Failed to drain input connection during cleanup")
				inputConn.Close()
			}
			return nil, fmt.Errorf("failed to connect to NATS output: %w", err)
		}
		metrics.NATSConnectionStatus.WithLabelValues("output").Set(1)
	}
	p.outputConn = outputConn

	// Create JetStream context for publishing activities
	js, err := outputConn.JetStream()
	if err != nil {
		if drainErr := inputConn.Drain(); drainErr != nil {
			klog.ErrorS(drainErr, "Failed to drain input connection during cleanup")
			inputConn.Close()
		}
		if outputConn != inputConn {
			if drainErr := outputConn.Drain(); drainErr != nil {
				klog.ErrorS(drainErr, "Failed to drain output connection during cleanup")
				outputConn.Close()
			}
		}
		return nil, fmt.Errorf("failed to create JetStream context: %w", err)
	}

	// Create informer factory for watching ActivityPolicy
	resyncPeriod := time.Duration(config.ResyncPeriod) * time.Second
	informerFactory := dynamicinformer.NewDynamicSharedInformerFactory(config.DynamicClient, resyncPeriod)
	policyInformer := informerFactory.ForResource(ActivityPolicyGVR).Informer()

	// Create policy cache
	policyCache := controller.NewPolicyCache()

	// Create publisher using JetStream
	publisher := NewPublisher(js, config.NATSActivityPrefix)

	// Create audit processor
	auditProcessor := NewAuditProcessor(inputConn, config.NATSAuditSubject, policyCache, publisher, config.Workers, config.RESTMapper)

	// Update processor with remaining fields
	p.policyCache = policyCache
	p.informerFactory = informerFactory
	p.policyInformer = policyInformer
	p.auditProcessor = auditProcessor
	p.publisher = publisher

	// Set up event handlers for ActivityPolicy
	policyInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    p.onPolicyAdd,
		UpdateFunc: p.onPolicyUpdate,
		DeleteFunc: p.onPolicyDelete,
	})

	return p, nil
}

// Run starts the processor and blocks until the context is cancelled.
func (p *Processor) Run(ctx context.Context) error {
	klog.Info("Starting Activity Processor")

	// Start health server
	go p.runHealthServer(ctx)

	// Start informer factory
	p.informerFactory.Start(ctx.Done())

	// Wait for cache to sync
	klog.Info("Waiting for ActivityPolicy cache to sync")
	syncCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if !cache.WaitForCacheSync(syncCtx.Done(), p.policyInformer.HasSynced) {
		return fmt.Errorf("timed out waiting for ActivityPolicy cache to sync")
	}
	klog.Info("ActivityPolicy cache synced", "policies", p.policyCache.Len())

	// Mark as started and healthy
	p.mu.Lock()
	p.started = true
	p.healthy = true
	p.mu.Unlock()

	// Start the audit processor
	go func() {
		if err := p.auditProcessor.Run(ctx); err != nil {
			klog.ErrorS(err, "Audit processor error")
		}
	}()

	klog.Info("Activity Processor running")

	// Wait for shutdown - either from context or lame duck mode
	select {
	case <-ctx.Done():
		klog.Info("Shutting down Activity Processor (context cancelled)")
	case <-p.shutdownChan:
		klog.Info("Shutting down Activity Processor (lame duck mode)")
	}

	// Mark as unhealthy
	p.mu.Lock()
	p.healthy = false
	p.mu.Unlock()

	// Gracefully drain NATS connections
	return p.drainConnections()
}

// onPolicyAdd handles ActivityPolicy creation events.
func (p *Processor) onPolicyAdd(obj interface{}) {
	// Check if policy is Ready before caching
	if !isPolicyReady(obj) {
		klog.V(2).InfoS("Policy not ready, skipping cache update")
		return
	}

	policy, err := p.policyCache.ConvertToActivityPolicy(obj)
	if err != nil {
		klog.ErrorS(err, "Failed to convert added ActivityPolicy")
		return
	}

	key := policy.Namespace + "/" + policy.Name
	if policy.Namespace == "" {
		key = policy.Name
	}

	if err := p.policyCache.Update(key, policy); err != nil {
		klog.ErrorS(err, "Failed to add policy to cache", "policy", key)
		return
	}

	klog.V(2).InfoS("Added ActivityPolicy to cache",
		"policy", key,
		"resource", policy.Spec.Resource.APIGroup+"/"+policy.Spec.Resource.Kind,
	)
}

// onPolicyUpdate handles ActivityPolicy update events.
func (p *Processor) onPolicyUpdate(oldObj, newObj interface{}) {
	policy, err := p.policyCache.ConvertToActivityPolicy(newObj)
	if err != nil {
		klog.ErrorS(err, "Failed to convert updated ActivityPolicy")
		return
	}

	key := policy.Namespace + "/" + policy.Name
	if policy.Namespace == "" {
		key = policy.Name
	}

	// Check if policy is Ready - if not, remove from cache
	if !isPolicyReady(newObj) {
		klog.V(2).InfoS("Policy not ready, removing from cache", "policy", key)
		p.policyCache.Delete(key)
		return
	}

	if err := p.policyCache.Update(key, policy); err != nil {
		klog.ErrorS(err, "Failed to update policy in cache", "policy", key)
		return
	}

	klog.V(2).InfoS("Updated ActivityPolicy in cache",
		"policy", key,
		"resource", policy.Spec.Resource.APIGroup+"/"+policy.Spec.Resource.Kind,
	)
}

// onPolicyDelete handles ActivityPolicy deletion events.
func (p *Processor) onPolicyDelete(obj interface{}) {
	// Handle DeletedFinalStateUnknown
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}

	policy, err := p.policyCache.ConvertToActivityPolicy(obj)
	if err != nil {
		klog.ErrorS(err, "Failed to convert deleted ActivityPolicy")
		return
	}

	key := policy.Namespace + "/" + policy.Name
	if policy.Namespace == "" {
		key = policy.Name
	}

	p.policyCache.Delete(key)

	klog.V(2).InfoS("Deleted ActivityPolicy from cache",
		"policy", key,
		"resource", policy.Spec.Resource.APIGroup+"/"+policy.Spec.Resource.Kind,
	)
}

// natsHealthStatus represents the health status of NATS connections.
type natsHealthStatus struct {
	Input  connectionStatus `json:"input"`
	Output connectionStatus `json:"output,omitempty"`
}

type connectionStatus struct {
	Connected bool   `json:"connected"`
	URL       string `json:"url,omitempty"`
}

// runHealthServer runs the health and readiness probe server.
func (p *Processor) runHealthServer(ctx context.Context) {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		p.mu.RLock()
		healthy := p.healthy
		p.mu.RUnlock()

		// Also check actual NATS connection status
		inputConnected := p.inputConn != nil && p.inputConn.IsConnected()
		outputConnected := p.outputConn == nil || p.outputConn == p.inputConn || p.outputConn.IsConnected()

		if healthy && inputConnected && outputConnected {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("not healthy"))
		}
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		p.mu.RLock()
		started := p.started
		p.mu.RUnlock()

		// Also check actual NATS connection status
		inputConnected := p.inputConn != nil && p.inputConn.IsConnected()
		outputConnected := p.outputConn == nil || p.outputConn == p.inputConn || p.outputConn.IsConnected()

		if started && inputConnected && outputConnected {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("not ready"))
		}
	})

	// Detailed NATS health endpoint
	mux.HandleFunc("/healthz/nats", func(w http.ResponseWriter, r *http.Request) {
		status := natsHealthStatus{
			Input: connectionStatus{
				Connected: p.inputConn != nil && p.inputConn.IsConnected(),
			},
		}
		if p.inputConn != nil && p.inputConn.IsConnected() {
			status.Input.URL = p.inputConn.ConnectedUrl()
		}

		// Only include output if it's a separate connection
		if p.outputConn != nil && p.outputConn != p.inputConn {
			status.Output = connectionStatus{
				Connected: p.outputConn.IsConnected(),
			}
			if p.outputConn.IsConnected() {
				status.Output.URL = p.outputConn.ConnectedUrl()
			}
		}

		w.Header().Set("Content-Type", "application/json")
		if status.Input.Connected && (p.outputConn == p.inputConn || status.Output.Connected) {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(status)
	})

	server := &http.Server{
		Addr:    p.config.HealthProbeAddr,
		Handler: mux,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	klog.Infof("Starting health probe server on %s", p.config.HealthProbeAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		klog.ErrorS(err, "Health probe server error")
	}
}

// isPolicyReady checks if a policy has the Ready=True condition set in its status.
// Only policies that have been validated by the controller-manager should be used.
func isPolicyReady(obj interface{}) bool {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return false
	}

	conditions, found, err := unstructured.NestedSlice(u.Object, "status", "conditions")
	if err != nil || !found {
		return false
	}

	for _, c := range conditions {
		cond, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		condType, _, _ := unstructured.NestedString(cond, "type")
		condStatus, _, _ := unstructured.NestedString(cond, "status")
		if condType == "Ready" && condStatus == "True" {
			return true
		}
	}

	return false
}
