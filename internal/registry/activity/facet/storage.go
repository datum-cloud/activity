package facet

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/apierrors"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// FacetStorageInterface defines the storage operations needed by FacetQueryStorage.
type FacetStorageInterface interface {
	QueryFacets(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error)
}

// FacetQueryStorage implements REST storage for ActivityFacetQuery resources.
// This is an ephemeral resource - it only supports Create operations and
// returns facet results without persisting anything.
type FacetQueryStorage struct {
	storage FacetStorageInterface
}

// NewFacetQueryStorage creates a new REST storage for ActivityFacetQuery.
func NewFacetQueryStorage(s FacetStorageInterface) *FacetQueryStorage {
	return &FacetQueryStorage{
		storage: s,
	}
}

var (
	_ rest.Scoper               = &FacetQueryStorage{}
	_ rest.Storage              = &FacetQueryStorage{}
	_ rest.Creater              = &FacetQueryStorage{}
	_ rest.SingularNameProvider = &FacetQueryStorage{}
)

// New returns an empty ActivityFacetQuery.
func (s *FacetQueryStorage) New() runtime.Object {
	return &v1alpha1.ActivityFacetQuery{}
}

// Destroy cleans up resources.
func (s *FacetQueryStorage) Destroy() {}

// NamespaceScoped returns false because ActivityFacetQuery is cluster-scoped.
func (s *FacetQueryStorage) NamespaceScoped() bool {
	return false
}

// GetSingularName returns the singular name of the resource.
func (s *FacetQueryStorage) GetSingularName() string {
	return "activityfacetquery"
}

// Create executes the facet query and returns the results.
func (s *FacetQueryStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	query, ok := obj.(*v1alpha1.ActivityFacetQuery)
	if !ok {
		return nil, errors.NewBadRequest("expected ActivityFacetQuery object")
	}

	// Validate input - collect all errors so users can fix everything in one request
	if errs := validateFacetQueryInput(query); len(errs) > 0 {
		return nil, apierrors.NewValidationStatusError(
			v1alpha1.SchemeGroupVersion.WithKind("ActivityFacetQuery").GroupKind(), "", errs)
	}

	// Extract user for scope context
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}
	scope := extractScopeFromUser(reqUser)

	// Build storage spec from query spec
	spec := storage.FacetQuerySpec{
		StartTime: query.Spec.TimeRange.Start,
		EndTime:   query.Spec.TimeRange.End,
		Filter:    query.Spec.Filter,
		Facets:    make([]storage.FacetFieldSpec, len(query.Spec.Facets)),
	}

	for i, f := range query.Spec.Facets {
		spec.Facets[i] = storage.FacetFieldSpec{
			Field: f.Field,
			Limit: f.Limit,
		}
	}

	// Execute facet query
	result, err := s.storage.QueryFacets(ctx, spec, scope)
	if err != nil {
		// Log the actual error for debugging but return a generic message to avoid leaking internal details
		klog.ErrorS(err, "Failed to query activity facets",
			"filter", query.Spec.Filter,
			"timeRange.start", query.Spec.TimeRange.Start,
			"timeRange.end", query.Spec.TimeRange.End,
		)
		return nil, errors.NewServiceUnavailable("Failed to retrieve facets. Please try again later or contact support for help.")
	}

	// Build response
	response := query.DeepCopy()
	response.Status = v1alpha1.ActivityFacetQueryStatus{
		Facets: make([]v1alpha1.FacetResult, len(result.Facets)),
	}

	for i, f := range result.Facets {
		response.Status.Facets[i] = v1alpha1.FacetResult{
			Field:  f.Field,
			Values: make([]v1alpha1.FacetValue, len(f.Values)),
		}
		for j, v := range f.Values {
			response.Status.Facets[i].Values[j] = v1alpha1.FacetValue{
				Value: v.Value,
				Count: v.Count,
			}
		}
	}

	return response, nil
}

// validateFacetQueryInput validates the ActivityFacetQuery input and returns all field errors.
func validateFacetQueryInput(query *v1alpha1.ActivityFacetQuery) field.ErrorList {
	allErrs := field.ErrorList{}
	specPath := field.NewPath("spec")
	facetsPath := specPath.Child("facets")

	if len(query.Spec.Facets) == 0 {
		allErrs = append(allErrs, field.Required(facetsPath, "provide at least one facet to query"))
		return allErrs
	}

	if len(query.Spec.Facets) > 10 {
		allErrs = append(allErrs, field.TooMany(facetsPath, len(query.Spec.Facets), 10))
	}

	for i, f := range query.Spec.Facets {
		facetPath := facetsPath.Index(i)

		if f.Field == "" {
			allErrs = append(allErrs, field.Required(facetPath.Child("field"), "specify which field to get distinct values for"))
		} else if !storage.IsValidActivityFacetField(f.Field) {
			allErrs = append(allErrs, field.NotSupported(facetPath.Child("field"), f.Field, storage.GetActivityFacetFieldNames()))
		}

		if f.Limit < 0 {
			allErrs = append(allErrs, field.Invalid(facetPath.Child("limit"), f.Limit, "must be non-negative"))
		}
	}

	return allErrs
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
