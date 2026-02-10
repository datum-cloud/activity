package controller

import (
	"encoding/json"
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// CompiledRule represents a pre-validated policy rule ready for execution.
type CompiledRule struct {
	// Match is the original match expression.
	Match string
	// Summary is the original summary template.
	Summary string
	// Valid indicates if the rule compiled successfully.
	Valid bool
	// CompileError holds any error from compilation.
	CompileError string
}

// CompiledPolicy represents a pre-validated ActivityPolicy ready for use.
type CompiledPolicy struct {
	// Name is the policy name.
	Name string
	// APIGroup is the target resource's API group.
	APIGroup string
	// Kind is the target resource's kind.
	Kind string
	// AuditRules are the compiled audit rules.
	AuditRules []CompiledRule
	// EventRules are the compiled event rules.
	EventRules []CompiledRule
	// ResourceVersion is the policy's resource version for cache invalidation.
	ResourceVersion string
}

// PolicyCache provides thread-safe in-memory caching of ActivityPolicy resources.
// The Activity Processor uses this cache to look up translation rules without
// querying the API server on every audit log or event.
type PolicyCache struct {
	mu sync.RWMutex

	// policies stores compiled policies by their cache key (namespace/name)
	policies map[string]*CompiledPolicy

	// byResource provides an index by apiGroup/kind for fast lookups
	// during translation. Map key format: "apiGroup/kind"
	byResource map[string]*CompiledPolicy
}

// NewPolicyCache creates a new policy cache.
func NewPolicyCache() *PolicyCache {
	return &PolicyCache{
		policies:   make(map[string]*CompiledPolicy),
		byResource: make(map[string]*CompiledPolicy),
	}
}

// Update adds or updates a policy in the cache.
func (c *PolicyCache) Update(key string, policy *v1alpha1.ActivityPolicy) error {
	compiled := c.compile(policy)

	c.mu.Lock()
	defer c.mu.Unlock()

	// If there was a previous policy at this key, remove its resource index
	if old, exists := c.policies[key]; exists {
		resourceKey := fmt.Sprintf("%s/%s", old.APIGroup, old.Kind)
		delete(c.byResource, resourceKey)
	}

	// Store the new compiled policy
	c.policies[key] = compiled

	// Update the resource index
	resourceKey := fmt.Sprintf("%s/%s", compiled.APIGroup, compiled.Kind)
	c.byResource[resourceKey] = compiled

	klog.V(2).Infof("Updated policy cache: key=%s, resource=%s/%s, auditRules=%d, eventRules=%d",
		key, compiled.APIGroup, compiled.Kind, len(compiled.AuditRules), len(compiled.EventRules))

	return nil
}

// Delete removes a policy from the cache.
func (c *PolicyCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if policy, exists := c.policies[key]; exists {
		resourceKey := fmt.Sprintf("%s/%s", policy.APIGroup, policy.Kind)
		delete(c.byResource, resourceKey)
		delete(c.policies, key)
		klog.V(2).Infof("Deleted policy from cache: key=%s, resource=%s", key, resourceKey)
	}
}

// Get retrieves a policy by its cache key.
func (c *PolicyCache) Get(key string) (*CompiledPolicy, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	policy, exists := c.policies[key]
	return policy, exists
}

// GetByResource retrieves a policy by its target resource (apiGroup/kind).
func (c *PolicyCache) GetByResource(apiGroup, kind string) (*CompiledPolicy, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	resourceKey := fmt.Sprintf("%s/%s", apiGroup, kind)
	policy, exists := c.byResource[resourceKey]
	return policy, exists
}

// List returns all policies in the cache.
func (c *PolicyCache) List() []*CompiledPolicy {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]*CompiledPolicy, 0, len(c.policies))
	for _, policy := range c.policies {
		result = append(result, policy)
	}
	return result
}

// Len returns the number of policies in the cache.
func (c *PolicyCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.policies)
}

// compile converts an ActivityPolicy to a CompiledPolicy, validating all expressions.
func (c *PolicyCache) compile(policy *v1alpha1.ActivityPolicy) *CompiledPolicy {
	compiled := &CompiledPolicy{
		Name:            policy.Name,
		APIGroup:        policy.Spec.Resource.APIGroup,
		Kind:            policy.Spec.Resource.Kind,
		ResourceVersion: policy.ResourceVersion,
		AuditRules:      make([]CompiledRule, len(policy.Spec.AuditRules)),
		EventRules:      make([]CompiledRule, len(policy.Spec.EventRules)),
	}

	// Compile audit rules
	for i, rule := range policy.Spec.AuditRules {
		compiledRule := CompiledRule{
			Match:   rule.Match,
			Summary: rule.Summary,
			Valid:   true,
		}

		// Validate match expression
		if err := cel.ValidatePolicyExpression(rule.Match, cel.MatchExpression, cel.AuditRule); err != nil {
			compiledRule.Valid = false
			compiledRule.CompileError = fmt.Sprintf("match: %v", err)
			klog.Warningf("Policy %s audit rule %d has invalid match: %v", policy.Name, i, err)
		}

		// Validate summary expression
		if compiledRule.Valid {
			if err := cel.ValidatePolicyExpression(rule.Summary, cel.SummaryExpression, cel.AuditRule); err != nil {
				compiledRule.Valid = false
				compiledRule.CompileError = fmt.Sprintf("summary: %v", err)
				klog.Warningf("Policy %s audit rule %d has invalid summary: %v", policy.Name, i, err)
			}
		}

		compiled.AuditRules[i] = compiledRule
	}

	// Compile event rules
	for i, rule := range policy.Spec.EventRules {
		compiledRule := CompiledRule{
			Match:   rule.Match,
			Summary: rule.Summary,
			Valid:   true,
		}

		// Validate match expression
		if err := cel.ValidatePolicyExpression(rule.Match, cel.MatchExpression, cel.EventRule); err != nil {
			compiledRule.Valid = false
			compiledRule.CompileError = fmt.Sprintf("match: %v", err)
			klog.Warningf("Policy %s event rule %d has invalid match: %v", policy.Name, i, err)
		}

		// Validate summary expression
		if compiledRule.Valid {
			if err := cel.ValidatePolicyExpression(rule.Summary, cel.SummaryExpression, cel.EventRule); err != nil {
				compiledRule.Valid = false
				compiledRule.CompileError = fmt.Sprintf("summary: %v", err)
				klog.Warningf("Policy %s event rule %d has invalid summary: %v", policy.Name, i, err)
			}
		}

		compiled.EventRules[i] = compiledRule
	}

	return compiled
}

// ConvertToActivityPolicy converts an unstructured object to an ActivityPolicy.
func (c *PolicyCache) ConvertToActivityPolicy(obj interface{}) (*v1alpha1.ActivityPolicy, error) {
	unstructuredObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("expected *unstructured.Unstructured, got %T", obj)
	}

	// Convert to JSON and then to ActivityPolicy
	jsonBytes, err := unstructuredObj.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal unstructured to JSON: %w", err)
	}

	policy := &v1alpha1.ActivityPolicy{}
	if err := json.Unmarshal(jsonBytes, policy); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON to ActivityPolicy: %w", err)
	}

	return policy, nil
}

// ConvertFromUnstructured converts an unstructured.Unstructured to an ActivityPolicy
// using the runtime scheme.
func ConvertFromUnstructured(obj *unstructured.Unstructured) (*v1alpha1.ActivityPolicy, error) {
	policy := &v1alpha1.ActivityPolicy{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.UnstructuredContent(), policy)
	if err != nil {
		return nil, fmt.Errorf("failed to convert unstructured to ActivityPolicy: %w", err)
	}
	return policy, nil
}
