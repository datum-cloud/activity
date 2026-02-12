package scope

import (
	"testing"

	"k8s.io/apiserver/pkg/authentication/user"

	"go.miloapis.com/activity/internal/storage"
)

func TestExtractScopeFromUser(t *testing.T) {
	tests := []struct {
		name     string
		user     user.Info
		expected storage.ScopeContext
	}{
		{
			name: "organization scope",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"Organization"},
					ParentNameExtraKey: {"acme-corp"},
				},
			},
			expected: storage.ScopeContext{Type: "organization", Name: "acme-corp"},
		},
		{
			name: "project scope",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"Project"},
					ParentNameExtraKey: {"backend-api"},
				},
			},
			expected: storage.ScopeContext{Type: "project", Name: "backend-api"},
		},
		{
			name: "user scope",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"User"},
					ParentNameExtraKey: {"550e8400-e29b-41d4-a716-446655440000"},
				},
			},
			expected: storage.ScopeContext{Type: "user", Name: "550e8400-e29b-41d4-a716-446655440000"},
		},
		{
			name:     "no scope (platform)",
			user:     &user.DefaultInfo{},
			expected: storage.ScopeContext{Type: "platform", Name: ""},
		},
		{
			name: "missing parent name",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"Organization"},
				},
			},
			expected: storage.ScopeContext{Type: "platform", Name: ""},
		},
		{
			name: "missing parent kind",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentNameExtraKey: {"acme-corp"},
				},
			},
			expected: storage.ScopeContext{Type: "platform", Name: ""},
		},
		{
			name: "unknown parent kind",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {"UnknownType"},
					ParentNameExtraKey: {"some-name"},
				},
			},
			expected: storage.ScopeContext{Type: "platform", Name: ""},
		},
		{
			name: "empty extra fields",
			user: &user.DefaultInfo{
				Extra: map[string][]string{
					ParentKindExtraKey: {},
					ParentNameExtraKey: {},
				},
			},
			expected: storage.ScopeContext{Type: "platform", Name: ""},
		},
		{
			name: "nil extra map",
			user: &user.DefaultInfo{
				Name: "test-user",
			},
			expected: storage.ScopeContext{Type: "platform", Name: ""},
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
