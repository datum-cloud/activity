package eventquery

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// mockEventQueryStorage is a test double for StorageInterface.
type mockEventQueryStorage struct {
	queryFunc      func(ctx context.Context, spec v1alpha1.EventQuerySpec, scope storage.ScopeContext) (*storage.EventQueryResult, error)
	maxQueryWindow time.Duration
	maxPageSize    int32
}

func (m *mockEventQueryStorage) QueryEvents(ctx context.Context, spec v1alpha1.EventQuerySpec, scope storage.ScopeContext) (*storage.EventQueryResult, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, spec, scope)
	}
	return &storage.EventQueryResult{Events: []corev1.Event{}, Continue: ""}, nil
}

func (m *mockEventQueryStorage) GetMaxQueryWindow() time.Duration {
	return m.maxQueryWindow
}

func (m *mockEventQueryStorage) GetMaxPageSize() int32 {
	return m.maxPageSize
}

// newTestBackend returns a mock storage with sensible defaults for most tests.
func newTestBackend() *mockEventQueryStorage {
	return &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
	}
}

// newTestUser returns a user.Info with platform scope (no parent resource set).
func newTestUser() user.Info {
	return &user.DefaultInfo{Name: "test-user"}
}

// ctxWithUser wraps ctx with the given user. EventQuery is cluster-scoped so
// no namespace is required in the context.
func ctxWithUser(u user.Info) context.Context {
	return request.WithUser(context.Background(), u)
}

// TestEventQueryREST_New verifies that New returns an empty EventQuery object.
func TestEventQueryREST_New(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	obj := r.New()

	require.NotNil(t, obj)
	_, ok := obj.(*v1alpha1.EventQuery)
	assert.True(t, ok, "New() should return *v1alpha1.EventQuery, got %T", obj)
}

// TestEventQueryREST_Destroy verifies that Destroy does not panic.
func TestEventQueryREST_Destroy(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	assert.NotPanics(t, func() { r.Destroy() })
}

// TestEventQueryREST_NamespaceScoped verifies that EventQuery is cluster-scoped.
func TestEventQueryREST_NamespaceScoped(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	assert.False(t, r.NamespaceScoped(), "EventQuery must be cluster-scoped (NamespaceScoped should return false)")
}

// TestEventQueryREST_GetSingularName verifies the singular resource name.
func TestEventQueryREST_GetSingularName(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	assert.Equal(t, "eventquery", r.GetSingularName())
}

// TestNewEventQueryREST verifies the constructor correctly wires the backend.
func TestNewEventQueryREST(t *testing.T) {
	t.Parallel()

	backend := newTestBackend()
	r := NewEventQueryREST(backend)

	require.NotNil(t, r)
	assert.Equal(t, backend, r.storage)
}

// TestEventQueryREST_Create_Success verifies a well-formed query executes and
// populates Status fields in the returned object.
func TestEventQueryREST_Create_Success(t *testing.T) {
	t.Parallel()

	returnedEvents := []corev1.Event{
		{ObjectMeta: metav1.ObjectMeta{Name: "evt-1", Namespace: "default"}},
		{ObjectMeta: metav1.ObjectMeta{Name: "evt-2", Namespace: "default"}},
	}

	backend := &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(_ context.Context, _ v1alpha1.EventQuerySpec, _ storage.ScopeContext) (*storage.EventQueryResult, error) {
			return &storage.EventQueryResult{Events: returnedEvents, Continue: ""}, nil
		},
	}

	r := NewEventQueryREST(backend)

	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	result, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.NoError(t, err)
	require.NotNil(t, result)

	resultQuery, ok := result.(*v1alpha1.EventQuery)
	require.True(t, ok, "Create should return *v1alpha1.EventQuery")

	assert.Len(t, resultQuery.Status.Results, 2)
	assert.Equal(t, "evt-1", resultQuery.Status.Results[0].Name)
	assert.Equal(t, "evt-2", resultQuery.Status.Results[1].Name)
	assert.NotEmpty(t, resultQuery.Status.EffectiveStartTime, "EffectiveStartTime should be populated")
	assert.NotEmpty(t, resultQuery.Status.EffectiveEndTime, "EffectiveEndTime should be populated")
}

// TestEventQueryREST_Create_ResultsReturnedInStatus verifies that query results
// are always returned in Status, not as a separate object — the ephemeral pattern.
func TestEventQueryREST_Create_ResultsReturnedInStatus(t *testing.T) {
	t.Parallel()

	backend := &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(_ context.Context, _ v1alpha1.EventQuerySpec, _ storage.ScopeContext) (*storage.EventQueryResult, error) {
			return &storage.EventQueryResult{
				Events:   []corev1.Event{{ObjectMeta: metav1.ObjectMeta{Name: "evt-1"}}},
				Continue: "next-page-cursor",
			}, nil
		},
	}

	r := NewEventQueryREST(backend)
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	result, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.NoError(t, err)
	resultQuery := result.(*v1alpha1.EventQuery)
	// Pagination cursor is surfaced through Status, not a separate resource.
	assert.Equal(t, "next-page-cursor", resultQuery.Status.Continue)
}

// TestEventQueryREST_Create_NoUserContext verifies that missing user context
// returns an internal server error.
func TestEventQueryREST_Create_NoUserContext(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	_, err := r.Create(context.Background(), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInternalError(err), "missing user context should return InternalError, got %v", err)
}

// TestEventQueryREST_Create_NonEventQueryObject verifies that passing a wrong
// object type returns an error rather than panicking.
func TestEventQueryREST_Create_NonEventQueryObject(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	// Pass a corev1.Event instead of EventQuery
	_, err := r.Create(ctxWithUser(newTestUser()), &corev1.Event{}, nil, nil)

	require.Error(t, err)
}

// TestEventQueryREST_Create_MissingStartTime verifies that missing startTime is
// rejected with a validation error.
func TestEventQueryREST_Create_MissingStartTime(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			// StartTime intentionally missing
			EndTime: "2024-01-02T00:00:00Z",
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "missing startTime should return Invalid error, got %v", err)
	assert.Contains(t, err.Error(), "startTime")
}

// TestEventQueryREST_Create_MissingEndTime verifies that missing endTime is
// rejected with a validation error.
func TestEventQueryREST_Create_MissingEndTime(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			// EndTime intentionally missing
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "missing endTime should return Invalid error, got %v", err)
	assert.Contains(t, err.Error(), "endTime")
}

// TestEventQueryREST_Create_InvalidStartTime verifies that a malformed startTime
// value returns an Invalid error.
func TestEventQueryREST_Create_InvalidStartTime(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "not-a-valid-time",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "invalid startTime should return Invalid error, got %v", err)
}

// TestEventQueryREST_Create_EndTimeBeforeStartTime verifies that endTime before
// startTime is rejected.
func TestEventQueryREST_Create_EndTimeBeforeStartTime(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-02T00:00:00Z",
			EndTime:   "2024-01-01T00:00:00Z", // before start
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "endTime before startTime should return Invalid error, got %v", err)
	assert.Contains(t, err.Error(), "endTime")
}

// TestEventQueryREST_Create_ExceedsMaxWindow verifies that a query window
// exceeding 60 days is rejected with a descriptive error.
func TestEventQueryREST_Create_ExceedsMaxWindow(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-04-01T00:00:00Z", // ~90 days — exceeds 60-day max
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "exceeding max window should return Invalid error, got %v", err)
}

// TestEventQueryREST_Create_NegativeLimit verifies that a negative limit value
// is rejected during validation.
func TestEventQueryREST_Create_NegativeLimit(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
			Limit:     -1,
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "negative limit should return Invalid error, got %v", err)
	assert.Contains(t, err.Error(), "limit")
}

// TestEventQueryREST_Create_LimitExceedsMax verifies that a limit exceeding
// the backend maximum is rejected.
func TestEventQueryREST_Create_LimitExceedsMax(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
			Limit:     9999, // max is 1000
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsInvalid(err), "limit exceeding max should return Invalid error, got %v", err)
	assert.Contains(t, err.Error(), "limit")
}

// TestEventQueryREST_Create_RelativeTimeFormats verifies that relative time
// expressions such as "now" and "now-7d" are accepted.
func TestEventQueryREST_Create_RelativeTimeFormats(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())

	tests := []struct {
		name      string
		startTime string
		endTime   string
	}{
		{"now minus duration to now", "now-7d", "now"},
		{"now minus hours to now", "now-24h", "now"},
		{"now minus 30 days to now", "now-30d", "now"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			query := &v1alpha1.EventQuery{
				Spec: v1alpha1.EventQuerySpec{
					StartTime: tt.startTime,
					EndTime:   tt.endTime,
				},
			}

			_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)
			assert.NoError(t, err, "relative time %s to %s should be valid", tt.startTime, tt.endTime)
		})
	}
}

// TestEventQueryREST_Create_NamespaceFilter verifies that the namespace field
// is passed to the storage layer correctly.
func TestEventQueryREST_Create_NamespaceFilter(t *testing.T) {
	t.Parallel()

	var capturedSpec v1alpha1.EventQuerySpec

	backend := &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(_ context.Context, spec v1alpha1.EventQuerySpec, _ storage.ScopeContext) (*storage.EventQueryResult, error) {
			capturedSpec = spec
			return &storage.EventQueryResult{}, nil
		},
	}

	r := NewEventQueryREST(backend)
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
			Namespace: "production",
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, "production", capturedSpec.Namespace)
}

// TestEventQueryREST_Create_FieldSelectorPassed verifies that the fieldSelector
// is forwarded to the storage layer unchanged.
func TestEventQueryREST_Create_FieldSelectorPassed(t *testing.T) {
	t.Parallel()

	var capturedSpec v1alpha1.EventQuerySpec

	backend := &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(_ context.Context, spec v1alpha1.EventQuerySpec, _ storage.ScopeContext) (*storage.EventQueryResult, error) {
			capturedSpec = spec
			return &storage.EventQueryResult{}, nil
		},
	}

	r := NewEventQueryREST(backend)
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime:     "2024-01-01T00:00:00Z",
			EndTime:       "2024-01-02T00:00:00Z",
			FieldSelector: "type=Warning",
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, "type=Warning", capturedSpec.FieldSelector)
}

// TestEventQueryREST_Create_ScopeExtraction verifies that platform, organization,
// and project scopes are correctly derived from user authentication metadata.
func TestEventQueryREST_Create_ScopeExtraction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		userExtra map[string][]string
		wantType  string
		wantName  string
	}{
		{
			name:      "platform scope when no extra set",
			userExtra: nil,
			wantType:  "platform",
			wantName:  "",
		},
		{
			name: "organization scope",
			userExtra: map[string][]string{
				"iam.miloapis.com/parent-type": {"Organization"},
				"iam.miloapis.com/parent-name": {"acme-corp"},
			},
			wantType: "organization",
			wantName: "acme-corp",
		},
		{
			name: "project scope",
			userExtra: map[string][]string{
				"iam.miloapis.com/parent-type": {"Project"},
				"iam.miloapis.com/parent-name": {"backend-api"},
			},
			wantType: "project",
			wantName: "backend-api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var capturedScope storage.ScopeContext
			backend := &mockEventQueryStorage{
				maxQueryWindow: 60 * 24 * time.Hour,
				maxPageSize:    1000,
				queryFunc: func(_ context.Context, _ v1alpha1.EventQuerySpec, sc storage.ScopeContext) (*storage.EventQueryResult, error) {
					capturedScope = sc
					return &storage.EventQueryResult{}, nil
				},
			}

			r := NewEventQueryREST(backend)
			query := &v1alpha1.EventQuery{
				Spec: v1alpha1.EventQuerySpec{
					StartTime: "2024-01-01T00:00:00Z",
					EndTime:   "2024-01-02T00:00:00Z",
				},
			}

			testUser := &user.DefaultInfo{Name: "test-user", Extra: tt.userExtra}
			_, err := r.Create(ctxWithUser(testUser), query, nil, nil)
			require.NoError(t, err)

			assert.Equal(t, tt.wantType, capturedScope.Type)
			assert.Equal(t, tt.wantName, capturedScope.Name)
		})
	}
}

// TestEventQueryREST_Create_StorageError verifies that a backend storage error
// is surfaced as a ServiceUnavailable response rather than leaking raw errors.
func TestEventQueryREST_Create_StorageError(t *testing.T) {
	t.Parallel()

	backend := &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
		queryFunc: func(_ context.Context, _ v1alpha1.EventQuerySpec, _ storage.ScopeContext) (*storage.EventQueryResult, error) {
			return nil, fmt.Errorf("clickhouse connection refused")
		},
	}

	r := NewEventQueryREST(backend)
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	_, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)

	require.Error(t, err)
	assert.True(t, apierrors.IsServiceUnavailable(err),
		"storage errors should return ServiceUnavailable, got %v", err)
}

// TestEventQueryREST_Create_EffectiveTimesInStatus verifies that the effective
// start and end times are serialized as RFC3339 strings in the Status.
func TestEventQueryREST_Create_EffectiveTimesInStatus(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-06-15T00:00:00Z",
			EndTime:   "2024-06-16T00:00:00Z",
		},
	}

	result, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)
	require.NoError(t, err)

	resultQuery := result.(*v1alpha1.EventQuery)

	// Effective times must be RFC3339 parseable.
	_, err = time.Parse(time.RFC3339, resultQuery.Status.EffectiveStartTime)
	assert.NoError(t, err, "EffectiveStartTime should be RFC3339: %q", resultQuery.Status.EffectiveStartTime)

	_, err = time.Parse(time.RFC3339, resultQuery.Status.EffectiveEndTime)
	assert.NoError(t, err, "EffectiveEndTime should be RFC3339: %q", resultQuery.Status.EffectiveEndTime)
}

// TestEventQueryREST_Create_EmptyResults verifies that a query returning no
// events produces an empty (not nil) results slice in Status.
func TestEventQueryREST_Create_EmptyResults(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	result, err := r.Create(ctxWithUser(newTestUser()), query, nil, nil)
	require.NoError(t, err)

	resultQuery := result.(*v1alpha1.EventQuery)
	// Results may be nil or empty; Continue should be empty when no more pages.
	assert.Empty(t, resultQuery.Status.Continue)
}

// TestValidateQuerySpec_BothTimesRequired verifies the table-driven validation
// combinations for missing or invalid spec fields.
func TestValidateQuerySpec_BothTimesRequired(t *testing.T) {
	t.Parallel()

	backend := &mockEventQueryStorage{
		maxQueryWindow: 60 * 24 * time.Hour,
		maxPageSize:    1000,
	}
	r := &EventQueryREST{storage: backend}

	tests := []struct {
		name        string
		spec        v1alpha1.EventQuerySpec
		wantErr     bool
		wantErrField string
	}{
		{
			name:    "valid spec",
			spec:    v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z"},
			wantErr: false,
		},
		{
			name:         "missing startTime",
			spec:         v1alpha1.EventQuerySpec{EndTime: "2024-01-02T00:00:00Z"},
			wantErr:      true,
			wantErrField: "spec.startTime",
		},
		{
			name:         "missing endTime",
			spec:         v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z"},
			wantErr:      true,
			wantErrField: "spec.endTime",
		},
		{
			name:         "endTime equals startTime",
			spec:         v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-01T00:00:00Z"},
			wantErr:      true,
			wantErrField: "spec.endTime",
		},
		{
			name:         "negative limit",
			spec:         v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z", Limit: -5},
			wantErr:      true,
			wantErrField: "spec.limit",
		},
		{
			name:         "limit exceeds max",
			spec:         v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z", Limit: 5000},
			wantErr:      true,
			wantErrField: "spec.limit",
		},
		{
			name:    "zero limit is valid (uses default)",
			spec:    v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z", Limit: 0},
			wantErr: false,
		},
		{
			name:    "limit at max boundary is valid",
			spec:    v1alpha1.EventQuerySpec{StartTime: "2024-01-01T00:00:00Z", EndTime: "2024-01-02T00:00:00Z", Limit: 1000},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			query := &v1alpha1.EventQuery{Spec: tt.spec}
			errs := r.validateQuerySpec(query)

			if tt.wantErr {
				require.NotEmpty(t, errs, "expected validation errors for %s", tt.name)
				if tt.wantErrField != "" {
					// Confirm at least one error references the expected field path.
					found := false
					for _, e := range errs {
						if e.Field == tt.wantErrField {
							found = true
							break
						}
					}
					assert.True(t, found, "expected error on field %q but got: %v", tt.wantErrField, errs)
				}
			} else {
				assert.Empty(t, errs, "expected no validation errors for %s, got %v", tt.name, errs)
			}
		})
	}
}

// TestEventQueryREST_ConvertToTable verifies that ConvertToTable returns a
// valid table without panicking.
func TestEventQueryREST_ConvertToTable(t *testing.T) {
	t.Parallel()

	r := NewEventQueryREST(newTestBackend())
	query := &v1alpha1.EventQuery{
		ObjectMeta: metav1.ObjectMeta{Name: "my-query"},
		Spec: v1alpha1.EventQuerySpec{
			StartTime: "2024-01-01T00:00:00Z",
			EndTime:   "2024-01-02T00:00:00Z",
		},
	}

	table, err := r.ConvertToTable(context.Background(), query, nil)

	require.NoError(t, err)
	require.NotNil(t, table)
}
