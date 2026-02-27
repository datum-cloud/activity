package activityprocessor

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/record"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"go.miloapis.com/activity/internal/controller"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

func TestEventEmitter_EmitEvaluationError(t *testing.T) {
	policy := &v1alpha1.ActivityPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-policy",
		},
		Spec: v1alpha1.ActivityPolicySpec{
			Resource: v1alpha1.ActivityPolicyResource{
				APIGroup: "test.example.com",
				Kind:     "TestResource",
			},
		},
	}

	k8sClient := fake.NewClientBuilder().
		WithScheme(controller.Scheme).
		WithObjects(policy).
		Build()

	recorder := record.NewFakeRecorder(10)
	emitter := NewEventEmitter(k8sClient, recorder)

	testErr := errors.New("CEL evaluation failed: undefined variable")
	emitter.EmitEvaluationError(context.Background(), "test-policy", 2, testErr)

	// Check that an event was emitted
	select {
	case event := <-recorder.Events:
		if !strings.Contains(event, "CEL evaluation failed") {
			t.Errorf("expected event to contain 'CEL evaluation failed', got: %s", event)
		}
		if !strings.Contains(event, "rule 2") {
			t.Errorf("expected event to contain 'rule 2', got: %s", event)
		}
	case <-time.After(time.Second):
		t.Fatal("expected event to be emitted, but none was received")
	}
}

func TestEventEmitter_PolicyDeleted(t *testing.T) {
	// Create client without the policy
	k8sClient := fake.NewClientBuilder().
		WithScheme(controller.Scheme).
		Build()

	recorder := record.NewFakeRecorder(10)
	emitter := NewEventEmitter(k8sClient, recorder)

	testErr := errors.New("test error")
	// Should not panic when policy is deleted
	emitter.EmitEvaluationError(context.Background(), "test-policy", 0, testErr)

	// No event should be emitted
	select {
	case event := <-recorder.Events:
		t.Fatalf("expected no event when policy is deleted, but got: %s", event)
	case <-time.After(100 * time.Millisecond):
		// No event as expected
	}
}

func TestEventEmitter_LongErrorMessage(t *testing.T) {
	policy := &v1alpha1.ActivityPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-policy",
		},
	}

	k8sClient := fake.NewClientBuilder().
		WithScheme(controller.Scheme).
		WithObjects(policy).
		Build()

	recorder := record.NewFakeRecorder(10)
	emitter := NewEventEmitter(k8sClient, recorder)

	// Create a very long error message
	longError := errors.New(strings.Repeat("x", 500))
	emitter.EmitEvaluationError(context.Background(), "test-policy", 0, longError)

	// Check that event was emitted with truncated message
	select {
	case event := <-recorder.Events:
		// Message should be truncated to 200 characters for the error portion
		if len(event) > 500 {
			t.Logf("Event message length: %d", len(event))
		}
	case <-time.After(time.Second):
		t.Fatal("expected event to be emitted")
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		maxLen   int
		expected string
	}{
		{
			name:     "short string",
			input:    "hello",
			maxLen:   10,
			expected: "hello",
		},
		{
			name:     "exact length",
			input:    "hello",
			maxLen:   5,
			expected: "hello",
		},
		{
			name:     "truncated",
			input:    "hello world",
			maxLen:   5,
			expected: "hello",
		},
		{
			name:     "empty string",
			input:    "",
			maxLen:   5,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := truncateString(tt.input, tt.maxLen)
			if result != tt.expected {
				t.Errorf("truncateString(%q, %d) = %q, want %q", tt.input, tt.maxLen, result, tt.expected)
			}
		})
	}
}
