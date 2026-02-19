package storage

import (
	"fmt"
	"strings"
)

// EventsFieldSelectors defines the supported field selectors for Kubernetes Events.
// Keys are Kubernetes field selector paths, values are ClickHouse column names.
// These map standard kubectl field selector syntax to our ClickHouse schema.
var EventsFieldSelectors = map[string]string{
	// Metadata fields
	"metadata.namespace": "namespace",
	"metadata.name":      "name",
	"metadata.uid":       "uid",

	// Involved object fields (most commonly used with field selectors)
	"involvedObject.apiVersion": "involved_api_version",
	"involvedObject.kind":       "involved_kind",
	"involvedObject.namespace":  "involved_namespace",
	"involvedObject.name":       "involved_name",
	"involvedObject.uid":        "involved_uid",
	"involvedObject.fieldPath":  "involved_field_path",

	// Event classification
	"reason": "reason",
	"type":   "type",

	// Source fields
	"source.component": "source_component",
	"source.host":      "source_host",

	// Reporting fields (for newer Event API)
	"reportingComponent": "source_component",
	"reportingInstance":  "source_host",
}

// EventsFieldSelectorAliases maps common short forms to full paths.
// These allow users to use simpler syntax like "reason=Pulled" instead of full paths.
var EventsFieldSelectorAliases = map[string]string{
	"namespace": "metadata.namespace",
	"name":      "metadata.name",
	"uid":       "metadata.uid",
}

// ResolveEventFieldSelector resolves a field selector key to a ClickHouse column name.
// It handles both full paths (involvedObject.name) and aliases (namespace).
// Returns an error if the field selector is not supported.
func ResolveEventFieldSelector(field string) (string, error) {
	// Check for alias first
	if fullPath, ok := EventsFieldSelectorAliases[field]; ok {
		field = fullPath
	}

	// Look up the ClickHouse column
	column, ok := EventsFieldSelectors[field]
	if !ok {
		return "", fmt.Errorf("unsupported field selector: %s", field)
	}

	return column, nil
}

// ParseFieldSelector parses a Kubernetes field selector string and returns
// a list of (column, operator, value) tuples for building WHERE clauses.
// Supports both = (equality) and != (inequality) operators.
// Example: "involvedObject.name=my-pod,type!=Warning"
func ParseFieldSelector(selector string) ([]FieldSelectorTerm, error) {
	if selector == "" {
		return nil, nil
	}

	var terms []FieldSelectorTerm
	parts := strings.Split(selector, ",")

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		var field, value string
		var op FieldSelectorOp

		// Check for != first (before =)
		if idx := strings.Index(part, "!="); idx != -1 {
			field = strings.TrimSpace(part[:idx])
			value = strings.TrimSpace(part[idx+2:])
			op = FieldSelectorNotEqual
		} else if idx := strings.Index(part, "=="); idx != -1 {
			// Support == as alias for =
			field = strings.TrimSpace(part[:idx])
			value = strings.TrimSpace(part[idx+2:])
			op = FieldSelectorEqual
		} else if idx := strings.Index(part, "="); idx != -1 {
			field = strings.TrimSpace(part[:idx])
			value = strings.TrimSpace(part[idx+1:])
			op = FieldSelectorEqual
		} else {
			return nil, fmt.Errorf("invalid field selector syntax: %s (expected field=value or field!=value)", part)
		}

		column, err := ResolveEventFieldSelector(field)
		if err != nil {
			supported := make([]string, 0, len(EventsFieldSelectors))
			for k := range EventsFieldSelectors {
				supported = append(supported, k)
			}
			return nil, fmt.Errorf("%s. Supported fields: %s", err.Error(), strings.Join(supported, ", "))
		}

		terms = append(terms, FieldSelectorTerm{
			Column:   column,
			Operator: op,
			Value:    value,
		})
	}

	return terms, nil
}

// FieldSelectorOp represents a field selector operator.
type FieldSelectorOp string

const (
	// FieldSelectorEqual represents the = operator.
	FieldSelectorEqual FieldSelectorOp = "="
	// FieldSelectorNotEqual represents the != operator.
	FieldSelectorNotEqual FieldSelectorOp = "!="
)

// FieldSelectorTerm represents a single field selector condition.
type FieldSelectorTerm struct {
	Column   string          // ClickHouse column name
	Operator FieldSelectorOp // = or !=
	Value    string          // The value to compare against
}

// ToSQL converts a field selector term to a SQL condition and argument.
// Returns the SQL fragment (e.g., "namespace = ?") and the argument value.
func (t FieldSelectorTerm) ToSQL() (string, interface{}) {
	switch t.Operator {
	case FieldSelectorNotEqual:
		return fmt.Sprintf("%s != ?", t.Column), t.Value
	default:
		return fmt.Sprintf("%s = ?", t.Column), t.Value
	}
}

// FieldSelectorTermsToSQL converts multiple field selector terms to SQL.
// Returns a slice of SQL conditions and corresponding arguments.
func FieldSelectorTermsToSQL(terms []FieldSelectorTerm) ([]string, []interface{}) {
	conditions := make([]string, 0, len(terms))
	args := make([]interface{}, 0, len(terms))

	for _, term := range terms {
		sql, arg := term.ToSQL()
		conditions = append(conditions, sql)
		args = append(args, arg)
	}

	return conditions, args
}
