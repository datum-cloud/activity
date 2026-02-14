package processor

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// AuditProcessor processes audit log events from a NATS JetStream pull consumer
// and generates Activity records via ActivityPolicy audit rules.
type AuditProcessor struct {
	js             nats.JetStreamContext
	streamName     string
	consumerName   string
	activityPrefix string
	batchSize      int
	policyLookup   AuditPolicyLookup
	workers        int
}

// NewAuditProcessor creates a new audit log processor.
// js is the JetStream context used for both consuming audit events and publishing activities.
// streamName is the NATS stream to consume from (e.g., "AUDIT_EVENTS").
// consumerName is the durable pull consumer name.
// activityPrefix is the subject prefix for publishing generated activities.
// policyLookup is used to evaluate audit events against ActivityPolicy audit rules.
func NewAuditProcessor(
	js nats.JetStreamContext,
	streamName string,
	consumerName string,
	activityPrefix string,
	policyLookup AuditPolicyLookup,
	workers int,
	batchSize int,
) *AuditProcessor {
	return &AuditProcessor{
		js:             js,
		streamName:     streamName,
		consumerName:   consumerName,
		activityPrefix: activityPrefix,
		policyLookup:   policyLookup,
		workers:        workers,
		batchSize:      batchSize,
	}
}

// Run starts the audit processor workers and blocks until ctx is cancelled.
func (p *AuditProcessor) Run(ctx context.Context) error {
	klog.InfoS("Starting audit processor",
		"stream", p.streamName,
		"consumer", p.consumerName,
		"workers", p.workers,
	)

	var wg sync.WaitGroup
	for i := 0; i < p.workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			p.worker(ctx, workerID)
		}(i)
	}

	klog.InfoS("Audit processor running", "workers", p.workers)

	<-ctx.Done()
	wg.Wait()

	klog.Info("Audit processor stopped")
	return nil
}

// worker consumes audit messages from the JetStream pull consumer and processes them.
// Messages are explicitly Acked on success and Naked on failure so that failed
// messages are redelivered (up to MaxDeliver on the consumer config).
func (p *AuditProcessor) worker(ctx context.Context, id int) {
	klog.V(4).InfoS("Audit worker started", "worker", id)

	sub, err := p.js.PullSubscribe(
		"audit.k8s.>",
		p.consumerName,
		nats.Bind(p.streamName, p.consumerName),
	)
	if err != nil {
		klog.ErrorS(err, "Failed to create pull subscription for audit events", "worker", id)
		return
	}
	defer sub.Unsubscribe()

	for {
		select {
		case <-ctx.Done():
			klog.V(4).InfoS("Audit worker stopping", "worker", id)
			return
		default:
		}

		msgs, err := sub.Fetch(p.batchSize, nats.MaxWait(5*time.Second))
		if err != nil {
			if err == nats.ErrTimeout {
				continue
			}
			klog.ErrorS(err, "Failed to fetch audit messages", "worker", id)
			continue
		}

		for _, msg := range msgs {
			if err := p.processMessage(ctx, msg); err != nil {
				klog.ErrorS(err, "Failed to process audit message", "worker", id)
				msg.Nak()
				continue
			}
			msg.Ack()
		}
	}
}

// processMessage processes a single audit log message.
func (p *AuditProcessor) processMessage(ctx context.Context, msg *nats.Msg) error {
	var auditMap map[string]interface{}
	if err := json.Unmarshal(msg.Data, &auditMap); err != nil {
		return fmt.Errorf("failed to unmarshal audit event: %w", err)
	}

	// Extract objectRef to find matching policy.
	objectRef, _ := auditMap["objectRef"].(map[string]interface{})
	if objectRef == nil {
		return nil
	}

	apiGroup, _ := objectRef["apiGroup"].(string)
	resource, _ := objectRef["resource"].(string)
	if resource == "" {
		return nil
	}

	// Delegate policy matching to the lookup (avoids import cycle with activityprocessor).
	matched, err := p.policyLookup.MatchAudit(apiGroup, resource, auditMap)
	if err != nil {
		return fmt.Errorf("failed to match audit event against policies: %w", err)
	}

	if matched == nil {
		return nil
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)
	if err := p.publishActivity(ctx, activity); err != nil {
		return fmt.Errorf("failed to publish audit activity: %w", err)
	}

	klog.V(3).InfoS("Generated activity from audit event",
		"activity", activity.Name,
		"policy", matched.PolicyName,
	)

	return nil
}

// buildAuditActivity constructs an Activity from an audit event map.
func (p *AuditProcessor) buildAuditActivity(
	auditMap map[string]interface{},
	objectRef map[string]interface{},
	matched *MatchedPolicy,
) *v1alpha1.Activity {
	namespace, _ := objectRef["namespace"].(string)
	resourceName, _ := objectRef["name"].(string)
	apiVersion, _ := objectRef["apiVersion"].(string)

	// Extract user info for actor classification.
	username := ""
	userUID := ""
	if user, ok := auditMap["user"].(map[string]interface{}); ok {
		username, _ = user["username"].(string)
		userUID, _ = user["uid"].(string)
	}

	changeSource := ChangeSourceSystem
	actorType := ActorTypeSystem
	actorName := username
	if username != "" && len(username) >= 7 && username[:7] != "system:" {
		changeSource = ChangeSourceHuman
		actorType = ActorTypeUser
	}
	if actorName == "" {
		actorName = "unknown"
	}

	// Use auditID for unique activity name when available.
	activityName := fmt.Sprintf("act-%s", uuid.New().String()[:8])
	if auditID, ok := auditMap["auditID"].(string); ok && len(auditID) >= 8 {
		activityName = fmt.Sprintf("act-%s", auditID[:8])
	}

	auditID, _ := auditMap["auditID"].(string)

	// Extract timestamp from audit event.
	// Use requestReceivedTimestamp which is always present in Kubernetes audit events.
	timestamp := extractTimestamp(auditMap, "requestReceivedTimestamp")
	if timestamp.IsZero() {
		// Fall back to stageTimestamp.
		timestamp = extractTimestamp(auditMap, "stageTimestamp")
	}
	if timestamp.IsZero() {
		klog.ErrorS(nil, "No valid timestamp found in audit event",
			"requestReceivedTimestamp", auditMap["requestReceivedTimestamp"],
			"stageTimestamp", auditMap["stageTimestamp"])
	}

	// Convert links from the matched policy into ActivityLink records.
	var activityLinks []v1alpha1.ActivityLink
	for _, link := range matched.Links {
		activityLinks = append(activityLinks, v1alpha1.ActivityLink{
			Marker: link.Marker,
			Resource: v1alpha1.ActivityResource{
				APIGroup:  getStringFromMap(link.Resource, "apiGroup"),
				Kind:      getStringFromMap(link.Resource, "kind"),
				Name:      getStringFromMap(link.Resource, "name"),
				Namespace: getStringFromMap(link.Resource, "namespace"),
				UID:       getStringFromMap(link.Resource, "uid"),
			},
		})
	}

	return &v1alpha1.Activity{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v1alpha1.SchemeGroupVersion.String(),
			Kind:       "Activity",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              activityName,
			Namespace:         namespace,
			CreationTimestamp: metav1.NewTime(timestamp),
		},
		Spec: v1alpha1.ActivitySpec{
			Summary:      matched.Summary,
			ChangeSource: changeSource,
			Actor: v1alpha1.ActivityActor{
				Type: actorType,
				Name: actorName,
				UID:  userUID,
			},
			Resource: v1alpha1.ActivityResource{
				APIGroup:   matched.APIGroup,
				APIVersion: apiVersion,
				Kind:       matched.Kind,
				Name:       resourceName,
				Namespace:  namespace,
			},
			Links:  activityLinks,
			Tenant: v1alpha1.ActivityTenant{Type: "platform"},
			Origin: v1alpha1.ActivityOrigin{
				Type: "audit",
				ID:   auditID,
			},
		},
	}
}

// publishActivity serializes and publishes an Activity to the NATS ACTIVITIES stream.
func (p *AuditProcessor) publishActivity(ctx context.Context, activity *v1alpha1.Activity) error {
	data, err := json.Marshal(activity)
	if err != nil {
		return fmt.Errorf("failed to marshal activity: %w", err)
	}

	subject := p.buildAuditActivitySubject(activity)

	// Use activity name as MsgID for NATS deduplication.
	_, err = p.js.Publish(subject, data, nats.MsgId(activity.Name))
	if err != nil {
		return fmt.Errorf("failed to publish activity to NATS: %w", err)
	}

	return nil
}

// extractTimestamp extracts and parses a timestamp field from an audit map.
// Handles both string timestamps (from JSON) and time.Time values.
func extractTimestamp(m map[string]interface{}, field string) time.Time {
	val, ok := m[field]
	if !ok || val == nil {
		return time.Time{}
	}

	// Handle string timestamp (most common from JSON deserialization).
	if ts, ok := val.(string); ok && ts != "" {
		// Try RFC3339Nano first (most precise).
		if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
			return t
		}
		// Fall back to RFC3339.
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			return t
		}
	}

	// Handle time.Time directly (if already parsed).
	if t, ok := val.(time.Time); ok {
		return t
	}

	return time.Time{}
}

// buildAuditActivitySubject returns the NATS subject for routing audit-derived activities.
func (p *AuditProcessor) buildAuditActivitySubject(activity *v1alpha1.Activity) string {
	prefix := p.activityPrefix

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
