package main

import (
	"strings"
	"testing"

	apiopenapi "k8s.io/apiserver/pkg/endpoints/openapi"
	openapiutil "k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	activityapiserver "go.miloapis.com/activity/internal/apiserver"
	"go.miloapis.com/activity/pkg/generated/openapi"
)

// TestOpenAPIGVKExtensions verifies that OpenAPI schemas include x-kubernetes-group-version-kind
// extensions required for Server-Side Apply (SSA) to work correctly.
//
// This is a regression test for the SSA failure:
// "no corresponding type for activity.miloapis.com/v1alpha1, Kind=ActivityPolicy"
//
// Root cause: The DefinitionNamer only returns GVK extensions when looking up names
// in REST-friendly format. The OpenAPI builder uses reflection to get Go module paths,
// so we need GetDefinitionName to transform Go module paths before DefinitionNamer lookup.
func TestOpenAPIGVKExtensions(t *testing.T) {
	namer := apiopenapi.NewDefinitionNamer(activityapiserver.Scheme)

	// Custom GetDefinitionName that transforms Go module paths to REST-friendly format
	// This mirrors the implementation in main.go
	getDefinitionName := func(name string) (string, spec.Extensions) {
		if strings.Contains(name, "/") {
			name = openapiutil.ToRESTFriendlyName(name)
		}
		return namer.GetDefinitionName(name)
	}

	defs := openapi.GetOpenAPIDefinitionsWithUnstructured(func(path string) spec.Ref {
		return spec.Ref{}
	})

	// Activity types should be present with Go module path keys
	// GetDefinitionName must transform these to REST-friendly format for GVK lookup
	testCases := []struct {
		goModulePath  string
		expectedGroup string
		expectedKind  string
	}{
		{
			goModulePath:  "go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ActivityPolicy",
			expectedGroup: "activity.miloapis.com",
			expectedKind:  "ActivityPolicy",
		},
		{
			goModulePath:  "go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ActivityPolicyList",
			expectedGroup: "activity.miloapis.com",
			expectedKind:  "ActivityPolicyList",
		},
		{
			goModulePath:  "go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ReindexJob",
			expectedGroup: "activity.miloapis.com",
			expectedKind:  "ReindexJob",
		},
		{
			goModulePath:  "go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ReindexJobList",
			expectedGroup: "activity.miloapis.com",
			expectedKind:  "ReindexJobList",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.goModulePath, func(t *testing.T) {
			// Verify the definition exists with Go module path key
			if _, ok := defs[tc.goModulePath]; !ok {
				t.Fatalf("Type %q not found in OpenAPI definitions", tc.goModulePath)
			}

			// Verify GetDefinitionName returns GVK extensions after transformation
			defName, extensions := getDefinitionName(tc.goModulePath)
			if extensions == nil {
				t.Fatalf("No extensions returned for %q (transformed to %q) - GVK extension missing! "+
					"This will cause SSA to fail with 'no corresponding type' error", tc.goModulePath, defName)
			}

			gvkExt, ok := extensions["x-kubernetes-group-version-kind"]
			if !ok {
				t.Fatalf("x-kubernetes-group-version-kind extension not found for %q", tc.goModulePath)
			}

			gvks, ok := gvkExt.([]interface{})
			if !ok {
				t.Fatalf("GVK extension is not an array: %T", gvkExt)
			}

			found := false
			for _, gvk := range gvks {
				gvkMap, ok := gvk.(map[string]interface{})
				if !ok {
					continue
				}
				if gvkMap["group"] == tc.expectedGroup &&
					gvkMap["version"] == "v1alpha1" &&
					gvkMap["kind"] == tc.expectedKind {
					found = true
					break
				}
			}

			if !found {
				t.Errorf("Expected GVK {group: %q, version: v1alpha1, kind: %q} not found in extensions: %v",
					tc.expectedGroup, tc.expectedKind, gvkExt)
			}
		})
	}
}

// TestCoreV1EventKeysPreserved verifies that standard Kubernetes types using
// OpenAPIModelName() keys are present and NOT mangled.
func TestCoreV1EventKeysPreserved(t *testing.T) {
	defs := openapi.GetOpenAPIDefinitionsWithUnstructured(func(path string) spec.Ref {
		return spec.Ref{}
	})

	// These keys come from OpenAPIModelName() and must be preserved exactly
	coreTypes := []string{
		"io.k8s.api.core.v1.Event",
		"io.k8s.api.core.v1.EventList",
		"io.k8s.api.events.v1.Event",
		"io.k8s.api.events.v1.EventList",
	}

	for _, key := range coreTypes {
		t.Run(key, func(t *testing.T) {
			if _, ok := defs[key]; !ok {
				t.Errorf("Core type %q not found in definitions", key)
			}
		})
	}
}

// TestUnstructuredTypeIncluded verifies that the Unstructured type is included
// in the definitions (required for some SSA operations).
func TestUnstructuredTypeIncluded(t *testing.T) {
	defs := openapi.GetOpenAPIDefinitionsWithUnstructured(func(path string) spec.Ref {
		return spec.Ref{}
	})

	unstructuredKey := "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured.Unstructured"
	if _, ok := defs[unstructuredKey]; !ok {
		t.Errorf("Unstructured type %q not found in definitions", unstructuredKey)
	}
}

// TestOpenAPIV3Builder verifies that the OpenAPI v3 builder can successfully
// build definitions for our types using the same configuration as the actual server.
func TestOpenAPIV3Builder(t *testing.T) {
	namer := apiopenapi.NewDefinitionNamer(activityapiserver.Scheme)

	// Custom GetDefinitionName that transforms Go module paths
	getDefinitionName := func(name string) (string, spec.Extensions) {
		if strings.Contains(name, "/") {
			name = openapiutil.ToRESTFriendlyName(name)
		}
		return namer.GetDefinitionName(name)
	}

	// Build definitions the same way DefaultOpenAPIV3Config does
	defs := openapi.GetOpenAPIDefinitionsWithUnstructured(func(name string) spec.Ref {
		defName, _ := getDefinitionName(name)
		return spec.MustCreateRef("#/components/schemas/" + defName)
	})

	// Check that all Activity types are present with Go module path keys
	activityTypes := []string{
		"go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ActivityPolicy",
		"go.miloapis.com/activity/pkg/apis/activity/v1alpha1.ReindexJob",
		"go.miloapis.com/activity/pkg/apis/activity/v1alpha1.AuditLogQuery",
		"go.miloapis.com/activity/pkg/apis/activity/v1alpha1.Activity",
	}

	for _, typeName := range activityTypes {
		if _, ok := defs[typeName]; !ok {
			// List all keys to help debug
			keys := make([]string, 0, len(defs))
			for k := range defs {
				if strings.Contains(k, "activity") {
					keys = append(keys, k)
				}
			}
			t.Errorf("Type %q not found in definitions. Activity-related keys: %v", typeName, keys)
		}
	}
}
