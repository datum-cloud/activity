package openapi

import (
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/util"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

// GetOpenAPIDefinitionsWithRESTFriendlyKeys wraps the generated GetOpenAPIDefinitions
// and transforms all definition keys to REST-friendly format.
//
// This is required because:
// 1. The openapi-gen tool generates definition keys using Go module paths (e.g., "go.miloapis.com/activity/...")
// 2. The DefinitionNamer in k8s.io/apiserver v0.35+ uses scheme.ToOpenAPIDefinitionName() which returns REST-friendly names (e.g., "com.miloapis.go.activity...")
// 3. When GetDefinitionName is called during OpenAPI schema building, the keys don't match
// 4. This causes GVK extensions (x-kubernetes-group-version-kind) to not be added
// 5. Without GVK extensions, Server-Side Apply (SSA) fails with "no corresponding type" errors
//
// By transforming keys to REST-friendly format, we ensure the keys match what the DefinitionNamer expects.
func GetOpenAPIDefinitionsWithRESTFriendlyKeys(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	originalDefs := GetOpenAPIDefinitions(ref)
	transformedDefs := make(map[string]common.OpenAPIDefinition, len(originalDefs))

	for key, def := range originalDefs {
		// Transform the key to REST-friendly format
		// e.g., "go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ActivityPolicy"
		// becomes "com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ActivityPolicy"
		restFriendlyKey := util.ToRESTFriendlyName(key)
		transformedDefs[restFriendlyKey] = def
	}

	// Also add the missing definition for unstructured.Unstructured which is a
	// special Kubernetes type that does not carry +k8s:openapi-gen markers.
	// This is needed when types reference unstructured objects.
	unstructuredKey := util.ToRESTFriendlyName("k8s.io/apimachinery/pkg/apis/meta/v1/unstructured.Unstructured")
	transformedDefs[unstructuredKey] = common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "Unstructured represents a Kubernetes resource as an arbitrary JSON object.",
				Type:        []string{"object"},
			},
			VendorExtensible: spec.VendorExtensible{
				Extensions: spec.Extensions{
					"x-kubernetes-preserve-unknown-fields": true,
				},
			},
		},
	}

	return transformedDefs
}
