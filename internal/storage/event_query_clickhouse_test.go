package storage

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// TestNewClickHouseEventQueryBackend_DefaultTable verifies that a missing Table
// config value is defaulted to "events".
func TestNewClickHouseEventQueryBackend_DefaultTable(t *testing.T) {
	t.Parallel()

	b := NewClickHouseEventQueryBackend(nil, ClickHouseEventsConfig{
		Database: "audit",
		// Table intentionally left empty
	})

	require.NotNil(t, b)
	assert.Equal(t, "events", b.config.Table, "missing Table should default to 'events'")
	assert.Equal(t, "audit", b.config.Database)
}

// TestNewClickHouseEventQueryBackend_ExplicitTable verifies that an explicitly
// provided Table name is preserved.
func TestNewClickHouseEventQueryBackend_ExplicitTable(t *testing.T) {
	t.Parallel()

	b := NewClickHouseEventQueryBackend(nil, ClickHouseEventsConfig{
		Database: "audit",
		Table:    "k8s_events",
	})

	require.NotNil(t, b)
	assert.Equal(t, "k8s_events", b.config.Table)
}

// TestClickHouseEventQueryBackend_GetMaxQueryWindow verifies the 60-day max window.
func TestClickHouseEventQueryBackend_GetMaxQueryWindow(t *testing.T) {
	t.Parallel()

	b := NewClickHouseEventQueryBackend(nil, ClickHouseEventsConfig{Database: "audit"})

	window := b.GetMaxQueryWindow()

	expected := 60 * 24 * time.Hour
	assert.Equal(t, expected, window, "max query window should be 60 days")
}

// TestClickHouseEventQueryBackend_GetMaxPageSize verifies the maximum page size is 1000.
func TestClickHouseEventQueryBackend_GetMaxPageSize(t *testing.T) {
	t.Parallel()

	b := NewClickHouseEventQueryBackend(nil, ClickHouseEventsConfig{Database: "audit"})

	maxSize := b.GetMaxPageSize()

	assert.Equal(t, int32(1000), maxSize)
}

// TestResolveEventQueryLimit_Defaults verifies the limit resolution logic.
func TestResolveEventQueryLimit_Defaults(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		requested int32
		want      int32
	}{
		{"zero uses default", 0, 100},
		{"negative uses default", -1, 100},
		{"explicit value within bounds", 50, 50},
		{"exactly at max", 1000, 1000},
		{"above max is clamped to max", 1001, 1000},
		{"large value clamped to max", 10000, 1000},
		{"one", 1, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := resolveEventQueryLimit(tt.requested)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestHashEventQueryParams_Deterministic verifies that the hash of the same spec
// is always identical.
func TestHashEventQueryParams_Deterministic(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime:     "2024-01-01T00:00:00Z",
		EndTime:       "2024-01-02T00:00:00Z",
		Namespace:     "production",
		FieldSelector: "type=Warning",
		Limit:         100,
	}

	hash1 := hashEventQueryParams(spec)
	hash2 := hashEventQueryParams(spec)

	assert.Equal(t, hash1, hash2, "hash must be deterministic")
	assert.NotEmpty(t, hash1, "hash must not be empty")
}

// TestHashEventQueryParams_DifferentForDifferentParams verifies that changing any
// parameter produces a different hash.
func TestHashEventQueryParams_DifferentForDifferentParams(t *testing.T) {
	t.Parallel()

	base := v1alpha1.EventQuerySpec{
		StartTime:     "2024-01-01T00:00:00Z",
		EndTime:       "2024-01-02T00:00:00Z",
		Namespace:     "production",
		FieldSelector: "type=Warning",
		Limit:         100,
	}

	tests := []struct {
		name    string
		mutated v1alpha1.EventQuerySpec
	}{
		{
			"different startTime",
			v1alpha1.EventQuerySpec{StartTime: "2024-06-01T00:00:00Z", EndTime: base.EndTime, Namespace: base.Namespace, FieldSelector: base.FieldSelector, Limit: base.Limit},
		},
		{
			"different endTime",
			v1alpha1.EventQuerySpec{StartTime: base.StartTime, EndTime: "2024-01-10T00:00:00Z", Namespace: base.Namespace, FieldSelector: base.FieldSelector, Limit: base.Limit},
		},
		{
			"different namespace",
			v1alpha1.EventQuerySpec{StartTime: base.StartTime, EndTime: base.EndTime, Namespace: "staging", FieldSelector: base.FieldSelector, Limit: base.Limit},
		},
		{
			"different fieldSelector",
			v1alpha1.EventQuerySpec{StartTime: base.StartTime, EndTime: base.EndTime, Namespace: base.Namespace, FieldSelector: "type=Normal", Limit: base.Limit},
		},
		{
			"different limit",
			v1alpha1.EventQuerySpec{StartTime: base.StartTime, EndTime: base.EndTime, Namespace: base.Namespace, FieldSelector: base.FieldSelector, Limit: 500},
		},
	}

	baseHash := hashEventQueryParams(base)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			mutatedHash := hashEventQueryParams(tt.mutated)
			assert.NotEqual(t, baseHash, mutatedHash, "changing %s should produce a different hash", tt.name)
		})
	}
}

// TestHashEventQueryParams_IgnoresContinue verifies that the Continue field is
// excluded from the hash so pagination does not invalidate the hash.
func TestHashEventQueryParams_IgnoresContinue(t *testing.T) {
	t.Parallel()

	spec1 := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Limit:     100,
		Continue:  "",
	}

	spec2 := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Limit:     100,
		Continue:  "some-cursor-value",
	}

	hash1 := hashEventQueryParams(spec1)
	hash2 := hashEventQueryParams(spec2)

	assert.Equal(t, hash1, hash2, "Continue field should not affect the hash")
}

// TestEncodeDecodeEventQueryCursor_Roundtrip verifies that a cursor encoded with
// one spec can be decoded with the same spec.
func TestEncodeDecodeEventQueryCursor_Roundtrip(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Namespace: "default",
		Limit:     100,
	}

	lastEvent := corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-event",
			Namespace: "default",
		},
	}

	cursor := encodeEventQueryCursor(lastEvent, spec)
	require.NotEmpty(t, cursor)

	offset, err := decodeEventQueryCursor(cursor, spec)

	require.NoError(t, err)
	// First page with limit=100 → next offset is 100
	assert.Equal(t, int32(100), offset)
}

// TestEncodeDecodeEventQueryCursor_OffsetAccumulates verifies that successive
// pagination pages accumulate the offset correctly.
func TestEncodeDecodeEventQueryCursor_OffsetAccumulates(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Limit:     50,
	}

	lastEvent := corev1.Event{}

	// First page cursor → offset 50
	cursor1 := encodeEventQueryCursor(lastEvent, spec)
	offset1, err := decodeEventQueryCursor(cursor1, spec)
	require.NoError(t, err)
	assert.Equal(t, int32(50), offset1)

	// Second page cursor: spec now has the first page's cursor
	spec2 := spec
	spec2.Continue = cursor1
	cursor2 := encodeEventQueryCursor(lastEvent, spec2)

	// Decode with spec2 (same params minus Continue field doesn't affect hash)
	specForDecode := spec // same as spec2 but without Continue (hash ignores Continue)
	offset2, err := decodeEventQueryCursor(cursor2, specForDecode)
	require.NoError(t, err)
	assert.Equal(t, int32(100), offset2, "second page offset should be 2*limit=100")
}

// TestDecodeEventQueryCursor_InvalidBase64 verifies that invalid base64 returns
// a descriptive error.
func TestDecodeEventQueryCursor_InvalidBase64(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
	}

	_, err := decodeEventQueryCursor("not-valid-base64!!!@#$", spec)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot decode pagination cursor")
}

// TestDecodeEventQueryCursor_InvalidJSON verifies that valid base64 but invalid
// JSON cursor data returns an appropriate error.
func TestDecodeEventQueryCursor_InvalidJSON(t *testing.T) {
	t.Parallel()

	// Valid base64 of invalid JSON
	invalidCursor := base64.URLEncoding.EncodeToString([]byte("not json"))

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
	}

	_, err := decodeEventQueryCursor(invalidCursor, spec)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "cursor format is invalid")
}

// TestDecodeEventQueryCursor_ParametersChanged verifies that decoding with
// different query parameters rejects the cursor.
func TestDecodeEventQueryCursor_ParametersChanged(t *testing.T) {
	t.Parallel()

	originalSpec := v1alpha1.EventQuerySpec{
		StartTime:     "2024-01-01T00:00:00Z",
		EndTime:       "2024-01-02T00:00:00Z",
		Namespace:     "production",
		FieldSelector: "type=Warning",
		Limit:         100,
	}

	lastEvent := corev1.Event{}
	cursor := encodeEventQueryCursor(lastEvent, originalSpec)

	tests := []struct {
		name        string
		modifiedSpec v1alpha1.EventQuerySpec
	}{
		{
			"startTime changed",
			v1alpha1.EventQuerySpec{StartTime: "2024-06-01T00:00:00Z", EndTime: originalSpec.EndTime, Namespace: originalSpec.Namespace, FieldSelector: originalSpec.FieldSelector, Limit: originalSpec.Limit},
		},
		{
			"endTime changed",
			v1alpha1.EventQuerySpec{StartTime: originalSpec.StartTime, EndTime: "2024-01-10T00:00:00Z", Namespace: originalSpec.Namespace, FieldSelector: originalSpec.FieldSelector, Limit: originalSpec.Limit},
		},
		{
			"namespace changed",
			v1alpha1.EventQuerySpec{StartTime: originalSpec.StartTime, EndTime: originalSpec.EndTime, Namespace: "staging", FieldSelector: originalSpec.FieldSelector, Limit: originalSpec.Limit},
		},
		{
			"fieldSelector changed",
			v1alpha1.EventQuerySpec{StartTime: originalSpec.StartTime, EndTime: originalSpec.EndTime, Namespace: originalSpec.Namespace, FieldSelector: "type=Normal", Limit: originalSpec.Limit},
		},
		{
			"limit changed",
			v1alpha1.EventQuerySpec{StartTime: originalSpec.StartTime, EndTime: originalSpec.EndTime, Namespace: originalSpec.Namespace, FieldSelector: originalSpec.FieldSelector, Limit: 500},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := decodeEventQueryCursor(cursor, tt.modifiedSpec)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "query parameters changed")
		})
	}
}

// TestDecodeEventQueryCursor_ExpiredCursor verifies that expired cursors are rejected.
func TestDecodeEventQueryCursor_ExpiredCursor(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Limit:     100,
	}

	// Manually craft an expired cursor (IssuedAt 2 hours ago)
	expiredData := eventQueryCursorData{
		Offset:    100,
		QueryHash: hashEventQueryParams(spec),
		IssuedAt:  time.Now().Add(-2 * time.Hour),
	}

	jsonData, err := json.Marshal(expiredData)
	require.NoError(t, err)
	expiredCursor := base64.URLEncoding.EncodeToString(jsonData)

	_, err = decodeEventQueryCursor(expiredCursor, spec)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "cursor expired")
}

// TestDecodeEventQueryCursor_ZeroIssuedAt verifies that a cursor with zero IssuedAt
// is treated as invalid.
func TestDecodeEventQueryCursor_ZeroIssuedAt(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Limit:     100,
	}

	// Cursor with zero time (no IssuedAt)
	data := eventQueryCursorData{
		Offset:    50,
		QueryHash: hashEventQueryParams(spec),
		// IssuedAt is zero value
	}

	jsonData, err := json.Marshal(data)
	require.NoError(t, err)
	cursor := base64.URLEncoding.EncodeToString(jsonData)

	_, err = decodeEventQueryCursor(cursor, spec)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "cursor format is invalid")
}

// TestValidateEventQueryCursor_ValidCursor verifies that a fresh cursor passes validation.
func TestValidateEventQueryCursor_ValidCursor(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
		Limit:     100,
	}

	cursor := encodeEventQueryCursor(corev1.Event{}, spec)

	err := ValidateEventQueryCursor(cursor, spec)

	assert.NoError(t, err, "fresh cursor should be valid")
}

// TestValidateEventQueryCursor_InvalidCursor verifies that malformed cursors fail validation.
func TestValidateEventQueryCursor_InvalidCursor(t *testing.T) {
	t.Parallel()

	spec := v1alpha1.EventQuerySpec{
		StartTime: "2024-01-01T00:00:00Z",
		EndTime:   "2024-01-02T00:00:00Z",
	}

	err := ValidateEventQueryCursor("invalid!!!", spec)

	assert.Error(t, err)
}

// TestGetEventQueryNotFoundError verifies the not-found error has the correct resource name.
func TestGetEventQueryNotFoundError(t *testing.T) {
	t.Parallel()

	err := GetEventQueryNotFoundError("my-event-query")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "my-event-query")
	assert.Contains(t, strings.ToLower(err.Error()), "eventquer")
}

// TestEventQueryBackend_GetMaxQueryWindow_Is60Days verifies the constant value
// through the interface method, ensuring the 60-day limit is preserved.
func TestEventQueryBackend_GetMaxQueryWindow_Is60Days(t *testing.T) {
	t.Parallel()

	var backend EventQueryBackend = NewClickHouseEventQueryBackend(nil, ClickHouseEventsConfig{Database: "audit"})

	window := backend.GetMaxQueryWindow()

	sixtyDays := 60 * 24 * time.Hour
	assert.Equal(t, sixtyDays, window)
	// Verify it's strictly more than 24 hours (unlike the native events list backend).
	assert.Greater(t, window, 24*time.Hour,
		"EventQuery window should be greater than 24h (the native Events limit)")
}

// TestEventQueryBuildScopeConditions_PlatformScope verifies that platform scope
// produces no filtering conditions.
func TestEventQueryBuildScopeConditions_PlatformScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventQueryBackend{}

	tests := []struct {
		name  string
		scope ScopeContext
	}{
		{"empty scope type", ScopeContext{Type: "", Name: ""}},
		{"explicit platform", ScopeContext{Type: "platform", Name: ""}},
		{"platform with name", ScopeContext{Type: "platform", Name: "global"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			conditions, args := b.buildScopeConditions(tt.scope)
			assert.Empty(t, conditions, "platform scope should produce no conditions")
			assert.Empty(t, args, "platform scope should produce no args")
		})
	}
}

// TestEventQueryBuildScopeConditions_OrganizationScope verifies that organization
// scope produces the expected SQL conditions.
func TestEventQueryBuildScopeConditions_OrganizationScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventQueryBackend{}
	scope := ScopeContext{Type: "organization", Name: "acme-corp"}

	conditions, args := b.buildScopeConditions(scope)

	assert.Len(t, conditions, 2, "org scope should produce 2 conditions")
	assert.Contains(t, conditions[0], "scope_type")
	assert.Contains(t, conditions[1], "scope_name")
	assert.Equal(t, []interface{}{"organization", "acme-corp"}, args)
}

// TestEventQueryBuildScopeConditions_ProjectScope verifies that project scope
// produces the expected SQL conditions.
func TestEventQueryBuildScopeConditions_ProjectScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventQueryBackend{}
	scope := ScopeContext{Type: "project", Name: "my-project"}

	conditions, args := b.buildScopeConditions(scope)

	assert.Len(t, conditions, 2)
	assert.Equal(t, []interface{}{"project", "my-project"}, args)
}
