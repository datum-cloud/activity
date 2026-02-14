package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// TestGetEventFieldValue_AllColumns verifies that each known column name extracts
// the correct field from a corev1.Event.
func TestGetEventFieldValue_AllColumns(t *testing.T) {
	t.Parallel()

	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-event",
			Namespace: "test-ns",
			UID:       types.UID("event-uid-123"),
		},
		InvolvedObject: corev1.ObjectReference{
			APIVersion: "apps/v1",
			Kind:       "Deployment",
			Namespace:  "involved-ns",
			Name:       "my-deploy",
			UID:        types.UID("involved-uid-456"),
			FieldPath:  "spec.containers[0]",
		},
		Reason: "ScalingReplicaSet",
		Type:   "Normal",
		Source: corev1.EventSource{
			Component: "deployment-controller",
			Host:      "node-1",
		},
	}

	tests := []struct {
		column string
		want   string
	}{
		{"namespace", "test-ns"},
		{"name", "test-event"},
		{"uid", "event-uid-123"},
		{"involved_api_version", "apps/v1"},
		{"involved_kind", "Deployment"},
		{"involved_namespace", "involved-ns"},
		{"involved_name", "my-deploy"},
		{"involved_uid", "involved-uid-456"},
		{"involved_field_path", "spec.containers[0]"},
		{"reason", "ScalingReplicaSet"},
		{"type", "Normal"},
		{"source_component", "deployment-controller"},
		{"source_host", "node-1"},
	}

	for _, tt := range tests {
		t.Run(tt.column, func(t *testing.T) {
			t.Parallel()
			got := GetEventFieldValue(event, tt.column)
			assert.Equal(t, tt.want, got, "column %q should return %q", tt.column, tt.want)
		})
	}
}

// TestGetEventFieldValue_UnknownColumn verifies that unknown column names return
// an empty string rather than panicking.
func TestGetEventFieldValue_UnknownColumn(t *testing.T) {
	t.Parallel()

	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-event",
			Namespace: "test-ns",
			UID:       types.UID("uid-123"),
		},
	}

	tests := []struct {
		name   string
		column string
	}{
		{"empty string", ""},
		{"unknown column", "nonexistent_column"},
		{"partial match", "involve"},
		{"typo", "namesapce"},
		{"camel case variant", "sourceComponent"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := GetEventFieldValue(event, tt.column)
			assert.Equal(t, "", got, "unknown column %q should return empty string", tt.column)
		})
	}
}

// TestGetEventFieldValue_EmptyEvent verifies behavior with a zero-value Event.
func TestGetEventFieldValue_EmptyEvent(t *testing.T) {
	t.Parallel()

	event := &corev1.Event{}

	columns := []string{
		"namespace", "name", "uid",
		"involved_api_version", "involved_kind", "involved_namespace",
		"involved_name", "involved_uid", "involved_field_path",
		"reason", "type", "source_component", "source_host",
	}

	for _, col := range columns {
		t.Run(col, func(t *testing.T) {
			t.Parallel()
			got := GetEventFieldValue(event, col)
			assert.Equal(t, "", got, "empty event column %q should return empty string", col)
		})
	}
}

// TestGetEventFieldValue_UIDConvertedToString verifies that event UID (types.UID) is
// correctly converted to string without data loss.
func TestGetEventFieldValue_UIDConvertedToString(t *testing.T) {
	t.Parallel()

	uid := types.UID("550e8400-e29b-41d4-a716-446655440000")
	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "evt",
			Namespace: "ns",
			UID:       uid,
		},
	}

	got := GetEventFieldValue(event, "uid")

	assert.Equal(t, string(uid), got)
}

// TestGetEventFieldValue_InvolvedUIDConvertedToString verifies that the involved
// object UID is correctly converted from types.UID to string.
func TestGetEventFieldValue_InvolvedUIDConvertedToString(t *testing.T) {
	t.Parallel()

	involvedUID := types.UID("aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb")
	event := &corev1.Event{
		InvolvedObject: corev1.ObjectReference{
			UID: involvedUID,
		},
	}

	got := GetEventFieldValue(event, "involved_uid")

	assert.Equal(t, string(involvedUID), got)
}

// TestGetEventFieldValue_WarningType verifies the "Warning" event type is extracted correctly.
func TestGetEventFieldValue_WarningType(t *testing.T) {
	t.Parallel()

	event := &corev1.Event{
		Type: corev1.EventTypeWarning,
	}

	got := GetEventFieldValue(event, "type")

	assert.Equal(t, "Warning", got)
}

// TestGetEventFieldValue_NormalType verifies the "Normal" event type is extracted correctly.
func TestGetEventFieldValue_NormalType(t *testing.T) {
	t.Parallel()

	event := &corev1.Event{
		Type: corev1.EventTypeNormal,
	}

	got := GetEventFieldValue(event, "type")

	assert.Equal(t, "Normal", got)
}

// TestGetEventFacetColumn_AllFields verifies that each known event facet field
// maps to a non-empty ClickHouse column name.
func TestGetEventFacetColumn_AllFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		field      string
		wantColumn string
	}{
		{"involvedObject.kind", "involved_kind"},
		{"involvedObject.namespace", "involved_namespace"},
		{"reason", "reason"},
		{"type", "type"},
		{"source.component", "source_component"},
		{"namespace", "namespace"},
	}

	for _, tt := range tests {
		t.Run(tt.field, func(t *testing.T) {
			t.Parallel()
			got, err := GetEventFacetColumn(tt.field)
			assert.NoError(t, err)
			assert.Equal(t, tt.wantColumn, got)
		})
	}
}

// TestGetEventFacetColumn_UnsupportedField verifies that unsupported field names
// return a meaningful error.
func TestGetEventFacetColumn_UnsupportedField(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		field string
	}{
		{"empty field", ""},
		{"non-facet field involvedObject.name", "involvedObject.name"},
		{"metadata field", "metadata.name"},
		{"unknown field", "foobar"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := GetEventFacetColumn(tt.field)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "unsupported event facet field")
			assert.Equal(t, "", got)
		})
	}
}

// TestIsValidEventFacetField verifies the field validation function for all known fields.
func TestIsValidEventFacetField(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		field string
		want  bool
	}{
		{"valid: involvedObject.kind", "involvedObject.kind", true},
		{"valid: involvedObject.namespace", "involvedObject.namespace", true},
		{"valid: reason", "reason", true},
		{"valid: type", "type", true},
		{"valid: source.component", "source.component", true},
		{"valid: namespace", "namespace", true},
		{"invalid: involvedObject.name", "involvedObject.name", false},
		{"invalid: metadata.name", "metadata.name", false},
		{"invalid: empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := IsValidEventFacetField(tt.field)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestEventFacetFieldNames verifies that EventFacetFieldNames returns all defined fields
// in sorted order.
func TestEventFacetFieldNames(t *testing.T) {
	t.Parallel()

	names := EventFacetFieldNames()

	// Should contain all defined facet fields.
	assert.Contains(t, names, "involvedObject.kind")
	assert.Contains(t, names, "involvedObject.namespace")
	assert.Contains(t, names, "reason")
	assert.Contains(t, names, "type")
	assert.Contains(t, names, "source.component")
	assert.Contains(t, names, "namespace")

	// Should be sorted alphabetically.
	for i := 1; i < len(names); i++ {
		assert.LessOrEqual(t, names[i-1], names[i],
			"EventFacetFieldNames should be sorted, but %q > %q", names[i-1], names[i])
	}
}

// TestResolveEventFieldSelector_KnownFields verifies that each supported API
// field path resolves to a non-empty ClickHouse column name.
func TestResolveEventFieldSelector_KnownFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		apiPath    string
		wantColumn string
	}{
		{"involvedObject.name", "involved_name"},
		{"involvedObject.namespace", "involved_namespace"},
		{"involvedObject.kind", "involved_kind"},
		{"involvedObject.apiVersion", "involved_api_version"},
		{"involvedObject.uid", "involved_uid"},
		{"involvedObject.fieldPath", "involved_field_path"},
		{"type", "type"},
		{"reason", "reason"},
		{"metadata.name", "name"},
		{"metadata.namespace", "namespace"},
		{"metadata.uid", "uid"},
		{"source.component", "source_component"},
		{"source.host", "source_host"},
	}

	for _, tt := range tests {
		t.Run(tt.apiPath, func(t *testing.T) {
			t.Parallel()
			got, err := ResolveEventFieldSelector(tt.apiPath)
			assert.NoError(t, err)
			assert.Equal(t, tt.wantColumn, got, "API path %q should resolve to column %q", tt.apiPath, tt.wantColumn)
		})
	}
}

// TestResolveEventFieldSelector_Aliases verifies that short-form aliases resolve
// to the same columns as their full-path equivalents.
func TestResolveEventFieldSelector_Aliases(t *testing.T) {
	t.Parallel()

	tests := []struct {
		alias      string
		equivalent string
	}{
		{"namespace", "metadata.namespace"},
		{"name", "metadata.name"},
		{"uid", "metadata.uid"},
	}

	for _, tt := range tests {
		t.Run(tt.alias, func(t *testing.T) {
			t.Parallel()
			aliasCol, err := ResolveEventFieldSelector(tt.alias)
			assert.NoError(t, err, "alias %q should resolve without error", tt.alias)

			fullCol, err := ResolveEventFieldSelector(tt.equivalent)
			assert.NoError(t, err, "full path %q should resolve without error", tt.equivalent)

			assert.Equal(t, fullCol, aliasCol,
				"alias %q and full path %q should resolve to the same column", tt.alias, tt.equivalent)
		})
	}
}

// TestResolveEventFieldSelector_UnsupportedField verifies that unknown field
// paths return an error rather than silently succeeding.
func TestResolveEventFieldSelector_UnsupportedField(t *testing.T) {
	t.Parallel()

	unsupportedFields := []string{
		"",
		"unknown.field",
		"involvedObject",       // parent path, not a leaf
		"metadata.labels",      // not a supported selector
		"spec.containers",      // pod-level, not event-level
		"status",
	}

	for _, field := range unsupportedFields {
		t.Run(field, func(t *testing.T) {
			t.Parallel()
			got, err := ResolveEventFieldSelector(field)
			assert.Error(t, err, "unsupported field %q should return error", field)
			assert.Equal(t, "", got, "unsupported field %q should return empty column", field)
			assert.Contains(t, err.Error(), "unsupported field selector")
		})
	}
}

// TestGetEventFieldValue_ViaFieldSelector verifies the complete pipeline from
// API field path → ClickHouse column → extracted event value. This ensures
// the field selector mapping and value extraction are consistent end-to-end.
func TestGetEventFieldValue_ViaFieldSelector(t *testing.T) {
	t.Parallel()

	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-event",
			Namespace: "default",
			UID:       types.UID("event-uid-999"),
		},
		InvolvedObject: corev1.ObjectReference{
			APIVersion: "apps/v1",
			Kind:       "Deployment",
			Namespace:  "production",
			Name:       "my-deploy",
			UID:        types.UID("deploy-uid-111"),
			FieldPath:  "spec.template",
		},
		Reason: "ScalingReplicaSet",
		Type:   corev1.EventTypeNormal,
		Source: corev1.EventSource{
			Component: "deployment-controller",
			Host:      "node-2",
		},
	}

	tests := []struct {
		apiPath   string
		wantValue string
	}{
		{"involvedObject.name", "my-deploy"},
		{"involvedObject.namespace", "production"},
		{"involvedObject.kind", "Deployment"},
		{"involvedObject.apiVersion", "apps/v1"},
		{"involvedObject.uid", "deploy-uid-111"},
		{"involvedObject.fieldPath", "spec.template"},
		{"type", "Normal"},
		{"reason", "ScalingReplicaSet"},
		{"metadata.name", "my-event"},
		{"metadata.namespace", "default"},
		{"metadata.uid", "event-uid-999"},
		{"source.component", "deployment-controller"},
		{"source.host", "node-2"},
	}

	for _, tt := range tests {
		t.Run(tt.apiPath, func(t *testing.T) {
			t.Parallel()

			column, err := ResolveEventFieldSelector(tt.apiPath)
			assert.NoError(t, err, "ResolveEventFieldSelector(%q) should not error", tt.apiPath)

			got := GetEventFieldValue(event, column)
			assert.Equal(t, tt.wantValue, got,
				"API path %q → column %q: expected %q, got %q", tt.apiPath, column, tt.wantValue, got)
		})
	}
}
