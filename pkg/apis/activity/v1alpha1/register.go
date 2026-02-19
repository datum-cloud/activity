package v1alpha1

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GroupName is the group name for the activity API
const GroupName = "activity.miloapis.com"

// SchemeGroupVersion is group version used to register these objects
var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1alpha1"}

var (
	// SchemeBuilder is the scheme builder for this API group
	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
	// AddToScheme adds the types in this group-version to the given scheme
	AddToScheme = SchemeBuilder.AddToScheme
)

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

// addKnownTypes adds the set of types defined in this package to the supplied scheme
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&AuditLogQuery{},
		&AuditLogFacetsQuery{},
		&ActivityPolicy{},
		&ActivityPolicyList{},
		&Activity{},
		&ActivityList{},
		&ActivityQuery{},
		&ActivityFacetQuery{},
		&EventFacetQuery{},
		&EventQuery{},
		&EventQueryList{},
		&PolicyPreview{},
		// Kubernetes Events (core/v1.Event) - stored in ClickHouse for multi-tenant access
		&corev1.Event{},
		&corev1.EventList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)

	// Register field label conversions for Events
	// This enables field selectors like type=Warning, reason=FailedMount, etc.
	// We need to register the conversion for both:
	// 1. core/v1 Event (for internal serialization)
	// 2. activity.miloapis.com/v1alpha1 Event (for API server field selector validation)
	coreV1GVK := schema.GroupVersion{Group: "", Version: "v1"}.WithKind("Event")
	if err := scheme.AddFieldLabelConversionFunc(coreV1GVK,
		EventFieldLabelConversionFunc); err != nil {
		return err
	}

	// Register for activity API group - this is the GVK used when serving Events
	// through the activity.miloapis.com/v1alpha1 API
	activityEventGVK := SchemeGroupVersion.WithKind("Event")
	if err := scheme.AddFieldLabelConversionFunc(activityEventGVK,
		EventFieldLabelConversionFunc); err != nil {
		return err
	}

	return nil
}

// EventFieldLabelConversionFunc converts field selectors for Event resources.
// This allows filtering events by fields beyond the default metadata.name and metadata.namespace.
func EventFieldLabelConversionFunc(label, value string) (string, string, error) {
	switch label {
	// Metadata fields
	case "metadata.name",
		"metadata.namespace",
		"metadata.uid":
		return label, value, nil

	// Involved object fields (commonly used with field selectors)
	case "involvedObject.apiVersion",
		"involvedObject.kind",
		"involvedObject.namespace",
		"involvedObject.name",
		"involvedObject.uid",
		"involvedObject.fieldPath":
		return label, value, nil

	// Event classification
	case "reason",
		"type":
		return label, value, nil

	// Source fields
	case "source.component",
		"source.host":
		return label, value, nil

	// Reporting fields (for newer Event API)
	case "reportingComponent",
		"reportingInstance":
		return label, value, nil

	default:
		return "", "", fmt.Errorf("%q is not a known field selector: only %q",
			label, SupportedEventFieldSelectors)
	}
}

// SupportedEventFieldSelectors lists all supported field selectors for Events
var SupportedEventFieldSelectors = []string{
	"metadata.name",
	"metadata.namespace",
	"metadata.uid",
	"involvedObject.apiVersion",
	"involvedObject.kind",
	"involvedObject.namespace",
	"involvedObject.name",
	"involvedObject.uid",
	"involvedObject.fieldPath",
	"reason",
	"type",
	"source.component",
	"source.host",
	"reportingComponent",
	"reportingInstance",
}
