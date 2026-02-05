package cel

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/cel-go/cel"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"

	"go.miloapis.com/activity/internal/metrics"
)

var tracer = otel.Tracer("activity-cel-filter")

// Environment creates a CEL environment for audit event filtering.
//
// Available fields: auditID, verb, requestReceivedTimestamp,
// objectRef.{namespace,resource,name,apiGroup}, user.{username,uid}, responseStatus.code
//
// Note: stageTimestamp is intentionally NOT available for filtering as it should
// only be used for internal pipeline delay calculations, not for querying events.
//
// Supports standard CEL operators (==, !=, <, >, <=, >=, &&, ||, !, in) and string methods
// (startsWith, endsWith, contains).
func Environment() (*cel.Env, error) {
	objectRefType := cel.MapType(cel.StringType, cel.DynType)
	userType := cel.MapType(cel.StringType, cel.DynType)
	responseStatusType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("auditID", cel.StringType),
		cel.Variable("verb", cel.StringType),
		cel.Variable("requestReceivedTimestamp", cel.TimestampType),

		cel.Variable("objectRef", objectRefType),
		cel.Variable("user", userType),
		cel.Variable("responseStatus", responseStatusType),
	)
}

// validFields defines the allowed fields for each structured type
var validFields = map[string]map[string]bool{
	"objectRef": {
		"apiGroup":  true,
		"namespace": true,
		"resource":  true,
		"name":      true,
	},
	"user": {
		"username": true,
		"uid":      true,
	},
	"responseStatus": {
		"code": true,
	},
}

// CompileFilter compiles and validates a CEL filter expression, ensuring it returns a boolean.
// Returns user-friendly error messages with helpful context (available fields, documentation links).
func CompileFilter(filterExpr string) (*cel.Ast, error) {
	startTime := time.Now()

	if filterExpr == "" {
		metrics.CELFilterErrors.WithLabelValues("empty").Inc()
		return nil, fmt.Errorf("filter expression cannot be empty")
	}

	env, err := Environment()
	if err != nil {
		metrics.CELFilterErrors.WithLabelValues("environment").Inc()
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}

	ast, issues := env.Compile(filterExpr)
	if issues != nil && issues.Err() != nil {
		metrics.CELFilterErrors.WithLabelValues("compilation").Inc()
		metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
		// Return friendly formatted error instead of raw CEL error
		return nil, fmt.Errorf("%s", formatFilterError(issues.Err()))
	}

	if !ast.OutputType().IsExactType(cel.BoolType) {
		metrics.CELFilterErrors.WithLabelValues("type_mismatch").Inc()
		metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
		// Format type mismatch error with helpful context
		typeErr := fmt.Errorf("filter expression must return a boolean, got %v", ast.OutputType())
		return nil, fmt.Errorf("%s", formatFilterError(typeErr))
	}

	// Validate that only allowed fields are accessed on structured types
	if err := validateFieldAccess(ast.Expr()); err != nil {
		metrics.CELFilterErrors.WithLabelValues("invalid_field").Inc()
		metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
		return nil, fmt.Errorf("%s", formatFilterError(err))
	}

	metrics.CELFilterParseDuration.Observe(time.Since(startTime).Seconds())
	return ast, nil
}

// validateFieldAccess recursively validates that only allowed fields are accessed
func validateFieldAccess(e *expr.Expr) error {
	if e == nil {
		return nil
	}

	switch exprKind := e.ExprKind.(type) {
	case *expr.Expr_SelectExpr:
		sel := exprKind.SelectExpr
		// Get the base object (e.g., "user", "objectRef", "responseStatus")
		if operand := sel.GetOperand(); operand != nil {
			if identExpr := operand.GetIdentExpr(); identExpr != nil {
				baseObject := identExpr.GetName()
				field := sel.GetField()

				// Check if this is a structured type we validate
				if allowedFields, ok := validFields[baseObject]; ok {
					// Check if the field is allowed
					if !allowedFields[field] {
						// Build a helpful error message with available fields
						availableFields := make([]string, 0, len(allowedFields))
						for f := range allowedFields {
							availableFields = append(availableFields, baseObject+"."+f)
						}
						return fmt.Errorf("field '%s.%s' is not available for filtering. Available fields for %s: %v",
							baseObject, field, baseObject, availableFields)
					}
				}
			}
			// Recursively validate the operand
			if err := validateFieldAccess(operand); err != nil {
				return err
			}
		}

	case *expr.Expr_CallExpr:
		call := exprKind.CallExpr
		// Validate the target if present
		if call.Target != nil {
			if err := validateFieldAccess(call.Target); err != nil {
				return err
			}
		}
		// Validate all arguments
		for _, arg := range call.Args {
			if err := validateFieldAccess(arg); err != nil {
				return err
			}
		}

	case *expr.Expr_ListExpr:
		list := exprKind.ListExpr
		for _, elem := range list.Elements {
			if err := validateFieldAccess(elem); err != nil {
				return err
			}
		}

	case *expr.Expr_StructExpr:
		structExpr := exprKind.StructExpr
		for _, entry := range structExpr.Entries {
			if err := validateFieldAccess(entry.GetValue()); err != nil {
				return err
			}
		}

	case *expr.Expr_ComprehensionExpr:
		comp := exprKind.ComprehensionExpr
		if err := validateFieldAccess(comp.IterRange); err != nil {
			return err
		}
		if err := validateFieldAccess(comp.AccuInit); err != nil {
			return err
		}
		if err := validateFieldAccess(comp.LoopCondition); err != nil {
			return err
		}
		if err := validateFieldAccess(comp.LoopStep); err != nil {
			return err
		}
		if err := validateFieldAccess(comp.Result); err != nil {
			return err
		}
	}

	return nil
}

// ConvertToClickHouseSQL converts a CEL expression to a ClickHouse WHERE clause with tracing.
func ConvertToClickHouseSQL(ctx context.Context, filterExpr string) (string, []interface{}, error) {
	ctx, span := tracer.Start(ctx, "cel.filter.convert",
		trace.WithAttributes(attribute.String("cel.expression", filterExpr)),
	)
	defer span.End()

	if filterExpr == "" {
		span.SetStatus(codes.Ok, "empty filter")
		return "", nil, nil
	}

	ast, err := CompileFilter(filterExpr)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "compilation failed")
		return "", nil, err
	}

	span.SetAttributes(attribute.Bool("cel.valid", true))

	converter := &sqlConverter{
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

type sqlConverter struct {
	args      []interface{}
	argIndex  int
	paramName map[int]string
}

func (c *sqlConverter) addArg(value interface{}) string {
	c.args = append(c.args, value)
	paramName := fmt.Sprintf("arg%d", c.argIndex)
	c.paramName[c.argIndex] = paramName
	c.argIndex++
	return fmt.Sprintf("{%s}", paramName)
}

func (c *sqlConverter) convertExpr(e *expr.Expr) (string, error) {
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

func (c *sqlConverter) convertCallExpr(call *expr.Expr_Call, e *expr.Expr) (string, error) {
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

	case "_>=_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s >= %s", left, right), nil

	case "_<=_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s <= %s", left, right), nil

	case "_>_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s > %s", left, right), nil

	case "_<_":
		left, err := c.convertExpr(call.Args[0])
		if err != nil {
			return "", err
		}
		right, err := c.convertExpr(call.Args[1])
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s < %s", left, right), nil

	case "@in":
		// Handle "x in [...]" - converts to "x IN (...)"
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
		// string.startsWith(prefix) -> startsWith(string, prefix)
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
		// string.endsWith(suffix) -> endsWith(string, suffix)
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
		// string.contains(substring) -> position(substring, string) > 0
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

	case "timestamp":
		// timestamp('2024-01-01T00:00:00Z') -> parse as DateTime
		if len(call.Args) == 1 {
			// Extract the string constant
			if constExpr := call.Args[0].GetConstExpr(); constExpr != nil {
				if strVal := constExpr.GetStringValue(); strVal != "" {
					t, err := time.Parse(time.RFC3339, strVal)
					if err != nil {
						return "", fmt.Errorf("invalid timestamp format: %w", err)
					}
					return c.addArg(t), nil
				}
			}
		}
	}

	return "", fmt.Errorf("unsupported CEL function: %s", call.Function)
}

func (c *sqlConverter) convertIdentExpr(ident *expr.Expr_Ident) (string, error) {
	switch ident.Name {
	case "auditID":
		return "audit_id", nil
	case "verb":
		return "verb", nil
	case "requestReceivedTimestamp":
		return "timestamp", nil

	case "objectRef", "user", "responseStatus":
		return "", fmt.Errorf("field '%s' must be accessed with dot notation (e.g., objectRef.namespace, user.username, responseStatus.code)", ident.Name)

	default:
		return "", fmt.Errorf("field '%s' is not available for filtering", ident.Name)
	}
}

func (c *sqlConverter) convertConstExpr(constant *expr.Constant) (string, error) {
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

func (c *sqlConverter) convertSelectExpr(sel *expr.Expr_Select) (string, error) {
	// Handle nested field access like user.username, objectRef.namespace
	// CEL represents these as SelectExpr with an operand (the object) and a field name

	// Get the base object (e.g., "user", "objectRef", "responseStatus")
	operand := sel.GetOperand()
	if operand == nil {
		return "", fmt.Errorf("select expression missing operand")
	}

	identExpr := operand.GetIdentExpr()
	if identExpr == nil {
		return "", fmt.Errorf("select expression operand must be an identifier")
	}

	baseObject := identExpr.GetName()
	field := sel.GetField()

	switch {
	case baseObject == "objectRef" && field == "namespace":
		return "namespace", nil
	case baseObject == "objectRef" && field == "resource":
		return "resource", nil
	case baseObject == "objectRef" && field == "name":
		return "resource_name", nil
	case baseObject == "objectRef" && field == "apiGroup":
		return "api_group", nil

	case baseObject == "user" && field == "username":
		return "user", nil
	case baseObject == "user" && field == "uid":
		return "user_uid", nil

	case baseObject == "responseStatus" && field == "code":
		return "status_code", nil

	default:
		// Defensive check - validation should catch invalid fields at compile time
		return "", fmt.Errorf("field '%s.%s' is not available for filtering", baseObject, field)
	}
}

func (c *sqlConverter) convertListExpr(list *expr.Expr_CreateList) (string, error) {
	// Convert list to array format for IN clause
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
