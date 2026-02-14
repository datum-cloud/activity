package processor

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewAuditProcessor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		streamName     string
		consumerName   string
		activityPrefix string
		workers        int
		batchSize      int
	}{
		{
			name:           "standard configuration",
			streamName:     "AUDIT_EVENTS",
			consumerName:   "activity-processor",
			activityPrefix: "activities",
			workers:        2,
			batchSize:      10,
		},
		{
			name:           "single worker with large batch",
			streamName:     "AUDIT",
			consumerName:   "consumer-1",
			activityPrefix: "act",
			workers:        1,
			batchSize:      100,
		},
		{
			name:           "zero workers still creates processor",
			streamName:     "AUDIT_EVENTS",
			consumerName:   "consumer",
			activityPrefix: "activities",
			workers:        0,
			batchSize:      10,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			lookup := &mockAuditPolicyLookup{}
			p := NewAuditProcessor(
				nil,
				tt.streamName,
				tt.consumerName,
				tt.activityPrefix,
				lookup,
				tt.workers,
				tt.batchSize,
			)

			require.NotNil(t, p)
			assert.Equal(t, tt.streamName, p.streamName)
			assert.Equal(t, tt.consumerName, p.consumerName)
			assert.Equal(t, tt.activityPrefix, p.activityPrefix)
			assert.Equal(t, tt.workers, p.workers)
			assert.Equal(t, tt.batchSize, p.batchSize)
			assert.Equal(t, lookup, p.policyLookup)
		})
	}
}

func TestBuildAuditActivity_HumanUser(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{activityPrefix: "activities"}

	auditMap := map[string]any{
		"auditID": "audit-abc-12345678",
		"user": map[string]any{
			"username": "alice@example.com",
			"uid":      "user-uid-123",
		},
	}

	objectRef := map[string]any{
		"namespace":  "production",
		"name":       "my-pod",
		"apiVersion": "v1",
	}

	matched := &MatchedPolicy{
		PolicyName: "core-pods",
		APIGroup:   "",
		Kind:       "Pod",
		Summary:    "Pod my-pod was created",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	assert.Equal(t, "Pod my-pod was created", activity.Spec.Summary)
	assert.Equal(t, ChangeSourceHuman, activity.Spec.ChangeSource)
	assert.Equal(t, ActorTypeUser, activity.Spec.Actor.Type)
	assert.Equal(t, "alice@example.com", activity.Spec.Actor.Name)
	assert.Equal(t, "user-uid-123", activity.Spec.Actor.UID)
	assert.Equal(t, "audit", activity.Spec.Origin.Type)
	// Activity name is "act-" + first 8 chars of auditID ("audit-abc-12345678"[:8] = "audit-ab")
	assert.Equal(t, "act-audit-ab", activity.Name)
}

func TestBuildAuditActivity_SystemUser(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{activityPrefix: "activities"}

	auditMap := map[string]any{
		"auditID": "defabc1234567890",
		"user": map[string]any{
			"username": "system:controller:replicaset-controller",
			"uid":      "",
		},
	}

	objectRef := map[string]any{
		"namespace":  "default",
		"name":       "my-rs",
		"apiVersion": "apps/v1",
	}

	matched := &MatchedPolicy{
		PolicyName: "apps-replicasets",
		APIGroup:   "apps",
		Kind:       "ReplicaSet",
		Summary:    "ReplicaSet my-rs was scaled",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	assert.Equal(t, ChangeSourceSystem, activity.Spec.ChangeSource)
	assert.Equal(t, ActorTypeSystem, activity.Spec.Actor.Type)
	assert.Equal(t, "system:controller:replicaset-controller", activity.Spec.Actor.Name)
	assert.Equal(t, "audit", activity.Spec.Origin.Type)
	assert.Equal(t, "act-defabc12", activity.Name)
}

func TestBuildAuditActivity_EmptyUsername(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{}

	auditMap := map[string]any{
		"auditID": "xyz1234567890abc",
		"user":    map[string]any{},
	}

	objectRef := map[string]any{
		"namespace":  "kube-system",
		"name":       "coredns",
		"apiVersion": "apps/v1",
	}

	matched := &MatchedPolicy{
		PolicyName: "coredns",
		APIGroup:   "apps",
		Kind:       "Deployment",
		Summary:    "Deployment coredns was updated",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	// Empty username → actor name falls back to "unknown"
	assert.Equal(t, "unknown", activity.Spec.Actor.Name)
	assert.Equal(t, ChangeSourceSystem, activity.Spec.ChangeSource)
}

func TestBuildAuditActivity_NoAuditID(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{}

	auditMap := map[string]any{
		"user": map[string]any{
			"username": "alice@example.com",
		},
	}

	objectRef := map[string]any{
		"namespace":  "default",
		"name":       "my-svc",
		"apiVersion": "v1",
	}

	matched := &MatchedPolicy{
		PolicyName: "core-services",
		APIGroup:   "",
		Kind:       "Service",
		Summary:    "Service my-svc was created",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	// No auditID → name is generated with "act-" prefix and random 8 chars
	require.True(t, len(activity.Name) >= 8, "name should be at least 8 chars (act-XXXXXXXX)")
	assert.Equal(t, "act-", activity.Name[:4])
	// Origin ID is empty when no auditID
	assert.Equal(t, "", activity.Spec.Origin.ID)
}

func TestBuildAuditActivity_AuditIDUsedAsActivityName(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{}

	auditMap := map[string]any{
		"auditID": "abcdef1234567890",
		"user": map[string]any{
			"username": "bob@example.com",
		},
	}

	objectRef := map[string]any{
		"namespace": "default",
		"name":      "my-cm",
	}

	matched := &MatchedPolicy{
		PolicyName: "core-configmaps",
		APIGroup:   "",
		Kind:       "ConfigMap",
		Summary:    "ConfigMap my-cm was updated",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	// Activity name is "act-" + first 8 chars of auditID
	assert.Equal(t, "act-abcdef12", activity.Name)
	// Origin ID is full auditID
	assert.Equal(t, "abcdef1234567890", activity.Spec.Origin.ID)
}

func TestBuildAuditActivity_ShortAuditID(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{}

	auditMap := map[string]any{
		// auditID with fewer than 8 chars — should fall back to random UUID
		"auditID": "short",
		"user": map[string]any{
			"username": "alice@example.com",
		},
	}

	objectRef := map[string]any{
		"namespace": "default",
		"name":      "my-pod",
	}

	matched := &MatchedPolicy{
		PolicyName: "core-pods",
		APIGroup:   "",
		Kind:       "Pod",
		Summary:    "Pod created",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	// Short auditID → falls back to random UUID name
	assert.Equal(t, "act-", activity.Name[:4])
	// But origin ID is still the short auditID
	assert.Equal(t, "short", activity.Spec.Origin.ID)
}

func TestBuildAuditActivity_ResourceFields(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{}

	auditMap := map[string]any{
		"auditID": "12345678abcdef00",
		"user": map[string]any{
			"username": "charlie@example.com",
		},
	}

	objectRef := map[string]any{
		"namespace":  "staging",
		"name":       "my-deploy",
		"apiVersion": "apps/v1",
	}

	matched := &MatchedPolicy{
		PolicyName: "apps-deployments",
		APIGroup:   "apps",
		Kind:       "Deployment",
		Summary:    "Deployment my-deploy was created",
	}

	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	require.NotNil(t, activity)
	assert.Equal(t, "apps", activity.Spec.Resource.APIGroup)
	assert.Equal(t, "apps/v1", activity.Spec.Resource.APIVersion)
	assert.Equal(t, "Deployment", activity.Spec.Resource.Kind)
	assert.Equal(t, "my-deploy", activity.Spec.Resource.Name)
	assert.Equal(t, "staging", activity.Spec.Resource.Namespace)
	assert.Equal(t, "staging", activity.Namespace)
	assert.Equal(t, "platform", activity.Spec.Tenant.Type)
}

func TestBuildAuditActivitySubject_NamespacedResource(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{activityPrefix: "activities"}
	auditMap := map[string]any{
		"auditID": "abcdef1234567890",
		"user":    map[string]any{"username": "alice@example.com"},
	}
	objectRef := map[string]any{
		"namespace":  "default",
		"name":       "my-pod",
		"apiVersion": "v1",
	}
	matched := &MatchedPolicy{APIGroup: "", Kind: "Pod", Summary: "Pod created"}
	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	subject := p.buildAuditActivitySubject(activity)

	assert.Contains(t, subject, "activities.")
	assert.Contains(t, subject, ".platform.")
	assert.Contains(t, subject, ".audit.")
	assert.Contains(t, subject, ".Pod.")
	assert.Contains(t, subject, ".default.")
	// Empty API group → "core"
	assert.Contains(t, subject, ".core.")
}

func TestBuildAuditActivitySubject_ClusterScopedResourceUsesUnderscoreNamespace(t *testing.T) {
	t.Parallel()

	p := &AuditProcessor{activityPrefix: "activities"}
	auditMap := map[string]any{
		"auditID": "abcdef1234567890",
		"user":    map[string]any{"username": "system:admin"},
	}
	objectRef := map[string]any{
		"namespace":  "",
		"name":       "cluster-role-1",
		"apiVersion": "rbac.authorization.k8s.io/v1",
	}
	matched := &MatchedPolicy{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Summary: "ClusterRole created"}
	activity := p.buildAuditActivity(auditMap, objectRef, matched)

	subject := p.buildAuditActivitySubject(activity)

	// Namespace empty → should use "_"
	assert.Contains(t, subject, "._.")
}

// mockAuditPolicyLookup is a test double for AuditPolicyLookup.
type mockAuditPolicyLookup struct {
	matchResult *MatchedPolicy
	matchErr    error
}

func (m *mockAuditPolicyLookup) MatchAudit(_, _ string, _ map[string]any) (*MatchedPolicy, error) {
	return m.matchResult, m.matchErr
}
