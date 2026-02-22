package common

import (
	"fmt"
	"strings"
)

// EscapeCELString escapes single quotes in a string to make it safe for use
// in a CEL string literal. Single quotes are escaped by replacing ' with \'
// to prevent CEL filter injection attacks.
//
// Example:
//   EscapeCELString("my-namespace") -> "my-namespace"
//   EscapeCELString("prod' || true || '") -> "prod\\' || true || \\'"
func EscapeCELString(s string) string {
	// Escape single quotes to prevent breaking out of CEL string literals
	return strings.ReplaceAll(s, "'", "\\'")
}

// EscapeFieldSelectorValue escapes special characters in a field selector value
// to prevent field selector injection. Field selectors use = and , as delimiters,
// so these must be escaped or rejected.
//
// Example:
//   EscapeFieldSelectorValue("Normal") -> "Normal"
//   EscapeFieldSelectorValue("type=Warning") -> error
func EscapeFieldSelectorValue(s string) (string, error) {
	// Field selector values should not contain = or , as these are syntax characters
	if strings.ContainsAny(s, "=,") {
		return "", fmt.Errorf("field selector value cannot contain '=' or ',' characters: %q", s)
	}
	return s, nil
}

// ValidateEventType validates that an event type is one of the allowed values.
// Kubernetes only supports "Normal" and "Warning" event types.
func ValidateEventType(t string) error {
	if t == "" {
		return nil // Empty is OK, means no filter
	}
	if t != "Normal" && t != "Warning" {
		return fmt.Errorf("event type must be 'Normal' or 'Warning', got: %q", t)
	}
	return nil
}
