package auditlogfacet

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

// AuditLogFacetStorageInterface defines the storage operations needed by AuditLogFacetsQueryStorage.
type AuditLogFacetStorageInterface interface {
	QueryAuditLogFacets(ctx context.Context, spec storage.AuditLogFacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error)
}

// AuditLogFacetsQueryStorage implements REST storage for AuditLogFacetsQuery resources.
// This is an ephemeral resource - it only supports Create operations and
// returns facet results without persisting anything.
type AuditLogFacetsQueryStorage struct {
	storage AuditLogFacetStorageInterface
}

// NewAuditLogFacetsQueryStorage creates a new REST storage for AuditLogFacetsQuery.
func NewAuditLogFacetsQueryStorage(s AuditLogFacetStorageInterface) *AuditLogFacetsQueryStorage {
	return &AuditLogFacetsQueryStorage{
		storage: s,
	}
}

var (
	_ rest.Scoper               = &AuditLogFacetsQueryStorage{}
	_ rest.Storage              = &AuditLogFacetsQueryStorage{}
	_ rest.Creater              = &AuditLogFacetsQueryStorage{}
	_ rest.SingularNameProvider = &AuditLogFacetsQueryStorage{}
)

// New returns an empty AuditLogFacetsQuery.
func (s *AuditLogFacetsQueryStorage) New() runtime.Object {
	return &v1alpha1.AuditLogFacetsQuery{}
}

// Destroy cleans up resources.
func (s *AuditLogFacetsQueryStorage) Destroy() {}

// NamespaceScoped returns false because AuditLogFacetsQuery is cluster-scoped.
func (s *AuditLogFacetsQueryStorage) NamespaceScoped() bool {
	return false
}

// GetSingularName returns the singular name of the resource.
func (s *AuditLogFacetsQueryStorage) GetSingularName() string {
	return "auditlogfacetsquery"
}

// Create executes the facet query and returns the results.
func (s *AuditLogFacetsQueryStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	query, ok := obj.(*v1alpha1.AuditLogFacetsQuery)
	if !ok {
		return nil, errors.NewBadRequest("expected AuditLogFacetsQuery object")
	}

	// Validate input - collect all errors so users can fix everything in one request
	if errs := validateAuditLogFacetQueryInput(query); len(errs) > 0 {
		return nil, apierrors.NewValidationStatusError(
			v1alpha1.SchemeGroupVersion.WithKind("AuditLogFacetsQuery").GroupKind(), "", errs)
	}

	// Extract user for scope context
	reqUser, ok := request.UserFrom(ctx)
	if !ok {
		return nil, errors.NewInternalError(fmt.Errorf("no user in context"))
	}
	scope := extractScopeFromUser(reqUser)

	// Build storage spec from query spec
	spec := storage.AuditLogFacetQuerySpec{
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
	result, err := s.storage.QueryAuditLogFacets(ctx, spec, scope)
	if err != nil {
		// Log the actual error for debugging but return a generic message to avoid leaking internal details
		klog.ErrorS(err, "Failed to query audit log facets",
			"filter", query.Spec.Filter,
			"timeRange.start", query.Spec.TimeRange.Start,
			"timeRange.end", query.Spec.TimeRange.End,
		)
		return nil, errors.NewServiceUnavailable("Failed to retrieve facets. Please try again later or contact support for help.")
	}

	// Build response
	response := query.DeepCopy()
	response.Status = v1alpha1.AuditLogFacetsQueryStatus{
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

// validateAuditLogFacetQueryInput validates the AuditLogFacetsQuery input and returns all field errors.
func validateAuditLogFacetQueryInput(query *v1alpha1.AuditLogFacetsQuery) field.ErrorList {
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
		} else if !storage.IsValidAuditLogFacetField(f.Field) {
			allErrs = append(allErrs, field.NotSupported(facetPath.Child("field"), f.Field, storage.GetAuditLogFacetFieldNames()))
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
