package scope

import (
	"k8s.io/apiserver/pkg/authentication/user"

	"go.miloapis.com/activity/internal/storage"
)

const (
	// Extra field keys set by Milo's authentication system to indicate resource hierarchy.
	ParentAPIGroupExtraKey = "iam.miloapis.com/parent-api-group"
	ParentKindExtraKey     = "iam.miloapis.com/parent-type"
	ParentNameExtraKey     = "iam.miloapis.com/parent-name"
)

// ExtractScopeFromUser determines the query scope from user authentication metadata.
// Defaults to platform-wide scope when no parent resource is specified.
//
// For user scope, the Name field contains the user's UID (not username), which enables
// querying all activity performed by that user across all organizations and projects.
func ExtractScopeFromUser(u user.Info) storage.ScopeContext {
	if u.GetExtra() == nil {
		return storage.ScopeContext{Type: "platform", Name: ""}
	}

	parentKind := u.GetExtra()[ParentKindExtraKey]
	parentName := u.GetExtra()[ParentNameExtraKey]

	if len(parentKind) == 0 || len(parentName) == 0 {
		return storage.ScopeContext{Type: "platform", Name: ""}
	}

	switch parentKind[0] {
	case "Organization":
		return storage.ScopeContext{Type: "organization", Name: parentName[0]}
	case "Project":
		return storage.ScopeContext{Type: "project", Name: parentName[0]}
	case "User":
		return storage.ScopeContext{Type: "user", Name: parentName[0]}
	default:
		return storage.ScopeContext{Type: "platform", Name: ""}
	}
}
