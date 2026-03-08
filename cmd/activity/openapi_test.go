package main

import (
	"testing"

	apiopenapi "k8s.io/apiserver/pkg/endpoints/openapi"
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
// Root cause: The openapi-gen tool generates definition keys using Go module paths
// (e.g., "go.miloapis.com/activity/..."), but the DefinitionNamer in k8s.io/apiserver v0.35+
// uses scheme.ToOpenAPIDefinitionName() which returns REST-friendly names
// (e.g., "com.miloapis.go.activity..."). This mismatch caused GVK extensions to not be added.
//
// Fix: GetOpenAPIDefinitionsWithRESTFriendlyKeys transforms keys to match the namer's format.
func TestOpenAPIGVKExtensions(t *testing.T) {
	// Build the DefinitionNamer using the same scheme as the API server
	namer := apiopenapi.NewDefinitionNamer(activityapiserver.Scheme)

	// Get OpenAPI definitions using the REST-friendly key wrapper (as used in production)
	defs := openapi.GetOpenAPIDefinitionsWithRESTFriendlyKeys(func(path string) spec.Ref {
		return spec.Ref{}
	})

	// Test cases for types that need GVK extensions for SSA
	// Keys are in REST-friendly format (as used by the wrapper and DefinitionNamer)
	testCases := []struct {
		restFriendlyKey string
		expectedGroup   string
		expectedKind    string
	}{
		{
			restFriendlyKey: "com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ActivityPolicy",
			expectedGroup:   "activity.miloapis.com",
			expectedKind:    "ActivityPolicy",
		},
		{
			restFriendlyKey: "com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ActivityPolicyList",
			expectedGroup:   "activity.miloapis.com",
			expectedKind:    "ActivityPolicyList",
		},
		{
			restFriendlyKey: "com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ReindexJob",
			expectedGroup:   "activity.miloapis.com",
			expectedKind:    "ReindexJob",
		},
		{
			restFriendlyKey: "com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ReindexJobList",
			expectedGroup:   "activity.miloapis.com",
			expectedKind:    "ReindexJobList",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.restFriendlyKey, func(t *testing.T) {
			// Verify type is in OpenAPI definitions (using REST-friendly key)
			if _, ok := defs[tc.restFriendlyKey]; !ok {
				t.Fatalf("Type %q not found in OpenAPI definitions", tc.restFriendlyKey)
			}

			// Get definition name and extensions from namer (using REST-friendly key)
			_, extensions := namer.GetDefinitionName(tc.restFriendlyKey)

			// Verify GVK extension is present
			if extensions == nil {
				t.Fatalf("No extensions returned for %q - GVK extension missing! "+
					"This will cause SSA to fail with 'no corresponding type' error", tc.restFriendlyKey)
			}

			gvkExt, ok := extensions["x-kubernetes-group-version-kind"]
			if !ok {
				t.Fatalf("x-kubernetes-group-version-kind extension not found for %q", tc.restFriendlyKey)
			}

			// Verify GVK contains expected values
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

// TestDefinitionNamerHasActivityTypes verifies that the DefinitionNamer has entries
// for all Activity API types. This catches issues where types aren't registered
// correctly in the scheme.
func TestDefinitionNamerHasActivityTypes(t *testing.T) {
	namer := apiopenapi.NewDefinitionNamer(activityapiserver.Scheme)

	// Check that the namer returns non-nil extensions for Activity types
	// Keys must be in REST-friendly format (as returned by scheme.ToOpenAPIDefinitionName)
	types := []string{
		"com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ActivityPolicy",
		"com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ActivityPolicyList",
		"com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ReindexJob",
		"com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ReindexJobList",
		"com.miloapis.go.activity.pkg.apis.activity.v1alpha1.Activity",
		"com.miloapis.go.activity.pkg.apis.activity.v1alpha1.ActivityList",
	}

	for _, typePath := range types {
		_, extensions := namer.GetDefinitionName(typePath)
		if extensions == nil {
			t.Errorf("DefinitionNamer returned nil extensions for %q - "+
				"type may not be registered in scheme correctly", typePath)
		}
	}
}
