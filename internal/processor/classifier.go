package processor

import (
	"strings"

	authnv1 "k8s.io/api/authentication/v1"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// ChangeSource constants for activity classification.
const (
	ChangeSourceHuman  = "human"
	ChangeSourceSystem = "system"
)

// ClassifyChangeSource determines whether an activity was initiated by a human
// or by the system (controllers, service accounts, etc.).
// System accounts always use a "system:" prefix for the username.
func ClassifyChangeSource(user authnv1.UserInfo) string {
	if strings.HasPrefix(user.Username, "system:") {
		return ChangeSourceSystem
	}

	return ChangeSourceHuman
}

// ActorType constants for actor classification.
const (
	ActorTypeUser       = "user"
	ActorTypeSystem     = "system"
	ActorTypeController = "controller"
)

// ResolveActor extracts actor information from the audit user field.
//
// Actor types:
//   - user: Human users authenticated via OIDC or other providers
//   - system: Kubernetes controllers, service accounts, and other system components
func ResolveActor(user authnv1.UserInfo) v1alpha1.ActivityActor {
	actor := v1alpha1.ActivityActor{
		UID: user.UID,
	}

	// Detect actor type based on username pattern
	switch {
	case strings.HasPrefix(user.Username, "system:"):
		// System component (controller, service account, node, etc.)
		actor.Type = ActorTypeSystem
		// Remove "system:" prefix for display
		actor.Name = strings.TrimPrefix(user.Username, "system:")

	case strings.Contains(user.Username, "@"):
		// Email-based username = human user
		actor.Type = ActorTypeUser
		actor.Name = user.UID
		actor.Email = user.Username

	default:
		// Unknown pattern, treat as user
		actor.Type = ActorTypeUser
		actor.Name = user.UID
	}

	if actor.Name == "" {
		actor.Name = "unknown"
	}

	return actor
}

// IsSystemActor returns true if the actor represents a system component.
func IsSystemActor(actor v1alpha1.ActivityActor) bool {
	return actor.Type == ActorTypeSystem
}

// IsHumanActor returns true if the actor represents a human user.
func IsHumanActor(actor v1alpha1.ActivityActor) bool {
	return actor.Type == ActorTypeUser
}
