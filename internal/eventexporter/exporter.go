// Package eventexporter implements a Kubernetes Event exporter that watches for Events
// and publishes them to NATS JetStream for ingestion into ClickHouse.
//
// This exporter ensures format consistency by using the same corev1.Event types
// for both serialization and deserialization throughout the pipeline.
package eventexporter

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
)

// Config holds the exporter configuration.
type Config struct {
	// NATS connection URL
	NATSUrl string

	// NATS subject prefix for events (subject will be {prefix}.{namespace})
	SubjectPrefix string

	// Scope annotations to inject for multi-tenant isolation
	ScopeType string
	ScopeName string

	// Kubeconfig path (empty for in-cluster)
	Kubeconfig string

	// Resync period for the informer
	ResyncPeriod time.Duration
}

// Run starts the event exporter and blocks until the context is cancelled.
func Run(ctx context.Context, cfg Config) error {
	klog.InfoS("Starting k8s-event-exporter",
		"natsUrl", cfg.NATSUrl,
		"subjectPrefix", cfg.SubjectPrefix,
		"scopeType", cfg.ScopeType,
		"scopeName", cfg.ScopeName,
	)

	// Create Kubernetes client
	k8sClient, err := createK8sClient(cfg.Kubeconfig)
	if err != nil {
		return fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	// Connect to NATS
	nc, err := nats.Connect(cfg.NATSUrl,
		nats.Name("k8s-event-exporter"),
		nats.ReconnectWait(2*time.Second),
		nats.MaxReconnects(-1), // Unlimited reconnects
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			klog.ErrorS(err, "NATS disconnected")
		}),
		nats.ReconnectHandler(func(_ *nats.Conn) {
			klog.InfoS("NATS reconnected")
		}),
	)
	if err != nil {
		return fmt.Errorf("failed to connect to NATS: %w", err)
	}
	defer nc.Close()

	// Get JetStream context
	js, err := nc.JetStream()
	if err != nil {
		return fmt.Errorf("failed to get JetStream context: %w", err)
	}

	klog.InfoS("Connected to NATS", "url", cfg.NATSUrl)

	// Create the event exporter
	exporter := &Exporter{
		js:            js,
		subjectPrefix: cfg.SubjectPrefix,
		scopeType:     cfg.ScopeType,
		scopeName:     cfg.ScopeName,
	}

	// Create informer factory for all namespaces
	factory := informers.NewSharedInformerFactory(k8sClient, cfg.ResyncPeriod)
	eventInformer := factory.Core().V1().Events().Informer()

	// Register event handlers
	eventInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			event, ok := obj.(*corev1.Event)
			if !ok {
				return
			}
			if err := exporter.publishEvent(ctx, event, "ADDED"); err != nil {
				klog.ErrorS(err, "Failed to publish event",
					"namespace", event.Namespace,
					"name", event.Name,
				)
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			event, ok := newObj.(*corev1.Event)
			if !ok {
				return
			}
			if err := exporter.publishEvent(ctx, event, "MODIFIED"); err != nil {
				klog.ErrorS(err, "Failed to publish event",
					"namespace", event.Namespace,
					"name", event.Name,
				)
			}
		},
		// We don't need to handle deletes - events are ephemeral and TTL'd
	})

	// Start the informer
	factory.Start(ctx.Done())

	// Wait for cache sync
	klog.InfoS("Waiting for informer cache to sync")
	if !cache.WaitForCacheSync(ctx.Done(), eventInformer.HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}
	klog.InfoS("Informer cache synced, watching for events")

	// Wait for shutdown
	<-ctx.Done()
	klog.InfoS("Shutting down")
	return nil
}

// Exporter handles publishing Kubernetes events to NATS.
type Exporter struct {
	js            nats.JetStreamContext
	subjectPrefix string
	scopeType     string
	scopeName     string
}

// publishEvent publishes a Kubernetes event to NATS JetStream.
func (e *Exporter) publishEvent(ctx context.Context, event *corev1.Event, eventType string) error {
	// Create a copy to avoid modifying the cached object
	eventCopy := event.DeepCopy()

	// Inject scope annotations
	if eventCopy.Annotations == nil {
		eventCopy.Annotations = make(map[string]string)
	}
	eventCopy.Annotations["platform.miloapis.com/scope.type"] = e.scopeType
	eventCopy.Annotations["platform.miloapis.com/scope.name"] = e.scopeName

	// Ensure TypeMeta is set (informer objects don't have it populated)
	eventCopy.TypeMeta = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Event",
	}

	// Serialize to JSON
	data, err := json.Marshal(eventCopy)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Build subject: events.k8s.{namespace}
	subject := fmt.Sprintf("%s.%s", e.subjectPrefix, event.Namespace)

	// Publish with message ID for deduplication
	msgID := string(event.UID)
	if eventType == "MODIFIED" {
		// For updates, include resource version to allow updates through
		msgID = fmt.Sprintf("%s-%s", event.UID, event.ResourceVersion)
	}

	_, err = e.js.Publish(subject, data,
		nats.MsgId(msgID),
		nats.Context(ctx),
	)
	if err != nil {
		return fmt.Errorf("failed to publish to NATS: %w", err)
	}

	klog.V(4).InfoS("Published event",
		"namespace", event.Namespace,
		"name", event.Name,
		"reason", event.Reason,
		"type", eventType,
		"subject", subject,
	)

	return nil
}

// createK8sClient creates a Kubernetes client.
func createK8sClient(kubeconfig string) (*kubernetes.Clientset, error) {
	var config *rest.Config
	var err error

	if kubeconfig != "" {
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	} else {
		config, err = rest.InClusterConfig()
	}
	if err != nil {
		return nil, fmt.Errorf("failed to build config: %w", err)
	}

	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	return client, nil
}
