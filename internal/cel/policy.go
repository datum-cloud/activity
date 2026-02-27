package cel

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
)

// PolicyExpressionType indicates whether an expression is a match or summary expression.
type PolicyExpressionType string

const (
	// MatchExpression is a CEL expression that returns a boolean.
	MatchExpression PolicyExpressionType = "match"
	// SummaryExpression is a CEL template expression with {{ }} delimiters.
	SummaryExpression PolicyExpressionType = "summary"
)

// PolicyRuleType indicates whether a rule is for audit or event processing.
type PolicyRuleType string

const (
	// AuditRule is a rule that processes audit log entries.
	AuditRule PolicyRuleType = "audit"
	// EventRule is a rule that processes Kubernetes events.
	EventRule PolicyRuleType = "event"
)

// summaryTemplateRegex matches {{ expression }} patterns in summary templates.
var summaryTemplateRegex = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

// auditEnvironment creates a CEL environment for audit rule expressions.
// Available variables: audit (full audit event), actor, actorRef
// If collector is non-nil, link() calls will capture link information.
func auditEnvironment(collector *linkCollector) (*cel.Env, error) {
	// The audit variable is a map containing the full Kubernetes audit event
	auditType := cel.MapType(cel.StringType, cel.DynType)
	// The actorRef variable is a map with {type, name} for linking
	actorRefType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("audit", auditType),
		cel.Variable("actor", cel.StringType),
		cel.Variable("actorRef", actorRefType),

		// link function declaration with implementation: link(displayText string, resourceRef map) -> string
		// Returns the display text and optionally captures link info in the collector.
		cel.Function("link",
			cel.Overload("link_string_dyn",
				[]*cel.Type{cel.StringType, cel.DynType},
				cel.StringType,
				cel.BinaryBinding(func(displayText, resourceRef ref.Val) ref.Val {
					text := fmt.Sprintf("%v", displayText.Value())
					if collector != nil {
						collector.addLink(text, resourceRef.Value())
					}
					return types.String(text)
				}),
			),
		),
	)
}

// eventEnvironment creates a CEL environment for event rule expressions.
// Available variables: event (full Kubernetes event), actor, actorRef
// If collector is non-nil, link() calls will capture link information.
func eventEnvironment(collector *linkCollector) (*cel.Env, error) {
	// The event variable is a map containing the full Kubernetes Event
	eventType := cel.MapType(cel.StringType, cel.DynType)
	// The actorRef variable is a map with {type, name} for linking
	actorRefType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("event", eventType),
		cel.Variable("actor", cel.StringType),
		cel.Variable("actorRef", actorRefType),

		// link function declaration with implementation: link(displayText string, resourceRef map) -> string
		// Returns the display text and optionally captures link info in the collector.
		cel.Function("link",
			cel.Overload("link_string_dyn",
				[]*cel.Type{cel.StringType, cel.DynType},
				cel.StringType,
				cel.BinaryBinding(func(displayText, resourceRef ref.Val) ref.Val {
					text := fmt.Sprintf("%v", displayText.Value())
					if collector != nil {
						collector.addLink(text, resourceRef.Value())
					}
					return types.String(text)
				}),
			),
		),
	)
}

// ValidatePolicyExpression validates a CEL expression used in an ActivityPolicy rule.
// It checks for syntax errors and type correctness based on the expression and rule types.
func ValidatePolicyExpression(expression string, exprType PolicyExpressionType, ruleType PolicyRuleType) error {
	if expression == "" {
		return fmt.Errorf("expression cannot be empty")
	}

	// Get the appropriate environment based on rule type
	// Pass nil collector since we're just validating, not collecting links
	var env *cel.Env
	var err error

	switch ruleType {
	case AuditRule:
		env, err = auditEnvironment(nil)
	case EventRule:
		env, err = eventEnvironment(nil)
	default:
		return fmt.Errorf("unknown rule type: %s", ruleType)
	}

	if err != nil {
		return fmt.Errorf("failed to create CEL environment: %w", err)
	}

	switch exprType {
	case MatchExpression:
		return validateMatchExpression(env, expression)
	case SummaryExpression:
		return validateSummaryExpression(env, expression)
	default:
		return fmt.Errorf("unknown expression type: %s", exprType)
	}
}

// validateMatchExpression validates a match expression that should return a boolean.
func validateMatchExpression(env *cel.Env, expression string) error {
	ast, issues := env.Compile(expression)
	if issues != nil && issues.Err() != nil {
		return formatPolicyError(issues.Err(), "match")
	}

	// Match expressions must return boolean
	if !ast.OutputType().IsExactType(cel.BoolType) {
		return fmt.Errorf("match expression must return a boolean, got %v", ast.OutputType())
	}

	return nil
}

// validateSummaryExpression validates a summary template expression with {{ }} delimiters.
func validateSummaryExpression(env *cel.Env, expression string) error {
	// Extract all {{ expression }} blocks from the template
	matches := summaryTemplateRegex.FindAllStringSubmatch(expression, -1)

	if len(matches) == 0 {
		// No template expressions found - this is valid but probably unintended
		// We allow it as the user might want a static summary
		return nil
	}

	// Validate each embedded CEL expression
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		embeddedExpr := strings.TrimSpace(match[1])
		if embeddedExpr == "" {
			return fmt.Errorf("empty expression in template: %s", match[0])
		}

		// Compile the embedded expression
		ast, issues := env.Compile(embeddedExpr)
		if issues != nil && issues.Err() != nil {
			return formatPolicyError(issues.Err(), "summary")
		}

		// Summary template expressions should return a string
		// The link() function returns a string, so check for string type
		if !ast.OutputType().IsExactType(cel.StringType) && !ast.OutputType().IsExactType(cel.DynType) {
			return fmt.Errorf("expression '{{ %s }}' in summary must return a string, got %v", embeddedExpr, ast.OutputType())
		}
	}

	return nil
}

// formatPolicyError formats a CEL error into a user-friendly message.
func formatPolicyError(err error, context string) error {
	errStr := err.Error()

	// Check for common error patterns and provide helpful messages
	if strings.Contains(errStr, "undeclared reference") {
		return fmt.Errorf("invalid %s expression: %s. "+
			"For audit rules, use 'audit' variable (e.g., audit.verb, audit.objectRef.name). "+
			"For event rules, use 'event' variable (e.g., event.reason, event.regarding.name). "+
			"Also available: actor, actorRef", context, errStr)
	}

	if strings.Contains(errStr, "found no matching overload") {
		return fmt.Errorf("invalid %s expression: function call error - %s. "+
			"Available function: link(displayText, resourceRef)", context, errStr)
	}

	return fmt.Errorf("invalid %s expression: %s", context, errStr)
}

// Link represents a link extracted from a summary template.
type Link struct {
	Marker   string
	Resource map[string]interface{}
}

// linkCollector collects links during CEL evaluation.
type linkCollector struct {
	links []Link
}

func (c *linkCollector) addLink(displayText string, resource interface{}) {
	if resourceMap, ok := resource.(map[string]interface{}); ok {
		c.links = append(c.links, Link{
			Marker:   displayText,
			Resource: resourceMap,
		})
	} else if resourceRef, ok := resource.(map[ref.Val]ref.Val); ok {
		// Convert CEL map to Go map
		goMap := make(map[string]interface{})
		for k, v := range resourceRef {
			if keyStr, ok := k.Value().(string); ok {
				goMap[keyStr] = v.Value()
			}
		}
		c.links = append(c.links, Link{
			Marker:   displayText,
			Resource: goMap,
		})
	}
}

// EvaluateAuditMatch evaluates a match expression against an audit log entry.
func EvaluateAuditMatch(expression string, audit interface{}) (bool, error) {
	auditMap, err := toMap(audit)
	if err != nil {
		return false, fmt.Errorf("failed to convert audit to map: %w", err)
	}
	return EvaluateAuditMatchMap(expression, auditMap)
}

// EvaluateAuditMatchMap evaluates a match expression against an audit log entry map.
func EvaluateAuditMatchMap(expression string, auditMap map[string]interface{}) (bool, error) {
	env, err := auditEnvironment(nil) // No link collection for match expressions
	if err != nil {
		return false, fmt.Errorf("failed to create audit environment: %w", err)
	}

	ast, issues := env.Compile(expression)
	if issues != nil && issues.Err() != nil {
		return false, fmt.Errorf("failed to compile match expression: %w", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		return false, fmt.Errorf("failed to create program: %w", err)
	}

	out, _, err := prg.Eval(map[string]interface{}{
		"audit":    auditMap,
		"actor":    extractString(auditMap, "user", "username"),
		"actorRef": buildActorRef(auditMap),
	})
	if err != nil {
		return false, fmt.Errorf("failed to evaluate match expression: %w", err)
	}

	result, ok := out.Value().(bool)
	if !ok {
		return false, fmt.Errorf("match expression did not return a boolean")
	}

	return result, nil
}

// EvaluateAuditSummary evaluates a summary template against an audit log entry.
func EvaluateAuditSummary(template string, audit interface{}) (string, []Link, error) {
	auditMap, err := toMap(audit)
	if err != nil {
		return "", nil, fmt.Errorf("failed to convert audit to map: %w", err)
	}
	return EvaluateAuditSummaryMap(template, auditMap)
}

// EvaluateAuditSummaryMap evaluates a summary template against an audit log entry map.
func EvaluateAuditSummaryMap(template string, auditMap map[string]interface{}) (string, []Link, error) {
	collector := &linkCollector{}
	env, err := auditEnvironment(collector)
	if err != nil {
		return "", nil, fmt.Errorf("failed to create audit environment: %w", err)
	}

	vars := map[string]interface{}{
		"audit":    auditMap,
		"actor":    extractString(auditMap, "user", "username"),
		"actorRef": buildActorRef(auditMap),
	}

	result, err := evaluateSummaryTemplate(env, template, vars)
	if err != nil {
		return "", nil, err
	}
	return result, collector.links, nil
}

// EvaluateEventMatch evaluates a match expression against a Kubernetes event.
func EvaluateEventMatch(expression string, event map[string]interface{}) (bool, error) {
	env, err := eventEnvironment(nil) // No link collection for match expressions
	if err != nil {
		return false, fmt.Errorf("failed to create event environment: %w", err)
	}

	ast, issues := env.Compile(expression)
	if issues != nil && issues.Err() != nil {
		return false, fmt.Errorf("failed to compile match expression: %w", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		return false, fmt.Errorf("failed to create program: %w", err)
	}

	out, _, err := prg.Eval(map[string]interface{}{
		"event":    event,
		"actor":    extractString(event, "reportingController"),
		"actorRef": buildEventActorRef(event),
	})
	if err != nil {
		return false, fmt.Errorf("failed to evaluate match expression: %w", err)
	}

	result, ok := out.Value().(bool)
	if !ok {
		return false, fmt.Errorf("match expression did not return a boolean")
	}

	return result, nil
}

// EvaluateEventSummary evaluates a summary template against a Kubernetes event.
func EvaluateEventSummary(template string, event map[string]interface{}) (string, []Link, error) {
	collector := &linkCollector{}
	env, err := eventEnvironment(collector)
	if err != nil {
		return "", nil, fmt.Errorf("failed to create event environment: %w", err)
	}

	vars := map[string]interface{}{
		"event":    event,
		"actor":    extractString(event, "reportingController"),
		"actorRef": buildEventActorRef(event),
	}

	result, err := evaluateSummaryTemplate(env, template, vars)
	if err != nil {
		return "", nil, err
	}
	return result, collector.links, nil
}

// evaluateSummaryTemplate evaluates a summary template with the given variables.
// Links are captured by the linkCollector in the CEL environment during evaluation.
// Returns an error if any template expression fails to compile or evaluate.
func evaluateSummaryTemplate(env *cel.Env, template string, vars map[string]interface{}) (string, error) {
	var evalErr error

	result := summaryTemplateRegex.ReplaceAllStringFunc(template, func(match string) string {
		// If we've already encountered an error, stop processing
		if evalErr != nil {
			return ""
		}

		// Extract the expression from {{ expression }}
		submatches := summaryTemplateRegex.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}

		expr := strings.TrimSpace(submatches[1])

		// Compile and evaluate the expression
		// The link() function in the environment will capture links automatically
		ast, issues := env.Compile(expr)
		if issues != nil && issues.Err() != nil {
			evalErr = fmt.Errorf("failed to compile template expression '{{ %s }}': %w", expr, issues.Err())
			return ""
		}

		prg, err := env.Program(ast)
		if err != nil {
			evalErr = fmt.Errorf("failed to create program for template expression '{{ %s }}': %w", expr, err)
			return ""
		}

		out, _, err := prg.Eval(vars)
		if err != nil {
			evalErr = fmt.Errorf("failed to evaluate template expression '{{ %s }}': %w", expr, err)
			return ""
		}

		return fmt.Sprintf("%v", out.Value())
	})

	// Check if an error occurred during template evaluation
	if evalErr != nil {
		return "", evalErr
	}

	return result, nil
}

// toMap converts an interface to a map[string]interface{}.
func toMap(v interface{}) (map[string]interface{}, error) {
	if m, ok := v.(map[string]interface{}); ok {
		return m, nil
	}

	// For structured types, we'd need to use reflection or JSON marshaling
	// For now, return an error for unsupported types
	return nil, fmt.Errorf("unsupported type for map conversion: %T", v)
}

// extractString extracts a nested string value from a map.
func extractString(m map[string]interface{}, keys ...string) string {
	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			// Last key - expect string
			if v, ok := current[key].(string); ok {
				return v
			}
			return ""
		}
		// Not last key - expect nested map
		if nested, ok := current[key].(map[string]interface{}); ok {
			current = nested
		} else {
			return ""
		}
	}
	return ""
}

// buildActorRef builds an actor reference map from audit user info.
// Returns a map with {type, name} structure matching the Activity actor format.
func buildActorRef(auditMap map[string]interface{}) map[string]interface{} {
	username := extractString(auditMap, "user", "username")
	if username == "" {
		return map[string]interface{}{
			"type": "unknown",
			"name": "",
		}
	}

	// Determine actor type based on username pattern
	actorType := "user"
	if strings.HasPrefix(username, "system:serviceaccount:") {
		actorType = "serviceaccount"
	} else if strings.HasPrefix(username, "system:") {
		actorType = "system"
	}

	return map[string]interface{}{
		"type": actorType,
		"name": username,
	}
}

// buildEventActorRef builds an actor reference map from a Kubernetes event.
func buildEventActorRef(event map[string]interface{}) map[string]interface{} {
	controller := extractString(event, "reportingController")
	if controller == "" {
		controller = extractString(event, "source", "component")
	}

	return map[string]interface{}{
		"type": "controller",
		"name": controller,
	}
}
