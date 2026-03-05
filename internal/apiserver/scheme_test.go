package apiserver

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// TestEventFieldLabelConversionRegistered verifies that field label conversion
// functions are properly registered for both core/v1 and events.k8s.io/v1 Events.
// This is critical for field selectors like "regarding.kind=Pod" to work.
//
// This test covers ALL field selectors listed in SupportedEventFieldSelectors
// to ensure parity with the storage layer tests in internal/storage/events_fields_test.go.
func TestEventFieldLabelConversionRegistered(t *testing.T) {
	tests := []struct {
		name       string
		gvk        schema.GroupVersionKind
		fieldLabel string
		value      string
		wantErr    bool
	}{
		// Metadata fields - core/v1
		{
			name:       "core/v1 Event - metadata.name",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "metadata.name",
			value:      "test-event",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - metadata.namespace",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "metadata.namespace",
			value:      "default",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - metadata.uid",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "metadata.uid",
			value:      "123e4567-e89b-12d3-a456-426614174000",
			wantErr:    false,
		},

		// Regarding fields - core/v1
		{
			name:       "core/v1 Event - regarding.apiVersion",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.apiVersion",
			value:      "apps/v1",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - regarding.kind",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.kind",
			value:      "Pod",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - regarding.namespace",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.namespace",
			value:      "default",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - regarding.name",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.name",
			value:      "my-pod",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - regarding.uid",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.uid",
			value:      "123e4567-e89b-12d3-a456-426614174001",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - regarding.fieldPath",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.fieldPath",
			value:      "spec.containers{nginx}",
			wantErr:    false,
		},

		// Event classification fields - core/v1
		{
			name:       "core/v1 Event - reason",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "reason",
			value:      "Pulled",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - type",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "type",
			value:      "Warning",
			wantErr:    false,
		},

		// Source fields - core/v1
		{
			name:       "core/v1 Event - source.component",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "source.component",
			value:      "kubelet",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - source.host",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "source.host",
			value:      "node-1",
			wantErr:    false,
		},

		// Reporting fields - core/v1
		{
			name:       "core/v1 Event - reportingComponent",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "reportingComponent",
			value:      "kube-scheduler",
			wantErr:    false,
		},
		{
			name:       "core/v1 Event - reportingInstance",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "reportingInstance",
			value:      "kube-scheduler-node-1",
			wantErr:    false,
		},

		// Metadata fields - events.k8s.io/v1
		{
			name:       "events.k8s.io/v1 Event - metadata.name",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "metadata.name",
			value:      "test-event",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - metadata.namespace",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "metadata.namespace",
			value:      "kube-system",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - metadata.uid",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "metadata.uid",
			value:      "123e4567-e89b-12d3-a456-426614174002",
			wantErr:    false,
		},

		// Regarding fields - events.k8s.io/v1
		{
			name:       "events.k8s.io/v1 Event - regarding.apiVersion",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.apiVersion",
			value:      "v1",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - regarding.kind",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.kind",
			value:      "Deployment",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - regarding.namespace",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.namespace",
			value:      "default",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - regarding.name",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.name",
			value:      "my-deployment",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - regarding.uid",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.uid",
			value:      "123e4567-e89b-12d3-a456-426614174003",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - regarding.fieldPath",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "regarding.fieldPath",
			value:      "spec.replicas",
			wantErr:    false,
		},

		// Event classification fields - events.k8s.io/v1
		{
			name:       "events.k8s.io/v1 Event - reason",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "reason",
			value:      "Killing",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - type",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "type",
			value:      "Normal",
			wantErr:    false,
		},

		// Source fields - events.k8s.io/v1
		{
			name:       "events.k8s.io/v1 Event - source.component",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "source.component",
			value:      "kubelet",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - source.host",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "source.host",
			value:      "node-2",
			wantErr:    false,
		},

		// Reporting fields - events.k8s.io/v1
		{
			name:       "events.k8s.io/v1 Event - reportingComponent",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "reportingComponent",
			value:      "kube-controller-manager",
			wantErr:    false,
		},
		{
			name:       "events.k8s.io/v1 Event - reportingInstance",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "reportingInstance",
			value:      "kube-controller-manager-node-1",
			wantErr:    false,
		},

		// Negative test cases
		{
			name:       "core/v1 Event - unsupported field",
			gvk:        schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			fieldLabel: "unsupported.field",
			value:      "value",
			wantErr:    true,
		},
		{
			name:       "events.k8s.io/v1 Event - unsupported field",
			gvk:        schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			fieldLabel: "unsupported.field",
			value:      "value",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the conversion using the scheme's ConvertFieldLabel method
			convertedLabel, convertedValue, err := Scheme.ConvertFieldLabel(tt.gvk, tt.fieldLabel, tt.value)
			if tt.wantErr {
				require.Error(t, err, "expected error for field %q", tt.fieldLabel)
				return
			}

			require.NoError(t, err, "unexpected error for field %q", tt.fieldLabel)

			// The conversion function should return the label and value unchanged
			// (actual conversion to ClickHouse column names happens in the storage layer)
			assert.Equal(t, tt.fieldLabel, convertedLabel, "field label should be unchanged")
			assert.Equal(t, tt.value, convertedValue, "field value should be unchanged")
		})
	}
}

// TestSchemeContainsEventTypes verifies that both core/v1 and events.k8s.io/v1
// Event types are registered in the scheme.
func TestSchemeContainsEventTypes(t *testing.T) {
	tests := []struct {
		name        string
		gvk         schema.GroupVersionKind
		expectKnown bool
	}{
		{
			name:        "core/v1 Event",
			gvk:         schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"},
			expectKnown: true,
		},
		{
			name:        "events.k8s.io/v1 Event",
			gvk:         schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "Event"},
			expectKnown: true,
		},
		{
			name:        "core/v1 EventList",
			gvk:         schema.GroupVersionKind{Group: "", Version: "v1", Kind: "EventList"},
			expectKnown: true,
		},
		{
			name:        "events.k8s.io/v1 EventList",
			gvk:         schema.GroupVersionKind{Group: "events.k8s.io", Version: "v1", Kind: "EventList"},
			expectKnown: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			known := Scheme.Recognizes(tt.gvk)
			assert.Equal(t, tt.expectKnown, known, "Scheme.Recognizes(%v) should be %v", tt.gvk, tt.expectKnown)
		})
	}
}
