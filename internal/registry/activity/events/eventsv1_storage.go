package events

import (
	"context"
	"fmt"
	"strconv"

	eventsv1 "k8s.io/api/events/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/fields"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/storage"
	eventwatch "go.miloapis.com/activity/internal/watch"
)

// EventsV1REST implements the REST interface for events.k8s.io/v1 Events.
// It adapts the newer eventsv1.Event type to work with the existing corev1.Event backend.
type EventsV1REST struct {
	backend EventsBackend
	watcher *eventwatch.EventsWatcher
}

// NewEventsV1REST returns a REST storage object for events.k8s.io/v1 Events.
func NewEventsV1REST(backend EventsBackend) *EventsV1REST {
	return &EventsV1REST{
		backend: backend,
	}
}

// NewEventsV1RESTWithWatcher returns a REST storage object for events.k8s.io/v1 Events with watch support.
func NewEventsV1RESTWithWatcher(backend EventsBackend, watcher *eventwatch.EventsWatcher) *EventsV1REST {
	return &EventsV1REST{
		backend: backend,
		watcher: watcher,
	}
}

// Compile-time interface verification
var (
	_ rest.Scoper               = &EventsV1REST{}
	_ rest.Creater              = &EventsV1REST{}
	_ rest.Getter               = &EventsV1REST{}
	_ rest.Lister               = &EventsV1REST{}
	_ rest.Updater              = &EventsV1REST{}
	_ rest.GracefulDeleter      = &EventsV1REST{}
	_ rest.Watcher              = &EventsV1REST{}
	_ rest.Storage              = &EventsV1REST{}
	_ rest.SingularNameProvider = &EventsV1REST{}
)

// New returns an empty eventsv1.Event object.
func (r *EventsV1REST) New() runtime.Object {
	return &eventsv1.Event{}
}

// Destroy cleans up resources.
func (r *EventsV1REST) Destroy() {
	// Nothing to destroy
}

// NamespaceScoped returns true - Events are namespaced resources.
func (r *EventsV1REST) NamespaceScoped() bool {
	return true
}

// GetSingularName returns the singular name of the resource.
func (r *EventsV1REST) GetSingularName() string {
	return "event"
}

// NewList returns an empty eventsv1.EventList.
func (r *EventsV1REST) NewList() runtime.Object {
	return &eventsv1.EventList{}
}

// Create stores a new event.
func (r *EventsV1REST) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	event, ok := obj.(*eventsv1.Event)
	if !ok {
		return nil, fmt.Errorf("not an events.k8s.io/v1 Event: %#v", obj)
	}

	// Get namespace from context
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return nil, errors.NewBadRequest("namespace is required")
	}

	// Get user for scope extraction
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scope := ExtractScopeFromUser(reqUser)

	klog.V(4).InfoS("Creating events.k8s.io/v1 event",
		"namespace", namespace,
		"name", event.Name,
		"scopeType", scope.Type,
		"scopeName", scope.Name,
	)

	// Set namespace if not set
	if event.Namespace == "" {
		event.Namespace = namespace
	} else if event.Namespace != namespace {
		return nil, errors.NewBadRequest("event namespace does not match request namespace")
	}

	// Run validation if provided
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	// Backend now uses eventsv1.Event natively - direct passthrough
	result, err := r.backend.Create(ctx, event, storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	})
	if err != nil {
		klog.ErrorS(err, "Failed to create events.k8s.io/v1 event",
			"namespace", namespace,
			"name", event.Name,
		)
		return nil, r.convertToStatusError(err)
	}

	return result, nil
}

// Get retrieves an event by name.
func (r *EventsV1REST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return nil, errors.NewBadRequest("namespace is required")
	}

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scope := ExtractScopeFromUser(reqUser)

	// Backend now uses eventsv1.Event natively - direct passthrough
	result, err := r.backend.Get(ctx, namespace, name, storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	})
	if err != nil {
		return nil, r.convertToStatusError(err)
	}

	return result, nil
}

// List retrieves events matching the given options.
func (r *EventsV1REST) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	namespace, _ := request.NamespaceFrom(ctx)

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scope := ExtractScopeFromUser(reqUser)

	// Convert internal ListOptions to metav1.ListOptions
	listOpts := metav1.ListOptions{
		Limit:    options.Limit,
		Continue: options.Continue,
	}
	if options.FieldSelector != nil {
		listOpts.FieldSelector = options.FieldSelector.String()
	}
	if options.LabelSelector != nil {
		listOpts.LabelSelector = options.LabelSelector.String()
	}
	if options.ResourceVersion != "" {
		listOpts.ResourceVersion = options.ResourceVersion
	}

	klog.V(4).InfoS("Listing events.k8s.io/v1 events",
		"namespace", namespace,
		"fieldSelector", listOpts.FieldSelector,
		"scopeType", scope.Type,
		"scopeName", scope.Name,
	)

	// Backend now uses eventsv1.Event natively - direct passthrough
	result, err := r.backend.List(ctx, namespace, listOpts, storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	})
	if err != nil {
		return nil, r.convertToStatusError(err)
	}

	return result, nil
}

// Update modifies an existing event.
func (r *EventsV1REST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return nil, false, errors.NewBadRequest("namespace is required")
	}

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, false, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scope := ExtractScopeFromUser(reqUser)
	scopeCtx := storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	}

	// Get existing event (backend now uses eventsv1.Event natively)
	existing, err := r.backend.Get(ctx, namespace, name, scopeCtx)
	if err != nil {
		if errors.IsNotFound(err) && forceAllowCreate {
			// Create new event
			updated, err := objInfo.UpdatedObject(ctx, nil)
			if err != nil {
				return nil, false, err
			}

			event, ok := updated.(*eventsv1.Event)
			if !ok {
				return nil, false, fmt.Errorf("not an events.k8s.io/v1 Event: %#v", updated)
			}

			event.Namespace = namespace
			event.Name = name

			if createValidation != nil {
				if err := createValidation(ctx, event); err != nil {
					return nil, false, err
				}
			}

			result, err := r.backend.Create(ctx, event, scopeCtx)
			if err != nil {
				return nil, false, r.convertToStatusError(err)
			}

			return result, true, nil
		}
		return nil, false, r.convertToStatusError(err)
	}

	// Get updated object
	updated, err := objInfo.UpdatedObject(ctx, existing)
	if err != nil {
		return nil, false, err
	}

	event, ok := updated.(*eventsv1.Event)
	if !ok {
		return nil, false, fmt.Errorf("not an events.k8s.io/v1 Event: %#v", updated)
	}

	// Validate update
	if updateValidation != nil {
		if err := updateValidation(ctx, event, existing); err != nil {
			return nil, false, err
		}
	}

	result, err := r.backend.Update(ctx, event, scopeCtx)
	if err != nil {
		return nil, false, r.convertToStatusError(err)
	}

	return result, false, nil
}

// Delete removes an event.
func (r *EventsV1REST) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return nil, false, errors.NewBadRequest("namespace is required")
	}

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, false, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scope := ExtractScopeFromUser(reqUser)
	scopeCtx := storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	}

	// Get the event first for validation and return value (backend now uses eventsv1.Event natively)
	existing, err := r.backend.Get(ctx, namespace, name, scopeCtx)
	if err != nil {
		if errors.IsNotFound(err) {
			// Already deleted
			return nil, true, nil
		}
		return nil, false, r.convertToStatusError(err)
	}

	// Run validation if provided
	if deleteValidation != nil {
		if err := deleteValidation(ctx, existing); err != nil {
			return nil, false, err
		}
	}

	if err := r.backend.Delete(ctx, namespace, name, scopeCtx); err != nil {
		return nil, false, r.convertToStatusError(err)
	}

	return existing, true, nil
}

// Watch returns a watch.Interface that streams event changes.
func (r *EventsV1REST) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	if r.watcher == nil {
		return nil, errors.NewServiceUnavailable("Watch API is not available. NATS is not configured.")
	}

	namespace, _ := request.NamespaceFrom(ctx)

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		klog.Error("No user in context for events watch request")
		return nil, errors.NewServiceUnavailable("Unable to process request. Please try again.")
	}

	scope := ExtractScopeFromUser(reqUser)

	filter := eventwatch.EventsWatchFilter{
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
		parseFieldSelectorForWatchV1(options.FieldSelector, &filter)
	}

	klog.V(4).InfoS("Starting events.k8s.io/v1 watch",
		"namespace", namespace,
		"scopeType", scope.Type,
		"scopeName", scope.Name,
		"filter", filter,
	)

	// Backend now uses eventsv1.Event natively - direct passthrough
	return r.watcher.Watch(ctx, storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	}, filter)
}

// ConvertToTable converts to table format.
func (r *EventsV1REST) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(eventsv1.Resource("events")).ConvertToTable(ctx, object, tableOptions)
}

// convertToStatusError converts internal errors to Kubernetes API errors.
func (r *EventsV1REST) convertToStatusError(err error) error {
	// If already a status error, return as-is
	if errors.IsNotFound(err) || errors.IsBadRequest(err) || errors.IsInternalError(err) {
		return err
	}

	klog.ErrorS(err, "Error in events storage")
	return errors.NewServiceUnavailable("Failed to access events storage. Please try again later.")
}

// parseFieldSelectorForWatchV1 extracts watch filter parameters from standard field selectors.
// Note: For events.k8s.io/v1, field names use "regarding" instead of "involvedObject"
func parseFieldSelectorForWatchV1(selector fields.Selector, filter *eventwatch.EventsWatchFilter) {
	if selector == nil || selector.Empty() {
		return
	}

	// Check both regarding (v1) and involvedObject (corev1) field names for compatibility
	if value, found := selector.RequiresExactMatch("regarding.kind"); found {
		filter.InvolvedObjectKind = value
	} else if value, found := selector.RequiresExactMatch("involvedObject.kind"); found {
		filter.InvolvedObjectKind = value
	}

	if value, found := selector.RequiresExactMatch("regarding.namespace"); found {
		filter.InvolvedObjectNamespace = value
	} else if value, found := selector.RequiresExactMatch("involvedObject.namespace"); found {
		filter.InvolvedObjectNamespace = value
	}

	if value, found := selector.RequiresExactMatch("regarding.name"); found {
		filter.InvolvedObjectName = value
	} else if value, found := selector.RequiresExactMatch("involvedObject.name"); found {
		filter.InvolvedObjectName = value
	}

	if value, found := selector.RequiresExactMatch("regarding.uid"); found {
		filter.InvolvedObjectUID = value
	} else if value, found := selector.RequiresExactMatch("involvedObject.uid"); found {
		filter.InvolvedObjectUID = value
	}

	if value, found := selector.RequiresExactMatch("reason"); found {
		filter.Reason = value
	}
	if value, found := selector.RequiresExactMatch("type"); found {
		filter.Type = value
	}

	// Check both reportingController (v1) and source (corev1) for compatibility
	if value, found := selector.RequiresExactMatch("reportingController"); found {
		filter.Source = value
	} else if value, found := selector.RequiresExactMatch("source"); found {
		filter.Source = value
	}
}
