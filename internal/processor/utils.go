package processor

import (
	authnv1 "k8s.io/api/authentication/v1"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// GetNestedString extracts a string from a map, supporting nested access with multiple keys.
func GetNestedString(m map[string]interface{}, keys ...string) string {
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
		if nested, ok := current[key].(map[string]interface{}); ok {
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
func ConvertLinks(celLinks []cel.Link) []v1alpha1.ActivityLink {
	if len(celLinks) == 0 {
		return nil
	}

	links := make([]v1alpha1.ActivityLink, len(celLinks))
	for i, l := range celLinks {
		links[i] = v1alpha1.ActivityLink{
			Marker: l.Marker,
			Resource: v1alpha1.ActivityResource{
				APIGroup:  getStringFromMap(l.Resource, "apiGroup"),
				Kind:      getStringFromMap(l.Resource, "kind"),
				Name:      getStringFromMap(l.Resource, "name"),
				Namespace: getStringFromMap(l.Resource, "namespace"),
				UID:       getStringFromMap(l.Resource, "uid"),
			},
		}
	}
	return links
}

// getStringFromMap safely extracts a string from a map (for cel.Link.Resource).
func getStringFromMap(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
