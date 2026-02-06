package record

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/storage"
	activitywatch "go.miloapis.com/activity/internal/watch"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// StorageInterface defines the storage operations needed by ActivityStorage.
type StorageInterface interface {
	QueryActivities(ctx context.Context, spec storage.ActivityQuerySpec, scope storage.ScopeContext) (*storage.ActivityQueryResult, error)
	GetActivity(ctx context.Context, namespace, name string, scope storage.ScopeContext) (string, error)
}

// ActivityStorage implements REST storage for Activity resources.
type ActivityStorage struct {
	storage StorageInterface
	watcher activitywatch.WatcherInterface
}

// NewActivityStorage creates a new REST storage for Activity.
func NewActivityStorage(s StorageInterface) *ActivityStorage {
	return &ActivityStorage{
		storage: s,
	}
}

// NewActivityStorageWithWatcher creates a new REST storage for Activity with watch support.
func NewActivityStorageWithWatcher(s StorageInterface, w activitywatch.WatcherInterface) *ActivityStorage {
	return &ActivityStorage{
		storage: s,
		watcher: w,
	}
}

var (
	_ rest.Scoper               = &ActivityStorage{}
	_ rest.Storage              = &ActivityStorage{}
	_ rest.Lister               = &ActivityStorage{}
	_ rest.Getter               = &ActivityStorage{}
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

// List returns a list of activities matching the query.
func (s *ActivityStorage) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	// Get namespace from context (may be empty for cluster-scoped list)
	namespace, _ := request.NamespaceFrom(ctx)

	// Extract user for scope context
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for activity list request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}
	scope := extractScopeFromUser(reqUser)

	// Build query spec from list options
	spec := storage.ActivityQuerySpec{
		Namespace: namespace,
		Limit:     int32(options.Limit),
		Continue:  options.Continue,
	}

	// Parse field selectors using upstream library
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		parseFieldSelector(options.FieldSelector, &spec)
	}

	// Extract custom query params from context (set by the handler wrapper)
	queryParams := ActivityQueryParamsFrom(ctx)
	if queryParams.StartTime != "" {
		spec.StartTime = queryParams.StartTime
	}
	if queryParams.EndTime != "" {
		spec.EndTime = queryParams.EndTime
	}
	if queryParams.Search != "" {
		spec.Search = queryParams.Search
	}
	if queryParams.ChangeSource != "" && spec.ChangeSource == "" {
		// Only use query param if not already set via field selector
		spec.ChangeSource = queryParams.ChangeSource
	}
	if queryParams.Filter != "" {
		spec.Filter = queryParams.Filter
	}

	klog.V(4).InfoS("Listing activities",
		"namespace", namespace,
		"scope", scope.Type,
		"limit", spec.Limit,
		"startTime", spec.StartTime,
		"endTime", spec.EndTime,
		"search", spec.Search,
		"filter", spec.Filter,
	)

	result, err := s.storage.QueryActivities(ctx, spec, scope)
	if err != nil {
		klog.ErrorS(err, "Failed to query activities", "namespace", namespace, "scope", scope.Type)
		return nil, errors.NewServiceUnavailable("Failed to retrieve activities. Please try again later or contact support for help.")
	}

	// Convert JSON to Activity objects
	list := &v1alpha1.ActivityList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v1alpha1.SchemeGroupVersion.String(),
			Kind:       "ActivityList",
		},
	}

	for _, activityJSON := range result.Activities {
		var activity v1alpha1.Activity
		if err := json.Unmarshal([]byte(activityJSON), &activity); err != nil {
			klog.ErrorS(err, "Failed to unmarshal activity", "json", activityJSON[:min(100, len(activityJSON))])
			continue
		}
		list.Items = append(list.Items, activity)
	}

	list.Continue = result.Continue

	return list, nil
}

// Get retrieves a single activity by name.
func (s *ActivityStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, errors.NewBadRequest("namespace is required")
	}

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for activity get request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}
	scope := extractScopeFromUser(reqUser)

	activityJSON, err := s.storage.GetActivity(ctx, namespace, name, scope)
	if err != nil {
		klog.ErrorS(err, "Failed to get activity", "namespace", namespace, "name", name, "scope", scope.Type)
		return nil, errors.NewServiceUnavailable("Failed to retrieve activity. Please try again later or contact support for help.")
	}

	if activityJSON == "" {
		return nil, errors.NewNotFound(v1alpha1.Resource("activities"), name)
	}

	var activity v1alpha1.Activity
	if err := json.Unmarshal([]byte(activityJSON), &activity); err != nil {
		klog.ErrorS(err, "Failed to unmarshal activity", "namespace", namespace, "name", name)
		return nil, errors.NewServiceUnavailable("Failed to retrieve activity. Please try again later or contact support for help.")
	}

	return &activity, nil
}

// Watch returns a watch.Interface that watches activities matching the query options.
func (s *ActivityStorage) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	if s.watcher == nil {
		return nil, errors.NewServiceUnavailable("Watch API is not available. Please contact your administrator.")
	}

	// Get namespace from context
	namespace, _ := request.NamespaceFrom(ctx)

	// Extract user for scope context
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for activity watch request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}
	scope := extractScopeFromUser(reqUser)

	// Build watch filter from field selectors
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
	}

	// Extract CEL filter from context (set by the handler wrapper)
	queryParams := ActivityQueryParamsFrom(ctx)
	if queryParams.Filter != "" {
		filter.CELFilter = queryParams.Filter
	}

	klog.V(4).InfoS("Starting activity watch",
		"namespace", namespace,
		"scope", scope.Type,
		"filter", filter,
		"celFilter", filter.CELFilter,
	)

	return s.watcher.Watch(ctx, scope, filter)
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

// activityToTableRow converts an Activity to a table row.
func activityToTableRow(activity *v1alpha1.Activity) metav1.TableRow {
	// Truncate summary for display
	summary := activity.Spec.Summary
	if len(summary) > 60 {
		summary = summary[:57] + "..."
	}

	// Format resource
	resource := activity.Spec.Resource.Kind
	if activity.Spec.Resource.Name != "" {
		resource += "/" + activity.Spec.Resource.Name
	}

	// Calculate age
	age := "<unknown>"
	if !activity.CreationTimestamp.IsZero() {
		age = formatDuration(metav1.Now().Sub(activity.CreationTimestamp.Time))
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

// formatDuration formats a duration in a human-readable way.
func formatDuration(d interface{}) string {
	switch v := d.(type) {
	case interface{ Hours() float64 }:
		h := int(v.Hours())
		if h >= 24 {
			return fmt.Sprintf("%dd", h/24)
		}
		if h > 0 {
			return fmt.Sprintf("%dh", h)
		}
		// Fall through to check minutes
		if m, ok := d.(interface{ Minutes() float64 }); ok {
			mins := int(m.Minutes())
			if mins > 0 {
				return fmt.Sprintf("%dm", mins)
			}
		}
		return "<1m"
	default:
		return "<unknown>"
	}
}

// extractScopeFromUser extracts the scope context from user info.
func extractScopeFromUser(u interface{}) storage.ScopeContext {
	// Try to get extra fields from user info
	if user, ok := u.(interface{ GetExtra() map[string][]string }); ok {
		extra := user.GetExtra()
		if scopeType, ok := extra["iam.miloapis.com/parent-type"]; ok && len(scopeType) > 0 {
			scopeName := ""
			if names, ok := extra["iam.miloapis.com/parent-name"]; ok && len(names) > 0 {
				scopeName = names[0]
			}
			return storage.ScopeContext{
				Type: scopeType[0],
				Name: scopeName,
			}
		}
	}
	// Default to platform scope for admins
	return storage.ScopeContext{
		Type: "platform",
		Name: "",
	}
}

// min returns the smaller of two integers.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ClusterScopedActivityStorage provides cluster-scoped access to activities.
type ClusterScopedActivityStorage struct {
	*ActivityStorage
}

// NewClusterScopedActivityStorage creates storage for cluster-scoped activity queries.
func NewClusterScopedActivityStorage(s StorageInterface) *ClusterScopedActivityStorage {
	return &ClusterScopedActivityStorage{
		ActivityStorage: NewActivityStorage(s),
	}
}

// NamespaceScoped returns false for cluster-scoped access.
func (s *ClusterScopedActivityStorage) NamespaceScoped() bool {
	return false
}

// List returns activities across all namespaces.
func (s *ClusterScopedActivityStorage) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	// For cluster-scoped list, namespace is empty
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for cluster-scoped activity list request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}
	scope := extractScopeFromUser(reqUser)

	spec := storage.ActivityQuerySpec{
		Namespace: "", // All namespaces
		Limit:     int32(options.Limit),
		Continue:  options.Continue,
	}

	// Parse field selectors using upstream library
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		parseFieldSelector(options.FieldSelector, &spec)
	}

	// Extract custom query params from context (set by the handler wrapper)
	queryParams := ActivityQueryParamsFrom(ctx)
	if queryParams.StartTime != "" {
		spec.StartTime = queryParams.StartTime
	}
	if queryParams.EndTime != "" {
		spec.EndTime = queryParams.EndTime
	}
	if queryParams.Search != "" {
		spec.Search = queryParams.Search
	}
	if queryParams.ChangeSource != "" && spec.ChangeSource == "" {
		// Only use query param if not already set via field selector
		spec.ChangeSource = queryParams.ChangeSource
	}
	if queryParams.Filter != "" {
		spec.Filter = queryParams.Filter
	}

	result, err := s.storage.QueryActivities(ctx, spec, scope)
	if err != nil {
		klog.ErrorS(err, "Failed to query activities (cluster-scoped)", "scope", scope.Type)
		return nil, errors.NewServiceUnavailable("Failed to retrieve activities. Please try again later or contact support for help.")
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
			continue
		}
		list.Items = append(list.Items, activity)
	}

	list.Continue = result.Continue

	return list, nil
}

// parseFieldSelector extracts query parameters from a fields.Selector.
// Uses the upstream RequiresExactMatch method to get field values.
func parseFieldSelector(selector fields.Selector, spec *storage.ActivityQuerySpec) {
	if selector == nil || selector.Empty() {
		return
	}

	// Extract exact match requirements for supported fields
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
	if value, found := selector.RequiresExactMatch("metadata.namespace"); found {
		spec.Namespace = value
	}
	// Time range filtering - supports RFC3339 and relative times (e.g., "now-7d")
	if value, found := selector.RequiresExactMatch("spec.startTime"); found {
		spec.StartTime = value
	}
	if value, found := selector.RequiresExactMatch("spec.endTime"); found {
		spec.EndTime = value
	}
}

// FieldLabelConversionFunc converts field selectors for Activity resources.
func FieldLabelConversionFunc(label, value string) (string, string, error) {
	switch label {
	case "metadata.name",
		"metadata.namespace",
		"spec.changeSource",
		"spec.resource.apiGroup",
		"spec.resource.kind",
		"spec.actor.name",
		"spec.origin.type",
		"spec.resource.uid",
		"spec.startTime",
		"spec.endTime":
		return label, value, nil
	default:
		return "", "", fmt.Errorf("field label %q is not supported", label)
	}
}

// SupportedFieldSelectors returns the set of supported field selectors for Activity resources.
var SupportedFieldSelectors = fields.Set{
	"metadata.name":          "",
	"metadata.namespace":     "",
	"spec.changeSource":      "",
	"spec.resource.apiGroup": "",
	"spec.resource.kind":     "",
	"spec.actor.name":        "",
	"spec.origin.type":       "",
	"spec.resource.uid":      "",
	"spec.startTime":         "",
	"spec.endTime":           "",
}

// SelectableActivityFields returns a function that validates field selector fields.
func SelectableActivityFields(obj *v1alpha1.Activity) fields.Set {
	return fields.Set{
		"metadata.name":          obj.Name,
		"metadata.namespace":     obj.Namespace,
		"spec.changeSource":      obj.Spec.ChangeSource,
		"spec.resource.apiGroup": obj.Spec.Resource.APIGroup,
		"spec.resource.kind":     obj.Spec.Resource.Kind,
		"spec.actor.name":        obj.Spec.Actor.Name,
		"spec.origin.type":       obj.Spec.Origin.Type,
		"spec.resource.uid":      obj.Spec.Resource.UID,
	}
}