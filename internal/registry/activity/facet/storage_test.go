package facet

import (
	"context"
	"fmt"
	"strings"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

	"go.miloapis.com/activity/internal/registry/scope"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// mockFacetStorage is a test double for FacetStorageInterface
type mockFacetStorage struct {
	queryFunc func(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error)
}

func (m *mockFacetStorage) QueryFacets(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, spec, scope)
	}
	return &storage.FacetQueryResult{Facets: []storage.FacetFieldResult{}}, nil
}

// TestFacetQueryStorage_RESTInterface verifies the REST interface contracts
func TestFacetQueryStorage_RESTInterface(t *testing.T) {
	s := NewFacetQueryStorage(&mockFacetStorage{})

	t.Run("New returns empty ActivityFacetQuery", func(t *testing.T) {
		obj := s.New()
		query, ok := obj.(*v1alpha1.ActivityFacetQuery)
		if !ok {
			t.Errorf("New() returned %T, want *v1alpha1.ActivityFacetQuery", obj)
		}
		if query == nil {
			t.Error("New() returned nil")
		}
	})

	t.Run("NamespaceScoped returns false", func(t *testing.T) {
		if s.NamespaceScoped() {
			t.Error("NamespaceScoped() = true, want false")
		}
	})

	t.Run("GetSingularName returns correct value", func(t *testing.T) {
		want := "activityfacetquery"
		if got := s.GetSingularName(); got != want {
			t.Errorf("GetSingularName() = %q, want %q", got, want)
		}
	})

	t.Run("Destroy doesn't panic", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Destroy() panicked: %v", r)
			}
		}()
		s.Destroy()
	})
}

// TestFacetQueryStorage_Create_Success tests successful facet query execution
func TestFacetQueryStorage_Create_Success(t *testing.T) {
	mockResult := &storage.FacetQueryResult{
		Facets: []storage.FacetFieldResult{
			{
				Field: "spec.actor.name",
				Values: []storage.FacetValueResult{
					{Value: "alice", Count: 100},
					{Value: "bob", Count: 50},
				},
			},
			{
				Field: "spec.resource.kind",
				Values: []storage.FacetValueResult{
					{Value: "Deployment", Count: 75},
					{Value: "Service", Count: 25},
				},
			},
		},
	}

	mock := &mockFacetStorage{
		queryFunc: func(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error) {
			return mockResult, nil
		},
	}
	s := NewFacetQueryStorage(mock)

	query := &v1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{Name: "test-facet-query"},
		Spec: v1alpha1.ActivityFacetQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: "now-7d",
				End:   "now",
			},
			Facets: []v1alpha1.FacetSpec{
				{Field: "spec.actor.name", Limit: 10},
				{Field: "spec.resource.kind", Limit: 10},
			},
		},
	}

	testUser := &user.DefaultInfo{
		Name: "test-user",
		Extra: map[string][]string{
			scope.ParentKindExtraKey: {"Organization"},
			scope.ParentNameExtraKey: {"test-org"},
		},
	}
	ctx := request.WithUser(context.Background(), testUser)

	result, err := s.Create(ctx, query, nil, nil)
	if err != nil {
		t.Fatalf("Create() error = %v, want nil", err)
	}

	resultQuery, ok := result.(*v1alpha1.ActivityFacetQuery)
	if !ok {
		t.Fatalf("Create() returned %T, want *v1alpha1.ActivityFacetQuery", result)
	}

	// Verify facet results were populated
	if len(resultQuery.Status.Facets) != 2 {
		t.Errorf("Status.Facets has %d facets, want 2", len(resultQuery.Status.Facets))
	}

	// Verify first facet
	if resultQuery.Status.Facets[0].Field != "spec.actor.name" {
		t.Errorf("Facet[0].Field = %q, want %q", resultQuery.Status.Facets[0].Field, "spec.actor.name")
	}
	if len(resultQuery.Status.Facets[0].Values) != 2 {
		t.Errorf("Facet[0].Values has %d values, want 2", len(resultQuery.Status.Facets[0].Values))
	}
	if resultQuery.Status.Facets[0].Values[0].Value != "alice" {
		t.Errorf("Facet[0].Values[0].Value = %q, want %q", resultQuery.Status.Facets[0].Values[0].Value, "alice")
	}
	if resultQuery.Status.Facets[0].Values[0].Count != 100 {
		t.Errorf("Facet[0].Values[0].Count = %d, want 100", resultQuery.Status.Facets[0].Values[0].Count)
	}
}

// TestFacetQueryStorage_Create_ScopeExtraction tests that scope is properly extracted from user context
func TestFacetQueryStorage_Create_ScopeExtraction(t *testing.T) {
	var capturedScope storage.ScopeContext

	mock := &mockFacetStorage{
		queryFunc: func(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error) {
			capturedScope = scope
			return &storage.FacetQueryResult{Facets: []storage.FacetFieldResult{}}, nil
		},
	}
	s := NewFacetQueryStorage(mock)

	tests := []struct {
		name     string
		user     user.Info
		wantType string
		wantName string
	}{
		{
			name: "organization scope",
			user: &user.DefaultInfo{
				Name: "org-user",
				Extra: map[string][]string{
					scope.ParentKindExtraKey: {"Organization"},
					scope.ParentNameExtraKey: {"acme-corp"},
				},
			},
			wantType: "organization",
			wantName: "acme-corp",
		},
		{
			name: "project scope",
			user: &user.DefaultInfo{
				Name: "project-user",
				Extra: map[string][]string{
					scope.ParentKindExtraKey: {"Project"},
					scope.ParentNameExtraKey: {"backend-api"},
				},
			},
			wantType: "project",
			wantName: "backend-api",
		},
		{
			name: "user scope",
			user: &user.DefaultInfo{
				Name: "user-scoped",
				Extra: map[string][]string{
					scope.ParentKindExtraKey: {"User"},
					scope.ParentNameExtraKey: {"550e8400-e29b-41d4-a716-446655440000"},
				},
			},
			wantType: "user",
			wantName: "550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name: "platform scope (no extra)",
			user: &user.DefaultInfo{
				Name: "admin-user",
			},
			wantType: "platform",
			wantName: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			capturedScope = storage.ScopeContext{} // Reset

			query := &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "scope-test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: "spec.actor.name"},
					},
				},
			}

			ctx := request.WithUser(context.Background(), tt.user)
			_, err := s.Create(ctx, query, nil, nil)
			if err != nil {
				t.Fatalf("Create() error = %v, want nil", err)
			}

			if capturedScope.Type != tt.wantType {
				t.Errorf("Scope.Type = %q, want %q", capturedScope.Type, tt.wantType)
			}
			if capturedScope.Name != tt.wantName {
				t.Errorf("Scope.Name = %q, want %q", capturedScope.Name, tt.wantName)
			}
		})
	}
}

// TestFacetQueryStorage_Create_ValidationErrors tests validation errors
func TestFacetQueryStorage_Create_ValidationErrors(t *testing.T) {
	s := NewFacetQueryStorage(&mockFacetStorage{})

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	tests := []struct {
		name      string
		query     *v1alpha1.ActivityFacetQuery
		wantError string
	}{
		{
			name: "empty facets list",
			query: &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{},
				},
			},
			wantError: "Provide at least one facet",
		},
		{
			name: "too many facets",
			query: &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: "spec.actor.name"},
						{Field: "spec.actor.type"},
						{Field: "spec.resource.apiGroup"},
						{Field: "spec.resource.kind"},
						{Field: "spec.resource.namespace"},
						{Field: "spec.changeSource"},
						{Field: "spec.actor.name"},
						{Field: "spec.actor.type"},
						{Field: "spec.resource.apiGroup"},
						{Field: "spec.resource.kind"},
						{Field: "spec.resource.namespace"}, // 11th facet
					},
				},
			},
			wantError: "at most 10",
		},
		{
			name: "empty field name",
			query: &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: ""},
					},
				},
			},
			wantError: "Specify which field",
		},
		{
			name: "invalid field name",
			query: &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: "spec.invalid.field"},
					},
				},
			},
			wantError: "Supported values",
		},
		{
			name: "negative limit",
			query: &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: "spec.actor.name", Limit: -5},
					},
				},
			},
			wantError: "Must be non-negative",
		},
		{
			name: "multiple errors - empty and invalid field",
			query: &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: ""},
						{Field: "invalid.field"},
					},
				},
			},
			wantError: "fields are missing or invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := s.Create(ctx, tt.query, nil, nil)

			if err == nil {
				t.Fatal("Create() error = nil, want error")
			}

			// Should return Invalid status error (422)
			statusErr, ok := err.(*apierrors.StatusError)
			if !ok {
				// Check if it's our custom StatusError
				if customErr, ok := err.(interface{ Status() metav1.Status }); ok {
					status := customErr.Status()
					if status.Code != 422 {
						t.Errorf("Status code = %d, want 422", status.Code)
					}
					if string(status.Reason) != "Invalid" {
						t.Errorf("Reason = %q, want %q", status.Reason, "Invalid")
					}
					errStr := err.Error()
					if !strings.Contains(errStr, tt.wantError) {
						t.Errorf("Error message %q doesn't contain %q", errStr, tt.wantError)
					}
					return
				}
				t.Fatalf("Create() returned %T, want StatusError", err)
			}

			if statusErr.ErrStatus.Code != 422 {
				t.Errorf("Status code = %d, want 422", statusErr.ErrStatus.Code)
			}

			errStr := err.Error()
			if !strings.Contains(errStr, tt.wantError) {
				t.Errorf("Error message %q doesn't contain %q", errStr, tt.wantError)
			}
		})
	}
}

// TestFacetQueryStorage_Create_StorageErrors tests error handling from the storage layer
func TestFacetQueryStorage_Create_StorageErrors(t *testing.T) {
	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	tests := []struct {
		name         string
		storageError error
		wantStatus   int32
		wantContains string
	}{
		{
			name:         "database connection error",
			storageError: fmt.Errorf("connection failed"),
			wantStatus:   503,
			wantContains: "Failed to retrieve facets",
		},
		{
			name:         "query timeout",
			storageError: fmt.Errorf("context deadline exceeded"),
			wantStatus:   503,
			wantContains: "Failed to retrieve facets",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockFacetStorage{
				queryFunc: func(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error) {
					return nil, tt.storageError
				},
			}
			s := NewFacetQueryStorage(mock)

			query := &v1alpha1.ActivityFacetQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.ActivityFacetQuerySpec{
					Facets: []v1alpha1.FacetSpec{
						{Field: "spec.actor.name"},
					},
				},
			}

			_, err := s.Create(ctx, query, nil, nil)

			if err == nil {
				t.Fatal("Create() error = nil, want error")
			}

			statusErr, ok := err.(*apierrors.StatusError)
			if !ok {
				t.Fatalf("Create() returned %T, want *apierrors.StatusError", err)
			}

			if statusErr.ErrStatus.Code != tt.wantStatus {
				t.Errorf("Status code = %d, want %d", statusErr.ErrStatus.Code, tt.wantStatus)
			}

			errStr := err.Error()
			if !strings.Contains(errStr, tt.wantContains) {
				t.Errorf("Error message %q doesn't contain %q", errStr, tt.wantContains)
			}
		})
	}
}

// TestFacetQueryStorage_Create_NoUserContext tests that missing user context returns error
func TestFacetQueryStorage_Create_NoUserContext(t *testing.T) {
	s := NewFacetQueryStorage(&mockFacetStorage{})

	query := &v1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: v1alpha1.ActivityFacetQuerySpec{
			Facets: []v1alpha1.FacetSpec{
				{Field: "spec.actor.name"},
			},
		},
	}

	// Create without user context
	_, err := s.Create(context.Background(), query, nil, nil)

	if err == nil {
		t.Fatal("Create() error = nil, want error")
	}

	statusErr, ok := err.(*apierrors.StatusError)
	if !ok {
		t.Fatalf("Create() returned %T, want *apierrors.StatusError", err)
	}

	if statusErr.ErrStatus.Code != 500 {
		t.Errorf("Status code = %d, want 500", statusErr.ErrStatus.Code)
	}
}

// TestFacetQueryStorage_Create_WrongObjectType tests that non-ActivityFacetQuery objects are rejected
func TestFacetQueryStorage_Create_WrongObjectType(t *testing.T) {
	s := NewFacetQueryStorage(&mockFacetStorage{})

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	// Pass wrong object type
	wrongObj := &v1alpha1.ActivityPolicy{}
	_, err := s.Create(ctx, wrongObj, nil, nil)

	if err == nil {
		t.Fatal("Create() error = nil, want error")
	}

	if !strings.Contains(err.Error(), "ActivityFacetQuery") {
		t.Errorf("Error message %q should mention 'ActivityFacetQuery'", err.Error())
	}
}

// TestFacetQueryStorage_Create_SpecPassthrough tests that spec fields are correctly passed to storage
func TestFacetQueryStorage_Create_SpecPassthrough(t *testing.T) {
	var capturedSpec storage.FacetQuerySpec

	mock := &mockFacetStorage{
		queryFunc: func(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error) {
			capturedSpec = spec
			return &storage.FacetQueryResult{Facets: []storage.FacetFieldResult{}}, nil
		},
	}
	s := NewFacetQueryStorage(mock)

	query := &v1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: v1alpha1.ActivityFacetQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: "now-7d",
				End:   "now",
			},
			Filter: "spec.changeSource == 'human'",
			Facets: []v1alpha1.FacetSpec{
				{Field: "spec.actor.name", Limit: 25},
				{Field: "spec.resource.kind", Limit: 50},
			},
		},
	}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	_, err := s.Create(ctx, query, nil, nil)
	if err != nil {
		t.Fatalf("Create() error = %v, want nil", err)
	}

	// Verify time range was passed
	if capturedSpec.StartTime != "now-7d" {
		t.Errorf("StartTime = %q, want %q", capturedSpec.StartTime, "now-7d")
	}
	if capturedSpec.EndTime != "now" {
		t.Errorf("EndTime = %q, want %q", capturedSpec.EndTime, "now")
	}

	// Verify filter was passed
	if capturedSpec.Filter != "spec.changeSource == 'human'" {
		t.Errorf("Filter = %q, want %q", capturedSpec.Filter, "spec.changeSource == 'human'")
	}

	// Verify facets were passed
	if len(capturedSpec.Facets) != 2 {
		t.Fatalf("Facets has %d items, want 2", len(capturedSpec.Facets))
	}
	if capturedSpec.Facets[0].Field != "spec.actor.name" {
		t.Errorf("Facets[0].Field = %q, want %q", capturedSpec.Facets[0].Field, "spec.actor.name")
	}
	if capturedSpec.Facets[0].Limit != 25 {
		t.Errorf("Facets[0].Limit = %d, want 25", capturedSpec.Facets[0].Limit)
	}
	if capturedSpec.Facets[1].Field != "spec.resource.kind" {
		t.Errorf("Facets[1].Field = %q, want %q", capturedSpec.Facets[1].Field, "spec.resource.kind")
	}
	if capturedSpec.Facets[1].Limit != 50 {
		t.Errorf("Facets[1].Limit = %d, want 50", capturedSpec.Facets[1].Limit)
	}
}

// TestFacetQueryStorage_Create_EmptyResults tests handling of empty results from storage
func TestFacetQueryStorage_Create_EmptyResults(t *testing.T) {
	mock := &mockFacetStorage{
		queryFunc: func(ctx context.Context, spec storage.FacetQuerySpec, scope storage.ScopeContext) (*storage.FacetQueryResult, error) {
			return &storage.FacetQueryResult{
				Facets: []storage.FacetFieldResult{
					{Field: "spec.actor.name", Values: []storage.FacetValueResult{}},
				},
			}, nil
		},
	}
	s := NewFacetQueryStorage(mock)

	query := &v1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: v1alpha1.ActivityFacetQuerySpec{
			Facets: []v1alpha1.FacetSpec{
				{Field: "spec.actor.name"},
			},
		},
	}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	result, err := s.Create(ctx, query, nil, nil)
	if err != nil {
		t.Fatalf("Create() error = %v, want nil", err)
	}

	resultQuery := result.(*v1alpha1.ActivityFacetQuery)

	if len(resultQuery.Status.Facets) != 1 {
		t.Fatalf("Status.Facets has %d items, want 1", len(resultQuery.Status.Facets))
	}
	if len(resultQuery.Status.Facets[0].Values) != 0 {
		t.Errorf("Facets[0].Values has %d items, want 0", len(resultQuery.Status.Facets[0].Values))
	}
}
