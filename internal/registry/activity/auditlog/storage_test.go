package auditlog

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"

	"go.miloapis.com/activity/internal/registry/scope"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// mockStorageInterface is a test double for StorageInterface
type mockStorageInterface struct {
	queryFunc       func(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error)
	maxQueryWindow  time.Duration
	maxPageSize     int32
}

func (m *mockStorageInterface) QueryAuditLogs(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, spec, scope)
	}
	return &storage.QueryResult{
		Events:        []auditv1.Event{},
		Continue: "",
	}, nil
}

func (m *mockStorageInterface) GetMaxQueryWindow() time.Duration {
	return m.maxQueryWindow
}

func (m *mockStorageInterface) GetMaxPageSize() int32 {
	return m.maxPageSize
}

// TestQueryStorage_RESTInterface verifies the REST interface contracts
func TestQueryStorage_RESTInterface(t *testing.T) {
	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
	}
	qs := &QueryStorage{storage: mockStorage}

	t.Run("New returns empty AuditLogQuery", func(t *testing.T) {
		obj := qs.New()
		query, ok := obj.(*v1alpha1.AuditLogQuery)
		if !ok {
			t.Errorf("New() returned %T, want *v1alpha1.AuditLogQuery", obj)
		}
		if query == nil {
			t.Error("New() returned nil")
		}
	})

	t.Run("NamespaceScoped returns false", func(t *testing.T) {
		if qs.NamespaceScoped() {
			t.Error("NamespaceScoped() = true, want false")
		}
	})

	t.Run("GetSingularName returns correct value", func(t *testing.T) {
		want := "auditlogquery"
		if got := qs.GetSingularName(); got != want {
			t.Errorf("GetSingularName() = %q, want %q", got, want)
		}
	})

	t.Run("Destroy doesn't panic", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Destroy() panicked: %v", r)
			}
		}()
		qs.Destroy()
	})
}

// TestQueryStorage_Create_Success tests successful query execution through the public API
func TestQueryStorage_Create_Success(t *testing.T) {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)

	mockEvents := []auditv1.Event{
		{
			AuditID: "test-audit-1",
			Verb:    "delete",
		},
		{
			AuditID: "test-audit-2",
			Verb:    "create",
		},
	}

	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error) {
			return &storage.QueryResult{
				Events:        mockEvents,
				Continue: "next-page-token",
			}, nil
		},
	}
	qs := &QueryStorage{storage: mockStorage}

	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-query",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: yesterday.Format(time.RFC3339),
			EndTime:   now.Format(time.RFC3339),
			Filter:    "verb == 'delete'",
			Limit:     100,
		},
	}

	// Create context with authenticated user
	testUser := &user.DefaultInfo{
		Name: "test-user",
		Extra: map[string][]string{
			scope.ParentKindExtraKey: {"Organization"},
			scope.ParentNameExtraKey: {"test-org"},
		},
	}
	ctx := request.WithUser(context.Background(), testUser)

	result, err := qs.Create(ctx, query, nil, nil)
	if err != nil {
		t.Fatalf("Create() error = %v, want nil", err)
	}

	resultQuery, ok := result.(*v1alpha1.AuditLogQuery)
	if !ok {
		t.Fatalf("Create() returned %T, want *v1alpha1.AuditLogQuery", result)
	}

	// Verify results were populated
	if len(resultQuery.Status.Results) != len(mockEvents) {
		t.Errorf("Status.Results has %d events, want %d", len(resultQuery.Status.Results), len(mockEvents))
	}

	if resultQuery.Status.Continue != "next-page-token" {
		t.Errorf("Status.Continue = %q, want %q", resultQuery.Status.Continue, "next-page-token")
	}

	// Verify effective timestamps are populated
	if resultQuery.Status.EffectiveStartTime == "" {
		t.Error("Status.EffectiveStartTime is empty, want populated timestamp")
	}
	if resultQuery.Status.EffectiveEndTime == "" {
		t.Error("Status.EffectiveEndTime is empty, want populated timestamp")
	}

	// Verify effective timestamps match the input (since we used absolute timestamps)
	if resultQuery.Status.EffectiveStartTime != query.Spec.StartTime {
		t.Errorf("Status.EffectiveStartTime = %q, want %q", resultQuery.Status.EffectiveStartTime, query.Spec.StartTime)
	}
	if resultQuery.Status.EffectiveEndTime != query.Spec.EndTime {
		t.Errorf("Status.EffectiveEndTime = %q, want %q", resultQuery.Status.EffectiveEndTime, query.Spec.EndTime)
	}
}

// TestQueryStorage_Create_ScopeExtraction tests that scope is properly extracted from user context
func TestQueryStorage_Create_ScopeExtraction(t *testing.T) {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)

	var capturedScope storage.ScopeContext

	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error) {
			capturedScope = scope
			return &storage.QueryResult{Events: []auditv1.Event{}}, nil
		},
	}
	qs := &QueryStorage{storage: mockStorage}

	tests := []struct {
		name      string
		user      user.Info
		wantType  string
		wantName  string
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
			capturedScope = storage.ScopeContext{Type: "", Name: ""} // Reset

			query := &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "scope-test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: yesterday.Format(time.RFC3339),
					EndTime:   now.Format(time.RFC3339),
					Limit:     10,
				},
			}

			ctx := request.WithUser(context.Background(), tt.user)
			_, err := qs.Create(ctx, query, nil, nil)
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

// TestQueryStorage_Create_ValidationErrors tests validation errors through the public API
func TestQueryStorage_Create_ValidationErrors(t *testing.T) {
	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
	}
	qs := &QueryStorage{storage: mockStorage}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	tests := []struct {
		name      string
		query     *v1alpha1.AuditLogQuery
		wantError string
	}{
		{
			name: "missing startTime",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					EndTime: "now",
				},
			},
			wantError: "must specify a start time",
		},
		{
			name: "missing endTime",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-7d",
				},
			},
			wantError: "must specify an end time",
		},
		{
			name: "invalid startTime format",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "2024/01/01",
					EndTime:   "now",
				},
			},
			wantError: "invalid time format",
		},
		{
			name: "invalid endTime format",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-7d",
					EndTime:   "invalid",
				},
			},
			wantError: "invalid time format",
		},
		{
			name: "endTime before startTime",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "2024-01-02T00:00:00Z",
					EndTime:   "2024-01-01T00:00:00Z",
				},
			},
			wantError: "endTime must be after startTime",
		},
		{
			name: "same startTime and endTime",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "2024-01-01T00:00:00Z",
					EndTime:   "2024-01-01T00:00:00Z",
				},
			},
			wantError: "endTime must be after startTime",
		},
		{
			name: "time range exceeds maximum",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "2024-01-01T00:00:00Z",
					EndTime:   "2024-01-09T00:00:00Z", // 8 days > 7 day max
				},
			},
			wantError: "time range of",
		},
		{
			name: "negative limit",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Limit:     -10,
				},
			},
			wantError: "limit must be non-negative",
		},
		{
			name: "limit exceeds maximum",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Limit:     2000, // > 1000 max
				},
			},
			wantError: "limit of 2000 exceeds maximum of 1000",
		},
		{
			name: "invalid cursor format",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime:     "now-1h",
					EndTime:       "now",
					Limit:         100,
					Continue: "invalid-cursor!@#$",
				},
			},
			wantError: "cannot decode pagination cursor",
		},
		{
			name: "invalid CEL filter syntax",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    "verb === 'delete'", // invalid syntax (triple equals)
				},
			},
			wantError: "Invalid filter", // Friendly error message
		},
		{
			name: "invalid CEL field access",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    "nonexistentField == 'value'",
				},
			},
			wantError: "undeclared reference",
		},
		{
			name: "CEL field without dot notation",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    "user == 'admin'", // should be user.username
				},
			},
			wantError: "found no matching overload",
		},
		{
			name: "CEL filter with wrong return type",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    "verb", // returns string, not boolean
				},
			},
			wantError: "filter expression must return a boolean",
		},
		{
			name: "invalid field name on objectRef (plural instead of singular)",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    `objectRef.resources == "domains"`, // should be objectRef.resource (singular)
				},
			},
			wantError: "field 'objectRef.resources' is not available for filtering",
		},
		{
			name: "invalid field name on user",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    `user.name == "admin"`, // should be user.username
				},
			},
			wantError: "field 'user.name' is not available for filtering",
		},
		{
			name: "invalid field name on responseStatus",
			query: &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: "now-1h",
					EndTime:   "now",
					Filter:    `responseStatus.status == 200`, // should be responseStatus.code
				},
			},
			wantError: "field 'responseStatus.status' is not available for filtering",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := qs.Create(ctx, tt.query, nil, nil)

			if err == nil {
				t.Fatal("Create() error = nil, want error")
			}

			// Should return Invalid status error
			statusErr, ok := err.(*apierrors.StatusError)
			if !ok {
				t.Fatalf("Create() returned %T, want *apierrors.StatusError", err)
			}

			if statusErr.ErrStatus.Code != 422 {
				t.Errorf("Status code = %d, want 422", statusErr.ErrStatus.Code)
			}

			if string(statusErr.ErrStatus.Reason) != "Invalid" {
				t.Errorf("Reason = %q, want %q", statusErr.ErrStatus.Reason, "Invalid")
			}

			errStr := err.Error()
			if !strings.Contains(errStr, tt.wantError) {
				t.Errorf("Error message %q doesn't contain %q", errStr, tt.wantError)
			}
		})
	}
}

// TestQueryStorage_Create_StorageErrors tests error handling from the storage layer.
// CEL validation errors are now caught at the API layer, so storage errors should
// only be runtime database errors.
func TestQueryStorage_Create_StorageErrors(t *testing.T) {
	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)

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
			wantContains: "Failed to execute query",
		},
		{
			name:         "query timeout",
			storageError: fmt.Errorf("context deadline exceeded"),
			wantStatus:   503,
			wantContains: "Failed to execute query",
		},
		{
			name:         "clickhouse error",
			storageError: fmt.Errorf("clickhouse: table not found"),
			wantStatus:   503,
			wantContains: "Failed to execute query",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStorage := &mockStorageInterface{
				maxQueryWindow: 7 * 24 * time.Hour,
				maxPageSize:    1000,
				queryFunc: func(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error) {
					return nil, tt.storageError
				},
			}
			qs := &QueryStorage{storage: mockStorage}

			query := &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: yesterday.Format(time.RFC3339),
					EndTime:   now.Format(time.RFC3339),
					Filter:    "verb == 'delete'",
					Limit:     100,
				},
			}

			_, err := qs.Create(ctx, query, nil, nil)

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

// TestQueryStorage_Create_NoUserContext tests that missing user context returns error
func TestQueryStorage_Create_NoUserContext(t *testing.T) {
	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
	}
	qs := &QueryStorage{storage: mockStorage}

	now := time.Now()
	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: "now-1h",
			EndTime:   now.Format(time.RFC3339),
		},
	}

	// Create without user context
	_, err := qs.Create(context.Background(), query, nil, nil)

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

// TestQueryStorage_Create_WrongObjectType tests that non-AuditLogQuery objects are rejected
func TestQueryStorage_Create_WrongObjectType(t *testing.T) {
	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
	}
	qs := &QueryStorage{storage: mockStorage}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	// Pass wrong object type
	wrongObj := &v1alpha1.AuditLogQueryList{}
	_, err := qs.Create(ctx, wrongObj, nil, nil)

	if err == nil {
		t.Fatal("Create() error = nil, want error")
	}

	if !strings.Contains(err.Error(), "not an AuditLogQuery") {
		t.Errorf("Error message %q should contain 'not an AuditLogQuery'", err.Error())
	}
}

// TestQueryStorage_Create_CursorValidation tests cursor validation at the API layer
func TestQueryStorage_Create_CursorValidation(t *testing.T) {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)

	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
	}
	qs := &QueryStorage{storage: mockStorage}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	tests := []struct {
		name      string
		cursor    string
		wantError string
	}{
		{
			name:      "invalid base64 cursor",
			cursor:    "not-valid-base64!@#$",
			wantError: "cannot decode pagination cursor",
		},
		{
			name:      "invalid JSON cursor",
			cursor:    "aW52YWxpZGpzb24=", // base64("invalidjson")
			wantError: "cursor format is invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime:     yesterday.Format(time.RFC3339),
					EndTime:       now.Format(time.RFC3339),
					Limit:         100,
					Continue: tt.cursor,
				},
			}

			_, err := qs.Create(ctx, query, nil, nil)

			if err == nil {
				t.Fatal("Create() error = nil, want error")
			}

			// Should return Invalid status error (422)
			statusErr, ok := err.(*apierrors.StatusError)
			if !ok {
				t.Fatalf("Create() returned %T, want *apierrors.StatusError", err)
			}

			if statusErr.ErrStatus.Code != 422 {
				t.Errorf("Status code = %d, want 422", statusErr.ErrStatus.Code)
			}

			if string(statusErr.ErrStatus.Reason) != "Invalid" {
				t.Errorf("Reason = %q, want %q", statusErr.ErrStatus.Reason, "Invalid")
			}

			errStr := err.Error()
			if !strings.Contains(errStr, tt.wantError) {
				t.Errorf("Error message %q doesn't contain %q", errStr, tt.wantError)
			}

			// Verify the error is on the continue field
			if !strings.Contains(errStr, "continue") {
				t.Errorf("Error should reference 'continue' field, got: %s", errStr)
			}
		})
	}
}

// TestQueryStorage_Create_RelativeTimeFormats tests various relative time formats
func TestQueryStorage_Create_RelativeTimeFormats(t *testing.T) {
	mockStorage := &mockStorageInterface{
		maxQueryWindow: 7 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error) {
			return &storage.QueryResult{Events: []auditv1.Event{}}, nil
		},
	}
	qs := &QueryStorage{storage: mockStorage}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	tests := []struct {
		name      string
		startTime string
		endTime   string
		wantValid bool
	}{
		{
			name:      "relative times with days",
			startTime: "now-6d",
			endTime:   "now",
			wantValid: true,
		},
		{
			name:      "relative times with hours",
			startTime: "now-24h",
			endTime:   "now",
			wantValid: true,
		},
		{
			name:      "relative times with minutes",
			startTime: "now-30m",
			endTime:   "now",
			wantValid: true,
		},
		{
			name:      "mixed RFC3339 and relative",
			startTime: "now-48h",
			endTime:   "now",
			wantValid: true,
		},
		{
			name:      "both RFC3339",
			startTime: "2024-01-01T00:00:00Z",
			endTime:   "2024-01-02T00:00:00Z",
			wantValid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: tt.startTime,
					EndTime:   tt.endTime,
					Limit:     100,
				},
			}

			_, err := qs.Create(ctx, query, nil, nil)

			if tt.wantValid && err != nil {
				t.Errorf("Create() error = %v, want nil", err)
			}
			if !tt.wantValid && err == nil {
				t.Error("Create() error = nil, want error")
			}
		})
	}
}

// TestQueryStorage_Create_EffectiveTimestamps tests that effective timestamps are correctly populated
func TestQueryStorage_Create_EffectiveTimestamps(t *testing.T) {
	mockStorage := &mockStorageInterface{
		maxQueryWindow: 30 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope storage.ScopeContext) (*storage.QueryResult, error) {
			return &storage.QueryResult{Events: []auditv1.Event{}}, nil
		},
	}
	qs := &QueryStorage{storage: mockStorage}

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	tests := []struct {
		name      string
		startTime string
		endTime   string
		checkFunc func(t *testing.T, query *v1alpha1.AuditLogQuery)
	}{
		{
			name:      "relative times - both relative",
			startTime: "now-7d",
			endTime:   "now",
			checkFunc: func(t *testing.T, query *v1alpha1.AuditLogQuery) {
				// Should have RFC3339 formatted timestamps
				if query.Status.EffectiveStartTime == "" {
					t.Error("EffectiveStartTime is empty")
				}
				if query.Status.EffectiveEndTime == "" {
					t.Error("EffectiveEndTime is empty")
				}

				// Parse to verify they're valid RFC3339
				startTime, err := time.Parse(time.RFC3339, query.Status.EffectiveStartTime)
				if err != nil {
					t.Errorf("EffectiveStartTime is not valid RFC3339: %v", err)
				}
				endTime, err := time.Parse(time.RFC3339, query.Status.EffectiveEndTime)
				if err != nil {
					t.Errorf("EffectiveEndTime is not valid RFC3339: %v", err)
				}

				// Verify the time range is approximately 7 days
				duration := endTime.Sub(startTime)
				expectedDuration := 7 * 24 * time.Hour
				// Allow 1 second tolerance for test execution time
				if duration < expectedDuration-time.Second || duration > expectedDuration+time.Second {
					t.Errorf("Time range = %v, want ~%v", duration, expectedDuration)
				}

				// Verify endTime is very close to now (within 1 second)
				now := time.Now()
				timeDiff := now.Sub(endTime)
				if timeDiff < 0 {
					timeDiff = -timeDiff
				}
				if timeDiff > time.Second {
					t.Errorf("EffectiveEndTime is %v away from now, expected < 1s", timeDiff)
				}
			},
		},
		{
			name:      "absolute times - both absolute",
			startTime: "2024-01-01T00:00:00Z",
			endTime:   "2024-01-02T00:00:00Z",
			checkFunc: func(t *testing.T, query *v1alpha1.AuditLogQuery) {
				// Should match exactly
				if query.Status.EffectiveStartTime != "2024-01-01T00:00:00Z" {
					t.Errorf("EffectiveStartTime = %q, want %q", query.Status.EffectiveStartTime, "2024-01-01T00:00:00Z")
				}
				if query.Status.EffectiveEndTime != "2024-01-02T00:00:00Z" {
					t.Errorf("EffectiveEndTime = %q, want %q", query.Status.EffectiveEndTime, "2024-01-02T00:00:00Z")
				}
			},
		},
		{
			name:      "mixed times - relative start, relative end",
			startTime: "now-48h",
			endTime:   "now-24h",
			checkFunc: func(t *testing.T, query *v1alpha1.AuditLogQuery) {
				// EffectiveStartTime should be RFC3339 formatted (from relative time)
				if query.Status.EffectiveStartTime == "" {
					t.Error("EffectiveStartTime is empty")
				}
				startTime, err := time.Parse(time.RFC3339, query.Status.EffectiveStartTime)
				if err != nil {
					t.Errorf("EffectiveStartTime is not valid RFC3339: %v", err)
				}

				// Should be approximately 48 hours before now
				now := time.Now()
				duration := now.Sub(startTime)
				expectedDuration := 48 * time.Hour
				if duration < expectedDuration-time.Second || duration > expectedDuration+time.Second {
					t.Errorf("Time from start to now = %v, want ~%v", duration, expectedDuration)
				}

				// EffectiveEndTime should be RFC3339 formatted (from relative time)
				if query.Status.EffectiveEndTime == "" {
					t.Error("EffectiveEndTime is empty")
				}
				endTime, err := time.Parse(time.RFC3339, query.Status.EffectiveEndTime)
				if err != nil {
					t.Errorf("EffectiveEndTime is not valid RFC3339: %v", err)
				}

				// Should be approximately 24 hours before now
				duration = now.Sub(endTime)
				expectedDuration = 24 * time.Hour
				if duration < expectedDuration-time.Second || duration > expectedDuration+time.Second {
					t.Errorf("Time from end to now = %v, want ~%v", duration, expectedDuration)
				}

				// Verify startTime is before endTime
				if !startTime.Before(endTime) {
					t.Errorf("startTime %v should be before endTime %v", startTime, endTime)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &v1alpha1.AuditLogQuery{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: v1alpha1.AuditLogQuerySpec{
					StartTime: tt.startTime,
					EndTime:   tt.endTime,
				},
			}

			result, err := qs.Create(ctx, query, nil, nil)
			if err != nil {
				t.Fatalf("Create() error = %v, want nil", err)
			}

			resultQuery := result.(*v1alpha1.AuditLogQuery)
			tt.checkFunc(t, resultQuery)
		})
	}
}
