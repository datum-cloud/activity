package events

import (
	"k8s.io/apiserver/pkg/authentication/user"

	"go.miloapis.com/activity/internal/types"
)

const (
	// Extra field keys set by Milo's authentication system to indicate resource hierarchy.
	ParentAPIGroupExtraKey = "iam.miloapis.com/parent-api-group"
	ParentKindExtraKey     = "iam.miloapis.com/parent-type"
	ParentNameExtraKey     = "iam.miloapis.com/parent-name"
)

// ScopeInfo represents the hierarchical scope for events queries.
// Used to restrict query results to the appropriate organizational boundary.
type ScopeInfo struct {
	Type string // "platform", "Organization", "Project", "User" (PascalCase for K8s Kind convention)
	Name string // scope identifier (org name, project name, user UID, etc.)
}

// ExtractScopeFromUser determines the events query scope from user authentication metadata.
// Defaults to platform-wide scope when no parent resource is specified.
//
// The returned Type uses Kubernetes Kind naming convention (PascalCase) to match
// how scope types are stored in ClickHouse.
//
// For user scope, the Name field contains the user's UID (not username), which enables
// querying all events within that user's context across all organizations and projects.
func ExtractScopeFromUser(u user.Info) ScopeInfo {
	if u.GetExtra() == nil {
		return ScopeInfo{Type: types.TenantTypePlatform, Name: ""}
	}

	parentKind := u.GetExtra()[ParentKindExtraKey]
	parentName := u.GetExtra()[ParentNameExtraKey]

	if len(parentKind) == 0 || len(parentName) == 0 {
		return ScopeInfo{Type: types.TenantTypePlatform, Name: ""}
	}

	switch parentKind[0] {
	case "Organization":
		return ScopeInfo{Type: types.TenantTypeOrganization, Name: parentName[0]}
	case "Project":
		return ScopeInfo{Type: types.TenantTypeProject, Name: parentName[0]}
	case "User":
		return ScopeInfo{Type: types.TenantTypeUser, Name: parentName[0]}
	default:
		return ScopeInfo{Type: types.TenantTypePlatform, Name: ""}
	}
}
