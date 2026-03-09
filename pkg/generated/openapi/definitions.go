package openapi

import (
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

// GetOpenAPIDefinitionsWithUnstructured wraps the generated GetOpenAPIDefinitions
// and adds the Unstructured type definition which doesn't carry +k8s:openapi-gen markers.
//
// IMPORTANT: This function does NOT transform keys. Keys remain in their original format
// (Go module paths like "go.miloapis.com/activity/...") because the OpenAPI builder uses
// reflection to get type names and looks them up in the definitions map.
//
// For GVK extensions (required for SSA), the GetDefinitionName function must transform
// Go module paths to REST-friendly format before looking up in DefinitionNamer. This
// transformation is done in main.go's getDefinitionName wrapper.
func GetOpenAPIDefinitionsWithUnstructured(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	originalDefs := GetOpenAPIDefinitions(ref)

	// Add the Unstructured type which doesn't carry +k8s:openapi-gen markers
	// Use the Go module path format to match how other definitions are keyed
	originalDefs["k8s.io/apimachinery/pkg/apis/meta/v1/unstructured.Unstructured"] = common.OpenAPIDefinition{
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

	return originalDefs
}
