package record

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/duration"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/registry/scope"
	"go.miloapis.com/activity/internal/storage"
	activitywatch "go.miloapis.com/activity/internal/watch"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// ActivityStorageInterface defines the storage operations needed by ActivityStorage.
type ActivityStorageInterface interface {
	QueryActivities(ctx context.Context, spec storage.ActivityQuerySpec, scope storage.ScopeContext) (*storage.ActivityQueryResult, error)
}

// ActivityStorage implements REST storage for Activity resources.
// This provides a simplified List/Watch interface for real-time activity streaming.
// For complex queries with time ranges, search, and CEL filters, use ActivityQuery instead.
type ActivityStorage struct {
	storage ActivityStorageInterface
	watcher activitywatch.WatcherInterface
}

// NewActivityStorage creates a new REST storage for Activity.
func NewActivityStorage(s ActivityStorageInterface) *ActivityStorage {
	return &ActivityStorage{
		storage: s,
	}
}

// NewActivityStorageWithWatcher creates a new REST storage for Activity with watch support.
func NewActivityStorageWithWatcher(s ActivityStorageInterface, w activitywatch.WatcherInterface) *ActivityStorage {
	return &ActivityStorage{
		storage: s,
		watcher: w,
	}
}

var (
	_ rest.Scoper               = &ActivityStorage{}
	_ rest.Storage              = &ActivityStorage{}
	_ rest.Lister               = &ActivityStorage{}
	_ rest.Watcher              = &ActivityStorage{}
	_ rest.SingularNameProvider = &ActivityStorage{}
	_ rest.TableConvertor       = &ActivityStorage{}
)

// New returns an empty Activity.
func (s *ActivityStorage) New() runtime.Object {
	return &v1alpha1.Activity{}
}

// Destroy cleans up resources.
func (s *ActivityStorage) Destroy() {}

// NewList returns an empty ActivityList.
func (s *ActivityStorage) NewList() runtime.Object {
	return &v1alpha1.ActivityList{}
}

// NamespaceScoped returns true because Activity is namespace-scoped.
func (s *ActivityStorage) NamespaceScoped() bool {
	return true
}

// GetSingularName returns the singular name of the resource.
func (s *ActivityStorage) GetSingularName() string {
	return "activity"
}

// DefaultListTimeWindow is the default time window for List operations.
// List is intended for real-time use cases (catch-up before Watch).
// For historical queries, use ActivityQuery instead.
const DefaultListTimeWindow = "now-1h"

// List returns a list of activities matching the query.
// Uses standard Kubernetes field selectors for filtering.
// Automatically constrains to the last hour for performance.
// For historical queries with custom time ranges, use ActivityQuery instead.
func (s *ActivityStorage) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	namespace, _ := request.NamespaceFrom(ctx)

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for activity list request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}
	scopeCtx := scope.ExtractScopeFromUser(reqUser)

	spec := storage.ActivityQuerySpec{
		Namespace: namespace,
		Limit:     int32(options.Limit),
		Continue:  options.Continue,
		StartTime: DefaultListTimeWindow, // Default to last hour for performance
	}

	// Parse standard field selectors
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		parseFieldSelector(options.FieldSelector, &spec)
	}

	klog.V(4).InfoS("Listing activities",
		"namespace", namespace,
		"scope", scopeCtx.Type,
		"limit", spec.Limit,
		"startTime", spec.StartTime,
	)

	result, err := s.storage.QueryActivities(ctx, spec, scopeCtx)
	if err != nil {
		klog.ErrorS(err, "Failed to query activities", "namespace", namespace, "scope", scopeCtx.Type)
		return nil, errors.NewServiceUnavailable("Failed to retrieve activities. Please try again later.")
	}

	list := &v1alpha1.ActivityList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v1alpha1.SchemeGroupVersion.String(),
			Kind:       "ActivityList",
		},
	}

	for _, activityJSON := range result.Activities {
		var activity v1alpha1.Activity
		if err := json.Unmarshal([]byte(activityJSON), &activity); err != nil {
			klog.ErrorS(err, "Failed to unmarshal activity")
			continue
		}
		list.Items = append(list.Items, activity)
	}

	list.Continue = result.Continue

	return list, nil
}

// Watch returns a watch.Interface that watches activities matching the query options.
func (s *ActivityStorage) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	if s.watcher == nil {
		return nil, errors.NewServiceUnavailable("Watch API is not available. NATS is not configured.")
	}

	namespace, _ := request.NamespaceFrom(ctx)

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for activity watch request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}
	scopeCtx := scope.ExtractScopeFromUser(reqUser)

	filter := activitywatch.WatchFilter{
		Namespace: namespace,
	}

	// Parse resourceVersion for replay support
	if options.ResourceVersion != "" && options.ResourceVersion != "0" {
		rv, err := strconv.ParseUint(options.ResourceVersion, 10, 64)
		if err != nil {
			klog.V(4).InfoS("Invalid resourceVersion, starting from now", "resourceVersion", options.ResourceVersion)
		} else {
			filter.ResourceVersion = rv
		}
	}

	// Parse field selectors for watch filtering
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		if value, found := options.FieldSelector.RequiresExactMatch("spec.changeSource"); found {
			filter.ChangeSource = value
		}
		if value, found := options.FieldSelector.RequiresExactMatch("spec.resource.apiGroup"); found {
			filter.APIGroup = value
		}
		if value, found := options.FieldSelector.RequiresExactMatch("spec.resource.kind"); found {
			filter.ResourceKind = value
		}
		if value, found := options.FieldSelector.RequiresExactMatch("spec.actor.name"); found {
			filter.ActorName = value
		}
		if value, found := options.FieldSelector.RequiresExactMatch("spec.resource.uid"); found {
			filter.ResourceUID = value
		}
		if value, found := options.FieldSelector.RequiresExactMatch("spec.resource.namespace"); found {
			filter.ResourceNamespace = value
		}
	}

	klog.V(4).InfoS("Starting activity watch",
		"namespace", namespace,
		"scope", scopeCtx.Type,
		"filter", filter,
	)

	return s.watcher.Watch(ctx, scopeCtx, filter)
}

// ConvertToTable converts activities to table format for kubectl display.
func (s *ActivityStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	table := &metav1.Table{
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Description: "Activity name"},
			{Name: "Summary", Type: "string", Description: "Activity summary"},
			{Name: "Actor", Type: "string", Description: "Who performed the action"},
			{Name: "Resource", Type: "string", Description: "Affected resource"},
			{Name: "Source", Type: "string", Description: "Change source (human/system)"},
			{Name: "Age", Type: "string", Description: "Time since activity"},
		},
	}

	switch t := object.(type) {
	case *v1alpha1.Activity:
		table.Rows = append(table.Rows, activityToTableRow(t))
	case *v1alpha1.ActivityList:
		for i := range t.Items {
			table.Rows = append(table.Rows, activityToTableRow(&t.Items[i]))
		}
	}

	return table, nil
}

func activityToTableRow(activity *v1alpha1.Activity) metav1.TableRow {
	summary := activity.Spec.Summary
	if len(summary) > 60 {
		summary = summary[:57] + "..."
	}

	resource := activity.Spec.Resource.Kind
	if activity.Spec.Resource.Name != "" {
		resource += "/" + activity.Spec.Resource.Name
	}

	age := "<unknown>"
	if !activity.CreationTimestamp.IsZero() {
		age = duration.HumanDuration(time.Since(activity.CreationTimestamp.Time))
	}

	return metav1.TableRow{
		Object: runtime.RawExtension{Object: activity},
		Cells: []interface{}{
			activity.Name,
			summary,
			activity.Spec.Actor.Name,
			resource,
			activity.Spec.ChangeSource,
			age,
		},
	}
}


// parseFieldSelector extracts query parameters from standard field selectors.
func parseFieldSelector(selector fields.Selector, spec *storage.ActivityQuerySpec) {
	if selector == nil || selector.Empty() {
		return
	}

	if value, found := selector.RequiresExactMatch("spec.changeSource"); found {
		spec.ChangeSource = value
	}
	if value, found := selector.RequiresExactMatch("spec.resource.apiGroup"); found {
		spec.APIGroup = value
	}
	if value, found := selector.RequiresExactMatch("spec.resource.kind"); found {
		spec.ResourceKind = value
	}
	if value, found := selector.RequiresExactMatch("spec.actor.name"); found {
		spec.ActorName = value
	}
	if value, found := selector.RequiresExactMatch("spec.resource.uid"); found {
		spec.ResourceUID = value
	}
}
