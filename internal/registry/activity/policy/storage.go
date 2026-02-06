package policy

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// REST implements a RESTStorage for ActivityPolicy.
type REST struct {
	*genericregistry.Store
}

// StatusREST implements the REST endpoint for updating ActivityPolicy status.
type StatusREST struct {
	store *genericregistry.Store
}

// New creates a new ActivityPolicy object.
func (r *StatusREST) New() runtime.Object {
	return &v1alpha1.ActivityPolicy{}
}

// Destroy cleans up resources on shutdown.
func (r *StatusREST) Destroy() {
	// No-op: the store is shared with the main REST storage
}

// Get retrieves the object from the storage.
func (r *StatusREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return r.store.Get(ctx, name, options)
}

// Update alters the status subset of an object.
func (r *StatusREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return r.store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}


// policyTableConvertor implements rest.TableConvertor for ActivityPolicy.
type policyTableConvertor struct{}

var _ rest.TableConvertor = &policyTableConvertor{}

// ConvertToTable converts ActivityPolicy objects to table format for kubectl display.
func (c *policyTableConvertor) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	table := &metav1.Table{
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Description: "Policy name"},
			{Name: "API Group", Type: "string", Description: "Target resource API group"},
			{Name: "Kind", Type: "string", Description: "Target resource kind"},
			{Name: "Audit Rules", Type: "integer", Description: "Number of audit log translation rules"},
			{Name: "Event Rules", Type: "integer", Description: "Number of event translation rules"},
			{Name: "Ready", Type: "string", Description: "Whether the policy compiled successfully"},
			{Name: "Age", Type: "string", Description: "Time since policy was created"},
		},
	}

	switch t := object.(type) {
	case *v1alpha1.ActivityPolicy:
		table.Rows = append(table.Rows, policyToTableRow(t))
	case *v1alpha1.ActivityPolicyList:
		for i := range t.Items {
			table.Rows = append(table.Rows, policyToTableRow(&t.Items[i]))
		}
	}

	return table, nil
}

// policyToTableRow converts an ActivityPolicy to a table row.
func policyToTableRow(policy *v1alpha1.ActivityPolicy) metav1.TableRow {
	// Format API group - show "(core)" for empty string
	apiGroup := policy.Spec.Resource.APIGroup
	if apiGroup == "" {
		apiGroup = "(core)"
	}

	// Calculate age
	age := "<unknown>"
	if !policy.CreationTimestamp.IsZero() {
		age = formatDuration(metav1.Now().Sub(policy.CreationTimestamp.Time))
	}

	// Get Ready condition status
	ready := "Unknown"
	for _, cond := range policy.Status.Conditions {
		if cond.Type == "Ready" {
			ready = string(cond.Status)
			break
		}
	}

	return metav1.TableRow{
		Object: runtime.RawExtension{Object: policy},
		Cells: []interface{}{
			policy.Name,
			apiGroup,
			policy.Spec.Resource.Kind,
			len(policy.Spec.AuditRules),
			len(policy.Spec.EventRules),
			ready,
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

// NewStorage creates a new REST storage for ActivityPolicy backed by etcd.
// It returns both the main storage and the status subresource storage.
func NewStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*REST, *StatusREST, error) {
	strategy := NewStrategy(scheme)
	statusStrategy := NewStatusStrategy(scheme)

	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &v1alpha1.ActivityPolicy{} },
		NewListFunc:               func() runtime.Object { return &v1alpha1.ActivityPolicyList{} },
		DefaultQualifiedResource:  v1alpha1.Resource("activitypolicies"),
		SingularQualifiedResource: v1alpha1.Resource("activitypolicy"),

		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,

		TableConvertor: &policyTableConvertor{},
	}

	options := &generic.StoreOptions{
		RESTOptions: optsGetter,
		AttrFunc:    GetAttrs,
	}

	if err := store.CompleteWithOptions(options); err != nil {
		return nil, nil, err
	}

	// Create a copy of the store for status updates with the status strategy
	statusStore := *store
	statusStore.UpdateStrategy = statusStrategy
	statusStore.ResetFieldsStrategy = statusStrategy

	return &REST{store}, &StatusREST{store: &statusStore}, nil
}
