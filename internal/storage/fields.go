package storage

import (
	"fmt"
	"sort"
	"strings"
)

// AuditLogFacetFields defines the supported fields for audit log facet queries.
// Keys are API field paths (as used in queries), values are human-readable descriptions.
var AuditLogFacetFields = map[string]string{
	"verb":                "The API verb (get, list, create, update, delete, etc.)",
	"user.username":       "The username of the actor",
	"user.uid":            "The UID of the actor",
	"responseStatus.code": "The HTTP response status code",
	"objectRef.namespace": "The namespace of the target object",
	"objectRef.resource":  "The resource type",
	"objectRef.apiGroup":  "The API group of the target resource",
}

// IsValidAuditLogFacetField checks if a field is supported for audit log faceting.
func IsValidAuditLogFacetField(field string) bool {
	_, ok := AuditLogFacetFields[field]
	return ok
}

// AuditLogFacetFieldNames returns a sorted list of supported audit log facet field names.
func AuditLogFacetFieldNames() []string {
	return sortedKeys(AuditLogFacetFields)
}

// FormatSupportedFields returns a comma-separated string of supported field names for error messages.
func FormatSupportedFields(fields map[string]string) string {
	names := sortedKeys(fields)
	return strings.Join(names, ", ")
}

// sortedKeys returns the keys of a map in sorted order.
func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// auditLogFacetColumnMapping maps API field paths to ClickHouse column names for audit logs.
// This is internal to the storage layer - only the field names are exposed publicly.
var auditLogFacetColumnMapping = map[string]string{
	"verb":                "verb",
	"user.username":       "user",
	"user.uid":            "user_uid",
	"responseStatus.code": "status_code",
	"objectRef.namespace": "namespace",
	"objectRef.resource":  "resource",
	"objectRef.apiGroup":  "api_group",
}

// GetAuditLogFacetColumn returns the ClickHouse column name for an audit log facet field.
// Returns an error if the field is not supported.
func GetAuditLogFacetColumn(field string) (string, error) {
	col, ok := auditLogFacetColumnMapping[field]
	if !ok {
		return "", fmt.Errorf("unsupported audit log facet field: %s", field)
	}
	return col, nil
}

func init() {
	// Validate that all defined fields have corresponding column mappings.
	// This catches mismatches at startup rather than at runtime.
	for field := range AuditLogFacetFields {
		if _, ok := auditLogFacetColumnMapping[field]; !ok {
			panic(fmt.Sprintf("missing ClickHouse column mapping for audit log facet field %q", field))
		}
	}

	// Also validate the reverse: all mappings should have field definitions
	for field := range auditLogFacetColumnMapping {
		if _, ok := AuditLogFacetFields[field]; !ok {
			panic(fmt.Sprintf("audit log facet column mapping %q has no field definition", field))
		}
	}
}
