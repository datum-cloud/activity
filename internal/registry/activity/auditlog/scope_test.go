package auditlog

import (
	"testing"

	"k8s.io/apiserver/pkg/authentication/user"
)

func TestExtractScopeFromUser(t *testing.T) {
	tests := []struct {
		name     string
		user     user.Info
		expected ScopeInfo
	}{
		{
			name: "organization scope",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"Organization"},
					ParentNameExtraKey: {"acme-corp"},
				},
			},
			expected: ScopeInfo{Type: "organization", Name: "acme-corp"},
		},
		{
			name: "project scope",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"Project"},
					ParentNameExtraKey: {"backend-api"},
				},
			},
			expected: ScopeInfo{Type: "project", Name: "backend-api"},
		},
		{
			name: "user scope",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"User"},
					ParentNameExtraKey: {"john.doe"},
				},
			},
			expected: ScopeInfo{Type: "user", Name: "john.doe"},
		},
		{
			name:     "no scope (platform)",
			user:     &user.DefaultInfo{},
			expected: ScopeInfo{Type: "platform", Name: ""},
		},
		{
			name: "missing parent name",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"Organization"},
				},
			},
			expected: ScopeInfo{Type: "platform", Name: ""},
		},
		{
			name: "missing parent kind",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentNameExtraKey: {"acme-corp"},
				},
			},
			expected: ScopeInfo{Type: "platform", Name: ""},
		},
		{
			name: "unknown parent kind",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"UnknownType"},
					ParentNameExtraKey: {"some-name"},
				},
			},
			expected: ScopeInfo{Type: "platform", Name: ""},
		},
		{
			name: "empty extra fields",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {},
					ParentNameExtraKey: {},
				},
			},
			expected: ScopeInfo{Type: "platform", Name: ""},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractScopeFromUser(tt.user)
			if result != tt.expected {
				t.Errorf("got %+v, want %+v", result, tt.expected)
			}
		})
	}
}
