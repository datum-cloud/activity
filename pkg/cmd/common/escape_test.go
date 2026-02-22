package common

import (
	"fmt"
	"strings"
	"testing"
)

func TestEscapeCELString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "normal string unchanged",
			input:    "my-namespace",
			expected: "my-namespace",
		},
		{
			name:     "empty string unchanged",
			input:    "",
			expected: "",
		},
		{
			name:     "single quote escaped",
			input:    "it's",
			expected: "it\\'s",
		},
		{
			name:     "injection attempt - OR operator",
			input:    "prod' || true || '",
			expected: "prod\\' || true || \\'",
		},
		{
			name:     "injection attempt - AND operator",
			input:    "prod' && 'x' == 'x",
			expected: "prod\\' && \\'x\\' == \\'x",
		},
		{
			name:     "injection attempt - closing quote",
			input:    "namespace'",
			expected: "namespace\\'",
		},
		{
			name:     "injection attempt - starting quote",
			input:    "'namespace",
			expected: "\\'namespace",
		},
		{
			name:     "multiple single quotes",
			input:    "'''",
			expected: "\\'\\'\\'",
		},
		{
			name:     "SQL-like injection attempt",
			input:    "'; DROP TABLE audit_logs; --",
			expected: "\\'; DROP TABLE audit_logs; --",
		},
		{
			name:     "special characters without quotes are OK",
			input:    "namespace-123_test.example",
			expected: "namespace-123_test.example",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := EscapeCELString(tt.input)
			if result != tt.expected {
				t.Errorf("EscapeCELString(%q) = %q, want %q", tt.input, result, tt.expected)
			}

			// Verify that the escaped string, when used in a CEL filter, doesn't break the syntax
			// by ensuring it still has balanced quotes after escaping
			if strings.Contains(tt.input, "'") {
				// Count unescaped quotes in result (escaped quotes don't count)
				unescapedQuotes := 0
				for i := 0; i < len(result); i++ {
					if result[i] == '\'' {
						// Check if it's escaped
						if i == 0 || result[i-1] != '\\' {
							unescapedQuotes++
						}
					}
				}
				// After escaping, there should be no unescaped quotes
				if unescapedQuotes > 0 {
					t.Errorf("EscapeCELString(%q) still contains %d unescaped quotes: %q",
						tt.input, unescapedQuotes, result)
				}
			}
		})
	}
}

func TestEscapeFieldSelectorValue(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    string
		expectError bool
	}{
		{
			name:        "normal value unchanged",
			input:       "Normal",
			expected:    "Normal",
			expectError: false,
		},
		{
			name:        "empty string unchanged",
			input:       "",
			expected:    "",
			expectError: false,
		},
		{
			name:        "hyphenated value OK",
			input:       "my-pod",
			expected:    "my-pod",
			expectError: false,
		},
		{
			name:        "dotted value OK",
			input:       "example.com",
			expected:    "example.com",
			expectError: false,
		},
		{
			name:        "injection attempt with equals",
			input:       "type=Warning",
			expected:    "",
			expectError: true,
		},
		{
			name:        "injection attempt with comma",
			input:       "Normal,type=Warning",
			expected:    "",
			expectError: true,
		},
		{
			name:        "injection attempt with both",
			input:       "type=Warning,reason=Failed",
			expected:    "",
			expectError: true,
		},
		{
			name:        "equals only",
			input:       "=",
			expected:    "",
			expectError: true,
		},
		{
			name:        "comma only",
			input:       ",",
			expected:    "",
			expectError: true,
		},
		{
			name:        "number value OK",
			input:       "123",
			expected:    "123",
			expectError: false,
		},
		{
			name:        "special chars OK (no delimiters)",
			input:       "pod-name_123",
			expected:    "pod-name_123",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := EscapeFieldSelectorValue(tt.input)
			if tt.expectError {
				if err == nil {
					t.Errorf("EscapeFieldSelectorValue(%q) expected error, got nil", tt.input)
				}
				if result != "" {
					t.Errorf("EscapeFieldSelectorValue(%q) expected empty result on error, got %q", tt.input, result)
				}
			} else {
				if err != nil {
					t.Errorf("EscapeFieldSelectorValue(%q) unexpected error: %v", tt.input, err)
				}
				if result != tt.expected {
					t.Errorf("EscapeFieldSelectorValue(%q) = %q, want %q", tt.input, result, tt.expected)
				}
			}
		})
	}
}

func TestValidateEventType(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{
			name:        "Normal is valid",
			input:       "Normal",
			expectError: false,
		},
		{
			name:        "Warning is valid",
			input:       "Warning",
			expectError: false,
		},
		{
			name:        "empty string is valid (no filter)",
			input:       "",
			expectError: false,
		},
		{
			name:        "lowercase normal is invalid",
			input:       "normal",
			expectError: true,
		},
		{
			name:        "lowercase warning is invalid",
			input:       "warning",
			expectError: true,
		},
		{
			name:        "invalid type",
			input:       "Error",
			expectError: true,
		},
		{
			name:        "injection attempt",
			input:       "Normal' || true || '",
			expectError: true,
		},
		{
			name:        "multiple values",
			input:       "Normal,Warning",
			expectError: true,
		},
		{
			name:        "whitespace",
			input:       " Normal ",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEventType(tt.input)
			if tt.expectError {
				if err == nil {
					t.Errorf("ValidateEventType(%q) expected error, got nil", tt.input)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateEventType(%q) unexpected error: %v", tt.input, err)
				}
			}
		})
	}
}

// TestEscapeCELStringInContext verifies that escaped strings work correctly
// when used in actual CEL filter construction
func TestEscapeCELStringInContext(t *testing.T) {
	tests := []struct {
		name          string
		userInput     string
		expectedFilter string
	}{
		{
			name:          "normal namespace",
			userInput:     "production",
			expectedFilter: "objectRef.namespace == 'production'",
		},
		{
			name:          "namespace with quote",
			userInput:     "prod'uction",
			expectedFilter: "objectRef.namespace == 'prod\\'uction'",
		},
		{
			name:          "injection attempt neutralized",
			userInput:     "prod' || true || '",
			expectedFilter: "objectRef.namespace == 'prod\\' || true || \\''",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate how it's used in audit.go
			escaped := EscapeCELString(tt.userInput)
			filter := fmt.Sprintf("objectRef.namespace == '%s'", escaped)

			if filter != tt.expectedFilter {
				t.Errorf("Filter construction failed:\nGot:  %s\nWant: %s", filter, tt.expectedFilter)
			}

			// Verify the filter has balanced quotes
			// After escaping and wrapping in quotes, count unescaped quotes
			quoteCount := 0
			inEscape := false
			for _, ch := range filter {
				if inEscape {
					inEscape = false
					continue
				}
				if ch == '\\' {
					inEscape = true
					continue
				}
				if ch == '\'' {
					quoteCount++
				}
			}

			// Should have exactly 2 quotes (opening and closing the string literal)
			if quoteCount != 2 {
				t.Errorf("Filter has unbalanced quotes: %s (found %d unescaped quotes)", filter, quoteCount)
			}
		})
	}
}
