package processor

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/internal/controller"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// AuditProcessor processes audit log events from NATS and generates activities.
type AuditProcessor struct {
	conn        *nats.Conn
	subject     string
	policyCache *controller.PolicyCache
	publisher   *Publisher
	workers     int
	restMapper  meta.RESTMapper

	// Work channel for distributing messages to workers
	workChan chan *nats.Msg
}

// NewAuditProcessor creates a new audit processor.
func NewAuditProcessor(
	conn *nats.Conn,
	subject string,
	policyCache *controller.PolicyCache,
	publisher *Publisher,
	workers int,
	restMapper meta.RESTMapper,
) *AuditProcessor {
	return &AuditProcessor{
		conn:        conn,
		subject:     subject,
		policyCache: policyCache,
		publisher:   publisher,
		workers:     workers,
		restMapper:  restMapper,
		workChan:    make(chan *nats.Msg, workers*10),
	}
}

// Run starts the audit processor.
func (p *AuditProcessor) Run(ctx context.Context) error {
	klog.InfoS("Starting audit processor", "subject", p.subject, "workers", p.workers)

	// Subscribe to audit events
	sub, err := p.conn.Subscribe(p.subject, func(msg *nats.Msg) {
		select {
		case p.workChan <- msg:
		default:
			klog.Warning("Audit processor work channel full, dropping message")
		}
	})
	if err != nil {
		return fmt.Errorf("failed to subscribe to audit events: %w", err)
	}
	defer sub.Unsubscribe()

	// Start workers
	var wg sync.WaitGroup
	for i := 0; i < p.workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			p.worker(ctx, workerID)
		}(i)
	}

	klog.InfoS("Audit processor running", "workers", p.workers)

	// Wait for context cancellation
	<-ctx.Done()

	// Close work channel to signal workers to stop
	close(p.workChan)

	// Wait for workers to finish
	wg.Wait()

	klog.Info("Audit processor stopped")
	return nil
}

// worker processes audit messages from the work channel.
func (p *AuditProcessor) worker(ctx context.Context, id int) {
	klog.V(4).InfoS("Audit worker started", "worker", id)

	for msg := range p.workChan {
		if err := p.processMessage(ctx, msg); err != nil {
			klog.ErrorS(err, "Failed to process audit message", "worker", id)
		}
	}

	klog.V(4).InfoS("Audit worker stopped", "worker", id)
}

// processMessage processes a single audit log message.
func (p *AuditProcessor) processMessage(ctx context.Context, msg *nats.Msg) error {
	// Parse the audit event
	var auditEvent map[string]interface{}
	if err := json.Unmarshal(msg.Data, &auditEvent); err != nil {
		return fmt.Errorf("failed to unmarshal audit event: %w", err)
	}

	// Extract resource info to find matching policy
	objectRef, ok := auditEvent["objectRef"].(map[string]interface{})
	if !ok {
		klog.V(4).Info("Audit event has no objectRef, skipping")
		return nil
	}

	apiGroup := getStringFromMap(objectRef, "apiGroup")
	resource := getStringFromMap(objectRef, "resource")

	// The "resource" field in objectRef is the plural form (e.g., "httpproxies")
	// We need to map it to Kind for policy lookup
	// First try the responseObject's kind if available
	var kind string
	if responseObj, ok := auditEvent["responseObject"].(map[string]interface{}); ok {
		kind = getStringFromMap(responseObj, "kind")
	}
	if kind == "" {
		// Also try requestObject's kind
		if requestObj, ok := auditEvent["requestObject"].(map[string]interface{}); ok {
			kind = getStringFromMap(requestObj, "kind")
		}
	}
	if kind == "" {
		// Use RESTMapper to resolve resource to kind via API discovery
		kind = p.resolveKindFromResource(apiGroup, resource)
	}

	if kind == "" {
		klog.V(4).InfoS("Could not determine kind from audit event, skipping",
			"apiGroup", apiGroup, "resource", resource)
		return nil
	}

	// Look up policy for this resource
	policy, found := p.policyCache.GetByResource(apiGroup, kind)
	if !found {
		klog.V(4).InfoS("No policy found for resource, skipping",
			"apiGroup", apiGroup, "kind", kind)
		return nil
	}

	// Find matching rule and generate activity
	activity, err := p.generateActivity(auditEvent, policy)
	if err != nil {
		return fmt.Errorf("failed to generate activity: %w", err)
	}

	if activity == nil {
		klog.V(4).InfoS("No rule matched audit event", "policy", policy.Name)
		return nil
	}

	// Publish the activity
	if err := p.publisher.Publish(ctx, activity); err != nil {
		return fmt.Errorf("failed to publish activity: %w", err)
	}

	klog.V(3).InfoS("Generated activity from audit event",
		"activity", activity.Name,
		"summary", activity.Spec.Summary,
		"changeSource", activity.Spec.ChangeSource,
	)

	return nil
}

// generateActivity generates an Activity from an audit event using the policy rules.
func (p *AuditProcessor) generateActivity(auditEvent map[string]interface{}, policy *controller.CompiledPolicy) (*v1alpha1.Activity, error) {
	// Try each audit rule in order
	for i, rule := range policy.AuditRules {
		if !rule.Valid {
			klog.V(4).InfoS("Skipping invalid rule", "policy", policy.Name, "rule", i)
			continue
		}

		// Evaluate match expression
		matched, err := cel.EvaluateAuditMatch(rule.Match, auditEvent)
		if err != nil {
			klog.ErrorS(err, "Failed to evaluate match expression",
				"policy", policy.Name, "rule", i)
			continue
		}

		if !matched {
			continue
		}

		// Rule matched - generate summary
		summary, links, err := cel.EvaluateAuditSummary(rule.Summary, auditEvent)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate summary for rule %d: %w", i, err)
		}

		// Build the activity
		activity := p.buildActivity(auditEvent, policy, summary, links)
		return activity, nil
	}

	// No rule matched
	return nil, nil
}

// buildActivity constructs an Activity resource from audit event data.
func (p *AuditProcessor) buildActivity(
	auditEvent map[string]interface{},
	policy *controller.CompiledPolicy,
	summary string,
	links []cel.Link,
) *v1alpha1.Activity {
	objectRef := auditEvent["objectRef"].(map[string]interface{})
	user := auditEvent["user"].(map[string]interface{})

	// Extract timestamps
	var timestamp time.Time
	if ts, ok := auditEvent["requestReceivedTimestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
			timestamp = t
		}
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	// Extract resource info
	namespace := getStringFromMap(objectRef, "namespace")
	resourceName := getStringFromMap(objectRef, "name")
	resourceUID := ""
	apiVersion := getStringFromMap(objectRef, "apiVersion")

	// Try to get UID from responseObject
	if responseObj, ok := auditEvent["responseObject"].(map[string]interface{}); ok {
		if metadata, ok := responseObj["metadata"].(map[string]interface{}); ok {
			resourceUID = getStringFromMap(metadata, "uid")
		}
	}

	// Classify change source
	changeSource := ClassifyChangeSource(user)

	// Resolve actor
	actor := ResolveActor(user)

	// Extract tenant info (from user extra fields)
	tenant := extractTenant(user)

	// Generate activity name
	activityName := fmt.Sprintf("act-%s", uuid.New().String()[:8])

	// Convert links
	var activityLinks []v1alpha1.ActivityLink
	for _, link := range links {
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

	// Build the activity
	activity := &v1alpha1.Activity{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v1alpha1.SchemeGroupVersion.String(),
			Kind:       "Activity",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              activityName,
			Namespace:         namespace,
			CreationTimestamp: metav1.NewTime(timestamp),
			Labels: map[string]string{
				"activity.miloapis.com/origin-type":    "audit",
				"activity.miloapis.com/change-source":  changeSource,
				"activity.miloapis.com/api-group":      policy.APIGroup,
				"activity.miloapis.com/resource-kind":  policy.Kind,
			},
		},
		Spec: v1alpha1.ActivitySpec{
			Summary:      summary,
			ChangeSource: changeSource,
			Actor:        actor,
			Resource: v1alpha1.ActivityResource{
				APIGroup:   policy.APIGroup,
				APIVersion: apiVersion,
				Kind:       policy.Kind,
				Name:       resourceName,
				Namespace:  namespace,
				UID:        resourceUID,
			},
			Links:  activityLinks,
			Tenant: tenant,
			Origin: v1alpha1.ActivityOrigin{
				Type: "audit",
				ID:   getStringFromMap(auditEvent, "auditID"),
			},
		},
	}

	return activity
}

// getStringFromMap safely extracts a string value from a map.
func getStringFromMap(m map[string]interface{}, keys ...string) string {
	if m == nil {
		return ""
	}

	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			if v, ok := current[key].(string); ok {
				return v
			}
			return ""
		}
		if nested, ok := current[key].(map[string]interface{}); ok {
			current = nested
		} else {
			return ""
		}
	}
	return ""
}

// resolveKindFromResource uses the RESTMapper to resolve a plural resource name to its Kind.
func (p *AuditProcessor) resolveKindFromResource(apiGroup, resource string) string {
	if p.restMapper == nil {
		return ""
	}

	// Build a GroupVersionResource - we don't know the version, so we use empty string
	// and let the mapper find it
	gvr := schema.GroupVersionResource{
		Group:    apiGroup,
		Resource: resource,
	}

	// Try to find the kind using the RESTMapper
	gvk, err := p.restMapper.KindFor(gvr)
	if err != nil {
		// If lookup failed, try to reset the mapper cache and retry once.
		// This handles the case where a new CRD was registered after startup.
		if resettable, ok := p.restMapper.(meta.ResettableRESTMapper); ok {
			resettable.Reset()
			gvk, err = p.restMapper.KindFor(gvr)
			if err == nil {
				return gvk.Kind
			}
		}
		klog.V(5).InfoS("Failed to resolve kind from RESTMapper",
			"apiGroup", apiGroup, "resource", resource, "error", err)
		return ""
	}

	return gvk.Kind
}

// extractTenant extracts tenant information from user extra fields.
func extractTenant(user map[string]interface{}) v1alpha1.ActivityTenant {
	extra, ok := user["extra"].(map[string]interface{})
	if !ok {
		return v1alpha1.ActivityTenant{Type: "platform"}
	}

	// Look for parent type/name in extra fields
	tenantType := "platform"
	tenantName := ""

	if types, ok := extra["iam.miloapis.com/parent-type"].([]interface{}); ok && len(types) > 0 {
		if t, ok := types[0].(string); ok {
			tenantType = t
		}
	}

	if names, ok := extra["iam.miloapis.com/parent-name"].([]interface{}); ok && len(names) > 0 {
		if n, ok := names[0].(string); ok {
			tenantName = n
		}
	}

	return v1alpha1.ActivityTenant{
		Type: tenantType,
		Name: tenantName,
	}
}
