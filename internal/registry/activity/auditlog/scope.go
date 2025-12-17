package auditlog

import (
	"k8s.io/apiserver/pkg/authentication/user"
)

const (
	// Extra field keys set by Milo's authentication system to indicate resource hierarchy.
	ParentAPIGroupExtraKey = "iam.miloapis.com/parent-api-group"
	ParentKindExtraKey     = "iam.miloapis.com/parent-type"
	ParentNameExtraKey     = "iam.miloapis.com/parent-name"
)

// ScopeInfo represents the hierarchical scope for audit log queries.
// Used to restrict query results to the appropriate organizational boundary.
type ScopeInfo struct {
	Type string // "platform", "organization", "project", "user"
	Name string // scope identifier (org name, project name, etc.)
}

// ExtractScopeFromUser determines the audit log query scope from user authentication metadata.
// Defaults to platform-wide scope when no parent resource is specified.
func ExtractScopeFromUser(u user.Info) ScopeInfo {
	if u.GetExtra() == nil {
		return ScopeInfo{Type: "platform", Name: ""}
	}

	parentKind := u.GetExtra()[ParentKindExtraKey]
	parentName := u.GetExtra()[ParentNameExtraKey]

	if len(parentKind) == 0 || len(parentName) == 0 {
		return ScopeInfo{Type: "platform", Name: ""}
	}

	switch parentKind[0] {
	case "Organization":
		return ScopeInfo{Type: "organization", Name: parentName[0]}
	case "Project":
		return ScopeInfo{Type: "project", Name: parentName[0]}
	case "User":
		return ScopeInfo{Type: "user", Name: parentName[0]}
	default:
		return ScopeInfo{Type: "platform", Name: ""}
	}
}
