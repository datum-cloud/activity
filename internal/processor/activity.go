package processor

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// ActivityBuilder contains the common fields needed to build an Activity.
type ActivityBuilder struct {
	// Resource information from the policy
	APIGroup string
	Kind     string
}

// BuildFromAudit constructs an Activity from an audit event.
// If resolveKind is provided, it will be used to resolve resource names to Kind in links.
// Returns error if link conversion fails.
func (b *ActivityBuilder) BuildFromAudit(
	audit *auditv1.Event,
	summary string,
	links []cel.Link,
	resolveKind KindResolver,
) (*v1alpha1.Activity, error) {
	// Extract timestamps
	timestamp := audit.RequestReceivedTimestamp.Time
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	// Extract resource info from ObjectRef
	var namespace, resourceName, apiVersion string
	if audit.ObjectRef != nil {
		namespace = audit.ObjectRef.Namespace
		resourceName = audit.ObjectRef.Name
		apiVersion = audit.ObjectRef.APIVersion
	}

	// Try to get UID from responseObject metadata
	resourceUID := extractResponseUID(audit.ResponseObject)

	// Classify change source and resolve actor
	changeSource := ClassifyChangeSource(audit.User)
	actor := ResolveActor(audit.User)
	tenant := ExtractTenant(audit.User)

	// Generate activity name
	activityName := fmt.Sprintf("act-%s", uuid.New().String()[:8])

	// Convert links
	activityLinks, err := ConvertLinks(links, resolveKind)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrActivityBuild, err)
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
			Labels: map[string]string{
				"activity.miloapis.com/origin-type":   "audit",
				"activity.miloapis.com/change-source": changeSource,
				"activity.miloapis.com/api-group":     b.APIGroup,
				"activity.miloapis.com/resource-kind": b.Kind,
			},
		},
		Spec: v1alpha1.ActivitySpec{
			Summary:      summary,
			ChangeSource: changeSource,
			Actor:        actor,
			Resource: v1alpha1.ActivityResource{
				APIGroup:   b.APIGroup,
				APIVersion: apiVersion,
				Kind:       b.Kind,
				Name:       resourceName,
				Namespace:  namespace,
				UID:        resourceUID,
			},
			Links:  activityLinks,
			Tenant: tenant,
			Origin: v1alpha1.ActivityOrigin{
				Type: "audit",
				ID:   string(audit.AuditID),
			},
		},
	}, nil
}

// extractResponseUID extracts the UID from an audit response object's metadata.
func extractResponseUID(responseObject *runtime.Unknown) string {
	if responseObject == nil || len(responseObject.Raw) == 0 {
		return ""
	}

	// We still need to unmarshal the raw response to get metadata.uid
	var obj struct {
		Metadata struct {
			UID string `json:"uid"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(responseObject.Raw, &obj); err != nil {
		return ""
	}
	return obj.Metadata.UID
}

// BuildFromEvent constructs an Activity from a Kubernetes event.
// If resolveKind is provided, it will be used to resolve resource names to Kind in links.
// Returns error if link conversion fails.
func (b *ActivityBuilder) BuildFromEvent(
	eventMap map[string]interface{},
	summary string,
	links []cel.Link,
	resolveKind KindResolver,
) (*v1alpha1.Activity, error) {
	regarding, _ := eventMap["regarding"].(map[string]interface{})

	// Extract timestamps
	var timestamp time.Time
	if ts, ok := eventMap["eventTime"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
			timestamp = t
		}
	}
	if timestamp.IsZero() {
		if metadata, ok := eventMap["metadata"].(map[string]interface{}); ok {
			if ts, ok := metadata["creationTimestamp"].(string); ok {
				if t, err := time.Parse(time.RFC3339, ts); err == nil {
					timestamp = t
				}
			}
		}
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	// Extract resource info from regarding
	namespace := GetNestedString(regarding, "namespace")
	resourceName := GetNestedString(regarding, "name")
	resourceUID := GetNestedString(regarding, "uid")
	apiVersion := GetNestedString(regarding, "apiVersion")

	// Events are typically system-generated
	changeSource := ChangeSourceSystem

	// For events, actor is usually the reporting component
	reportingController := GetNestedString(eventMap, "reportingController")
	actor := v1alpha1.ActivityActor{
		Type: ActorTypeSystem,
		Name: reportingController,
	}
	if actor.Name == "" {
		actor.Name = "unknown"
	}

	// Extract tenant info (may not be present in events)
	tenant := v1alpha1.ActivityTenant{
		Type: "platform",
		Name: "",
	}

	// Generate activity name
	activityName := fmt.Sprintf("act-%s", uuid.New().String()[:8])

	// Convert links
	activityLinks, err := ConvertLinks(links, resolveKind)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrActivityBuild, err)
	}

	// Get event UID for origin
	eventUID := ""
	if metadata, ok := eventMap["metadata"].(map[string]interface{}); ok {
		eventUID = GetNestedString(metadata, "uid")
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
			Labels: map[string]string{
				"activity.miloapis.com/origin-type":   "event",
				"activity.miloapis.com/change-source": changeSource,
				"activity.miloapis.com/api-group":     b.APIGroup,
				"activity.miloapis.com/resource-kind": b.Kind,
			},
		},
		Spec: v1alpha1.ActivitySpec{
			Summary:      summary,
			ChangeSource: changeSource,
			Actor:        actor,
			Resource: v1alpha1.ActivityResource{
				APIGroup:   b.APIGroup,
				APIVersion: apiVersion,
				Kind:       b.Kind,
				Name:       resourceName,
				Namespace:  namespace,
				UID:        resourceUID,
			},
			Links:  activityLinks,
			Tenant: tenant,
			Origin: v1alpha1.ActivityOrigin{
				Type: "event",
				ID:   eventUID,
			},
		},
	}, nil
}
