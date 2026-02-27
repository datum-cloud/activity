package reindex

import (
	"context"
	"fmt"
	"time"

	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"go.miloapis.com/activity/internal/processor"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// fetchAuditLogBatch queries audit logs via the AuditLogQuery API.
// Returns the batch of audit events, the cursor for the next batch, and any error.
func fetchAuditLogBatch(
	ctx context.Context,
	c client.Client,
	startTime, endTime time.Time,
	cursor string,
	batchSize int32,
) ([]*auditv1.Event, string, error) {
	klog.V(4).InfoS("Fetching audit log batch via API",
		"startTime", startTime,
		"endTime", endTime,
		"cursor", cursor,
		"batchSize", batchSize,
	)

	// Create AuditLogQuery resource
	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "reindex-audit-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: startTime.Format(time.RFC3339),
			EndTime:   endTime.Format(time.RFC3339),
			Limit:     batchSize,
			Continue:  cursor,
		},
	}

	// Create the query - the API server returns results in status immediately
	if err := c.Create(ctx, query); err != nil {
		return nil, "", fmt.Errorf("failed to create AuditLogQuery: %w", err)
	}

	klog.V(4).InfoS("AuditLogQuery executed",
		"resultsCount", len(query.Status.Results),
		"continue", query.Status.Continue,
	)

	// Convert results to pointers
	batch := make([]*auditv1.Event, len(query.Status.Results))
	for i := range query.Status.Results {
		batch[i] = &query.Status.Results[i]
	}

	return batch, query.Status.Continue, nil
}

// fetchEventBatch queries Kubernetes events via the EventQuery API.
// Returns the batch of events as maps, the cursor for the next batch, and any error.
func fetchEventBatch(
	ctx context.Context,
	c client.Client,
	startTime, endTime time.Time,
	cursor string,
	batchSize int32,
) ([]map[string]interface{}, string, error) {
	klog.V(4).InfoS("Fetching event batch via API",
		"startTime", startTime,
		"endTime", endTime,
		"cursor", cursor,
		"batchSize", batchSize,
	)

	// Create EventQuery resource
	query := &v1alpha1.EventQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "reindex-event-",
		},
		Spec: v1alpha1.EventQuerySpec{
			StartTime: startTime.Format(time.RFC3339),
			EndTime:   endTime.Format(time.RFC3339),
			Limit:     batchSize,
			Continue:  cursor,
		},
	}

	// Create the query - the API server returns results in status immediately
	if err := c.Create(ctx, query); err != nil {
		return nil, "", fmt.Errorf("failed to create EventQuery: %w", err)
	}

	klog.V(4).InfoS("EventQuery executed",
		"resultsCount", len(query.Status.Results),
		"continue", query.Status.Continue,
	)

	// Convert EventRecord results to map[string]interface{} for processor compatibility
	batch := make([]map[string]interface{}, len(query.Status.Results))
	for i := range query.Status.Results {
		// The processor expects the event data in map format
		// EventRecord has an Event field that contains the actual event data
		eventMap, err := eventRecordToMap(&query.Status.Results[i])
		if err != nil {
			return nil, "", fmt.Errorf("failed to convert event record %d: %w", i, err)
		}
		batch[i] = eventMap
	}

	return batch, query.Status.Continue, nil
}

// evaluateBatch applies ActivityPolicy rules to a batch of events.
// The originType should be "audit" or "event" to indicate the source.
func evaluateBatch(
	ctx context.Context,
	batch interface{},
	policies []*v1alpha1.ActivityPolicy,
	originType string,
) ([]*v1alpha1.Activity, error) {
	var activities []*v1alpha1.Activity

	switch originType {
	case "audit":
		// Process audit logs
		auditBatch, ok := batch.([]*auditv1.Event)
		if !ok {
			return nil, fmt.Errorf("invalid batch type for audit logs")
		}

		for _, audit := range auditBatch {
			for _, policy := range policies {
				result, err := processor.EvaluateAuditRules(&policy.Spec, audit, nil)
				if err != nil {
					klog.ErrorS(err, "Failed to evaluate audit rules",
						"policy", policy.Name,
						"auditID", audit.AuditID,
					)
					continue
				}

				if result.Activity != nil {
					// Add policy label for tracking
					if result.Activity.Labels == nil {
						result.Activity.Labels = make(map[string]string)
					}
					result.Activity.Labels["activity.miloapis.com/policy-name"] = policy.Name

					activities = append(activities, result.Activity)
					break // Only first matching policy generates an activity
				}
			}
		}

	case "event":
		// Process Kubernetes events
		eventBatch, ok := batch.([]map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid batch type for events")
		}

		for _, eventMap := range eventBatch {
			for _, policy := range policies {
				result, err := processor.EvaluateEventRules(&policy.Spec, eventMap, nil)
				if err != nil {
					klog.ErrorS(err, "Failed to evaluate event rules",
						"policy", policy.Name,
						"eventUID", processor.GetNestedString(eventMap, "metadata", "uid"),
					)
					continue
				}

				if result.Activity != nil {
					// Add policy label for tracking
					if result.Activity.Labels == nil {
						result.Activity.Labels = make(map[string]string)
					}
					result.Activity.Labels["activity.miloapis.com/policy-name"] = policy.Name

					activities = append(activities, result.Activity)
					break // Only first matching policy generates an activity
				}
			}
		}

	default:
		return nil, fmt.Errorf("invalid origin type: %s", originType)
	}

	klog.V(3).InfoS("Evaluated batch",
		"originType", originType,
		"inputEvents", batchSize(batch),
		"activitiesGenerated", len(activities),
	)

	return activities, nil
}

// eventRecordToMap converts an EventRecord to a map[string]interface{} for processor compatibility.
func eventRecordToMap(record *v1alpha1.EventRecord) (map[string]interface{}, error) {
	// The processor expects the event data in a structured map format.
	// We need to convert the eventsv1.Event to map[string]interface{}.

	// Create a map with the event fields that the processor expects
	eventMap := map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":      record.Event.Name,
			"namespace": record.Event.Namespace,
			"uid":       string(record.Event.UID),
		},
		"regarding": map[string]interface{}{
			"apiVersion": record.Event.Regarding.APIVersion,
			"kind":       record.Event.Regarding.Kind,
			"name":       record.Event.Regarding.Name,
			"namespace":  record.Event.Regarding.Namespace,
			"uid":        string(record.Event.Regarding.UID),
		},
		"reason":             record.Event.Reason,
		"note":               record.Event.Note,
		"type":               record.Event.Type,
		"eventTime":          record.Event.EventTime.Time,
		"reportingController": record.Event.ReportingController,
		"reportingInstance":  record.Event.ReportingInstance,
		"action":             record.Event.Action,
	}

	// Add series if present
	if record.Event.Series != nil {
		eventMap["series"] = map[string]interface{}{
			"count":            record.Event.Series.Count,
			"lastObservedTime": record.Event.Series.LastObservedTime.Time,
		}
	}

	// Add related object if present
	if record.Event.Related != nil {
		eventMap["related"] = map[string]interface{}{
			"apiVersion": record.Event.Related.APIVersion,
			"kind":       record.Event.Related.Kind,
			"name":       record.Event.Related.Name,
			"namespace":  record.Event.Related.Namespace,
			"uid":        string(record.Event.Related.UID),
		}
	}

	return eventMap, nil
}

// batchSize returns the size of a batch regardless of type.
func batchSize(batch interface{}) int {
	switch v := batch.(type) {
	case []*auditv1.Event:
		return len(v)
	case []map[string]interface{}:
		return len(v)
	default:
		return 0
	}
}
