package activityquery

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/internal/registry/scope"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/internal/timeutil"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// StorageInterface defines the storage operations needed by QueryStorage.
type StorageInterface interface {
	QueryActivities(ctx context.Context, spec storage.ActivityQuerySpec, scope storage.ScopeContext) (*storage.ActivityQueryResult, error)
	GetMaxQueryWindow() time.Duration
	GetMaxPageSize() int32
}

// QueryStorage implements REST storage for ActivityQuery.
type QueryStorage struct {
	storage StorageInterface
}

// NewQueryStorage creates a new REST storage for ActivityQuery.
func NewQueryStorage(s StorageInterface) *QueryStorage {
	return &QueryStorage{
		storage: s,
	}
}

var (
	_ rest.Scoper               = &QueryStorage{}
	_ rest.Creater              = &QueryStorage{}
	_ rest.Storage              = &QueryStorage{}
	_ rest.SingularNameProvider = &QueryStorage{}
)

// New returns an empty ActivityQuery.
func (s *QueryStorage) New() runtime.Object {
	return &v1alpha1.ActivityQuery{}
}

// Destroy cleans up resources.
func (s *QueryStorage) Destroy() {}

// NamespaceScoped returns false because ActivityQuery is cluster-scoped.
func (s *QueryStorage) NamespaceScoped() bool {
	return false
}

// GetSingularName returns the singular name of the resource.
func (s *QueryStorage) GetSingularName() string {
	return "activityquery"
}

// Create implements the ephemeral query pattern. The query executes immediately
// and returns results without persisting the resource.
func (s *QueryStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	query, ok := obj.(*v1alpha1.ActivityQuery)
	if !ok {
		return nil, fmt.Errorf("not an ActivityQuery: %#v", obj)
	}

	klog.V(4).Infof("Executing ActivityQuery: %+v", query.Spec)

	// Get user for scope context
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}

	scopeCtx := scope.ExtractScopeFromUser(reqUser)

	klog.InfoS("Executing scope-aware activity query",
		"query", query.Name,
		"scopeType", scopeCtx.Type,
		"scopeName", scopeCtx.Name,
		"startTime", query.Spec.StartTime,
		"endTime", query.Spec.EndTime,
		"namespace", query.Spec.Namespace,
		"changeSource", query.Spec.ChangeSource,
	)

	// Validate query spec
	if errs := s.validateQuerySpec(query); len(errs) > 0 {
		return nil, errors.NewInvalid(
			v1alpha1.SchemeGroupVersion.WithKind("ActivityQuery").GroupKind(),
			query.Name,
			errs,
		)
	}

	// Parse effective timestamps
	now := time.Now()
	effectiveStartTime, err := timeutil.ParseFlexibleTime(query.Spec.StartTime, now)
	if err != nil {
		return nil, errors.NewInternalError(fmt.Errorf("failed to parse startTime: %w", err))
	}
	effectiveEndTime, err := timeutil.ParseFlexibleTime(query.Spec.EndTime, now)
	if err != nil {
		return nil, errors.NewInternalError(fmt.Errorf("failed to parse endTime: %w", err))
	}

	// Build storage query spec from API spec
	storageSpec := storage.ActivityQuerySpec{
		Namespace:    query.Spec.Namespace,
		StartTime:    query.Spec.StartTime,
		EndTime:      query.Spec.EndTime,
		ChangeSource: query.Spec.ChangeSource,
		APIGroup:     query.Spec.APIGroup,
		ResourceKind: query.Spec.ResourceKind,
		ActorName:    query.Spec.ActorName,
		ResourceUID:  query.Spec.ResourceUID,
		Search:       query.Spec.Search,
		Filter:       query.Spec.Filter,
		Limit:        query.Spec.Limit,
		Continue:     query.Spec.Continue,
	}

	result, err := s.storage.QueryActivities(ctx, storageSpec, scopeCtx)
	if err != nil {
		klog.ErrorS(err, "Failed to query activities")
		return nil, errors.NewServiceUnavailable("Failed to execute query. Try again or contact support if the problem persists.")
	}

	// Convert JSON results to Activity objects
	activities := make([]v1alpha1.Activity, 0, len(result.Activities))
	for _, activityJSON := range result.Activities {
		var activity v1alpha1.Activity
		if err := json.Unmarshal([]byte(activityJSON), &activity); err != nil {
			klog.ErrorS(err, "Corrupt activity record in storage")
			return nil, errors.NewInternalError(fmt.Errorf("unable to load activity records. Please contact support if the problem persists"))
		}
		activities = append(activities, activity)
	}

	query.Status.Results = activities
	query.Status.Continue = result.Continue
	query.Status.EffectiveStartTime = effectiveStartTime.Format(time.RFC3339)
	query.Status.EffectiveEndTime = effectiveEndTime.Format(time.RFC3339)

	return query, nil
}

// validateQuerySpec validates the query specification and returns field errors.
func (s *QueryStorage) validateQuerySpec(query *v1alpha1.ActivityQuery) field.ErrorList {
	allErrs := field.ErrorList{}
	specPath := field.NewPath("spec")

	now := time.Now()

	// Validate startTime
	if query.Spec.StartTime == "" {
		allErrs = append(allErrs, field.Required(specPath.Child("startTime"), "must specify a start time"))
	} else {
		_, err := timeutil.ParseFlexibleTime(query.Spec.StartTime, now)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(specPath.Child("startTime"), query.Spec.StartTime, err.Error()))
		}
	}

	// Validate endTime
	if query.Spec.EndTime == "" {
		allErrs = append(allErrs, field.Required(specPath.Child("endTime"), "must specify an end time"))
	} else {
		_, err := timeutil.ParseFlexibleTime(query.Spec.EndTime, now)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(specPath.Child("endTime"), query.Spec.EndTime, err.Error()))
		}
	}

	// Validate time range
	if query.Spec.StartTime != "" && query.Spec.EndTime != "" {
		startTime, err1 := timeutil.ParseFlexibleTime(query.Spec.StartTime, now)
		endTime, err2 := timeutil.ParseFlexibleTime(query.Spec.EndTime, now)

		if err1 == nil && err2 == nil {
			if !endTime.After(startTime) {
				allErrs = append(allErrs, field.Invalid(specPath.Child("endTime"), query.Spec.EndTime, "endTime must be after startTime"))
			}

			queryWindow := endTime.Sub(startTime)
			maxWindow := s.storage.GetMaxQueryWindow()
			if maxWindow > 0 && queryWindow > maxWindow {
				allErrs = append(allErrs, field.Invalid(specPath, fmt.Sprintf("%s to %s", query.Spec.StartTime, query.Spec.EndTime),
					fmt.Sprintf("time range of %v exceeds maximum of %v", queryWindow, maxWindow)))
			}
		}
	}

	// Validate changeSource
	if query.Spec.ChangeSource != "" && query.Spec.ChangeSource != "human" && query.Spec.ChangeSource != "system" {
		allErrs = append(allErrs, field.Invalid(specPath.Child("changeSource"), query.Spec.ChangeSource,
			"must be 'human' or 'system'"))
	}

	// Validate limit
	if query.Spec.Limit < 0 {
		allErrs = append(allErrs, field.Invalid(specPath.Child("limit"), query.Spec.Limit, "limit must be non-negative"))
	}

	maxPageSize := s.storage.GetMaxPageSize()
	if maxPageSize > 0 && query.Spec.Limit > maxPageSize {
		allErrs = append(allErrs, field.Invalid(specPath.Child("limit"), query.Spec.Limit,
			fmt.Sprintf("limit of %d exceeds maximum of %d", query.Spec.Limit, maxPageSize)))
	}

	// Validate CEL filter
	if query.Spec.Filter != "" {
		_, err := cel.CompileActivityFilter(query.Spec.Filter)
		if err != nil {
			allErrs = append(allErrs, field.Invalid(specPath.Child("filter"), query.Spec.Filter, err.Error()))
		}
	}

	return allErrs
}

// ConvertToTable converts to table format.
func (s *QueryStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(v1alpha1.Resource("activityquery")).ConvertToTable(ctx, object, tableOptions)
}
