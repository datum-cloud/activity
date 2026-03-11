package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
)

func TestGetEventFieldValue_RelatedField(t *testing.T) {
	eventWithRelated := &corev1.Event{
		InvolvedObject: corev1.ObjectReference{
			APIVersion: "v1",
			Kind:       "Pod",
			Namespace:  "default",
			Name:       "my-pod",
			UID:        types.UID("pod-uid-123"),
		},
		Related: &corev1.ObjectReference{
			APIVersion: "v1",
			Kind:       "Node",
			Namespace:  "",
			Name:       "worker-node-1",
		},
	}

	tests := []struct {
		name   string
		event  *corev1.Event
		column string
		want   string
	}{
		// Event WITH a related object — each column returns the correct value.
		{
			name:   "related_api_version with Related set",
			event:  eventWithRelated,
			column: "related_api_version",
			want:   "v1",
		},
		{
			name:   "related_kind with Related set",
			event:  eventWithRelated,
			column: "related_kind",
			want:   "Node",
		},
		{
			name:   "related_namespace with Related set (empty namespace for cluster-scoped)",
			event:  eventWithRelated,
			column: "related_namespace",
			want:   "",
		},
		{
			name:   "related_name with Related set",
			event:  eventWithRelated,
			column: "related_name",
			want:   "worker-node-1",
		},

		// Event WITHOUT a related object — nil safety: must return "" without panicking.
		{
			name:   "related_api_version when Related is nil returns empty string",
			event:  &corev1.Event{},
			column: "related_api_version",
			want:   "",
		},
		{
			name:   "related_kind when Related is nil returns empty string",
			event:  &corev1.Event{},
			column: "related_kind",
			want:   "",
		},
		{
			name:   "related_namespace when Related is nil returns empty string",
			event:  &corev1.Event{},
			column: "related_namespace",
			want:   "",
		},
		{
			name:   "related_name when Related is nil returns empty string",
			event:  &corev1.Event{},
			column: "related_name",
			want:   "",
		},

		// Existing regarding fields still work correctly.
		{
			name:   "regarding_kind returns InvolvedObject.Kind",
			event:  eventWithRelated,
			column: "regarding_kind",
			want:   "Pod",
		},
		{
			name:   "regarding_namespace returns InvolvedObject.Namespace",
			event:  eventWithRelated,
			column: "regarding_namespace",
			want:   "default",
		},
		{
			name:   "regarding_name returns InvolvedObject.Name",
			event:  eventWithRelated,
			column: "regarding_name",
			want:   "my-pod",
		},
		{
			name:   "regarding_api_version returns InvolvedObject.APIVersion",
			event:  eventWithRelated,
			column: "regarding_api_version",
			want:   "v1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetEventFieldValue(tt.event, tt.column)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetEventFieldValue_RelatedNilDoesNotPanic(t *testing.T) {
	// Explicit panic-guard test: calling all related_* columns on a nil-Related
	// event must not panic. This is the most critical nil-safety check.
	event := &corev1.Event{} // Related is nil

	relatedColumns := []string{
		"related_api_version",
		"related_kind",
		"related_namespace",
		"related_name",
	}

	for _, col := range relatedColumns {
		t.Run(col, func(t *testing.T) {
			assert.NotPanics(t, func() {
				got := GetEventFieldValue(event, col)
				assert.Equal(t, "", got, "expected empty string for %s when Related is nil", col)
			})
		})
	}
}

func TestEventFacetColumnMapping(t *testing.T) {
	tests := []struct {
		name           string
		field          string
		expectedColumn string
		wantErr        bool
	}{
		{
			name:           "related.kind maps to related_kind",
			field:          "related.kind",
			expectedColumn: "related_kind",
			wantErr:        false,
		},
		{
			name:           "related.namespace maps to related_namespace",
			field:          "related.namespace",
			expectedColumn: "related_namespace",
			wantErr:        false,
		},
		{
			name:    "related.unsupported returns error",
			field:   "related.unsupported",
			wantErr: true,
		},
		// Verify existing regarding mappings are not broken.
		{
			name:           "regarding.kind maps to regarding_kind",
			field:          "regarding.kind",
			expectedColumn: "regarding_kind",
			wantErr:        false,
		},
		{
			name:           "regarding.namespace maps to regarding_namespace",
			field:          "regarding.namespace",
			expectedColumn: "regarding_namespace",
			wantErr:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetEventFacetColumn(tt.field)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expectedColumn, got)
		})
	}
}
