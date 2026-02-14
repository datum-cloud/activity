package activityprocessor

import (
	"fmt"

	"go.miloapis.com/activity/internal/processor"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// PolicyCacheAdapter wraps PolicyCache to implement the processor.EventPolicyLookup
// and processor.AuditPolicyLookup interfaces. This allows the internal/processor
// package to use the policy cache without creating an import cycle.
type PolicyCacheAdapter struct {
	cache *PolicyCache
}

// NewPolicyCacheAdapter creates a new adapter wrapping the given PolicyCache.
func NewPolicyCacheAdapter(cache *PolicyCache) *PolicyCacheAdapter {
	return &PolicyCacheAdapter{cache: cache}
}

// MatchEvent looks up matching event rules for the given apiGroup and kind,
// evaluates them against the provided event map, and returns the first match.
// Returns nil if no policy rule matches the event.
func (a *PolicyCacheAdapter) MatchEvent(apiGroup, kind string, eventMap map[string]any) (*processor.MatchedPolicy, error) {
	policies := a.cache.GetByKind(apiGroup, kind)
	if len(policies) == 0 {
		return nil, nil
	}

	for _, policy := range policies {
		if len(policy.EventRules) == 0 {
			continue
		}

		vars := BuildEventVars(eventMap)

		for i, rule := range policy.EventRules {
			if !rule.Valid {
				continue
			}

			matched, err := rule.EvaluateEventMatch(eventMap)
			if err != nil {
				return nil, fmt.Errorf("policy %s event rule %d match: %w", policy.Name, i, err)
			}

			if !matched {
				continue
			}

			summary, links, err := rule.EvaluateSummary(vars)
			if err != nil {
				return nil, fmt.Errorf("policy %s event rule %d summary: %w", policy.Name, i, err)
			}

			return &processor.MatchedPolicy{
				PolicyName: policy.Name,
				APIGroup:   policy.APIGroup,
				Kind:       policy.Kind,
				Summary:    summary,
				Links:      links,
			}, nil
		}
	}

	return nil, nil
}

// MatchAudit looks up matching audit rules for the given apiGroup and resource,
// evaluates them against the provided audit map, and returns the first match.
// Returns nil if no policy rule matches the audit event.
func (a *PolicyCacheAdapter) MatchAudit(apiGroup, resource string, auditMap map[string]any) (*processor.MatchedPolicy, error) {
	policies := a.cache.Get(apiGroup, resource)
	if len(policies) == 0 {
		return nil, nil
	}

	for _, policy := range policies {
		if len(policy.AuditRules) == 0 {
			continue
		}

		vars := BuildAuditVars(auditMap)

		for i, rule := range policy.AuditRules {
			if !rule.Valid {
				continue
			}

			matched, err := rule.EvaluateAuditMatch(auditMap)
			if err != nil {
				return nil, fmt.Errorf("policy %s audit rule %d match: %w", policy.Name, i, err)
			}

			if !matched {
				continue
			}

			summary, links, err := rule.EvaluateSummary(vars)
			if err != nil {
				return nil, fmt.Errorf("policy %s audit rule %d summary: %w", policy.Name, i, err)
			}

			return &processor.MatchedPolicy{
				PolicyName: policy.Name,
				APIGroup:   policy.APIGroup,
				Kind:       policy.Kind,
				Summary:    summary,
				Links:      links,
			}, nil
		}
	}

	return nil, nil
}

// AddPolicy implements processor.PolicyUpdater by converting the PolicySpec to an
// ActivityPolicy and adding it to the cache.
func (a *PolicyCacheAdapter) AddPolicy(spec *processor.PolicySpec) error {
	policy := specToActivityPolicy(spec)
	return a.cache.Add(policy, spec.Resource)
}

// UpdatePolicy implements processor.PolicyUpdater by converting the PolicySpecs to
// ActivityPolicies and updating the cache.
func (a *PolicyCacheAdapter) UpdatePolicy(oldSpec, newSpec *processor.PolicySpec) error {
	oldPolicy := specToActivityPolicy(oldSpec)
	newPolicy := specToActivityPolicy(newSpec)
	return a.cache.Update(oldPolicy, newPolicy, oldSpec.Resource, newSpec.Resource)
}

// RemovePolicy implements processor.PolicyUpdater by converting the PolicySpec to an
// ActivityPolicy and removing it from the cache.
func (a *PolicyCacheAdapter) RemovePolicy(spec *processor.PolicySpec) {
	policy := specToActivityPolicy(spec)
	a.cache.Remove(policy, spec.Resource)
}

// specToActivityPolicy converts a processor.PolicySpec to a v1alpha1.ActivityPolicy
// for use with the PolicyCache methods.
func specToActivityPolicy(spec *processor.PolicySpec) *v1alpha1.ActivityPolicy {
	policy := &v1alpha1.ActivityPolicy{}
	policy.Name = spec.Name
	policy.ResourceVersion = spec.ResourceVersion
	policy.Spec.Resource.APIGroup = spec.APIGroup
	policy.Spec.Resource.Kind = spec.Kind

	for _, r := range spec.AuditRules {
		policy.Spec.AuditRules = append(policy.Spec.AuditRules, v1alpha1.ActivityPolicyRule{
			Match:   r.Match,
			Summary: r.Summary,
		})
	}

	for _, r := range spec.EventRules {
		policy.Spec.EventRules = append(policy.Spec.EventRules, v1alpha1.ActivityPolicyRule{
			Match:   r.Match,
			Summary: r.Summary,
		})
	}

	return policy
}
