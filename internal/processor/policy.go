package processor

import "go.miloapis.com/activity/internal/cel"

// PolicyRule represents a compiled activity policy rule for CEL evaluation.
// This is the minimal interface that EventProcessor and AuditProcessor need
// to match events/audit records against policy rules. The activityprocessor
// package provides concrete implementations of this interface.
type PolicyRule interface {
	// IsValid returns true if the rule compiled successfully.
	IsValid() bool
	// EvaluateEventMatch evaluates the match expression against an event map.
	EvaluateEventMatch(eventMap map[string]any) (bool, error)
	// EvaluateAuditMatch evaluates the match expression against an audit map.
	EvaluateAuditMatch(auditMap map[string]any) (bool, error)
	// EvaluateSummary evaluates the summary template with the given variables.
	// Returns the rendered summary, any links collected via link() calls, and any error.
	EvaluateSummary(vars map[string]any) (string, []cel.Link, error)
}

// MatchedPolicy contains the result of matching an event against policy rules.
type MatchedPolicy struct {
	// PolicyName is the name of the matching policy.
	PolicyName string
	// APIGroup is the API group of the target resource.
	APIGroup string
	// Kind is the kind of the target resource.
	Kind string
	// Summary is the generated activity summary.
	Summary string
	// Links contains clickable references extracted from link() calls in the summary template.
	Links []cel.Link
}

// EventPolicyLookup is the interface used by EventProcessor to look up and
// evaluate activity policies against Kubernetes events.
// activityprocessor.PolicyCache provides an adapter that satisfies this interface.
type EventPolicyLookup interface {
	// MatchEvent looks up matching event rules for the given resource and
	// evaluates them against the provided event map.
	// Returns the first matching result, or nil if no policy matched.
	MatchEvent(apiGroup, kind string, eventMap map[string]any) (*MatchedPolicy, error)
}

// AuditPolicyLookup is the interface used by AuditProcessor to look up and
// evaluate activity policies against audit log events.
type AuditPolicyLookup interface {
	// MatchAudit looks up matching audit rules for the given resource and
	// evaluates them against the provided audit map.
	// Returns the first matching result, or nil if no policy matched.
	MatchAudit(apiGroup, resource string, auditMap map[string]any) (*MatchedPolicy, error)
}

// PolicyUpdater is the interface used by the Processor to update the policy cache
// when ActivityPolicy resources change.
type PolicyUpdater interface {
	// AddPolicy adds a policy to the cache.
	AddPolicy(policy *PolicySpec) error
	// UpdatePolicy updates a policy in the cache.
	UpdatePolicy(oldPolicy, newPolicy *PolicySpec) error
	// RemovePolicy removes a policy from the cache.
	RemovePolicy(policy *PolicySpec)
}

// PolicySpec contains the minimal information needed to add a policy to the cache.
type PolicySpec struct {
	// Name is the policy name.
	Name string
	// APIGroup is the target resource's API group.
	APIGroup string
	// Kind is the target resource's kind.
	Kind string
	// Resource is the plural resource name.
	Resource string
	// ResourceVersion is used for cache invalidation.
	ResourceVersion string
	// AuditRules are the CEL match/summary rule pairs for audit events.
	AuditRules []RuleSpec
	// EventRules are the CEL match/summary rule pairs for Kubernetes events.
	EventRules []RuleSpec
}

// RuleSpec contains a match/summary rule pair.
type RuleSpec struct {
	Match   string
	Summary string
}
