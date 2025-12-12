package cel

import (
	"context"
	"strings"
	"testing"
	"time"
)

// TestCELFilterWorkflow tests the complete workflow of compiling a CEL filter
// and converting it to ClickHouse SQL. This is the primary use case for the package.
func TestCELFilterWorkflow(t *testing.T) {
	tests := []struct {
		name         string
		filter       string
		wantSQL      string
		wantArgCount int
		wantErr      bool
	}{
		{
			name:         "simple equality filter",
			filter:       "verb == 'delete'",
			wantSQL:      "verb = {arg1}",
			wantArgCount: 1,
			wantErr:      false,
		},
		{
			name:         "complex AND condition",
			filter:       "verb == 'delete' && objectRef.namespace == 'production'",
			wantSQL:      "(verb = {arg1} AND namespace = {arg2})",
			wantArgCount: 2,
			wantErr:      false,
		},
		{
			name:         "OR condition",
			filter:       "verb == 'create' || verb == 'update'",
			wantSQL:      "(verb = {arg1} OR verb = {arg2})",
			wantArgCount: 2,
			wantErr:      false,
		},
		{
			name:         "IN operator with multiple values",
			filter:       "objectRef.namespace in ['prod', 'staging', 'dev']",
			wantSQL:      "namespace IN [{arg1}, {arg2}, {arg3}]",
			wantArgCount: 3,
			wantErr:      false,
		},
		{
			name:         "comparison operators",
			filter:       "responseStatus.code >= 400",
			wantSQL:      "status_code >= {arg1}",
			wantArgCount: 1,
			wantErr:      false,
		},
		{
			name:         "nested fields",
			filter:       "objectRef.resource == 'pods' && objectRef.name == 'my-pod'",
			wantSQL:      "(resource = {arg1} AND resource_name = {arg2})",
			wantArgCount: 2,
			wantErr:      false,
		},
		{
			name:         "string method - startsWith",
			filter:       "user.username.startsWith('system:')",
			wantSQL:      "startsWith(user, {arg1})",
			wantArgCount: 1,
			wantErr:      false,
		},
		{
			name:         "string method - contains",
			filter:       "objectRef.namespace.contains('prod')",
			wantSQL:      "position(namespace, {arg1}) > 0",
			wantArgCount: 1,
			wantErr:      false,
		},
		{
			name:    "empty filter",
			filter:  "",
			wantErr: false, // Empty returns empty SQL, not error
		},
		{
			name:    "invalid syntax - triple equals",
			filter:  "verb === 'delete'",
			wantErr: true,
		},
		{
			name:    "invalid - undeclared field",
			filter:  "invalidField == 'value'",
			wantErr: true,
		},
		{
			name:    "invalid - non-boolean expression",
			filter:  "verb",
			wantErr: true,
		},
		{
			name:    "invalid - unavailable field for SQL",
			filter:  "objectRef.apiGroup == 'apps'",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args, err := ConvertToClickHouseSQL(context.Background(), tt.filter)

			if (err != nil) != tt.wantErr {
				t.Errorf("ConvertToClickHouseSQL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr {
				return
			}

			if sql != tt.wantSQL {
				t.Errorf("ConvertToClickHouseSQL() sql = %q, want %q", sql, tt.wantSQL)
			}

			if len(args) != tt.wantArgCount {
				t.Errorf("ConvertToClickHouseSQL() arg count = %d, want %d", len(args), tt.wantArgCount)
			}
		})
	}
}

// TestCELFilterCompilation tests the CompileFilter function in isolation,
// focusing on validation and type checking.
func TestCELFilterCompilation(t *testing.T) {
	tests := []struct {
		name    string
		filter  string
		wantErr bool
	}{
		{
			name:    "valid simple filter",
			filter:  "verb == 'delete'",
			wantErr: false,
		},
		{
			name:    "valid complex filter",
			filter:  "verb == 'delete' && objectRef.resource in ['secrets', 'configmaps'] && objectRef.namespace == 'production'",
			wantErr: false,
		},
		{
			name:    "valid timestamp comparison",
			filter:  "stageTimestamp >= timestamp('2024-01-01T00:00:00Z')",
			wantErr: false,
		},
		{
			name:    "valid string methods",
			filter:  "user.username.startsWith('system:') && objectRef.namespace.contains('prod')",
			wantErr: false,
		},
		{
			name:    "empty filter",
			filter:  "",
			wantErr: true,
		},
		{
			name:    "syntax error",
			filter:  "verb = 'delete'",
			wantErr: true,
		},
		{
			name:    "undeclared field",
			filter:  "unknownField == 'value'",
			wantErr: true,
		},
		{
			name:    "non-boolean return type",
			filter:  "verb",
			wantErr: true,
		},
		{
			name:    "type mismatch - calling string method on map",
			filter:  "user.startsWith('system:')",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ast, err := CompileFilter(tt.filter)

			if (err != nil) != tt.wantErr {
				t.Errorf("CompileFilter() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && ast == nil {
				t.Error("CompileFilter() returned nil AST for valid filter")
			}
		})
	}
}

// TestSQLConversionEdgeCases tests edge cases and complex scenarios in SQL conversion
// that might not be covered by the basic workflow tests.
func TestSQLConversionEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		filter   string
		validate func(t *testing.T, sql string, args []interface{})
	}{
		{
			name:   "timestamp parameter is correctly formatted",
			filter: "stageTimestamp >= timestamp('2024-01-01T00:00:00Z')",
			validate: func(t *testing.T, sql string, args []interface{}) {
				if len(args) != 1 {
					t.Errorf("Expected 1 arg, got %d", len(args))
					return
				}
				if _, ok := args[0].(time.Time); !ok {
					t.Errorf("Expected time.Time arg, got %T", args[0])
				}
			},
		},
		{
			name:   "multiple different field types",
			filter: "verb == 'delete' && responseStatus.code >= 400 && objectRef.namespace in ['prod', 'staging']",
			validate: func(t *testing.T, sql string, args []interface{}) {
				if len(args) != 4 {
					t.Errorf("Expected 4 args (string, int, string, string), got %d", len(args))
				}
			},
		},
		{
			name:   "nested boolean logic",
			filter: "(verb == 'delete' || verb == 'update') && objectRef.namespace == 'production'",
			validate: func(t *testing.T, sql string, args []interface{}) {
				if !strings.Contains(sql, "OR") || !strings.Contains(sql, "AND") {
					t.Errorf("Expected SQL to contain both OR and AND operators")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args, err := ConvertToClickHouseSQL(context.Background(), tt.filter)
			if err != nil {
				t.Fatalf("ConvertToClickHouseSQL() unexpected error: %v", err)
			}

			tt.validate(t, sql, args)
		})
	}
}

// TestEnvironment tests that the CEL environment is properly configured
// with the expected variables and types.
func TestEnvironment(t *testing.T) {
	env, err := Environment()
	if err != nil {
		t.Fatalf("Environment() error = %v", err)
	}

	if env == nil {
		t.Fatal("Environment() returned nil")
	}

	// Test that environment can compile valid expressions with all expected fields
	validExpressions := []string{
		"auditID == 'test'",
		"verb == 'delete'",
		"stage == 'ResponseComplete'",
		"stageTimestamp > timestamp('2024-01-01T00:00:00Z')",
		"objectRef.namespace == 'default'",
		"objectRef.resource == 'pods'",
		"objectRef.name == 'my-pod'",
		"user.username == 'admin'",
		"responseStatus.code == 200",
	}

	for _, expr := range validExpressions {
		t.Run(expr, func(t *testing.T) {
			_, issues := env.Compile(expr)
			if issues != nil && issues.Err() != nil {
				t.Errorf("Environment() cannot compile valid expression %q: %v", expr, issues.Err())
			}
		})
	}
}

// TestCompileFilterErrorMessages tests that CompileFilter returns helpful,
// user-friendly error messages with context for various error types.
func TestCompileFilterErrorMessages(t *testing.T) {
	tests := []struct {
		name            string
		filter          string
		wantContains    []string
		wantNotContains []string
	}{
		{
			name:   "syntax error includes helpful context",
			filter: `verb === "delete"`,
			wantContains: []string{
				"Invalid filter",
				"Available fields:",
				"auditID",
				"verb",
				"objectRef.namespace",
				"user.username",
				"cel.dev",
			},
		},
		{
			name:   "undeclared field error includes available fields",
			filter: "nonexistent == 'value'",
			wantContains: []string{
				"Invalid filter",
				"Available fields:",
				"cel.dev",
			},
		},
		{
			name:   "type error includes helpful context",
			filter: "verb",
			wantContains: []string{
				"filter expression must return a boolean",
				"Available fields:",
			},
		},
		{
			name:   "no implementation details leaked",
			filter: "user", // returns map instead of boolean
			wantNotContains: []string{
				"ClickHouse",
				"SQL",
				"database",
				"table",
			},
			wantContains: []string{
				"filter expression must return a boolean",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := CompileFilter(tt.filter)
			if err == nil {
				t.Fatal("CompileFilter() should return error for invalid filter")
			}

			errMsg := err.Error()

			for _, want := range tt.wantContains {
				if !strings.Contains(errMsg, want) {
					t.Errorf("Error message missing expected content %q\nGot: %s", want, errMsg)
				}
			}

			for _, notWant := range tt.wantNotContains {
				if strings.Contains(errMsg, notWant) {
					t.Errorf("Error message leaked implementation detail %q\nGot: %s", notWant, errMsg)
				}
			}
		})
	}
}
