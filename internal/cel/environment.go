package cel

import (
	"fmt"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
)

// NewAuditEnvironment creates a CEL environment for audit rule expressions.
// Available variables: verb, objectRef, user, responseStatus, responseObject, requestObject, actor, actorRef, kind.
// If collector is non-nil, link() calls will capture link information.
func NewAuditEnvironment(collector *linkCollector) (*cel.Env, error) {
	objectRefType := cel.MapType(cel.StringType, cel.DynType)
	userType := cel.MapType(cel.StringType, cel.DynType)
	responseStatusType := cel.MapType(cel.StringType, cel.DynType)
	actorRefType := cel.MapType(cel.StringType, cel.DynType)
	// responseObject and requestObject are dynamic maps since their schema
	// depends on the resource type being audited
	dynamicObjectType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		// Core audit fields - match AuditLogQuery filter format
		cel.Variable("verb", cel.StringType),
		cel.Variable("objectRef", objectRefType),
		cel.Variable("user", userType),
		cel.Variable("responseStatus", responseStatusType),

		// Request/response objects - available when audit level includes them
		// Note: responseObject on DELETE is a Status object, not the deleted resource
		cel.Variable("responseObject", dynamicObjectType),
		cel.Variable("requestObject", dynamicObjectType),

		// Convenience variables
		cel.Variable("actor", cel.StringType),
		cel.Variable("actorRef", actorRefType),

		// Also expose "kind" for convenience (extracted from objectRef)
		cel.Variable("kind", cel.StringType),

		// link function declaration with implementation: link(displayText string, resourceRef map) -> string
		// Returns the display text and optionally captures link info in the collector.
		cel.Function("link",
			cel.Overload("link_string_dyn",
				[]*cel.Type{cel.StringType, cel.DynType},
				cel.StringType,
				cel.BinaryBinding(func(displayText, resourceRef ref.Val) ref.Val {
					text := fmt.Sprintf("%v", displayText.Value())
					if collector != nil {
						collector.addLink(text, resourceRef.Value())
					}
					return types.String(text)
				}),
			),
		),
	)
}

// NewEventEnvironment creates a CEL environment for event rule expressions.
// Available variables: event (full Kubernetes event), actor, actorRef
// If collector is non-nil, link() calls will capture link information.
func NewEventEnvironment(collector *linkCollector) (*cel.Env, error) {
	// The event variable is a map containing the full Kubernetes Event
	eventType := cel.MapType(cel.StringType, cel.DynType)
	// The actorRef variable is a map with {type, name} for linking
	actorRefType := cel.MapType(cel.StringType, cel.DynType)

	return cel.NewEnv(
		cel.Variable("event", eventType),
		cel.Variable("actor", cel.StringType),
		cel.Variable("actorRef", actorRefType),

		// link function declaration with implementation: link(displayText string, resourceRef map) -> string
		// Returns the display text and optionally captures link info in the collector.
		cel.Function("link",
			cel.Overload("link_string_dyn",
				[]*cel.Type{cel.StringType, cel.DynType},
				cel.StringType,
				cel.BinaryBinding(func(displayText, resourceRef ref.Val) ref.Val {
					text := fmt.Sprintf("%v", displayText.Value())
					if collector != nil {
						collector.addLink(text, resourceRef.Value())
					}
					return types.String(text)
				}),
			),
		),
	)
}

// BuildAuditVars creates the CEL variable map for audit evaluation.
// Variables are flattened to match AuditLogQuery filter format.
func BuildAuditVars(auditMap map[string]interface{}) map[string]interface{} {
	vars := map[string]interface{}{
		"actor":    ExtractString(auditMap, "user", "username"),
		"actorRef": BuildActorRef(auditMap),
	}

	// Flatten audit fields to top level
	if v, ok := auditMap["verb"]; ok {
		vars["verb"] = v
	} else {
		vars["verb"] = ""
	}

	if v, ok := auditMap["objectRef"]; ok {
		vars["objectRef"] = v
		// Extract kind for convenience
		if objRef, ok := v.(map[string]interface{}); ok {
			if kind, ok := objRef["resource"].(string); ok {
				vars["kind"] = kind
			} else {
				vars["kind"] = ""
			}
		} else {
			vars["kind"] = ""
		}
	} else {
		vars["objectRef"] = map[string]interface{}{}
		vars["kind"] = ""
	}

	if v, ok := auditMap["user"]; ok {
		vars["user"] = v
	} else {
		vars["user"] = map[string]interface{}{}
	}

	if v, ok := auditMap["responseStatus"]; ok {
		vars["responseStatus"] = v
	} else {
		vars["responseStatus"] = map[string]interface{}{}
	}

	// Include responseObject and requestObject when available
	if v, ok := auditMap["responseObject"]; ok {
		vars["responseObject"] = v
	} else {
		vars["responseObject"] = map[string]interface{}{}
	}

	if v, ok := auditMap["requestObject"]; ok {
		vars["requestObject"] = v
	} else {
		vars["requestObject"] = map[string]interface{}{}
	}

	return vars
}

// BuildEventVars creates the CEL variable map for event evaluation.
func BuildEventVars(eventMap map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"event":    eventMap,
		"actor":    ExtractEventActor(eventMap),
		"actorRef": BuildEventActorRef(eventMap),
	}
}

// ExtractString extracts a nested string value from a map.
func ExtractString(m map[string]interface{}, keys ...string) string {
	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			// Last key - expect string
			if v, ok := current[key].(string); ok {
				return v
			}
			return ""
		}
		// Not last key - expect nested map
		if nested, ok := current[key].(map[string]interface{}); ok {
			current = nested
		} else {
			return ""
		}
	}
	return ""
}

// ExtractMap extracts a nested map from a map using a sequence of keys.
// Returns an empty map if the path doesn't exist or the value is not a map.
func ExtractMap(m map[string]interface{}, keys ...string) map[string]interface{} {
	current := m
	for _, key := range keys {
		if nested, ok := current[key].(map[string]interface{}); ok {
			current = nested
		} else {
			return map[string]interface{}{}
		}
	}
	return current
}

// BuildActorRef builds an actor reference map from audit user info.
// Returns a map with {type, name} structure matching the Activity actor format.
func BuildActorRef(auditMap map[string]interface{}) map[string]interface{} {
	username := ExtractString(auditMap, "user", "username")
	if username == "" {
		return map[string]interface{}{
			"type": "unknown",
			"name": "",
		}
	}

	// Determine actor type based on username pattern
	actorType := "user"
	if strings.HasPrefix(username, "system:serviceaccount:") {
		actorType = "serviceaccount"
	} else if strings.HasPrefix(username, "system:") {
		actorType = "system"
	}

	return map[string]interface{}{
		"type": actorType,
		"name": username,
	}
}

// ExtractEventActor extracts the actor name from a Kubernetes event.
func ExtractEventActor(eventMap map[string]interface{}) string {
	if controller := ExtractString(eventMap, "reportingController"); controller != "" {
		return controller
	}
	return ExtractString(eventMap, "source", "component")
}

// BuildEventActorRef builds an actor reference map from a Kubernetes event.
func BuildEventActorRef(eventMap map[string]interface{}) map[string]interface{} {
	controller := ExtractEventActor(eventMap)
	return map[string]interface{}{
		"type": "controller",
		"name": controller,
	}
}
