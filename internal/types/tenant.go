// Package types provides shared type definitions and constants used across
// the activity service.
package types

// TenantType constants define the valid values for tenant/scope type fields.
// These use Kubernetes Kind naming convention (PascalCase) to match how Milo
// sets the parent type in authentication extra fields.
//
// These values are used in:
// - Activity processing (spec.tenant.type)
// - Audit log scoping (scope annotations)
// - ClickHouse storage queries
// - API request scoping
const (
	// TenantTypePlatform represents platform-wide scope with no tenant restriction.
	// This is the only lowercase value as it's a default/fallback that doesn't
	// come from Milo's parent kind field.
	TenantTypePlatform = "platform"

	// TenantTypeOrganization represents organization-level scope.
	TenantTypeOrganization = "Organization"

	// TenantTypeProject represents project-level scope.
	TenantTypeProject = "Project"

	// TenantTypeUser represents user-level scope for querying activities
	// performed by a specific user across all organizations and projects.
	TenantTypeUser = "User"
)
