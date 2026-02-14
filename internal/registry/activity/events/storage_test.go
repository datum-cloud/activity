package events

import (
	"context"
	"fmt"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

	"go.miloapis.com/activity/internal/storage"
)

// mockEventsBackend is a test double for EventsBackend
type mockEventsBackend struct {
	createFunc func(ctx context.Context, event *corev1.Event, scope storage.ScopeContext) (*corev1.Event, error)
	getFunc    func(ctx context.Context, namespace, name string, scope storage.ScopeContext) (*corev1.Event, error)
	listFunc   func(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (*corev1.EventList, error)
	updateFunc func(ctx context.Context, event *corev1.Event, scope storage.ScopeContext) (*corev1.Event, error)
	deleteFunc func(ctx context.Context, namespace, name string, scope storage.ScopeContext) error
	watchFunc  func(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (watch.Interface, error)
}

func (m *mockEventsBackend) Create(ctx context.Context, event *corev1.Event, scope storage.ScopeContext) (*corev1.Event, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, event, scope)
	}
	event.ResourceVersion = "12345"
	event.UID = types.UID("test-uid")
	return event, nil
}

func (m *mockEventsBackend) Get(ctx context.Context, namespace, name string, scope storage.ScopeContext) (*corev1.Event, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, namespace, name, scope)
	}
	return &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:       namespace,
			Name:            name,
			UID:             "test-uid",
			ResourceVersion: "12345",
		},
	}, nil
}

func (m *mockEventsBackend) List(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (*corev1.EventList, error) {
	if m.listFunc != nil {
		return m.listFunc(ctx, namespace, opts, scope)
	}
	return &corev1.EventList{
		Items: []corev1.Event{},
	}, nil
}

func (m *mockEventsBackend) Update(ctx context.Context, event *corev1.Event, scope storage.ScopeContext) (*corev1.Event, error) {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, event, scope)
	}
	event.ResourceVersion = "12346"
	return event, nil
}

func (m *mockEventsBackend) Delete(ctx context.Context, namespace, name string, scope storage.ScopeContext) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, namespace, name, scope)
	}
	return nil
}

func (m *mockEventsBackend) Watch(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (watch.Interface, error) {
	if m.watchFunc != nil {
		return m.watchFunc(ctx, namespace, opts, scope)
	}
	return nil, apierrors.NewMethodNotSupported(corev1.Resource("events"), "watch")
}

// TestEventsREST_RESTInterface verifies the REST interface contracts
func TestEventsREST_RESTInterface(t *testing.T) {
	mockBackend := &mockEventsBackend{}
	er := NewEventsREST(mockBackend)

	t.Run("New returns empty Event", func(t *testing.T) {
		obj := er.New()
		event, ok := obj.(*corev1.Event)
		if !ok {
			t.Errorf("New() returned %T, want *corev1.Event", obj)
		}
		if event == nil {
			t.Error("New() returned nil")
		}
	})

	t.Run("NewList returns empty EventList", func(t *testing.T) {
		obj := er.NewList()
		list, ok := obj.(*corev1.EventList)
		if !ok {
			t.Errorf("NewList() returned %T, want *corev1.EventList", obj)
		}
		if list == nil {
			t.Error("NewList() returned nil")
		}
	})

	t.Run("NamespaceScoped returns true", func(t *testing.T) {
		if !er.NamespaceScoped() {
			t.Error("NamespaceScoped() = false, want true")
		}
	})

	t.Run("GetSingularName returns correct value", func(t *testing.T) {
		want := "event"
		if got := er.GetSingularName(); got != want {
			t.Errorf("GetSingularName() = %q, want %q", got, want)
		}
	})

	t.Run("Destroy doesn't panic", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Destroy() panicked: %v", r)
			}
		}()
		er.Destroy()
	})
}

// TestEventsREST_Create_Success tests successful event creation
func TestEventsREST_Create_Success(t *testing.T) {
	now := metav1.Now()

	mockBackend := &mockEventsBackend{
		createFunc: func(ctx context.Context, event *corev1.Event, scope storage.ScopeContext) (*corev1.Event, error) {
			event.ResourceVersion = "12345"
			event.UID = types.UID("generated-uid")
			return event, nil
		},
	}
	er := NewEventsREST(mockBackend)

	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "test-event",
		},
		InvolvedObject: corev1.ObjectReference{
			Kind:      "Pod",
			Namespace: "default",
			Name:      "my-pod",
		},
		Reason:         "Started",
		Message:        "Container started",
		Type:           "Normal",
		FirstTimestamp: now,
		LastTimestamp:  now,
	}

	// Create context with authenticated user and namespace
	testUser := &user.DefaultInfo{
		Name: "test-user",
		Extra: map[string][]string{
			ParentKindExtraKey: {"Organization"},
			ParentNameExtraKey: {"test-org"},
		},
	}
	ctx := request.WithUser(context.Background(), testUser)
	ctx = request.WithNamespace(ctx, "default")

	result, err := er.Create(ctx, event, nil, nil)
	if err != nil {
		t.Fatalf("Create() error = %v, want nil", err)
	}

	resultEvent, ok := result.(*corev1.Event)
	if !ok {
		t.Fatalf("Create() returned %T, want *corev1.Event", result)
	}

	if resultEvent.ResourceVersion != "12345" {
		t.Errorf("ResourceVersion = %q, want %q", resultEvent.ResourceVersion, "12345")
	}

	if resultEvent.UID != "generated-uid" {
		t.Errorf("UID = %q, want %q", resultEvent.UID, "generated-uid")
	}
}

// TestEventsREST_Create_ScopeExtraction tests that scope is properly extracted from user context
func TestEventsREST_Create_ScopeExtraction(t *testing.T) {
	var capturedScope storage.ScopeContext

	mockBackend := &mockEventsBackend{
		createFunc: func(ctx context.Context, event *corev1.Event, scope storage.ScopeContext) (*corev1.Event, error) {
			capturedScope = scope
			event.ResourceVersion = "12345"
			return event, nil
		},
	}
	er := NewEventsREST(mockBackend)

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
					ParentKindExtraKey: {"Organization"},
					ParentNameExtraKey: {"acme-corp"},
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
					ParentKindExtraKey: {"Project"},
					ParentNameExtraKey: {"backend-api"},
				},
			},
			wantType: "project",
			wantName: "backend-api",
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
			capturedScope = storage.ScopeContext{}

			event := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "default",
					Name:      "test-event",
				},
			}

			ctx := request.WithUser(context.Background(), tt.user)
			ctx = request.WithNamespace(ctx, "default")

			_, err := er.Create(ctx, event, nil, nil)
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

// TestEventsREST_Get_Success tests successful event retrieval
func TestEventsREST_Get_Success(t *testing.T) {
	mockBackend := &mockEventsBackend{
		getFunc: func(ctx context.Context, namespace, name string, scope storage.ScopeContext) (*corev1.Event, error) {
			return &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       namespace,
					Name:            name,
					UID:             "test-uid",
					ResourceVersion: "12345",
				},
				Reason:  "Started",
				Message: "Container started",
			}, nil
		},
	}
	er := NewEventsREST(mockBackend)

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)
	ctx = request.WithNamespace(ctx, "default")

	result, err := er.Get(ctx, "my-event", nil)
	if err != nil {
		t.Fatalf("Get() error = %v, want nil", err)
	}

	event, ok := result.(*corev1.Event)
	if !ok {
		t.Fatalf("Get() returned %T, want *corev1.Event", result)
	}

	if event.Name != "my-event" {
		t.Errorf("Name = %q, want %q", event.Name, "my-event")
	}

	if event.Namespace != "default" {
		t.Errorf("Namespace = %q, want %q", event.Namespace, "default")
	}
}

// TestEventsREST_Get_NotFound tests event not found error
func TestEventsREST_Get_NotFound(t *testing.T) {
	mockBackend := &mockEventsBackend{
		getFunc: func(ctx context.Context, namespace, name string, scope storage.ScopeContext) (*corev1.Event, error) {
			return nil, apierrors.NewNotFound(corev1.Resource("events"), name)
		},
	}
	er := NewEventsREST(mockBackend)

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)
	ctx = request.WithNamespace(ctx, "default")

	_, err := er.Get(ctx, "nonexistent", nil)
	if err == nil {
		t.Fatal("Get() error = nil, want NotFound error")
	}

	if !apierrors.IsNotFound(err) {
		t.Errorf("Get() error type = %T, want NotFound", err)
	}
}

// TestEventsREST_List_Success tests successful event listing
func TestEventsREST_List_Success(t *testing.T) {
	now := metav1.Now()

	mockBackend := &mockEventsBackend{
		listFunc: func(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (*corev1.EventList, error) {
			return &corev1.EventList{
				Items: []corev1.Event{
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:       namespace,
							Name:            "event-1",
							ResourceVersion: "12345",
						},
						Reason:        "Started",
						LastTimestamp: now,
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:       namespace,
							Name:            "event-2",
							ResourceVersion: "12346",
						},
						Reason:        "Pulled",
						LastTimestamp: now,
					},
				},
			}, nil
		},
	}
	er := NewEventsREST(mockBackend)

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)
	ctx = request.WithNamespace(ctx, "default")

	result, err := er.List(ctx, &metainternalversion.ListOptions{})
	if err != nil {
		t.Fatalf("List() error = %v, want nil", err)
	}

	list, ok := result.(*corev1.EventList)
	if !ok {
		t.Fatalf("List() returned %T, want *corev1.EventList", result)
	}

	if len(list.Items) != 2 {
		t.Errorf("List() returned %d items, want 2", len(list.Items))
	}
}

// TestEventsREST_Delete_Success tests successful event deletion
func TestEventsREST_Delete_Success(t *testing.T) {
	mockBackend := &mockEventsBackend{
		getFunc: func(ctx context.Context, namespace, name string, scope storage.ScopeContext) (*corev1.Event, error) {
			return &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      name,
				},
			}, nil
		},
		deleteFunc: func(ctx context.Context, namespace, name string, scope storage.ScopeContext) error {
			return nil
		},
	}
	er := NewEventsREST(mockBackend)

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)
	ctx = request.WithNamespace(ctx, "default")

	result, deleted, err := er.Delete(ctx, "my-event", nil, nil)
	if err != nil {
		t.Fatalf("Delete() error = %v, want nil", err)
	}

	if !deleted {
		t.Error("Delete() deleted = false, want true")
	}

	event, ok := result.(*corev1.Event)
	if !ok {
		t.Fatalf("Delete() returned %T, want *corev1.Event", result)
	}

	if event.Name != "my-event" {
		t.Errorf("Deleted event name = %q, want %q", event.Name, "my-event")
	}
}

// TestEventsREST_Create_NoUserContext tests that missing user context returns error
func TestEventsREST_Create_NoUserContext(t *testing.T) {
	mockBackend := &mockEventsBackend{}
	er := NewEventsREST(mockBackend)

	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "test-event",
		},
	}

	// Create context without user
	ctx := request.WithNamespace(context.Background(), "default")

	_, err := er.Create(ctx, event, nil, nil)
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

// TestEventsREST_Create_NoNamespaceContext tests that missing namespace returns error
func TestEventsREST_Create_NoNamespaceContext(t *testing.T) {
	mockBackend := &mockEventsBackend{}
	er := NewEventsREST(mockBackend)

	event := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-event",
		},
	}

	// Create context without namespace
	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)

	_, err := er.Create(ctx, event, nil, nil)
	if err == nil {
		t.Fatal("Create() error = nil, want error")
	}

	if !apierrors.IsBadRequest(err) {
		t.Errorf("Create() error type = %T, want BadRequest", err)
	}
}

// TestEventsREST_StorageErrors tests error handling from the storage layer
func TestEventsREST_StorageErrors(t *testing.T) {
	testUser := &user.DefaultInfo{Name: "test-user"}

	tests := []struct {
		name         string
		storageError error
		wantStatus   int32
	}{
		{
			name:         "database connection error",
			storageError: fmt.Errorf("connection failed"),
			wantStatus:   503,
		},
		{
			name:         "query timeout",
			storageError: fmt.Errorf("context deadline exceeded"),
			wantStatus:   503,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockBackend := &mockEventsBackend{
				listFunc: func(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (*corev1.EventList, error) {
					return nil, tt.storageError
				},
			}
			er := NewEventsREST(mockBackend)

			ctx := request.WithUser(context.Background(), testUser)
			ctx = request.WithNamespace(ctx, "default")

			_, err := er.List(ctx, &metainternalversion.ListOptions{})

			if err == nil {
				t.Fatal("List() error = nil, want error")
			}

			statusErr, ok := err.(*apierrors.StatusError)
			if !ok {
				t.Fatalf("List() returned %T, want *apierrors.StatusError", err)
			}

			if statusErr.ErrStatus.Code != tt.wantStatus {
				t.Errorf("Status code = %d, want %d", statusErr.ErrStatus.Code, tt.wantStatus)
			}
		})
	}
}

// TestScopeExtraction tests the scope extraction function
func TestScopeExtraction(t *testing.T) {
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
					ParentKindExtraKey: {"Organization"},
					ParentNameExtraKey: {"acme-corp"},
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
					ParentKindExtraKey: {"Project"},
					ParentNameExtraKey: {"backend-api"},
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
					ParentKindExtraKey: {"User"},
					ParentNameExtraKey: {"550e8400-e29b-41d4-a716-446655440000"},
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
		{
			name:     "nil extra",
			user:     &user.DefaultInfo{Name: "user"},
			wantType: "platform",
			wantName: "",
		},
		{
			name: "empty parent kind",
			user: &user.DefaultInfo{
				Name: "user",
				Extra: map[string][]string{
					ParentKindExtraKey: {},
					ParentNameExtraKey: {"some-name"},
				},
			},
			wantType: "platform",
			wantName: "",
		},
		{
			name: "unknown parent kind",
			user: &user.DefaultInfo{
				Name: "user",
				Extra: map[string][]string{
					ParentKindExtraKey: {"UnknownKind"},
					ParentNameExtraKey: {"some-name"},
				},
			},
			wantType: "platform",
			wantName: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scope := ExtractScopeFromUser(tt.user)

			if scope.Type != tt.wantType {
				t.Errorf("Scope.Type = %q, want %q", scope.Type, tt.wantType)
			}
			if scope.Name != tt.wantName {
				t.Errorf("Scope.Name = %q, want %q", scope.Name, tt.wantName)
			}
		})
	}
}

// TestEventsREST_Watch_NoWatcher tests that Watch returns error when no watcher is configured
func TestEventsREST_Watch_NoWatcher(t *testing.T) {
	mockBackend := &mockEventsBackend{}
	// Create without watcher
	er := NewEventsREST(mockBackend)

	testUser := &user.DefaultInfo{Name: "test-user"}
	ctx := request.WithUser(context.Background(), testUser)
	ctx = request.WithNamespace(ctx, "default")

	_, err := er.Watch(ctx, &metainternalversion.ListOptions{})
	if err == nil {
		t.Fatal("Watch() error = nil, want error")
	}

	// Should be a ServiceUnavailable error
	statusErr, ok := err.(*apierrors.StatusError)
	if !ok {
		t.Fatalf("Watch() returned %T, want *apierrors.StatusError", err)
	}

	if statusErr.ErrStatus.Code != 503 {
		t.Errorf("Status code = %d, want 503", statusErr.ErrStatus.Code)
	}
}

// TestEventWatcher tests the event watcher functionality
func TestEventWatcher(t *testing.T) {
	t.Run("sends matching events", func(t *testing.T) {
		w := NewEventWatcher("default", metav1.ListOptions{}, storage.ScopeContext{Type: "platform"})

		event := &corev1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-event",
			},
		}

		w.SendEvent(watch.Added, event)

		select {
		case received := <-w.ResultChan():
			if received.Type != watch.Added {
				t.Errorf("Event type = %v, want Added", received.Type)
			}
			receivedEvent := received.Object.(*corev1.Event)
			if receivedEvent.Name != "test-event" {
				t.Errorf("Event name = %q, want %q", receivedEvent.Name, "test-event")
			}
		case <-time.After(100 * time.Millisecond):
			t.Error("Timed out waiting for event")
		}
	})

	t.Run("filters by namespace", func(t *testing.T) {
		w := NewEventWatcher("default", metav1.ListOptions{}, storage.ScopeContext{Type: "platform"})

		// Send event from different namespace
		event := &corev1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "other-namespace",
				Name:      "test-event",
			},
		}

		w.SendEvent(watch.Added, event)

		select {
		case <-w.ResultChan():
			t.Error("Should not receive event from different namespace")
		case <-time.After(50 * time.Millisecond):
			// Expected - event was filtered
		}
	})

	t.Run("filters by scope", func(t *testing.T) {
		w := NewEventWatcher("", metav1.ListOptions{}, storage.ScopeContext{
			Type: "organization",
			Name: "my-org",
		})

		// Send event with different scope
		event := &corev1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-event",
				Annotations: map[string]string{
					"platform.miloapis.com/scope.type": "organization",
					"platform.miloapis.com/scope.name": "other-org",
				},
			},
		}

		w.SendEvent(watch.Added, event)

		select {
		case <-w.ResultChan():
			t.Error("Should not receive event from different scope")
		case <-time.After(50 * time.Millisecond):
			// Expected - event was filtered
		}
	})

	t.Run("stop closes result channel", func(t *testing.T) {
		w := NewEventWatcher("default", metav1.ListOptions{}, storage.ScopeContext{Type: "platform"})
		w.Stop()

		// Channel should be closed
		_, ok := <-w.ResultChan()
		if ok {
			t.Error("ResultChan should be closed after Stop()")
		}
	})
}
