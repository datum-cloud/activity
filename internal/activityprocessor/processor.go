package activityprocessor

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	toolscache "k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/metrics"

	"go.miloapis.com/activity/internal/controller"
	"go.miloapis.com/activity/internal/processor"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

var (
	eventsReceived = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_processor",
			Name:      "events_received_total",
			Help:      "Total number of audit events received from NATS",
		},
		[]string{"api_group", "resource"},
	)

	eventsEvaluated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_processor",
			Name:      "events_evaluated_total",
			Help:      "Total number of audit events evaluated against policies",
		},
		[]string{"policy", "api_group", "kind", "matched"},
	)

	eventsSkipped = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_processor",
			Name:      "events_skipped_total",
			Help:      "Total number of audit events skipped",
		},
		[]string{"reason"}, // "no_object_ref", "no_matching_policy"
	)

	eventsErrored = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_processor",
			Name:      "events_errored_total",
			Help:      "Total number of audit events that encountered errors",
		},
		[]string{"error_type"}, // "unmarshal", "publish", "evaluate"
	)

	activitiesGenerated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_processor",
			Name:      "activities_generated_total",
			Help:      "Total number of activities generated and published",
		},
		[]string{"policy", "api_group", "kind"},
	)

	eventProcessingDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "activity_processor",
			Name:      "event_processing_duration_seconds",
			Help:      "Time spent processing audit events per policy",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"policy"},
	)

	policyCount = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "activity_processor",
			Name:      "active_policies",
			Help:      "Number of active (Ready) policies being used",
		},
	)

	workerCount = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "activity_processor",
			Name:      "active_workers",
			Help:      "Number of active worker goroutines",
		},
	)
)

func init() {
	// Use controller-runtime's registry so metrics are exposed alongside controller metrics.
	metrics.Registry.MustRegister(
		eventsReceived,
		eventsEvaluated,
		eventsSkipped,
		eventsErrored,
		activitiesGenerated,
		eventProcessingDuration,
		policyCount,
		workerCount,
	)
}

// Config contains configuration for the activity processor.
type Config struct {
	// NATS configuration
	NATSURL        string
	NATSStreamName string // Source stream for audit events (e.g., "AUDIT_EVENTS")
	ConsumerName   string // Durable consumer name

	// Output NATS stream for generated activities
	OutputStreamName    string // Stream for publishing activities (e.g., "ACTIVITIES")
	OutputSubjectPrefix string // Subject prefix for activities (e.g., "activities")

	// Processing configuration
	Workers    int           // Number of concurrent workers
	BatchSize  int           // Messages to fetch per batch
	AckWait    time.Duration // Time before message redelivery
	MaxDeliver int           // Maximum redelivery attempts
}

// DefaultConfig returns configuration with default values.
func DefaultConfig() Config {
	return Config{
		NATSURL:             "nats://localhost:4222",
		NATSStreamName:      "AUDIT_EVENTS",
		ConsumerName:        "activity-processor@activity.miloapis.com",
		OutputStreamName:    "ACTIVITIES",
		OutputSubjectPrefix: "activities",
		Workers:             4,
		BatchSize:           100,
		AckWait:             30 * time.Second,
		MaxDeliver:          5,
	}
}

// Processor consumes audit events from NATS, evaluates ActivityPolicies,
// and publishes Activity resources to NATS for downstream consumption.
type Processor struct {
	config     Config
	restConfig *rest.Config

	nc *nats.Conn
	js nats.JetStreamContext

	cache cache.Cache

	// mapper converts Kind to Resource using API discovery. Requires explicit
	// Reset() on cache miss to discover newly registered CRDs.
	mapper meta.ResettableRESTMapper

	// policies indexes by apiGroup/resource (plural form) to match audit event format.
	policyMu sync.RWMutex
	policies map[string][]*v1alpha1.ActivityPolicy

	wg     sync.WaitGroup
	ctx    context.Context
	cancel context.CancelFunc
}

// New creates a new activity processor.
func New(config Config, restConfig *rest.Config) (*Processor, error) {
	ctx, cancel := context.WithCancel(context.Background())

	p := &Processor{
		config:     config,
		restConfig: restConfig,
		policies:   make(map[string][]*v1alpha1.ActivityPolicy),
		ctx:        ctx,
		cancel:     cancel,
	}

	return p, nil
}

// Start begins processing audit events.
func (p *Processor) Start(ctx context.Context) error {
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(p.restConfig)
	if err != nil {
		return fmt.Errorf("failed to create discovery client: %w", err)
	}
	cachedDiscoveryClient := memory.NewMemCacheClient(discoveryClient)
	p.mapper = restmapper.NewDeferredDiscoveryRESTMapper(cachedDiscoveryClient)

	c, err := cache.New(p.restConfig, cache.Options{
		Scheme: controller.Scheme,
	})
	if err != nil {
		return fmt.Errorf("failed to create cache: %w", err)
	}
	p.cache = c

	informer, err := p.cache.GetInformer(ctx, &v1alpha1.ActivityPolicy{})
	if err != nil {
		return fmt.Errorf("failed to get informer for ActivityPolicy: %w", err)
	}

	_, err = informer.AddEventHandler(toolscache.ResourceEventHandlerFuncs{
		AddFunc:    p.onPolicyAdd,
		UpdateFunc: p.onPolicyUpdate,
		DeleteFunc: p.onPolicyDelete,
	})
	if err != nil {
		return fmt.Errorf("failed to add event handler: %w", err)
	}

	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		if err := p.cache.Start(ctx); err != nil {
			klog.ErrorS(err, "Cache failed")
		}
	}()

	if !p.cache.WaitForCacheSync(ctx) {
		return fmt.Errorf("failed to sync cache")
	}

	klog.InfoS("ActivityPolicy cache synced")

	nc, err := nats.Connect(p.config.NATSURL,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			if err != nil {
				klog.ErrorS(err, "NATS disconnected")
			}
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			klog.InfoS("NATS reconnected", "url", nc.ConnectedUrl())
		}),
		nats.LameDuckModeHandler(func(nc *nats.Conn) {
			klog.InfoS("NATS server entering lame duck mode, will reconnect to another server")
		}),
	)
	if err != nil {
		return fmt.Errorf("failed to connect to NATS: %w", err)
	}
	p.nc = nc

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return fmt.Errorf("failed to create JetStream context: %w", err)
	}
	p.js = js

	// Streams and consumers are managed declaratively via NATS JetStream controller.
	// Fail fast if they don't exist rather than attempting to create them.
	_, err = js.ConsumerInfo(p.config.NATSStreamName, p.config.ConsumerName)
	if err != nil {
		nc.Close()
		return fmt.Errorf("consumer %q not found on stream %q (ensure NATS JetStream resources are deployed): %w",
			p.config.ConsumerName, p.config.NATSStreamName, err)
	}

	_, err = js.StreamInfo(p.config.OutputStreamName)
	if err != nil {
		nc.Close()
		return fmt.Errorf("output stream %q not found (ensure NATS JetStream resources are deployed): %w",
			p.config.OutputStreamName, err)
	}

	klog.InfoS("Activity processor starting",
		"stream", p.config.NATSStreamName,
		"consumer", p.config.ConsumerName,
		"outputStream", p.config.OutputStreamName,
		"workers", p.config.Workers,
	)

	workerErrors := make(chan error, p.config.Workers)
	for i := 0; i < p.config.Workers; i++ {
		p.wg.Add(1)
		go p.worker(ctx, i, workerErrors)
	}
	go p.monitorWorkers(ctx, workerErrors)

	return nil
}

// Stop gracefully shuts down the processor.
func (p *Processor) Stop() {
	klog.Info("Stopping activity processor")
	p.cancel()
	p.wg.Wait()

	if p.nc != nil {
		p.nc.Close()
	}
	klog.Info("Activity processor stopped")
}

// monitorWorkers monitors worker health and logs errors.
func (p *Processor) monitorWorkers(ctx context.Context, workerErrors <-chan error) {
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-workerErrors:
			if err != nil {
				klog.ErrorS(err, "Worker reported error")
			}
		}
	}
}

// kindToResource converts a Kind to its plural resource name using API discovery.
// On cache miss, it resets the discovery cache and retries to handle newly registered CRDs.
func (p *Processor) kindToResource(apiGroup, kind string) (string, error) {
	gk := schema.GroupKind{
		Group: apiGroup,
		Kind:  kind,
	}

	mapping, err := p.mapper.RESTMapping(gk)
	if err != nil {
		if meta.IsNoMatchError(err) {
			// Cache miss - reset and retry to discover newly registered CRDs.
			klog.V(2).InfoS("REST mapping not found, resetting discovery cache",
				"apiGroup", apiGroup,
				"kind", kind,
			)
			p.mapper.Reset()

			mapping, err = p.mapper.RESTMapping(gk)
			if err != nil {
				return "", fmt.Errorf("failed to find resource mapping for %s/%s: %w", apiGroup, kind, err)
			}
		} else {
			return "", fmt.Errorf("failed to find resource mapping for %s/%s: %w", apiGroup, kind, err)
		}
	}

	return mapping.Resource.Resource, nil
}

func (p *Processor) onPolicyAdd(obj interface{}) {
	policy, ok := obj.(*v1alpha1.ActivityPolicy)
	if !ok {
		klog.Error("Failed to cast object to ActivityPolicy in add handler")
		return
	}

	if !isPolicyReady(policy) {
		klog.V(2).InfoS("Skipping policy that is not ready",
			"policy", policy.Name,
		)
		return
	}

	// Convert Kind to resource (plural) to match audit event ObjectRef format.
	resource, err := p.kindToResource(policy.Spec.Resource.APIGroup, policy.Spec.Resource.Kind)
	if err != nil {
		klog.ErrorS(err, "Failed to resolve resource for policy, skipping",
			"policy", policy.Name,
			"apiGroup", policy.Spec.Resource.APIGroup,
			"kind", policy.Spec.Resource.Kind,
		)
		return
	}

	p.policyMu.Lock()
	defer p.policyMu.Unlock()

	key := policyKey(policy.Spec.Resource.APIGroup, resource)
	p.policies[key] = append(p.policies[key], policy.DeepCopy())
	p.updatePolicyCountMetric()

	klog.InfoS("Added ActivityPolicy",
		"policy", policy.Name,
		"kind", policy.Spec.Resource.Kind,
		"resource", resource,
	)
}

func (p *Processor) onPolicyUpdate(oldObj, newObj interface{}) {
	oldPolicy, ok := oldObj.(*v1alpha1.ActivityPolicy)
	if !ok {
		klog.Error("Failed to cast old object to ActivityPolicy in update handler")
		return
	}
	newPolicy, ok := newObj.(*v1alpha1.ActivityPolicy)
	if !ok {
		klog.Error("Failed to cast new object to ActivityPolicy in update handler")
		return
	}

	wasReady := isPolicyReady(oldPolicy)
	isReady := isPolicyReady(newPolicy)

	oldResource, oldErr := p.kindToResource(oldPolicy.Spec.Resource.APIGroup, oldPolicy.Spec.Resource.Kind)
	newResource, newErr := p.kindToResource(newPolicy.Spec.Resource.APIGroup, newPolicy.Spec.Resource.Kind)

	if oldErr != nil && wasReady {
		klog.ErrorS(oldErr, "Failed to resolve old resource for policy update",
			"policy", oldPolicy.Name,
			"apiGroup", oldPolicy.Spec.Resource.APIGroup,
			"kind", oldPolicy.Spec.Resource.Kind,
		)
	}
	if newErr != nil && isReady {
		klog.ErrorS(newErr, "Failed to resolve new resource for policy update",
			"policy", newPolicy.Name,
			"apiGroup", newPolicy.Spec.Resource.APIGroup,
			"kind", newPolicy.Spec.Resource.Kind,
		)
		return
	}

	p.policyMu.Lock()
	defer p.policyMu.Unlock()

	oldKey := policyKey(oldPolicy.Spec.Resource.APIGroup, oldResource)
	newKey := policyKey(newPolicy.Spec.Resource.APIGroup, newResource)

	if wasReady {
		p.removePolicyLocked(oldKey, oldPolicy.Name)
	}

	if isReady {
		p.policies[newKey] = append(p.policies[newKey], newPolicy.DeepCopy())
		klog.InfoS("Updated ActivityPolicy",
			"policy", newPolicy.Name,
			"resource", newKey,
			"wasReady", wasReady,
			"isReady", isReady,
		)
	} else if wasReady {
		klog.InfoS("ActivityPolicy no longer ready, removed from processing",
			"policy", newPolicy.Name,
		)
	}

	p.updatePolicyCountMetric()
}

func (p *Processor) onPolicyDelete(obj interface{}) {
	policy, ok := obj.(*v1alpha1.ActivityPolicy)
	if !ok {
		// Informer may pass a tombstone when the object was deleted while disconnected.
		tombstone, ok := obj.(toolscache.DeletedFinalStateUnknown)
		if !ok {
			klog.Error("Failed to cast object in delete handler")
			return
		}
		policy, ok = tombstone.Obj.(*v1alpha1.ActivityPolicy)
		if !ok {
			klog.Error("Failed to cast tombstone object to ActivityPolicy")
			return
		}
	}

	resource, err := p.kindToResource(policy.Spec.Resource.APIGroup, policy.Spec.Resource.Kind)
	if err != nil {
		klog.ErrorS(err, "Failed to resolve resource for policy delete",
			"policy", policy.Name,
			"apiGroup", policy.Spec.Resource.APIGroup,
			"kind", policy.Spec.Resource.Kind,
		)
		return
	}

	p.policyMu.Lock()
	defer p.policyMu.Unlock()

	key := policyKey(policy.Spec.Resource.APIGroup, resource)
	p.removePolicyLocked(key, policy.Name)
	p.updatePolicyCountMetric()

	klog.InfoS("Deleted ActivityPolicy",
		"policy", policy.Name,
		"resource", key,
	)
}

// removePolicyLocked removes a policy from the cache. Caller must hold policyMu.
func (p *Processor) removePolicyLocked(key, name string) {
	policies := p.policies[key]
	for i, pol := range policies {
		if pol.Name == name {
			// O(1) removal: swap with last element and truncate.
			policies[i] = policies[len(policies)-1]
			p.policies[key] = policies[:len(policies)-1]
			break
		}
	}
	if len(p.policies[key]) == 0 {
		delete(p.policies, key)
	}
}

// updatePolicyCountMetric updates the active policies gauge. Caller must hold policyMu.
func (p *Processor) updatePolicyCountMetric() {
	var count int
	for _, policies := range p.policies {
		count += len(policies)
	}
	policyCount.Set(float64(count))
}

func (p *Processor) worker(ctx context.Context, id int, errors chan<- error) {
	defer p.wg.Done()
	defer workerCount.Dec()

	workerCount.Inc()

	sub, err := p.js.PullSubscribe(
		"audit.k8s.>",
		p.config.ConsumerName,
		nats.Bind(p.config.NATSStreamName, p.config.ConsumerName),
	)
	if err != nil {
		klog.ErrorS(err, "Failed to create pull subscription", "worker", id)
		errors <- fmt.Errorf("worker %d: failed to create subscription: %w", id, err)
		return
	}
	defer sub.Unsubscribe()

	klog.V(2).InfoS("Worker started", "worker", id)

	for {
		select {
		case <-ctx.Done():
			klog.V(2).InfoS("Worker stopping", "worker", id)
			return
		default:
		}

		msgs, err := sub.Fetch(p.config.BatchSize, nats.MaxWait(5*time.Second))
		if err != nil {
			if err == nats.ErrTimeout {
				continue
			}
			klog.ErrorS(err, "Failed to fetch messages", "worker", id)
			continue
		}

		for _, msg := range msgs {
			if err := p.processMessage(msg); err != nil {
				klog.ErrorS(err, "Failed to process message", "worker", id)
				msg.Nak()
				continue
			}
			msg.Ack()
		}
	}
}

func (p *Processor) processMessage(msg *nats.Msg) error {
	var audit auditv1.Event
	if err := json.Unmarshal(msg.Data, &audit); err != nil {
		eventsErrored.WithLabelValues("unmarshal").Inc()
		return fmt.Errorf("failed to unmarshal audit event: %w", err)
	}

	if audit.ObjectRef == nil {
		eventsSkipped.WithLabelValues("no_object_ref").Inc()
		return nil
	}

	apiGroup := audit.ObjectRef.APIGroup
	if apiGroup == "" {
		apiGroup = "core"
	}
	eventsReceived.WithLabelValues(apiGroup, audit.ObjectRef.Resource).Inc()

	policies := p.getPolicies(audit.ObjectRef.APIGroup, audit.ObjectRef.Resource)
	if len(policies) == 0 {
		eventsSkipped.WithLabelValues("no_matching_policy").Inc()
		return nil
	}

	// First matching policy wins.
	for _, policy := range policies {
		policyStart := time.Now()
		result, err := processor.EvaluateAuditRules(&policy.Spec, &audit)
		if err != nil {
			klog.ErrorS(err, "Failed to evaluate policy",
				"policy", policy.Name,
				"auditID", audit.AuditID,
			)
			eventsErrored.WithLabelValues("evaluate").Inc()
			eventsEvaluated.WithLabelValues(
				policy.Name,
				policy.Spec.Resource.APIGroup,
				policy.Spec.Resource.Kind,
				"error",
			).Inc()
			eventProcessingDuration.WithLabelValues(policy.Name).Observe(time.Since(policyStart).Seconds())
			continue
		}

		ruleMatched := result.Activity != nil
		eventsEvaluated.WithLabelValues(
			policy.Name,
			policy.Spec.Resource.APIGroup,
			policy.Spec.Resource.Kind,
			fmt.Sprintf("%t", ruleMatched),
		).Inc()

		if !ruleMatched {
			eventProcessingDuration.WithLabelValues(policy.Name).Observe(time.Since(policyStart).Seconds())
			continue
		}

		if err := p.publishActivity(result.Activity, policy); err != nil {
			eventsErrored.WithLabelValues("publish").Inc()
			eventProcessingDuration.WithLabelValues(policy.Name).Observe(time.Since(policyStart).Seconds())
			return fmt.Errorf("failed to publish activity: %w", err)
		}

		klog.V(4).InfoS("Generated activity",
			"activity", result.Activity.Name,
			"policy", policy.Name,
			"ruleIndex", result.MatchedRuleIndex,
			"auditID", audit.AuditID,
		)

		eventProcessingDuration.WithLabelValues(policy.Name).Observe(time.Since(policyStart).Seconds())
		return nil
	}

	return nil
}

func (p *Processor) getPolicies(apiGroup, resource string) []*v1alpha1.ActivityPolicy {
	p.policyMu.RLock()
	defer p.policyMu.RUnlock()

	key := policyKey(apiGroup, resource)
	return p.policies[key]
}

func (p *Processor) publishActivity(activity *v1alpha1.Activity, policy *v1alpha1.ActivityPolicy) error {
	data, err := json.Marshal(activity)
	if err != nil {
		return fmt.Errorf("failed to marshal activity: %w", err)
	}

	subject := p.buildActivitySubject(activity)

	// Activity name is unique per audit event, enabling NATS deduplication.
	_, err = p.js.Publish(subject, data, nats.MsgId(activity.Name))
	if err != nil {
		return fmt.Errorf("failed to publish to NATS: %w", err)
	}

	activitiesGenerated.WithLabelValues(
		policy.Name,
		policy.Spec.Resource.APIGroup,
		policy.Spec.Resource.Kind,
	).Inc()
	return nil
}

// buildActivitySubject returns the NATS subject for routing activities.
// Format: <prefix>.<tenant_type>.<tenant_name>.<api_group>.<origin>.<kind>.<namespace>.<name>
func (p *Processor) buildActivitySubject(activity *v1alpha1.Activity) string {
	prefix := p.config.OutputSubjectPrefix

	tenantType := activity.Spec.Tenant.Type
	if tenantType == "" {
		tenantType = "platform"
	}
	tenantName := activity.Spec.Tenant.Name
	if tenantName == "" {
		tenantName = "_"
	}

	apiGroup := activity.Spec.Resource.APIGroup
	if apiGroup == "" {
		apiGroup = "core"
	}

	origin := activity.Spec.Origin.Type
	kind := activity.Spec.Resource.Kind
	namespace := activity.Spec.Resource.Namespace
	if namespace == "" {
		namespace = "_"
	}
	name := activity.Name

	return fmt.Sprintf("%s.%s.%s.%s.%s.%s.%s.%s",
		prefix, tenantType, tenantName, apiGroup, origin, kind, namespace, name)
}

func policyKey(apiGroup, kindOrResource string) string {
	return fmt.Sprintf("%s/%s", apiGroup, kindOrResource)
}

func isPolicyReady(policy *v1alpha1.ActivityPolicy) bool {
	return meta.IsStatusConditionTrue(policy.Status.Conditions, "Ready")
}
