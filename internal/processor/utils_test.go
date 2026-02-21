package processor

import (
	"testing"

	"go.miloapis.com/activity/internal/cel"
	authnv1 "k8s.io/api/authentication/v1"
)

func TestResourceToKind(t *testing.T) {
	tests := []struct {
		resource string
		want     string
	}{
		// Regular plurals
		{"pods", "Pod"},
		{"services", "Service"},
		{"nodes", "Node"},
		{"namespaces", "Namespace"},
		{"secrets", "Secret"},
		{"configmaps", "Configmap"},
		{"deployments", "Deployment"},
		{"replicasets", "Replicaset"},
		{"daemonsets", "Daemonset"},
		{"statefulsets", "Statefulset"},
		{"jobs", "Job"},
		{"cronjobs", "Cronjob"},

		// Irregular plurals (from map)
		{"endpoints", "Endpoints"},
		{"endpointslices", "EndpointSlice"},
		{"ingresses", "Ingress"},
		{"networkpolicies", "NetworkPolicy"},
		{"podsecuritypolicies", "PodSecurityPolicy"},
		{"priorityclasses", "PriorityClass"},
		{"storageclasses", "StorageClass"},
		{"ingressclasses", "IngressClass"},
		{"runtimeclasses", "RuntimeClass"},
		{"csidrivers", "CSIDriver"},
		{"csinodes", "CSINode"},
		{"csistoragecapacities", "CSIStorageCapacity"},
		{"volumeattachments", "VolumeAttachment"},
		{"mutatingwebhookconfigurations", "MutatingWebhookConfiguration"},
		{"validatingwebhookconfigurations", "ValidatingWebhookConfiguration"},

		// Edge cases
		{"", ""},
		{"s", "S"}, // Single char "s" becomes "S" (not a real resource but handled)
	}

	for _, tt := range tests {
		t.Run(tt.resource, func(t *testing.T) {
			got := resourceToKind(tt.resource)
			if got != tt.want {
				t.Errorf("resourceToKind(%q) = %q, want %q", tt.resource, got, tt.want)
			}
		})
	}
}

func TestConvertLinks(t *testing.T) {
	tests := []struct {
		name     string
		celLinks []cel.Link
		want     int
		wantKind string
	}{
		{
			name:     "nil links",
			celLinks: nil,
			want:     0,
		},
		{
			name:     "empty links",
			celLinks: []cel.Link{},
			want:     0,
		},
		{
			name: "link with kind field (Kubernetes events)",
			celLinks: []cel.Link{
				{
					Marker: "Pod my-pod",
					Resource: map[string]any{
						"kind":      "Pod",
						"name":      "my-pod",
						"namespace": "default",
						"uid":       "pod-123",
						"apiGroup":  "",
					},
				},
			},
			want:     1,
			wantKind: "Pod",
		},
		{
			name: "link with resource field (Kubernetes audit objectRef)",
			celLinks: []cel.Link{
				{
					Marker: "Deployment my-deployment",
					Resource: map[string]any{
						"resource":  "deployments",
						"name":      "my-deployment",
						"namespace": "default",
						"uid":       "deploy-456",
						"apiGroup":  "apps",
					},
				},
			},
			want:     1,
			wantKind: "Deployment",
		},
		{
			name: "link with both kind and resource (kind wins)",
			celLinks: []cel.Link{
				{
					Marker: "Service my-service",
					Resource: map[string]any{
						"kind":      "Service",
						"resource":  "services",
						"name":      "my-service",
						"namespace": "default",
					},
				},
			},
			want:     1,
			wantKind: "Service",
		},
		{
			name: "link with type field (actorRef)",
			celLinks: []cel.Link{
				{
					Marker: "kubernetes-admin",
					Resource: map[string]any{
						"type": "user",
						"name": "kubernetes-admin",
					},
				},
			},
			want:     1,
			wantKind: "user",
		},
		{
			name: "multiple links with mixed formats",
			celLinks: []cel.Link{
				{
					Marker: "Pod my-pod",
					Resource: map[string]any{
						"kind": "Pod",
						"name": "my-pod",
					},
				},
				{
					Marker: "Deployment my-deployment",
					Resource: map[string]any{
						"resource": "deployments",
						"name":     "my-deployment",
					},
				},
				{
					Marker: "kubernetes-admin",
					Resource: map[string]any{
						"type": "user",
						"name": "kubernetes-admin",
					},
				},
			},
			want:     3,
			wantKind: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ConvertLinks(tt.celLinks)

			if len(got) != tt.want {
				t.Errorf("ConvertLinks() returned %d links, want %d", len(got), tt.want)
				return
			}

			if tt.want > 0 && tt.wantKind != "" {
				if got[0].Resource.Kind != tt.wantKind {
					t.Errorf("ConvertLinks() first link Kind = %q, want %q", got[0].Resource.Kind, tt.wantKind)
				}
			}
		})
	}
}

func TestExtractTenant(t *testing.T) {
	tests := []struct {
		name     string
		user     authnv1.UserInfo
		wantType string
		wantName string
	}{
		{
			name:     "platform (no extra fields)",
			user:     authnv1.UserInfo{},
			wantType: "platform",
			wantName: "",
		},
		{
			name: "organization from parent fields",
			user: authnv1.UserInfo{
				Extra: map[string]authnv1.ExtraValue{
					"iam.miloapis.com/parent-type": {"organization"},
					"iam.miloapis.com/parent-name": {"acme-corp"},
				},
			},
			wantType: "organization",
			wantName: "acme-corp",
		},
		{
			name: "project from parent fields",
			user: authnv1.UserInfo{
				Extra: map[string]authnv1.ExtraValue{
					"iam.miloapis.com/parent-type": {"project"},
					"iam.miloapis.com/parent-name": {"my-project"},
				},
			},
			wantType: "project",
			wantName: "my-project",
		},
		{
			name: "organization from legacy field",
			user: authnv1.UserInfo{
				Extra: map[string]authnv1.ExtraValue{
					"organization": {"legacy-org"},
				},
			},
			wantType: "organization",
			wantName: "legacy-org",
		},
		{
			name: "project overrides organization",
			user: authnv1.UserInfo{
				Extra: map[string]authnv1.ExtraValue{
					"organization": {"my-org"},
					"project":      {"my-project"},
				},
			},
			wantType: "project",
			wantName: "my-project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractTenant(tt.user)
			if got.Type != tt.wantType {
				t.Errorf("ExtractTenant() Type = %q, want %q", got.Type, tt.wantType)
			}
			if got.Name != tt.wantName {
				t.Errorf("ExtractTenant() Name = %q, want %q", got.Name, tt.wantName)
			}
		})
	}
}

func TestGetNestedString(t *testing.T) {
	tests := []struct {
		name string
		m    map[string]any
		keys []string
		want string
	}{
		{
			name: "single level",
			m:    map[string]any{"key": "value"},
			keys: []string{"key"},
			want: "value",
		},
		{
			name: "nested levels",
			m: map[string]any{
				"user": map[string]any{
					"username": "alice",
				},
			},
			keys: []string{"user", "username"},
			want: "alice",
		},
		{
			name: "deeply nested",
			m: map[string]any{
				"audit": map[string]any{
					"objectRef": map[string]any{
						"name": "my-resource",
					},
				},
			},
			keys: []string{"audit", "objectRef", "name"},
			want: "my-resource",
		},
		{
			name: "missing key",
			m:    map[string]any{"key": "value"},
			keys: []string{"missing"},
			want: "",
		},
		{
			name: "nil map",
			m:    nil,
			keys: []string{"key"},
			want: "",
		},
		{
			name: "empty keys",
			m:    map[string]any{"key": "value"},
			keys: []string{},
			want: "",
		},
		{
			name: "non-string value",
			m:    map[string]any{"key": 123},
			keys: []string{"key"},
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetNestedString(tt.m, tt.keys...)
			if got != tt.want {
				t.Errorf("GetNestedString() = %q, want %q", got, tt.want)
			}
		})
	}
}
