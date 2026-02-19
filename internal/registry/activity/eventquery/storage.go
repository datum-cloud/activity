package eventquery

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/registry/scope"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/internal/timeutil"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// StorageInterface defines the storage operations required by EventQueryREST.
type StorageInterface interface {
	QueryEvents(ctx context.Context, spec v1alpha1.EventQuerySpec, scope storage.ScopeContext) (*storage.EventQueryResult, error)
	GetMaxQueryWindow() time.Duration
	GetMaxPageSize() int32
}

// EventQueryREST implements REST storage for EventQuery.
// EventQuery is an ephemeral resource (like TokenReview/SubjectAccessReview and AuditLogQuery)
// that only supports Create. Queries execute immediately against ClickHouse and return
// results without persisting the resource, allowing historical event search up to 60 days.
type EventQueryREST struct {
	storage StorageInterface
}

// NewEventQueryREST returns a RESTStorage object for EventQuery.
func NewEventQueryREST(backend storage.EventQueryBackend) *EventQueryREST {
	return &EventQueryREST{
		storage: backend,
	}
}

var (
	_ rest.Scoper               = &EventQueryREST{}
	_ rest.Creater              = &EventQueryREST{}
	_ rest.Storage              = &EventQueryREST{}
	_ rest.SingularNameProvider = &EventQueryREST{}
	// Note: Get and List are intentionally NOT implemented.
	// EventQuery is an ephemeral resource that only supports Create.
	// Queries execute immediately and return results without persisting the resource.
)

// New returns an empty EventQuery object.
func (r *EventQueryREST) New() runtime.Object {
	return &v1alpha1.EventQuery{}
}

// Destroy cleans up resources held by the storage.
func (r *EventQueryREST) Destroy() {
	// Nothing to destroy — the backend is shared with ClickHouseEventsBackend
}

// NamespaceScoped returns false because EventQuery is cluster-scoped.
func (r *EventQueryREST) NamespaceScoped() bool {
	return false
}

// GetSingularName returns the singular name of the resource.
func (r *EventQueryREST) GetSingularName() string {
	return "eventquery"
}

// Create implements the ephemeral query pattern. The query executes immediately
// against ClickHouse and returns results in the Status field without persisting
// the EventQuery resource, keeping the API server clean.
func (r *EventQueryREST) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	query, ok := obj.(*v1alpha1.EventQuery)
	if !ok {
		return nil, fmt.Errorf("not an EventQuery: %#v", obj)
	}

	klog.V(4).Infof("Executing EventQuery: %+v", query.Spec)

	// Authenticate the request to ensure RBAC is enforced
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	// Apply tenant isolation by extracting scope boundaries from user context.
	// Platform admins see all events; organization/project users see only their scope.
	scopeCtx := scope.ExtractScopeFromUser(reqUser)

	klog.InfoS("Executing scope-aware event query",
		"query", query.Name,
		"scopeType", scopeCtx.Type,
		"scopeName", scopeCtx.Name,
		"startTime", query.Spec.StartTime,
		"endTime", query.Spec.EndTime,
		"namespace", query.Spec.Namespace,
	)

	// Reject invalid queries early to prevent expensive database operations
	if errs := r.validateQuerySpec(query); len(errs) > 0 {
		return nil, errors.NewInvalid(
			v1alpha1.SchemeGroupVersion.WithKind("EventQuery").GroupKind(),
			query.Name,
			errs,
		)
	}

	// Parse effective timestamps using a single reference time for consistency.
	// This prevents sub-second drift when both startTime and endTime use relative formats.
	now := time.Now()
	effectiveStartTime, err := timeutil.ParseFlexibleTime(query.Spec.StartTime, now)
	if err != nil {
		// Should not happen — validation already confirmed the format is valid
		return nil, errors.NewInternalError(fmt.Errorf("failed to parse startTime: %w", err))
	}
	effectiveEndTime, err := timeutil.ParseFlexibleTime(query.Spec.EndTime, now)
	if err != nil {
		// Should not happen — validation already confirmed the format is valid
		return nil, errors.NewInternalError(fmt.Errorf("failed to parse endTime: %w", err))
	}

	result, err := r.storage.QueryEvents(ctx, query.Spec, scopeCtx)
	if err != nil {
		return nil, r.convertToStructuredError(query, err)
	}

	query.Status.Results = result.Events
	query.Status.Continue = result.Continue
	query.Status.EffectiveStartTime = effectiveStartTime.Format(time.RFC3339)
	query.Status.EffectiveEndTime = effectiveEndTime.Format(time.RFC3339)

	return query, nil
}

// validateQuerySpec validates the EventQuerySpec and returns field-level errors.
func (r *EventQueryREST) validateQuerySpec(query *v1alpha1.EventQuery) field.ErrorList {
	allErrs := field.ErrorList{}
	specPath := field.NewPath("spec")

	// Use a single reference time for all time parsing to prevent sub-second drift
	now := time.Now()

	if query.Spec.StartTime == "" {
		allErrs = append(allErrs, field.Required(specPath.Child("startTime"), "must specify a start time"))
	} else {
		_, err := timeutil.ParseFlexibleTime(query.Spec.StartTime, now)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(specPath.Child("startTime"), query.Spec.StartTime, err.Error()))
		}
	}

	if query.Spec.EndTime == "" {
		allErrs = append(allErrs, field.Required(specPath.Child("endTime"), "must specify an end time"))
	} else {
		_, err := timeutil.ParseFlexibleTime(query.Spec.EndTime, now)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(specPath.Child("endTime"), query.Spec.EndTime, err.Error()))
		}
	}

	if query.Spec.StartTime != "" && query.Spec.EndTime != "" {
		startTime, err1 := timeutil.ParseFlexibleTime(query.Spec.StartTime, now)
		endTime, err2 := timeutil.ParseFlexibleTime(query.Spec.EndTime, now)

		if err1 == nil && err2 == nil {
			if !endTime.After(startTime) {
				allErrs = append(allErrs, field.Invalid(
					specPath.Child("endTime"),
					query.Spec.EndTime,
					"endTime must be after startTime",
				))
			}

			queryWindow := endTime.Sub(startTime)
			maxWindow := r.storage.GetMaxQueryWindow()
			if maxWindow > 0 && queryWindow > maxWindow {
				allErrs = append(allErrs, field.Invalid(
					specPath,
					fmt.Sprintf("%s to %s", query.Spec.StartTime, query.Spec.EndTime),
					fmt.Sprintf("time range of %v exceeds the maximum of %v (60 days). Reduce the time range or split into smaller queries", queryWindow, maxWindow),
				))
			}
		}
	}

	if query.Spec.Limit < 0 {
		allErrs = append(allErrs, field.Invalid(
			specPath.Child("limit"),
			query.Spec.Limit,
			"limit must be non-negative",
		))
	}

	maxPageSize := r.storage.GetMaxPageSize()
	if maxPageSize > 0 && query.Spec.Limit > maxPageSize {
		allErrs = append(allErrs, field.Invalid(
			specPath.Child("limit"),
			query.Spec.Limit,
			fmt.Sprintf("limit of %d exceeds maximum of %d. Set limit to %d or less", query.Spec.Limit, maxPageSize, maxPageSize),
		))
	}

	// Validate continue cursor if provided
	if query.Spec.Continue != "" {
		if err := storage.ValidateEventQueryCursor(query.Spec.Continue, query.Spec); err != nil {
			allErrs = append(allErrs, field.Invalid(
				specPath.Child("continue"),
				query.Spec.Continue,
				err.Error(),
			))
		}
	}

	return allErrs
}

// convertToStructuredError translates internal database errors into actionable
// Kubernetes status errors with appropriate HTTP codes and retry semantics.
func (r *EventQueryREST) convertToStructuredError(query *v1alpha1.EventQuery, err error) error {
	klog.ErrorS(err, "failed to execute EventQuery against ClickHouse", "query", query.Name)
	return errors.NewServiceUnavailable("Failed to execute query. Please try again later or contact support for help.")
}

// ConvertToTable converts an EventQuery to table format for kubectl output.
func (r *EventQueryREST) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(v1alpha1.Resource("eventqueries")).ConvertToTable(ctx, object, tableOptions)
}
