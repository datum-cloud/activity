package cel

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/cel-go/cel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"

	"go.miloapis.com/activity/internal/metrics"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// ActivityEnvironment creates a CEL environment for activity filtering.
//
// Available fields:
//   - spec.changeSource - "human" or "system"
//   - spec.actor.name - actor display name
//   - spec.actor.type - actor type
//   - spec.actor.uid - actor UID
//   - spec.resource.apiGroup - resource API group
//   - spec.resource.kind - resource kind
//   - spec.resource.name - resource name
//   - spec.resource.namespace - resource namespace
//   - spec.resource.uid - resource UID
//   - spec.summary - activity summary text
//   - spec.origin.type - origin type (audit/event)
//   - metadata.namespace - activity namespace
//
// Supports standard CEL operators (==, !=, &&, ||, !, in) and string methods
// (startsWith, endsWith, contains).
func ActivityEnvironment() (*cel.Env, error) {
	specType := cel.MapType(cel.StringType, cel.DynType)
	metadataType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("spec", specType),
		cel.Variable("metadata", metadataType),
	)
}

// activityValidFields defines the allowed fields for activity filtering
var activityValidFields = map[string]map[string]bool{
	"spec": {
		"changeSource": true,
		"summary":      true,
		// Parent fields - these are intermediate paths to nested fields
		"actor":    true,
		"resource": true,
		"origin":   true,
	},
	"spec.actor": {
		"name": true,
		"type": true,
		"uid":  true,
	},
	"spec.resource": {
		"apiGroup":  true,
		"kind":      true,
		"name":      true,
		"namespace": true,
		"uid":       true,
	},
	"spec.origin": {
		"type": true,
	},
	"metadata": {
		"namespace": true,
		"name":      true,
	},
}

// CompileActivityFilter compiles and validates a CEL filter expression for activities.
// Returns user-friendly error messages with helpful context.
func CompileActivityFilter(filterExpr string) (*cel.Ast, error) {
	startTime := time.Now()

	if filterExpr == "" {
		metrics.CELFilterErrors.WithLabelValues("empty").Inc()
		return nil, fmt.Errorf("filter expression cannot be empty")
	}

	env, err := ActivityEnvironment()
	if err != nil {
		metrics.CELFilterErrors.WithLabelValues("environment").Inc()
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}

	ast, issues := env.Compile(filterExpr)
	if issues != nil && issues.Err() != nil {
		metrics.CELFilterErrors.WithLabelValues("compilation").Inc()
		metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
		return nil, fmt.Errorf("%s", formatActivityFilterError(issues.Err()))
	}

	if !ast.OutputType().IsExactType(cel.BoolType) {
		metrics.CELFilterErrors.WithLabelValues("type_mismatch").Inc()
		metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
		typeErr := fmt.Errorf("filter expression must return a boolean, got %v", ast.OutputType())
		return nil, fmt.Errorf("%s", formatActivityFilterError(typeErr))
	}

	// Validate that only allowed fields are accessed
	if err := validateActivityFieldAccess(ast.Expr()); err != nil {
		metrics.CELFilterErrors.WithLabelValues("invalid_field").Inc()
		metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
		return nil, fmt.Errorf("%s", formatActivityFilterError(err))
	}

	metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
	return ast, nil
}

// CompiledActivityFilter holds a pre-compiled CEL program for reuse in watch operations.
type CompiledActivityFilter struct {
	program cel.Program
}

// CompileActivityFilterProgram compiles a CEL filter for watch evaluation.
// Unlike CompileActivityFilter which returns an AST for SQL conversion, this
// returns a compiled program that can evaluate Activity objects directly.
func CompileActivityFilterProgram(filterExpr string) (*CompiledActivityFilter, error) {
	if filterExpr == "" {
		return nil, fmt.Errorf("filter expression cannot be empty")
	}

	env, err := ActivityEnvironment()
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}

	ast, issues := env.Compile(filterExpr)
	if issues != nil && issues.Err() != nil {
		return nil, fmt.Errorf("%s", formatActivityFilterError(issues.Err()))
	}

	if !ast.OutputType().IsExactType(cel.BoolType) {
		typeErr := fmt.Errorf("filter expression must return a boolean, got %v", ast.OutputType())
		return nil, fmt.Errorf("%s", formatActivityFilterError(typeErr))
	}

	// Validate that only allowed fields are accessed
	if err := validateActivityFieldAccess(ast.Expr()); err != nil {
		return nil, fmt.Errorf("%s", formatActivityFilterError(err))
	}

	// Create program from compiled AST
	program, err := env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL program: %w", err)
	}

	return &CompiledActivityFilter{program: program}, nil
}

// EvaluateActivity evaluates the filter against an Activity object.
// Returns true if the activity matches the filter, false otherwise.
func (f *CompiledActivityFilter) EvaluateActivity(activity *v1alpha1.Activity) (bool, error) {
	if f == nil || f.program == nil {
		return true, nil // No filter means match all
	}

	// Convert Activity to map format for CEL evaluation
	input := ActivityToMap(activity)

	// Evaluate the program
	result, _, err := f.program.Eval(input)
	if err != nil {
		return false, fmt.Errorf("CEL evaluation error: %w", err)
	}

	// Extract boolean result
	boolVal, ok := result.Value().(bool)
	if !ok {
		return false, fmt.Errorf("CEL result is not a boolean: %T", result.Value())
	}

	return boolVal, nil
}

// ActivityToMap converts an Activity struct to a map format for CEL evaluation.
// The map structure matches the CEL variables defined in ActivityEnvironment.
func ActivityToMap(activity *v1alpha1.Activity) map[string]interface{} {
	return map[string]interface{}{
		"spec": map[string]interface{}{
			"changeSource": activity.Spec.ChangeSource,
			"summary":      activity.Spec.Summary,
			"actor": map[string]interface{}{
				"name": activity.Spec.Actor.Name,
				"type": activity.Spec.Actor.Type,
				"uid":  activity.Spec.Actor.UID,
			},
			"resource": map[string]interface{}{
				"apiGroup":  activity.Spec.Resource.APIGroup,
				"kind":      activity.Spec.Resource.Kind,
				"name":      activity.Spec.Resource.Name,
				"namespace": activity.Spec.Resource.Namespace,
				"uid":       activity.Spec.Resource.UID,
			},
			"origin": map[string]interface{}{
				"type": activity.Spec.Origin.Type,
			},
		},
		"metadata": map[string]interface{}{
			"namespace": activity.Namespace,
			"name":      activity.Name,
		},
	}
}

// validateActivityFieldAccess validates that only allowed fields are accessed in activity filters
func validateActivityFieldAccess(e *expr.Expr) error {
	if e == nil {
		return nil
	}

	switch exprKind := e.ExprKind.(type) {
	case *expr.Expr_SelectExpr:
		sel := exprKind.SelectExpr
		if operand := sel.GetOperand(); operand != nil {
			// Handle nested field access like spec.actor.name
			// Check if operand is another select (nested access)
			if nestedSel := operand.GetSelectExpr(); nestedSel != nil {
				if baseIdent := nestedSel.GetOperand().GetIdentExpr(); baseIdent != nil {
					// e.g., spec.actor.name -> base=spec, parent=actor, field=name
					baseName := baseIdent.GetName()
					parentField := nestedSel.GetField()
					field := sel.GetField()
					fullPath := baseName + "." + parentField

					if allowedFields, ok := activityValidFields[fullPath]; ok {
						if !allowedFields[field] {
							return fmt.Errorf("field '%s.%s' is not available for filtering", fullPath, field)
						}
					}
				}
			} else if identExpr := operand.GetIdentExpr(); identExpr != nil {
				// Direct field access like spec.changeSource
				baseObject := identExpr.GetName()
				field := sel.GetField()

				if allowedFields, ok := activityValidFields[baseObject]; ok {
					if !allowedFields[field] {
						return fmt.Errorf("field '%s.%s' is not available for filtering", baseObject, field)
					}
				}
			}
			if err := validateActivityFieldAccess(operand); err != nil {
				return err
			}
		}

	case *expr.Expr_CallExpr:
		call := exprKind.CallExpr
		if call.Target != nil {
			if err := validateActivityFieldAccess(call.Target); err != nil {
				return err
			}
		}
		for _, arg := range call.Args {
			if err := validateActivityFieldAccess(arg); err != nil {
				return err
			}
		}

	case *expr.Expr_ListExpr:
		list := exprKind.ListExpr
		for _, elem := range list.Elements {
			if err := validateActivityFieldAccess(elem); err != nil {
				return err
			}
		}

	case *expr.Expr_StructExpr:
		structExpr := exprKind.StructExpr
		for _, entry := range structExpr.Entries {
			if err := validateActivityFieldAccess(entry.GetValue()); err != nil {
				return err
			}
		}

	case *expr.Expr_ComprehensionExpr:
		comp := exprKind.ComprehensionExpr
		if err := validateActivityFieldAccess(comp.IterRange); err != nil {
			return err
		}
		if err := validateActivityFieldAccess(comp.AccuInit); err != nil {
			return err
		}
		if err := validateActivityFieldAccess(comp.LoopCondition); err != nil {
			return err
		}
		if err := validateActivityFieldAccess(comp.LoopStep); err != nil {
			return err
		}
		if err := validateActivityFieldAccess(comp.Result); err != nil {
			return err
		}
	}

	return nil
}

// formatActivityFilterError formats error messages for activity filter expressions
func formatActivityFilterError(err error) string {
	errMsg := err.Error()

	// Provide helpful suggestions for common errors
	if strings.Contains(errMsg, "undeclared reference") {
		return fmt.Sprintf(`%s

Available fields for activity filtering:
  - spec.changeSource - "human" or "system"
  - spec.actor.name, spec.actor.type, spec.actor.uid
  - spec.resource.apiGroup, spec.resource.kind, spec.resource.name
  - spec.resource.namespace, spec.resource.uid
  - spec.summary, spec.origin.type
  - metadata.namespace, metadata.name

Example: spec.changeSource == "human" && spec.resource.kind == "Deployment"`, errMsg)
	}

	return errMsg
}

// ConvertActivityToClickHouseSQL converts a CEL expression for activities to a ClickHouse WHERE clause.
func ConvertActivityToClickHouseSQL(ctx context.Context, filterExpr string) (string, []interface{}, error) {
	ctx, span := tracer.Start(ctx, "cel.activity_filter.convert",
		trace.WithAttributes(attribute.String("cel.expression", filterExpr)),
	)
	defer span.End()

	if filterExpr == "" {
		span.SetStatus(codes.Ok, "empty filter")
		return "", nil, nil
	}

	ast, err := CompileActivityFilter(filterExpr)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "compilation failed")
		return "", nil, err
	}

	span.SetAttributes(attribute.Bool("cel.valid", true))

	converter := &activitySqlConverter{
		args:      make([]interface{}, 0),
		argIndex:  1,
		paramName: make(map[int]string),
	}

	sql, err := converter.convertExpr(ast.Expr())
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "conversion failed")
		return "", nil, err
	}

	span.SetAttributes(
		attribute.String("sql.where_clause", sql),
		attribute.Int("sql.param_count", len(converter.args)),
	)
	span.SetStatus(codes.Ok, "conversion successful")

	return sql, converter.args, nil
}

type activitySqlConverter struct {
	args      []interface{}
	argIndex  int
	paramName map[int]string
}

func (c *activitySqlConverter) addArg(value interface{}) string {
	c.args = append(c.args, value)
	paramName := fmt.Sprintf("arg%d", c.argIndex)
	c.paramName[c.argIndex] = paramName
	c.argIndex++
	return fmt.Sprintf("{%s}", paramName)
}

func (c *activitySqlConverter) convertExpr(e *expr.Expr) (string, error) {
	switch e.ExprKind.(type) {
	case *expr.Expr_CallExpr:
		return c.convertCallExpr(e.GetCallExpr(), e)
	case *expr.Expr_IdentExpr:
		return c.convertIdentExpr(e.GetIdentExpr())
	case *expr.Expr_ConstExpr:
		return c.convertConstExpr(e.GetConstExpr())
	case *expr.Expr_SelectExpr:
		return c.convertSelectExpr(e.GetSelectExpr())
	case *expr.Expr_ListExpr:
		return c.convertListExpr(e.GetListExpr())
	default:
		return "", fmt.Errorf("unsupported expression type: %T", e.ExprKind)
	}
}

func (c *activitySqlConverter) convertCallExpr(call *expr.Expr_Call, e *expr.Expr) (string, error) {
	switch call.Function {
	case "!_":
		// Handle logical NOT: !expr -> NOT (expr)
		arg, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("NOT (%s)", arg), nil

	case "_==_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s = %s", left, right), nil

	case "_!=_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s != %s", left, right), nil

	case "_&&_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("(%s AND %s)", left, right), nil

	case "_||_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("(%s OR %s)", left, right), nil

	case "@in":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s IN %s", left, right), nil

	case "startsWith":
		if call.Target != nil {
			target, err := c.convertExpr(call.Target)
			if err != nil {
				return "", err
			}
			prefix, err := c.convertExpr(call.Args[0])
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("startsWith(%s, %s)", target, prefix), nil
		}

	case "endsWith":
		if call.Target != nil {
			target, err := c.convertExpr(call.Target)
			if err != nil {
				return "", err
			}
			suffix, err := c.convertExpr(call.Args[0])
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("endsWith(%s, %s)", target, suffix), nil
		}

	case "contains":
		if call.Target != nil {
			target, err := c.convertExpr(call.Target)
			if err != nil {
				return "", err
			}
			substring, err := c.convertExpr(call.Args[0])
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("position(%s, %s) > 0", target, substring), nil
		}
	}

	return "", fmt.Errorf("unsupported CEL function: %s", call.Function)
}

func (c *activitySqlConverter) convertIdentExpr(ident *expr.Expr_Ident) (string, error) {
	switch ident.Name {
	case "spec", "metadata":
		return "", fmt.Errorf("field '%s' must be accessed with dot notation (e.g., spec.changeSource, metadata.namespace)", ident.Name)
	default:
		return "", fmt.Errorf("field '%s' is not available for filtering", ident.Name)
	}
}

func (c *activitySqlConverter) convertConstExpr(constant *expr.Constant) (string, error) {
	switch constant.ConstantKind.(type) {
	case *expr.Constant_StringValue:
		return c.addArg(constant.GetStringValue()), nil
	case *expr.Constant_Int64Value:
		return c.addArg(constant.GetInt64Value()), nil
	case *expr.Constant_Uint64Value:
		return c.addArg(constant.GetUint64Value()), nil
	case *expr.Constant_DoubleValue:
		return c.addArg(constant.GetDoubleValue()), nil
	case *expr.Constant_BoolValue:
		if constant.GetBoolValue() {
			return "1", nil
		}
		return "0", nil
	default:
		return "", fmt.Errorf("unsupported constant type: %T", constant.ConstantKind)
	}
}

func (c *activitySqlConverter) convertSelectExpr(sel *expr.Expr_Select) (string, error) {
	operand := sel.GetOperand()
	if operand == nil {
		return "", fmt.Errorf("select expression missing operand")
	}

	field := sel.GetField()

	// Check for nested select (e.g., spec.actor.name)
	if nestedSel := operand.GetSelectExpr(); nestedSel != nil {
		if baseIdent := nestedSel.GetOperand().GetIdentExpr(); baseIdent != nil {
			baseName := baseIdent.GetName()
			parentField := nestedSel.GetField()

			// Map nested activity fields to ClickHouse columns
			return c.mapActivityField(baseName, parentField, field)
		}
	}

	// Direct field access (e.g., spec.changeSource)
	if identExpr := operand.GetIdentExpr(); identExpr != nil {
		baseName := identExpr.GetName()
		return c.mapActivityField(baseName, field, "")
	}

	return "", fmt.Errorf("unsupported select expression structure")
}

// mapActivityField maps activity CEL field paths to ClickHouse column names
func (c *activitySqlConverter) mapActivityField(baseName, field1, field2 string) (string, error) {
	// Handle nested paths like spec.actor.name
	if field2 != "" {
		switch {
		// spec.actor.*
		case baseName == "spec" && field1 == "actor" && field2 == "name":
			return "actor_name", nil
		case baseName == "spec" && field1 == "actor" && field2 == "type":
			return "actor_type", nil
		case baseName == "spec" && field1 == "actor" && field2 == "uid":
			return "actor_uid", nil

		// spec.resource.*
		case baseName == "spec" && field1 == "resource" && field2 == "apiGroup":
			return "api_group", nil
		case baseName == "spec" && field1 == "resource" && field2 == "kind":
			return "resource_kind", nil
		case baseName == "spec" && field1 == "resource" && field2 == "name":
			return "resource_name", nil
		case baseName == "spec" && field1 == "resource" && field2 == "namespace":
			return "resource_namespace", nil
		case baseName == "spec" && field1 == "resource" && field2 == "uid":
			return "resource_uid", nil

		// spec.origin.*
		case baseName == "spec" && field1 == "origin" && field2 == "type":
			return "origin_type", nil

		default:
			return "", fmt.Errorf("field '%s.%s.%s' is not available for filtering", baseName, field1, field2)
		}
	}

	// Handle direct paths like spec.changeSource
	switch {
	case baseName == "spec" && field1 == "changeSource":
		return "change_source", nil
	case baseName == "spec" && field1 == "summary":
		return "summary", nil
	case baseName == "metadata" && field1 == "namespace":
		return "activity_namespace", nil
	case baseName == "metadata" && field1 == "name":
		return "activity_name", nil

	default:
		return "", fmt.Errorf("field '%s.%s' is not available for filtering", baseName, field1)
	}
}

func (c *activitySqlConverter) convertListExpr(list *expr.Expr_CreateList) (string, error) {
	elements := make([]string, len(list.Elements))
	for i, elem := range list.Elements {
		val, err := c.convertExpr(elem)
		if err != nil {
			return "", err
		}
		elements[i] = val
	}
	return fmt.Sprintf("[%s]", strings.Join(elements, ", ")), nil
}
