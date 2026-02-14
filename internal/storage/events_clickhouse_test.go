package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewClickHouseEventsBackend_DefaultTable verifies that a missing Table config
// value is defaulted to "events".
func TestNewClickHouseEventsBackend_DefaultTable(t *testing.T) {
	t.Parallel()

	b := NewClickHouseEventsBackend(nil, ClickHouseEventsConfig{
		Database: "audit",
		// Table intentionally left empty
	})

	require.NotNil(t, b)
	assert.Equal(t, "events", b.config.Table, "missing Table should default to 'events'")
	assert.Equal(t, "audit", b.config.Database)
}

// TestNewClickHouseEventsBackend_ExplicitTable verifies that an explicitly
// provided Table name is preserved.
func TestNewClickHouseEventsBackend_ExplicitTable(t *testing.T) {
	t.Parallel()

	b := NewClickHouseEventsBackend(nil, ClickHouseEventsConfig{
		Database: "audit",
		Table:    "my_events",
	})

	require.NotNil(t, b)
	assert.Equal(t, "my_events", b.config.Table)
}

// TestBuildScopeConditions_PlatformScope verifies that platform scope produces
// no filtering conditions (sees all events).
func TestBuildScopeConditions_PlatformScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventsBackend{}

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

// TestBuildScopeConditions_OrganizationScope verifies that organization scope
// produces scope_type and scope_name filter conditions.
func TestBuildScopeConditions_OrganizationScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventsBackend{}
	scope := ScopeContext{Type: "organization", Name: "acme-corp"}

	conditions, args := b.buildScopeConditions(scope)

	assert.Len(t, conditions, 2, "org scope should produce 2 conditions")
	assert.Contains(t, conditions[0], "scope_type")
	assert.Contains(t, conditions[1], "scope_name")
	assert.Equal(t, []interface{}{"organization", "acme-corp"}, args)
}

// TestBuildScopeConditions_ProjectScope verifies that project scope
// produces scope_type and scope_name filter conditions.
func TestBuildScopeConditions_ProjectScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventsBackend{}
	scope := ScopeContext{Type: "project", Name: "my-project"}

	conditions, args := b.buildScopeConditions(scope)

	assert.Len(t, conditions, 2, "project scope should produce 2 conditions")
	assert.Equal(t, []interface{}{"project", "my-project"}, args)
}

// TestBuildScopeConditions_UserScope verifies that user scope falls through to
// organization/project-style filtering for events.
func TestBuildScopeConditions_UserScope(t *testing.T) {
	t.Parallel()

	b := &ClickHouseEventsBackend{}
	scope := ScopeContext{Type: "user", Name: "user-uid-123"}

	conditions, args := b.buildScopeConditions(scope)

	// User scope falls through to scope_type/scope_name filtering for events
	assert.Len(t, conditions, 2)
	assert.Equal(t, []interface{}{"user", "user-uid-123"}, args)
}
