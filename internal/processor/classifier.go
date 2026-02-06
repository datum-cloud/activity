package processor

import (
	"strings"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// ChangeSource constants for activity classification.
const (
	ChangeSourceHuman  = "human"
	ChangeSourceSystem = "system"
)

// ClassifyChangeSource determines whether an activity was initiated by a human
// or by the system (controllers, operators, etc.).
//
// Classification rules are evaluated in priority order:
//  1. Explicit annotation on the resource (activity.miloapis.com/change-source)
//  2. Username matches system:serviceaccount:kube-system:* -> system
//  3. Username matches system:* -> system
//  4. Username is a real user (email-like or no system: prefix) -> human
//  5. Default to system for safety
func ClassifyChangeSource(user map[string]interface{}) string {
	username := getStringFromMap(user, "username")

	// Check for explicit annotation override (would be in extra fields)
	if extra, ok := user["extra"].(map[string]interface{}); ok {
		if sources, ok := extra["activity.miloapis.com/change-source"].([]interface{}); ok && len(sources) > 0 {
			if source, ok := sources[0].(string); ok {
				if source == ChangeSourceHuman || source == ChangeSourceSystem {
					return source
				}
			}
		}
	}

	// System service accounts in kube-system namespace
	if strings.HasPrefix(username, "system:serviceaccount:kube-system:") {
		return ChangeSourceSystem
	}

	// Any system: prefixed username is system-initiated
	if strings.HasPrefix(username, "system:") {
		return ChangeSourceSystem
	}

	// Usernames with @ are typically human users (email addresses)
	if strings.Contains(username, "@") {
		return ChangeSourceHuman
	}

	// Service accounts in other namespaces could be human-triggered
	// but we default to system for safety
	if strings.HasPrefix(username, "serviceaccount:") {
		return ChangeSourceSystem
	}

	// Usernames without special prefixes are likely human
	if username != "" && !strings.Contains(username, ":") {
		return ChangeSourceHuman
	}

	// Default to system
	return ChangeSourceSystem
}

// ActorType constants for actor classification.
const (
	ActorTypeUser           = "user"
	ActorTypeServiceAccount = "serviceaccount"
	ActorTypeController     = "controller"
)

// ResolveActor extracts actor information from the audit user field.
//
// Actor types:
//   - user: Human users authenticated via OIDC or other providers
//   - serviceaccount: Kubernetes service accounts
//   - controller: Known Kubernetes controllers
func ResolveActor(user map[string]interface{}) v1alpha1.ActivityActor {
	username := getStringFromMap(user, "username")
	uid := getStringFromMap(user, "uid")

	actor := v1alpha1.ActivityActor{
		UID: uid,
	}

	// Detect actor type based on username pattern
	switch {
	case strings.HasPrefix(username, "system:serviceaccount:"):
		// Service account: system:serviceaccount:<namespace>:<name>
		actor.Type = ActorTypeServiceAccount
		parts := strings.Split(username, ":")
		if len(parts) >= 4 {
			actor.Name = parts[3] // The service account name
		} else {
			actor.Name = username
		}

	case strings.HasPrefix(username, "system:"):
		// System component (controller, node, etc.)
		actor.Type = ActorTypeController
		// Remove "system:" prefix for display
		actor.Name = strings.TrimPrefix(username, "system:")

	case strings.Contains(username, "@"):
		// Email-based username = human user
		actor.Type = ActorTypeUser
		actor.Name = username
		actor.Email = username

	default:
		// Unknown pattern, treat as user
		actor.Type = ActorTypeUser
		actor.Name = username
	}

	// Try to get a more user-friendly name from extra fields
	if extra, ok := user["extra"].(map[string]interface{}); ok {
		// Check for display name
		if names, ok := extra["iam.miloapis.com/display-name"].([]interface{}); ok && len(names) > 0 {
			if name, ok := names[0].(string); ok && name != "" {
				actor.Name = name
			}
		}

		// Check for email if not already set
		if actor.Email == "" {
			if emails, ok := extra["iam.miloapis.com/email"].([]interface{}); ok && len(emails) > 0 {
				if email, ok := emails[0].(string); ok {
					actor.Email = email
				}
			}
		}
	}

	return actor
}

// IsSystemActor returns true if the actor represents a system component.
func IsSystemActor(actor v1alpha1.ActivityActor) bool {
	return actor.Type == ActorTypeController || actor.Type == ActorTypeServiceAccount
}

// IsHumanActor returns true if the actor represents a human user.
func IsHumanActor(actor v1alpha1.ActivityActor) bool {
	return actor.Type == ActorTypeUser
}
