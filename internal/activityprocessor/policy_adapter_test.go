package activityprocessor

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"go.miloapis.com/activity/internal/processor"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// TestPolicyCacheAdapterImplementsInterfaces verifies that PolicyCacheAdapter
// satisfies both processor.EventPolicyLookup and processor.AuditPolicyLookup.
// This is a compile-time check embedded in a test so failures are caught by CI.
func TestPolicyCacheAdapterImplementsInterfaces(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	var _ processor.EventPolicyLookup = adapter
	var _ processor.AuditPolicyLookup = adapter

	require.NotNil(t, adapter)
}

// TestNewPolicyCacheAdapter verifies the constructor wraps the cache correctly.
func TestNewPolicyCacheAdapter(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	require.NotNil(t, adapter)
	assert.Equal(t, c, adapter.cache)
}

// TestPolicyCacheAdapter_MatchEvent_NoPolicies verifies nil is returned
// when no policies exist for the given apiGroup/kind combination.
func TestPolicyCacheAdapter_MatchEvent_NoPolicies(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	eventMap := map[string]any{
		"reason": "Scheduled",
		"regarding": map[string]any{
			"kind": "Pod",
			"name": "my-pod",
		},
	}

	result, err := adapter.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	assert.Nil(t, result, "should return nil when no policies exist")
}

// TestPolicyCacheAdapter_MatchAudit_NoPolicies verifies nil is returned
// when no policies exist for the given apiGroup/resource combination.
func TestPolicyCacheAdapter_MatchAudit_NoPolicies(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	auditMap := map[string]any{
		"verb":    "create",
		"auditID": "abc-123",
	}

	result, err := adapter.MatchAudit("", "pods", auditMap)

	require.NoError(t, err)
	assert.Nil(t, result, "should return nil when no policies exist")
}

// TestPolicyCacheAdapter_MatchEvent_PolicyWithNoEventRules verifies nil is returned
// when a matching policy exists but has no event rules.
// MatchEvent looks up cache by kind (e.g., "Pod"), so we add the policy with kind as the resource key.
func TestPolicyCacheAdapter_MatchEvent_PolicyWithNoEventRules(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	// A policy with only audit rules and no event rules.
	// We add it with kind="Pod" as the resource key since MatchEvent looks up by kind.
	policy := newTestPolicy("audit-only-policy", "", "Pod")
	policy.Spec.AuditRules = []v1alpha1.ActivityPolicyRule{
		{Match: "audit.verb == 'create'", Summary: "Pod created"},
	}
	// No EventRules

	require.NoError(t, c.Add(policy, "Pod"))

	eventMap := map[string]any{
		"reason": "Scheduled",
	}

	result, err := adapter.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	assert.Nil(t, result, "should return nil when policy has no event rules")
}

// TestPolicyCacheAdapter_MatchAudit_PolicyWithNoAuditRules verifies nil is returned
// when a matching policy exists but has no audit rules.
// MatchAudit looks up cache by resource (e.g., "pods").
func TestPolicyCacheAdapter_MatchAudit_PolicyWithNoAuditRules(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	// A policy with only event rules and no audit rules.
	// We add it with resource="pods" since MatchAudit looks up by resource.
	policy := newTestPolicy("event-only-policy", "", "Pod")
	policy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{Match: "event.reason == 'Scheduled'", Summary: "Pod scheduled"},
	}
	// No AuditRules

	require.NoError(t, c.Add(policy, "pods"))

	auditMap := map[string]any{
		"verb":      "create",
		"objectRef": map[string]any{"resource": "pods"},
	}

	result, err := adapter.MatchAudit("", "pods", auditMap)

	require.NoError(t, err)
	assert.Nil(t, result, "should return nil when policy has no audit rules")
}

// TestPolicyCacheAdapter_MatchEvent_InvalidRuleSkipped verifies that invalid
// (non-compilable) rules are silently skipped rather than causing errors.
func TestPolicyCacheAdapter_MatchEvent_InvalidRuleSkipped(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	// Policy with invalid CEL expression — compilation fails but Add() still succeeds.
	policy := newTestPolicy("bad-policy", "", "Pod")
	policy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{Match: "this is not valid CEL !!!", Summary: "Pod scheduled"},
	}

	// Add should succeed even with invalid rules (they're marked invalid, not rejected).
	require.NoError(t, c.Add(policy, "Pod"))

	eventMap := map[string]any{"reason": "Scheduled"}

	// Invalid rule is skipped; no match → nil result.
	result, err := adapter.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	assert.Nil(t, result, "invalid rules should be skipped")
}

// TestPolicyCacheAdapter_MatchEvent_MatchingPolicy verifies that a valid matching
// policy returns the expected MatchedPolicy result.
func TestPolicyCacheAdapter_MatchEvent_MatchingPolicy(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	policy := newTestPolicy("pod-scheduler-policy", "", "Pod")
	policy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{
			Match:   "event.reason == 'Scheduled'",
			Summary: "Pod was scheduled",
		},
	}

	// MatchEvent looks up by kind, so add with kind as resource key.
	require.NoError(t, c.Add(policy, "Pod"))

	eventMap := map[string]any{
		"reason": "Scheduled",
		"regarding": map[string]any{
			"kind": "Pod",
			"name": "my-pod",
		},
	}

	result, err := adapter.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "pod-scheduler-policy", result.PolicyName)
	assert.Equal(t, "", result.APIGroup)
	assert.Equal(t, "Pod", result.Kind)
	assert.Equal(t, "Pod was scheduled", result.Summary)
}

// TestPolicyCacheAdapter_MatchAudit_MatchingPolicy verifies that a valid matching
// audit policy returns the expected MatchedPolicy result.
func TestPolicyCacheAdapter_MatchAudit_MatchingPolicy(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	policy := newTestPolicy("pod-create-policy", "", "Pod")
	policy.Spec.AuditRules = []v1alpha1.ActivityPolicyRule{
		{
			Match:   "audit.verb == 'create'",
			Summary: "Pod was created",
		},
	}

	// MatchAudit looks up by resource (plural), so add with "pods".
	require.NoError(t, c.Add(policy, "pods"))

	auditMap := map[string]any{
		"verb":    "create",
		"auditID": "abc-123",
		"user":    map[string]any{"username": "alice@example.com"},
	}

	result, err := adapter.MatchAudit("", "pods", auditMap)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "pod-create-policy", result.PolicyName)
	assert.Equal(t, "", result.APIGroup)
	assert.Equal(t, "Pod", result.Kind)
	assert.Equal(t, "Pod was created", result.Summary)
}

// TestPolicyCacheAdapter_MatchEvent_NonMatchingRule verifies nil is returned
// when the event does not satisfy the CEL match expression.
func TestPolicyCacheAdapter_MatchEvent_NonMatchingRule(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	policy := newTestPolicy("pod-scheduled-policy", "", "Pod")
	policy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{
			Match:   "event.reason == 'Scheduled'",
			Summary: "Pod was scheduled",
		},
	}

	require.NoError(t, c.Add(policy, "Pod"))

	// Event with a different reason — should not match.
	eventMap := map[string]any{
		"reason": "Pulled", // Different from "Scheduled"
		"regarding": map[string]any{
			"kind": "Pod",
			"name": "my-pod",
		},
	}

	result, err := adapter.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	assert.Nil(t, result, "non-matching event should return nil")
}

// TestPolicyCacheAdapter_MatchEvent_FirstMatchWins verifies that only the first
// matching rule is returned when multiple rules would match.
func TestPolicyCacheAdapter_MatchEvent_FirstMatchWins(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	policy := newTestPolicy("multi-rule-policy", "", "Pod")
	policy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{
			Match:   "event.reason == 'Scheduled'",
			Summary: "Pod was scheduled",
		},
		{
			// Also matches "Scheduled" but should never be reached.
			Match:   "event.reason == 'Scheduled'",
			Summary: "This should not be returned",
		},
	}

	require.NoError(t, c.Add(policy, "Pod"))

	eventMap := map[string]any{
		"reason": "Scheduled",
	}

	result, err := adapter.MatchEvent("", "Pod", eventMap)

	require.NoError(t, err)
	require.NotNil(t, result)
	// Only the first matching rule summary should be returned.
	assert.Equal(t, "Pod was scheduled", result.Summary)
}

// TestPolicyCacheAdapter_MatchEvent_APIGroupRouting verifies that lookups
// for different apiGroup/kind pairs are routed independently.
func TestPolicyCacheAdapter_MatchEvent_APIGroupRouting(t *testing.T) {
	t.Parallel()

	c := NewPolicyCache()
	adapter := NewPolicyCacheAdapter(c)

	podPolicy := newTestPolicy("pod-policy", "", "Pod")
	podPolicy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{Match: "event.reason == 'Scheduled'", Summary: "Pod scheduled"},
	}

	deployPolicy := newTestPolicy("deploy-policy", "apps", "Deployment")
	deployPolicy.Spec.EventRules = []v1alpha1.ActivityPolicyRule{
		{Match: "event.reason == 'ScalingReplicaSet'", Summary: "Deployment scaled"},
	}

	require.NoError(t, c.Add(podPolicy, "Pod"))
	require.NoError(t, c.Add(deployPolicy, "Deployment"))

	// Pod event matches pod policy.
	podEventMap := map[string]any{"reason": "Scheduled"}
	podResult, err := adapter.MatchEvent("", "Pod", podEventMap)
	require.NoError(t, err)
	require.NotNil(t, podResult)
	assert.Equal(t, "pod-policy", podResult.PolicyName)

	// Deployment event matches deployment policy.
	deployEventMap := map[string]any{"reason": "ScalingReplicaSet"}
	deployResult, err := adapter.MatchEvent("apps", "Deployment", deployEventMap)
	require.NoError(t, err)
	require.NotNil(t, deployResult)
	assert.Equal(t, "deploy-policy", deployResult.PolicyName)

	// Pod event against deployment lookup returns nil.
	crossResult, err := adapter.MatchEvent("apps", "Deployment", podEventMap)
	require.NoError(t, err)
	assert.Nil(t, crossResult, "pod event should not match deployment policy")
}

// newTestPolicy creates a minimal ActivityPolicy for use in tests.
func newTestPolicy(name, apiGroup, kind string) *v1alpha1.ActivityPolicy {
	return &v1alpha1.ActivityPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			ResourceVersion: "1",
		},
		Spec: v1alpha1.ActivityPolicySpec{
			Resource: v1alpha1.ActivityPolicyResource{
				APIGroup: apiGroup,
				Kind:     kind,
			},
		},
	}
}
