package processor

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMatchedPolicyFields verifies the MatchedPolicy type has the expected fields.
func TestMatchedPolicyFields(t *testing.T) {
	t.Parallel()

	mp := MatchedPolicy{
		PolicyName: "my-policy",
		APIGroup:   "apps",
		Kind:       "Deployment",
		Summary:    "Deployment updated",
	}

	assert.Equal(t, "my-policy", mp.PolicyName)
	assert.Equal(t, "apps", mp.APIGroup)
	assert.Equal(t, "Deployment", mp.Kind)
	assert.Equal(t, "Deployment updated", mp.Summary)
}

// TestEventPolicyLookup_Interface verifies the interface can be implemented by a test double.
func TestEventPolicyLookup_Interface(t *testing.T) {
	t.Parallel()

	// Verify our mock satisfies the interface at compile time.
	var _ EventPolicyLookup = &mockEventPolicyLookup{}

	lookup := &mockEventPolicyLookup{
		matchResult: &MatchedPolicy{
			PolicyName: "pod-policy",
			APIGroup:   "",
			Kind:       "Pod",
			Summary:    "Pod was created",
		},
	}

	eventMap := map[string]any{
		"reason": "Created",
		"regarding": map[string]any{
			"kind": "Pod",
			"name": "my-pod",
		},
	}

	result, err := lookup.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "pod-policy", result.PolicyName)
	assert.Equal(t, "Pod was created", result.Summary)
}

// TestEventPolicyLookup_NoMatch verifies nil is returned when no policy matches.
func TestEventPolicyLookup_NoMatch(t *testing.T) {
	t.Parallel()

	lookup := &mockEventPolicyLookup{matchResult: nil}

	result, err := lookup.MatchEvent("apps", "Deployment", map[string]any{})

	require.NoError(t, err)
	assert.Nil(t, result)
}

// TestEventPolicyLookup_Error verifies errors are propagated correctly.
func TestEventPolicyLookup_Error(t *testing.T) {
	t.Parallel()

	expectedErr := errors.New("policy store unavailable")
	lookup := &mockEventPolicyLookup{matchErr: expectedErr}

	result, err := lookup.MatchEvent("", "Pod", map[string]any{})

	require.Error(t, err)
	assert.ErrorIs(t, err, expectedErr)
	assert.Nil(t, result)
}

// TestAuditPolicyLookup_Interface verifies the AuditPolicyLookup interface can be implemented.
func TestAuditPolicyLookup_Interface(t *testing.T) {
	t.Parallel()

	var _ AuditPolicyLookup = &mockAuditLookup{}

	lookup := &mockAuditLookup{
		matchResult: &MatchedPolicy{
			PolicyName: "pods-audit",
			APIGroup:   "",
			Kind:       "Pod",
			Summary:    "Pod deleted by alice",
		},
	}

	auditMap := map[string]any{
		"verb":     "delete",
		"auditID":  "abc-123",
		"objectRef": map[string]any{
			"resource": "pods",
			"name":     "my-pod",
		},
	}

	result, err := lookup.MatchAudit("", "pods", auditMap)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "pods-audit", result.PolicyName)
}

// TestAuditPolicyLookup_Error verifies errors are propagated correctly.
func TestAuditPolicyLookup_Error(t *testing.T) {
	t.Parallel()

	expectedErr := errors.New("cache miss")
	lookup := &mockAuditLookup{matchErr: expectedErr}

	result, err := lookup.MatchAudit("apps", "deployments", map[string]any{})

	require.Error(t, err)
	assert.ErrorIs(t, err, expectedErr)
	assert.Nil(t, result)
}

// mockEventPolicyLookup is a test double for EventPolicyLookup.
type mockEventPolicyLookup struct {
	matchResult *MatchedPolicy
	matchErr    error
	// Track calls for assertion
	calls []struct {
		apiGroup string
		kind     string
	}
}

func (m *mockEventPolicyLookup) MatchEvent(apiGroup, kind string, _ map[string]any) (*MatchedPolicy, error) {
	m.calls = append(m.calls, struct {
		apiGroup string
		kind     string
	}{apiGroup, kind})
	return m.matchResult, m.matchErr
}

// mockAuditLookup is a test double for AuditPolicyLookup.
type mockAuditLookup struct {
	matchResult *MatchedPolicy
	matchErr    error
}

func (m *mockAuditLookup) MatchAudit(_, _ string, _ map[string]any) (*MatchedPolicy, error) {
	return m.matchResult, m.matchErr
}
