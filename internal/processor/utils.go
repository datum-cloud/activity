package processor

import (
	"fmt"

	authnv1 "k8s.io/api/authentication/v1"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// KindResolver resolves a plural resource name to its Kind using API discovery.
// Returns error if resolution fails.
type KindResolver func(apiGroup, resource string) (string, error)

// GetNestedString extracts a string from a map, supporting nested access with multiple keys.
func GetNestedString(m map[string]any, keys ...string) string {
	if m == nil || len(keys) == 0 {
		return ""
	}

	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			if v, ok := current[key].(string); ok {
				return v
			}
			return ""
		}
		if nested, ok := current[key].(map[string]any); ok {
			current = nested
		} else {
			return ""
		}
	}
	return ""
}

// ExtractTenant extracts tenant information from user extra fields.
func ExtractTenant(user authnv1.UserInfo) v1alpha1.ActivityTenant {
	tenant := v1alpha1.ActivityTenant{
		Type: "platform",
		Name: "",
	}

	// Look for parent type/name in extra fields
	if parentType := getExtraValue(user.Extra, "iam.miloapis.com/parent-type"); parentType != "" {
		tenant.Type = parentType
	}

	if parentName := getExtraValue(user.Extra, "iam.miloapis.com/parent-name"); parentName != "" {
		tenant.Name = parentName
	}

	// Check for organization (alternative field)
	if tenant.Type == "platform" {
		if org := getExtraValue(user.Extra, "organization"); org != "" {
			tenant.Type = "organization"
			tenant.Name = org
		}
	}

	// Check for project (more specific than organization)
	if project := getExtraValue(user.Extra, "project"); project != "" {
		tenant.Type = "project"
		tenant.Name = project
	}

	return tenant
}

// getExtraValue extracts the first value from a UserInfo extra field.
func getExtraValue(extra map[string]authnv1.ExtraValue, key string) string {
	if values, ok := extra[key]; ok && len(values) > 0 {
		return values[0]
	}
	return ""
}

// ConvertLinks converts CEL links to Activity links.
// If resolveKind is provided, it will be used to resolve plural resource names to Kind.
// Returns error if kind resolution fails.
func ConvertLinks(celLinks []cel.Link, resolveKind KindResolver) ([]v1alpha1.ActivityLink, error) {
	if len(celLinks) == 0 {
		return nil, nil
	}

	links := make([]v1alpha1.ActivityLink, len(celLinks))
	for i, l := range celLinks {
		kind := getStringFromMap(l.Resource, "kind")
		apiGroup := getStringFromMap(l.Resource, "apiGroup")

		// Fallback 1: if kind is empty, try to get it from the "resource" field
		// This handles Kubernetes audit objectRef which has "resource" (plural) instead of "kind"
		if kind == "" {
			if resource := getStringFromMap(l.Resource, "resource"); resource != "" {
				if resolveKind != nil {
					resolvedKind, err := resolveKind(apiGroup, resource)
					if err != nil {
						return nil, fmt.Errorf("%w: resource %q in apiGroup %q: %v", ErrKindResolution, resource, apiGroup, err)
					}
					kind = resolvedKind
				}
			}
		}

		// Fallback 2: if still empty, try to get it from the "type" field
		// This handles actorRef which has {type, name} structure
		if kind == "" {
			kind = getStringFromMap(l.Resource, "type")
		}

		links[i] = v1alpha1.ActivityLink{
			Marker: l.Marker,
			Resource: v1alpha1.ActivityResource{
				APIGroup:  apiGroup,
				Kind:      kind,
				Name:      getStringFromMap(l.Resource, "name"),
				Namespace: getStringFromMap(l.Resource, "namespace"),
				UID:       getStringFromMap(l.Resource, "uid"),
			},
		}
	}
	return links, nil
}

// getStringFromMap safely extracts a string from a map (for cel.Link.Resource).
func getStringFromMap(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
