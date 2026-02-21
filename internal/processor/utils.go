package processor

import (
	authnv1 "k8s.io/api/authentication/v1"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

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
func ConvertLinks(celLinks []cel.Link) []v1alpha1.ActivityLink {
	if len(celLinks) == 0 {
		return nil
	}

	links := make([]v1alpha1.ActivityLink, len(celLinks))
	for i, l := range celLinks {
		kind := getStringFromMap(l.Resource, "kind")

		// Fallback 1: if kind is empty, try to get it from the "resource" field
		// This handles Kubernetes audit objectRef which has "resource" (plural) instead of "kind"
		if kind == "" {
			if resource := getStringFromMap(l.Resource, "resource"); resource != "" {
				kind = resourceToKind(resource)
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
				APIGroup:  getStringFromMap(l.Resource, "apiGroup"),
				Kind:      kind,
				Name:      getStringFromMap(l.Resource, "name"),
				Namespace: getStringFromMap(l.Resource, "namespace"),
				UID:       getStringFromMap(l.Resource, "uid"),
			},
		}
	}
	return links
}

// getStringFromMap safely extracts a string from a map (for cel.Link.Resource).
func getStringFromMap(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// resourceToKind converts a plural resource name to a singular Kind name.
// This handles common Kubernetes resource naming patterns.
// Examples: "pods" -> "Pod", "services" -> "Service", "deployments" -> "Deployment"
func resourceToKind(resource string) string {
	if resource == "" {
		return ""
	}

	// Common irregular plurals in Kubernetes
	irregulars := map[string]string{
		"endpoints":               "Endpoints",
		"endpointslices":          "EndpointSlice",
		"ingresses":               "Ingress",
		"networkpolicies":         "NetworkPolicy",
		"podsecuritypolicies":     "PodSecurityPolicy",
		"priorityclasses":         "PriorityClass",
		"storageclasses":          "StorageClass",
		"ingressclasses":          "IngressClass",
		"runtimeclasses":          "RuntimeClass",
		"csidrivers":              "CSIDriver",
		"csinodes":                "CSINode",
		"csistoragecapacities":    "CSIStorageCapacity",
		"volumeattachments":       "VolumeAttachment",
		"mutatingwebhookconfigurations":   "MutatingWebhookConfiguration",
		"validatingwebhookconfigurations": "ValidatingWebhookConfiguration",
	}

	if kind, ok := irregulars[resource]; ok {
		return kind
	}

	// Handle regular plurals: remove trailing "s" and capitalize first letter
	singular := resource
	if len(resource) > 1 && resource[len(resource)-1] == 's' {
		// Check for "ies" -> "y" pattern (e.g., "policies" -> "policy")
		if len(resource) > 3 && resource[len(resource)-3:] == "ies" {
			singular = resource[:len(resource)-3] + "y"
		} else if len(resource) > 2 && resource[len(resource)-2:] == "es" {
			// Don't strip "es" from words ending in "ses" or "ches" etc.
			// Just strip final "s"
			singular = resource[:len(resource)-1]
		} else {
			singular = resource[:len(resource)-1]
		}
	}

	// Capitalize first letter
	if len(singular) > 0 {
		return string(singular[0]-32) + singular[1:]
	}

	return singular
}
