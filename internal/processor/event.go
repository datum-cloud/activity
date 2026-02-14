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

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/internal/controller"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// EventProcessor processes Kubernetes events from NATS and generates activities.
type EventProcessor struct {
	conn        *nats.Conn
	subject     string
	policyCache *controller.PolicyCache
	publisher   *Publisher
	workers     int

	// Work channel for distributing messages to workers
	workChan chan *nats.Msg
}

// NewEventProcessor creates a new event processor.
func NewEventProcessor(
	conn *nats.Conn,
	subject string,
	policyCache *controller.PolicyCache,
	publisher *Publisher,
	workers int,
) *EventProcessor {
	return &EventProcessor{
		conn:        conn,
		subject:     subject,
		policyCache: policyCache,
		publisher:   publisher,
		workers:     workers,
		workChan:    make(chan *nats.Msg, workers*10),
	}
}

// Run starts the event processor.
func (p *EventProcessor) Run(ctx context.Context) error {
	klog.InfoS("Starting event processor", "subject", p.subject, "workers", p.workers)

	// Subscribe to Kubernetes events
	sub, err := p.conn.Subscribe(p.subject, func(msg *nats.Msg) {
		select {
		case p.workChan <- msg:
		default:
			klog.Warning("Event processor work channel full, dropping message")
		}
	})
	if err != nil {
		return fmt.Errorf("failed to subscribe to events: %w", err)
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

	klog.InfoS("Event processor running", "workers", p.workers)

	// Wait for context cancellation
	<-ctx.Done()

	// Close work channel to signal workers to stop
	close(p.workChan)

	// Wait for workers to finish
	wg.Wait()

	klog.Info("Event processor stopped")
	return nil
}

// worker processes event messages from the work channel.
func (p *EventProcessor) worker(ctx context.Context, id int) {
	klog.V(4).InfoS("Event worker started", "worker", id)

	for msg := range p.workChan {
		if err := p.processMessage(ctx, msg); err != nil {
			klog.ErrorS(err, "Failed to process event message", "worker", id)
		}
	}

	klog.V(4).InfoS("Event worker stopped", "worker", id)
}

// processMessage processes a single Kubernetes event message.
func (p *EventProcessor) processMessage(ctx context.Context, msg *nats.Msg) error {
	// Parse the Kubernetes event
	var event map[string]interface{}
	if err := json.Unmarshal(msg.Data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Extract involved object info to find matching policy
	// Kubernetes events have either "regarding" (v1.Event) or "involvedObject" (corev1.Event)
	involvedObject := p.getInvolvedObject(event)
	if involvedObject == nil {
		klog.V(4).Info("Event has no involved object, skipping")
		return nil
	}

	apiGroup := getStringFromMap(involvedObject, "apiGroup")
	// For core resources, apiVersion is "v1" with empty apiGroup
	if apiGroup == "" {
		if apiVersion := getStringFromMap(involvedObject, "apiVersion"); apiVersion != "" && apiVersion != "v1" {
			// Parse apiGroup from apiVersion like "apps/v1"
			apiGroup = parseAPIGroup(apiVersion)
		}
	}
	kind := getStringFromMap(involvedObject, "kind")

	if kind == "" {
		klog.V(4).InfoS("Could not determine kind from event, skipping")
		return nil
	}

	// Look up policy for this resource
	policy, found := p.policyCache.GetByResource(apiGroup, kind)
	if !found {
		klog.V(4).InfoS("No policy found for resource, skipping",
			"apiGroup", apiGroup, "kind", kind)
		return nil
	}

	// Check if policy has event rules
	if len(policy.EventRules) == 0 {
		klog.V(4).InfoS("Policy has no event rules, skipping",
			"policy", policy.Name, "apiGroup", apiGroup, "kind", kind)
		return nil
	}

	// Find matching rule and generate activity
	activity, err := p.generateActivity(event, policy, involvedObject)
	if err != nil {
		return fmt.Errorf("failed to generate activity: %w", err)
	}

	if activity == nil {
		klog.V(4).InfoS("No rule matched event", "policy", policy.Name)
		return nil
	}

	// Publish the activity
	if err := p.publisher.Publish(ctx, activity); err != nil {
		return fmt.Errorf("failed to publish activity: %w", err)
	}

	klog.V(3).InfoS("Generated activity from event",
		"activity", activity.Name,
		"summary", activity.Spec.Summary,
		"reason", getStringFromMap(event, "reason"),
	)

	return nil
}

// getInvolvedObject extracts the involved object from a Kubernetes event.
// Handles both v1.Event (regarding) and corev1.Event (involvedObject) formats.
func (p *EventProcessor) getInvolvedObject(event map[string]interface{}) map[string]interface{} {
	// Try "regarding" first (events.k8s.io/v1)
	if regarding, ok := event["regarding"].(map[string]interface{}); ok {
		return regarding
	}
	// Fall back to "involvedObject" (v1)
	if involvedObject, ok := event["involvedObject"].(map[string]interface{}); ok {
		return involvedObject
	}
	return nil
}

// normalizeEvent creates a copy of the event with a "regarding" field.
// This ensures CEL expressions can consistently use event.regarding regardless
// of whether the original event used "regarding" or "involvedObject".
func (p *EventProcessor) normalizeEvent(event map[string]interface{}, involvedObject map[string]interface{}) map[string]interface{} {
	// If the event already has "regarding", return as-is
	if _, ok := event["regarding"]; ok {
		return event
	}

	// Create a shallow copy with "regarding" added
	normalized := make(map[string]interface{}, len(event)+1)
	for k, v := range event {
		normalized[k] = v
	}
	normalized["regarding"] = involvedObject

	return normalized
}

// generateActivity generates an Activity from a Kubernetes event using the policy rules.
func (p *EventProcessor) generateActivity(
	event map[string]interface{},
	policy *controller.CompiledPolicy,
	involvedObject map[string]interface{},
) (*v1alpha1.Activity, error) {
	// Normalize event to always have "regarding" for consistent CEL access
	// This handles v1 Events that use "involvedObject" instead of "regarding"
	normalizedEvent := p.normalizeEvent(event, involvedObject)

	// Try each event rule in order
	for i, rule := range policy.EventRules {
		if !rule.Valid {
			klog.V(4).InfoS("Skipping invalid rule", "policy", policy.Name, "rule", i)
			continue
		}

		// Evaluate match expression
		matched, err := cel.EvaluateEventMatch(rule.Match, normalizedEvent)
		if err != nil {
			klog.ErrorS(err, "Failed to evaluate match expression",
				"policy", policy.Name, "rule", i)
			continue
		}

		if !matched {
			continue
		}

		// Rule matched - generate summary
		summary, links, err := cel.EvaluateEventSummary(rule.Summary, normalizedEvent)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate summary for rule %d: %w", i, err)
		}

		// Build the activity
		activity := p.buildActivity(event, policy, involvedObject, summary, links)
		return activity, nil
	}

	// No rule matched
	return nil, nil
}

// buildActivity constructs an Activity resource from event data.
func (p *EventProcessor) buildActivity(
	event map[string]interface{},
	policy *controller.CompiledPolicy,
	involvedObject map[string]interface{},
	summary string,
	links []cel.Link,
) *v1alpha1.Activity {
	// Extract timestamps
	var timestamp time.Time
	// Try eventTime first (events.k8s.io/v1)
	if ts := getStringFromMap(event, "eventTime"); ts != "" {
		if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
			timestamp = t
		}
	}
	// Fall back to lastTimestamp or firstTimestamp
	if timestamp.IsZero() {
		if ts := getStringFromMap(event, "lastTimestamp"); ts != "" {
			if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
				timestamp = t
			}
		}
	}
	if timestamp.IsZero() {
		if ts := getStringFromMap(event, "firstTimestamp"); ts != "" {
			if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
				timestamp = t
			}
		}
	}
	// Fall back to metadata.creationTimestamp
	if timestamp.IsZero() {
		if metadata, ok := event["metadata"].(map[string]interface{}); ok {
			if ts := getStringFromMap(metadata, "creationTimestamp"); ts != "" {
				if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
					timestamp = t
				}
			}
		}
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	// Extract resource info from involved object
	namespace := getStringFromMap(involvedObject, "namespace")
	resourceName := getStringFromMap(involvedObject, "name")
	resourceUID := getStringFromMap(involvedObject, "uid")
	apiVersion := getStringFromMap(involvedObject, "apiVersion")

	// Resolve actor from reporting controller or source component
	actor := p.resolveEventActor(event)

	// Events from controllers are always system-initiated
	changeSource := ChangeSourceSystem

	// Extract event UID for origin tracking
	eventUID := ""
	if metadata, ok := event["metadata"].(map[string]interface{}); ok {
		eventUID = getStringFromMap(metadata, "uid")
	}

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
				"activity.miloapis.com/origin-type":   "event",
				"activity.miloapis.com/change-source": changeSource,
				"activity.miloapis.com/api-group":     policy.APIGroup,
				"activity.miloapis.com/resource-kind": policy.Kind,
				"activity.miloapis.com/event-reason":  getStringFromMap(event, "reason"),
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
			Links: activityLinks,
			Tenant: v1alpha1.ActivityTenant{
				Type: "platform",
				Name: "",
			},
			Origin: v1alpha1.ActivityOrigin{
				Type: "event",
				ID:   eventUID,
			},
		},
	}

	return activity
}

// resolveEventActor extracts actor information from a Kubernetes event.
// Events are generated by controllers, so we extract the reporting controller or source component.
func (p *EventProcessor) resolveEventActor(event map[string]interface{}) v1alpha1.ActivityActor {
	// Try reportingController first (events.k8s.io/v1)
	controller := getStringFromMap(event, "reportingController")

	// Fall back to source.component (v1)
	if controller == "" {
		if source, ok := event["source"].(map[string]interface{}); ok {
			controller = getStringFromMap(source, "component")
		}
	}

	// Default to unknown if we can't find the controller
	if controller == "" {
		controller = "unknown"
	}

	return v1alpha1.ActivityActor{
		Type: ActorTypeController,
		Name: controller,
	}
}

// parseAPIGroup extracts the API group from an apiVersion string.
// For "apps/v1", returns "apps". For "v1", returns "".
func parseAPIGroup(apiVersion string) string {
	for i := len(apiVersion) - 1; i >= 0; i-- {
		if apiVersion[i] == '/' {
			return apiVersion[:i]
		}
	}
	return ""
}
