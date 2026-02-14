package activityprocessor

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"k8s.io/klog/v2"

	internalcel "go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// summaryTemplateRegex matches {{ expression }} patterns in summary templates.
var summaryTemplateRegex = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

// CompiledRule represents a pre-compiled policy rule ready for execution.
type CompiledRule struct {
	// Match is the original match expression.
	Match string
	// Summary is the original summary template.
	Summary string
	// MatchProgram is the pre-compiled CEL program for match evaluation.
	MatchProgram cel.Program
	// SummaryTemplates contains pre-compiled CEL programs for each template expression.
	SummaryTemplates []compiledTemplate
	// Valid indicates if the rule compiled successfully.
	Valid bool
	// CompileError holds any error from compilation.
	CompileError string
	// linkMu serialises access to linkSink so that concurrent goroutines evaluating
	// the same CompiledRule (shared via *CompiledPolicy in the cache) do not race
	// on the shared link collection buffer.
	linkMu sync.Mutex
	// linkSink is the per-evaluation collector written to by the link() CEL function.
	// It is reset before each summary evaluation and read after.
	// The pointer is shared between this struct and the compiled CEL program binding.
	linkSink *[]internalcel.Link
}

// compiledTemplate represents a single {{ expression }} in a summary template.
type compiledTemplate struct {
	// FullMatch is the original {{ expression }} string
	FullMatch string
	// Expression is the CEL expression without {{ }}
	Expression string
	// Program is the pre-compiled CEL program
	Program cel.Program
}

// CompiledPolicy represents a pre-compiled ActivityPolicy ready for execution.
type CompiledPolicy struct {
	// Name is the policy name.
	Name string
	// APIGroup is the target resource's API group.
	APIGroup string
	// Kind is the target resource's kind.
	Kind string
	// Resource is the plural resource name (for audit event matching).
	Resource string
	// AuditRules are the compiled audit rules.
	AuditRules []*CompiledRule
	// EventRules are the compiled event rules.
	EventRules []*CompiledRule
	// ResourceVersion is the policy's resource version for cache invalidation.
	ResourceVersion string
	// OriginalPolicy is the original policy for metrics and logging.
	OriginalPolicy *v1alpha1.ActivityPolicy
}

// PolicyCache provides thread-safe caching of pre-compiled ActivityPolicy resources.
type PolicyCache struct {
	mu sync.RWMutex

	// policies stores compiled policies indexed by apiGroup/resource (plural)
	// Multiple policies can target the same resource.
	// Used for audit event lookups which use plural resource names.
	policies map[string][]*CompiledPolicy

	// kindPolicies stores compiled policies indexed by apiGroup/kind (singular)
	// Used for Kubernetes event lookups which use Kind names.
	kindPolicies map[string][]*CompiledPolicy
}

// NewPolicyCache creates a new policy cache.
func NewPolicyCache() *PolicyCache {
	return &PolicyCache{
		policies:     make(map[string][]*CompiledPolicy),
		kindPolicies: make(map[string][]*CompiledPolicy),
	}
}

// Add compiles and adds a policy to the cache.
func (c *PolicyCache) Add(policy *v1alpha1.ActivityPolicy, resource string) error {
	compiled, err := c.compile(policy, resource)
	if err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Add to resource-keyed index (for audit event lookups)
	key := policyKey(policy.Spec.Resource.APIGroup, resource)
	c.policies[key] = append(c.policies[key], compiled)

	// Add to kind-keyed index (for Kubernetes event lookups)
	kindKey := policyKey(policy.Spec.Resource.APIGroup, policy.Spec.Resource.Kind)
	c.kindPolicies[kindKey] = append(c.kindPolicies[kindKey], compiled)

	klog.V(2).InfoS("Added compiled policy to cache",
		"policy", policy.Name,
		"resourceKey", key,
		"kindKey", kindKey,
		"auditRules", len(compiled.AuditRules),
		"eventRules", len(compiled.EventRules),
	)

	return nil
}

// Update removes the old policy and adds the new one.
func (c *PolicyCache) Update(oldPolicy, newPolicy *v1alpha1.ActivityPolicy, oldResource, newResource string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Remove old policy from resource-keyed index
	oldKey := policyKey(oldPolicy.Spec.Resource.APIGroup, oldResource)
	c.removeLockedFromMap(c.policies, oldKey, oldPolicy.Name)

	// Remove old policy from kind-keyed index
	oldKindKey := policyKey(oldPolicy.Spec.Resource.APIGroup, oldPolicy.Spec.Resource.Kind)
	c.removeLockedFromMap(c.kindPolicies, oldKindKey, oldPolicy.Name)

	// Compile and add new policy
	compiled, err := c.compile(newPolicy, newResource)
	if err != nil {
		return err
	}

	// Add to resource-keyed index
	newKey := policyKey(newPolicy.Spec.Resource.APIGroup, newResource)
	c.policies[newKey] = append(c.policies[newKey], compiled)

	// Add to kind-keyed index
	newKindKey := policyKey(newPolicy.Spec.Resource.APIGroup, newPolicy.Spec.Resource.Kind)
	c.kindPolicies[newKindKey] = append(c.kindPolicies[newKindKey], compiled)

	klog.V(2).InfoS("Updated compiled policy in cache",
		"policy", newPolicy.Name,
		"oldKey", oldKey,
		"newKey", newKey,
	)

	return nil
}

// Remove removes a policy from the cache.
func (c *PolicyCache) Remove(policy *v1alpha1.ActivityPolicy, resource string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Remove from resource-keyed index
	key := policyKey(policy.Spec.Resource.APIGroup, resource)
	c.removeLockedFromMap(c.policies, key, policy.Name)

	// Remove from kind-keyed index
	kindKey := policyKey(policy.Spec.Resource.APIGroup, policy.Spec.Resource.Kind)
	c.removeLockedFromMap(c.kindPolicies, kindKey, policy.Name)

	klog.V(2).InfoS("Removed policy from cache", "policy", policy.Name, "key", key)
}

// removeLockedFromMap removes a policy by name from a specific map. Caller must hold the lock.
func (c *PolicyCache) removeLockedFromMap(m map[string][]*CompiledPolicy, key, policyName string) {
	policies := m[key]
	for i, p := range policies {
		if p.Name == policyName {
			// O(1) removal: swap with last element and truncate.
			policies[i] = policies[len(policies)-1]
			m[key] = policies[:len(policies)-1]
			break
		}
	}
	if len(m[key]) == 0 {
		delete(m, key)
	}
}

// Get returns compiled policies for a given apiGroup and resource (plural).
// Used for audit event lookups.
func (c *PolicyCache) Get(apiGroup, resource string) []*CompiledPolicy {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := policyKey(apiGroup, resource)
	return c.policies[key]
}

// GetByKind returns compiled policies for a given apiGroup and kind (singular).
// Used for Kubernetes event lookups.
func (c *PolicyCache) GetByKind(apiGroup, kind string) []*CompiledPolicy {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := policyKey(apiGroup, kind)
	return c.kindPolicies[key]
}

// Len returns the total number of policies in the cache.
func (c *PolicyCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	count := 0
	for _, policies := range c.policies {
		count += len(policies)
	}
	return count
}

// compile compiles an ActivityPolicy into a CompiledPolicy.
func (c *PolicyCache) compile(policy *v1alpha1.ActivityPolicy, resource string) (*CompiledPolicy, error) {
	compiled := &CompiledPolicy{
		Name:            policy.Name,
		APIGroup:        policy.Spec.Resource.APIGroup,
		Kind:            policy.Spec.Resource.Kind,
		Resource:        resource,
		ResourceVersion: policy.ResourceVersion,
		AuditRules:      make([]*CompiledRule, len(policy.Spec.AuditRules)),
		EventRules:      make([]*CompiledRule, len(policy.Spec.EventRules)),
		OriginalPolicy:  policy.DeepCopy(),
	}

	// Compile audit rules
	for i, rule := range policy.Spec.AuditRules {
		compiled.AuditRules[i] = c.compileAuditRule(rule, policy.Name, i)
	}

	// Compile event rules
	for i, rule := range policy.Spec.EventRules {
		compiled.EventRules[i] = c.compileEventRule(rule, policy.Name, i)
	}

	return compiled, nil
}

// compileAuditRule compiles a single audit rule.
func (c *PolicyCache) compileAuditRule(rule v1alpha1.ActivityPolicyRule, policyName string, ruleIndex int) *CompiledRule {
	compiled := &CompiledRule{
		Match:    rule.Match,
		Summary:  rule.Summary,
		Valid:    true,
		linkSink: new([]internalcel.Link),
	}

	// Create audit environment for compilation.
	// The linkSink pointer is shared with the compiled program binding so that
	// link() calls during evaluation write into compiled.linkSink automatically.
	env, err := auditEnvironment(compiled.linkSink)
	if err != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("failed to create CEL environment: %v", err)
		klog.Warningf("Policy %s audit rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}

	// Compile match expression
	matchAST, issues := env.Compile(rule.Match)
	if issues != nil && issues.Err() != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("match: %v", issues.Err())
		klog.Warningf("Policy %s audit rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}

	matchProgram, err := env.Program(matchAST)
	if err != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("match program: %v", err)
		klog.Warningf("Policy %s audit rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}
	compiled.MatchProgram = matchProgram

	// Compile summary template expressions
	templates, err := compileSummaryTemplate(env, rule.Summary)
	if err != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("summary: %v", err)
		klog.Warningf("Policy %s audit rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}
	compiled.SummaryTemplates = templates

	return compiled
}

// compileEventRule compiles a single event rule.
func (c *PolicyCache) compileEventRule(rule v1alpha1.ActivityPolicyRule, policyName string, ruleIndex int) *CompiledRule {
	compiled := &CompiledRule{
		Match:    rule.Match,
		Summary:  rule.Summary,
		Valid:    true,
		linkSink: new([]internalcel.Link),
	}

	// Create event environment for compilation.
	// The linkSink pointer is shared with the compiled program binding so that
	// link() calls during evaluation write into compiled.linkSink automatically.
	env, err := eventEnvironment(compiled.linkSink)
	if err != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("failed to create CEL environment: %v", err)
		klog.Warningf("Policy %s event rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}

	// Compile match expression
	matchAST, issues := env.Compile(rule.Match)
	if issues != nil && issues.Err() != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("match: %v", issues.Err())
		klog.Warningf("Policy %s event rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}

	matchProgram, err := env.Program(matchAST)
	if err != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("match program: %v", err)
		klog.Warningf("Policy %s event rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}
	compiled.MatchProgram = matchProgram

	// Compile summary template expressions
	templates, err := compileSummaryTemplate(env, rule.Summary)
	if err != nil {
		compiled.Valid = false
		compiled.CompileError = fmt.Sprintf("summary: %v", err)
		klog.Warningf("Policy %s event rule %d: %s", policyName, ruleIndex, compiled.CompileError)
		return compiled
	}
	compiled.SummaryTemplates = templates

	return compiled
}

// compileSummaryTemplate compiles all {{ expression }} blocks in a summary template.
func compileSummaryTemplate(env *cel.Env, template string) ([]compiledTemplate, error) {
	matches := summaryTemplateRegex.FindAllStringSubmatch(template, -1)
	if len(matches) == 0 {
		return nil, nil
	}

	templates := make([]compiledTemplate, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		expr := strings.TrimSpace(match[1])
		if expr == "" {
			return nil, fmt.Errorf("empty expression in template: %s", match[0])
		}

		ast, issues := env.Compile(expr)
		if issues != nil && issues.Err() != nil {
			return nil, fmt.Errorf("expression '%s': %w", expr, issues.Err())
		}

		prg, err := env.Program(ast)
		if err != nil {
			return nil, fmt.Errorf("expression '%s': %w", expr, err)
		}

		templates = append(templates, compiledTemplate{
			FullMatch:  match[0],
			Expression: expr,
			Program:    prg,
		})
	}

	return templates, nil
}

// auditEnvironment creates a CEL environment for audit rule expressions.
// linkSink, when non-nil, receives Link values captured by link() calls during evaluation.
// The same pointer is shared with the compiled program so links accumulate in place.
func auditEnvironment(linkSink *[]internalcel.Link) (*cel.Env, error) {
	auditType := cel.MapType(cel.StringType, cel.DynType)
	actorRefType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("audit", auditType),
		cel.Variable("actor", cel.StringType),
		cel.Variable("actorRef", actorRefType),
		cel.Function("link",
			cel.Overload("link_string_dyn",
				[]*cel.Type{cel.StringType, cel.DynType},
				cel.StringType,
				cel.BinaryBinding(func(displayText, resourceRef ref.Val) ref.Val {
					text := fmt.Sprintf("%v", displayText.Value())
					if linkSink != nil {
						appendLink(linkSink, text, resourceRef)
					}
					return types.String(text)
				}),
			),
		),
	)
}

// eventEnvironment creates a CEL environment for event rule expressions.
// linkSink, when non-nil, receives Link values captured by link() calls during evaluation.
func eventEnvironment(linkSink *[]internalcel.Link) (*cel.Env, error) {
	eventType := cel.MapType(cel.StringType, cel.DynType)
	actorRefType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("event", eventType),
		cel.Variable("actor", cel.StringType),
		cel.Variable("actorRef", actorRefType),
		cel.Function("link",
			cel.Overload("link_string_dyn",
				[]*cel.Type{cel.StringType, cel.DynType},
				cel.StringType,
				cel.BinaryBinding(func(displayText, resourceRef ref.Val) ref.Val {
					text := fmt.Sprintf("%v", displayText.Value())
					if linkSink != nil {
						appendLink(linkSink, text, resourceRef)
					}
					return types.String(text)
				}),
			),
		),
	)
}

// appendLink converts a CEL ref.Val resource reference to an internalcel.Link and appends it.
func appendLink(sink *[]internalcel.Link, text string, resourceRef ref.Val) {
	link := internalcel.Link{Marker: text}

	switch v := resourceRef.Value().(type) {
	case map[string]interface{}:
		link.Resource = v
	case map[ref.Val]ref.Val:
		// CEL map type — convert keys to strings.
		goMap := make(map[string]interface{}, len(v))
		for k, val := range v {
			if keyStr, ok := k.Value().(string); ok {
				goMap[keyStr] = val.Value()
			}
		}
		link.Resource = goMap
	default:
		// Unrecognized resource type; store an empty map so the marker is still captured.
		link.Resource = make(map[string]interface{})
	}

	*sink = append(*sink, link)
}

// EvaluateAuditRules evaluates audit rules against an audit event using pre-compiled programs.
// Returns the index of the matching rule, the generated summary, and whether a match was found.
func (r *CompiledRule) EvaluateAuditMatch(auditMap map[string]any) (bool, error) {
	if !r.Valid || r.MatchProgram == nil {
		return false, nil
	}

	vars := map[string]any{
		"audit":    auditMap,
		"actor":    extractString(auditMap, "user", "username"),
		"actorRef": buildActorRef(auditMap),
	}

	out, _, err := r.MatchProgram.Eval(vars)
	if err != nil {
		return false, fmt.Errorf("failed to evaluate match: %w", err)
	}

	result, ok := out.Value().(bool)
	if !ok {
		return false, fmt.Errorf("match expression did not return boolean")
	}

	return result, nil
}

// EvaluateSummary evaluates the summary template using pre-compiled programs.
// It returns the rendered summary string and any links captured by link() calls.
//
// EvaluateSummary is safe to call from multiple goroutines: the mutex serialises
// access to the shared linkSink so concurrent evaluations of the same rule do not
// interleave their collected links.
func (r *CompiledRule) EvaluateSummary(vars map[string]any) (string, []internalcel.Link, error) {
	if len(r.SummaryTemplates) == 0 {
		return r.Summary, nil, nil
	}

	r.linkMu.Lock()
	defer r.linkMu.Unlock()

	// Reset the link sink before each evaluation so we don't accumulate stale links
	// from previous calls.
	if r.linkSink != nil {
		*r.linkSink = (*r.linkSink)[:0]
	}

	result := r.Summary
	for _, tmpl := range r.SummaryTemplates {
		out, _, err := tmpl.Program.Eval(vars)
		if err != nil {
			return "", nil, fmt.Errorf("failed to evaluate summary expression '%s': %w", tmpl.Expression, err)
		}
		result = strings.Replace(result, tmpl.FullMatch, fmt.Sprintf("%v", out.Value()), 1)
	}

	// Copy collected links out of the sink before releasing the lock.
	var links []internalcel.Link
	if r.linkSink != nil && len(*r.linkSink) > 0 {
		links = make([]internalcel.Link, len(*r.linkSink))
		copy(links, *r.linkSink)
	}

	return result, links, nil
}

// EvaluateEventMatch evaluates the match expression against a Kubernetes event.
func (r *CompiledRule) EvaluateEventMatch(eventMap map[string]any) (bool, error) {
	if !r.Valid || r.MatchProgram == nil {
		return false, nil
	}

	vars := map[string]any{
		"event":    eventMap,
		"actor":    extractEventActor(eventMap),
		"actorRef": buildEventActorRef(eventMap),
	}

	out, _, err := r.MatchProgram.Eval(vars)
	if err != nil {
		return false, fmt.Errorf("failed to evaluate match: %w", err)
	}

	result, ok := out.Value().(bool)
	if !ok {
		return false, fmt.Errorf("match expression did not return boolean")
	}

	return result, nil
}

// Helper functions for building CEL variables

func extractString(m map[string]any, keys ...string) string {
	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			if v, ok := current[key].(string); ok {
				return v
			}
			return ""
		}
		if nested, ok := current[key].(map[string]any); ok {
			current = nested
		} else {
			return ""
		}
	}
	return ""
}

func buildActorRef(auditMap map[string]any) map[string]any {
	username := extractString(auditMap, "user", "username")
	if username == "" {
		return map[string]any{"type": "unknown", "name": ""}
	}

	actorType := "user"
	if strings.HasPrefix(username, "system:serviceaccount:") {
		actorType = "serviceaccount"
	} else if strings.HasPrefix(username, "system:") {
		actorType = "system"
	}

	return map[string]any{"type": actorType, "name": username}
}

func extractEventActor(eventMap map[string]any) string {
	if controller := extractString(eventMap, "reportingController"); controller != "" {
		return controller
	}
	return extractString(eventMap, "source", "component")
}

func buildEventActorRef(eventMap map[string]any) map[string]any {
	controller := extractEventActor(eventMap)
	return map[string]any{"type": "controller", "name": controller}
}

// BuildAuditVars builds the variables map for audit rule evaluation.
func BuildAuditVars(auditMap map[string]any) map[string]any {
	return map[string]any{
		"audit":    auditMap,
		"actor":    extractString(auditMap, "user", "username"),
		"actorRef": buildActorRef(auditMap),
	}
}

// BuildEventVars builds the variables map for event rule evaluation.
func BuildEventVars(eventMap map[string]any) map[string]any {
	return map[string]any{
		"event":    eventMap,
		"actor":    extractEventActor(eventMap),
		"actorRef": buildEventActorRef(eventMap),
	}
}
