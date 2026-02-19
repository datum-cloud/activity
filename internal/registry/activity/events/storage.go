package events

import (
	"context"
	"fmt"
	"strconv"

	corev1 "k8s.io/api/core/v1"
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

// EventsREST implements the REST interface for Kubernetes Events.
// Unlike AuditLogQuery (which is an ephemeral resource), Events support full CRUD operations.
type EventsREST struct {
	backend EventsBackend
	watcher *eventwatch.EventsWatcher
}

// NewEventsREST returns a REST storage object for Events.
func NewEventsREST(backend EventsBackend) *EventsREST {
	return &EventsREST{
		backend: backend,
	}
}

// NewEventsRESTWithWatcher returns a REST storage object for Events with watch support.
func NewEventsRESTWithWatcher(backend EventsBackend, watcher *eventwatch.EventsWatcher) *EventsREST {
	return &EventsREST{
		backend: backend,
		watcher: watcher,
	}
}

// Compile-time interface verification
var (
	_ rest.Scoper               = &EventsREST{}
	_ rest.Creater              = &EventsREST{}
	_ rest.Getter               = &EventsREST{}
	_ rest.Lister               = &EventsREST{}
	_ rest.Updater              = &EventsREST{}
	_ rest.GracefulDeleter      = &EventsREST{}
	_ rest.Watcher              = &EventsREST{}
	_ rest.Storage              = &EventsREST{}
	_ rest.SingularNameProvider = &EventsREST{}
)

// New returns an empty Event object.
func (r *EventsREST) New() runtime.Object {
	return &corev1.Event{}
}

// Destroy cleans up resources.
func (r *EventsREST) Destroy() {
	// Nothing to destroy
}

// NamespaceScoped returns true - Events are namespaced resources.
func (r *EventsREST) NamespaceScoped() bool {
	return true
}

// GetSingularName returns the singular name of the resource.
func (r *EventsREST) GetSingularName() string {
	return "event"
}

// NewList returns an empty EventList.
func (r *EventsREST) NewList() runtime.Object {
	return &corev1.EventList{}
}

// Create stores a new event.
func (r *EventsREST) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	event, ok := obj.(*corev1.Event)
	if !ok {
		return nil, fmt.Errorf("not an Event: %#v", obj)
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

	klog.V(4).InfoS("Creating event",
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

	result, err := r.backend.Create(ctx, event, storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	})
	if err != nil {
		klog.ErrorS(err, "Failed to create event",
			"namespace", namespace,
			"name", event.Name,
		)
		return nil, r.convertToStatusError(err)
	}

	return result, nil
}

// Get retrieves an event by name.
func (r *EventsREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return nil, errors.NewBadRequest("namespace is required")
	}

	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scope := ExtractScopeFromUser(reqUser)

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
func (r *EventsREST) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
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

	klog.V(4).InfoS("Listing events",
		"namespace", namespace,
		"fieldSelector", listOpts.FieldSelector,
		"scopeType", scope.Type,
		"scopeName", scope.Name,
	)

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
func (r *EventsREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
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

	// Get existing event
	existing, err := r.backend.Get(ctx, namespace, name, scopeCtx)
	if err != nil {
		if errors.IsNotFound(err) && forceAllowCreate {
			// Create new event
			updated, err := objInfo.UpdatedObject(ctx, nil)
			if err != nil {
				return nil, false, err
			}

			event, ok := updated.(*corev1.Event)
			if !ok {
				return nil, false, fmt.Errorf("not an Event: %#v", updated)
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

	event, ok := updated.(*corev1.Event)
	if !ok {
		return nil, false, fmt.Errorf("not an Event: %#v", updated)
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
func (r *EventsREST) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
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

	// Get the event first for validation and return value
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
func (r *EventsREST) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
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
		parseFieldSelectorForWatch(options.FieldSelector, &filter)
	}

	klog.V(4).InfoS("Starting events watch",
		"namespace", namespace,
		"scopeType", scope.Type,
		"scopeName", scope.Name,
		"filter", filter,
	)

	return r.watcher.Watch(ctx, storage.ScopeContext{
		Type: scope.Type,
		Name: scope.Name,
	}, filter)
}

// ConvertToTable converts to table format.
func (r *EventsREST) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(corev1.Resource("events")).ConvertToTable(ctx, object, tableOptions)
}

// convertToStatusError converts internal errors to Kubernetes API errors.
func (r *EventsREST) convertToStatusError(err error) error {
	// If already a status error, return as-is
	if errors.IsNotFound(err) || errors.IsBadRequest(err) || errors.IsInternalError(err) {
		return err
	}

	klog.ErrorS(err, "Error in events storage")
	return errors.NewServiceUnavailable("Failed to access events storage. Please try again later.")
}

// parseFieldSelectorForWatch extracts watch filter parameters from standard field selectors.
func parseFieldSelectorForWatch(selector fields.Selector, filter *eventwatch.EventsWatchFilter) {
	if selector == nil || selector.Empty() {
		return
	}

	if value, found := selector.RequiresExactMatch("involvedObject.kind"); found {
		filter.InvolvedObjectKind = value
	}
	if value, found := selector.RequiresExactMatch("involvedObject.namespace"); found {
		filter.InvolvedObjectNamespace = value
	}
	if value, found := selector.RequiresExactMatch("involvedObject.name"); found {
		filter.InvolvedObjectName = value
	}
	if value, found := selector.RequiresExactMatch("involvedObject.uid"); found {
		filter.InvolvedObjectUID = value
	}
	if value, found := selector.RequiresExactMatch("reason"); found {
		filter.Reason = value
	}
	if value, found := selector.RequiresExactMatch("type"); found {
		filter.Type = value
	}
	if value, found := selector.RequiresExactMatch("source"); found {
		filter.Source = value
	}
}
