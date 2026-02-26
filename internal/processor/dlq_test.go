package processor

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestPolicyEvaluationError(t *testing.T) {
	tests := []struct {
		name       string
		policyName string
		ruleIndex  int
		err        error
	}{
		{
			name:       "basic error",
			policyName: "test-policy",
			ruleIndex:  0,
			err:        errors.New("CEL evaluation failed"),
		},
		{
			name:       "negative rule index",
			policyName: "test-policy",
			ruleIndex:  -1,
			err:        errors.New("pre-rule error"),
		},
		{
			name:       "empty policy name",
			policyName: "",
			ruleIndex:  2,
			err:        errors.New("some error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policyErr := NewPolicyEvaluationError(tt.policyName, tt.ruleIndex, tt.err)

			if policyErr.PolicyName != tt.policyName {
				t.Errorf("PolicyName = %q, want %q", policyErr.PolicyName, tt.policyName)
			}
			if policyErr.RuleIndex != tt.ruleIndex {
				t.Errorf("RuleIndex = %d, want %d", policyErr.RuleIndex, tt.ruleIndex)
			}
			if policyErr.Error() != tt.err.Error() {
				t.Errorf("Error() = %q, want %q", policyErr.Error(), tt.err.Error())
			}
			if policyErr.Unwrap() != tt.err {
				t.Errorf("Unwrap() = %v, want %v", policyErr.Unwrap(), tt.err)
			}
		})
	}
}

func TestPolicyEvaluationErrorIs(t *testing.T) {
	originalErr := errors.New("original error")
	policyErr := NewPolicyEvaluationError("test-policy", 1, originalErr)

	var unwrapped *PolicyEvaluationError
	if !errors.As(policyErr, &unwrapped) {
		t.Error("errors.As should succeed for PolicyEvaluationError")
	}
	if unwrapped.PolicyName != "test-policy" {
		t.Errorf("unwrapped PolicyName = %q, want %q", unwrapped.PolicyName, "test-policy")
	}
	if unwrapped.RuleIndex != 1 {
		t.Errorf("unwrapped RuleIndex = %d, want %d", unwrapped.RuleIndex, 1)
	}
}

func TestNoopDLQPublisher(t *testing.T) {
	publisher := &noopDLQPublisher{}
	ctx := context.Background()
	payload := json.RawMessage(`{"test": "data"}`)
	testErr := errors.New("test error")

	t.Run("PublishAuditFailure returns nil", func(t *testing.T) {
		err := publisher.PublishAuditFailure(ctx, payload, "policy", 0, ErrorTypeCELMatch, testErr, nil, nil)
		if err != nil {
			t.Errorf("PublishAuditFailure() returned error: %v", err)
		}
	})

	t.Run("PublishEventFailure returns nil", func(t *testing.T) {
		err := publisher.PublishEventFailure(ctx, payload, "policy", 0, ErrorTypeCELMatch, testErr, nil, nil)
		if err != nil {
			t.Errorf("PublishEventFailure() returned error: %v", err)
		}
	})
}

func TestDefaultDLQConfig(t *testing.T) {
	config := DefaultDLQConfig()

	if !config.Enabled {
		t.Error("default config should have Enabled = true")
	}
	if config.StreamName != "ACTIVITY_DEAD_LETTER" {
		t.Errorf("StreamName = %q, want %q", config.StreamName, "ACTIVITY_DEAD_LETTER")
	}
	if config.SubjectPrefix != "activity.dlq" {
		t.Errorf("SubjectPrefix = %q, want %q", config.SubjectPrefix, "activity.dlq")
	}
}

func TestNewDLQPublisher_Disabled(t *testing.T) {
	config := DLQConfig{
		Enabled: false,
	}
	publisher := NewDLQPublisher(nil, config)

	// Should return a noop publisher
	_, isNoop := publisher.(*noopDLQPublisher)
	if !isNoop {
		t.Error("NewDLQPublisher with disabled config should return noopDLQPublisher")
	}
}

func TestErrorTypes(t *testing.T) {
	// Verify error type constants are distinct
	errorTypes := []ErrorType{
		ErrorTypeCELMatch,
		ErrorTypeCELSummary,
		ErrorTypeUnmarshal,
		ErrorTypeKindResolve,
	}

	seen := make(map[ErrorType]bool)
	for _, et := range errorTypes {
		if seen[et] {
			t.Errorf("duplicate error type: %s", et)
		}
		seen[et] = true
	}
}

func TestEventTypes(t *testing.T) {
	// Verify event type constants are distinct
	if EventTypeAudit == EventTypeK8sEvent {
		t.Error("EventTypeAudit and EventTypeK8sEvent should be different")
	}

	if EventTypeAudit != "audit" {
		t.Errorf("EventTypeAudit = %q, want %q", EventTypeAudit, "audit")
	}
	if EventTypeK8sEvent != "k8s-event" {
		t.Errorf("EventTypeK8sEvent = %q, want %q", EventTypeK8sEvent, "k8s-event")
	}
}

func TestDeadLetterEventSerialization(t *testing.T) {
	dlEvent := DeadLetterEvent{
		Type:            EventTypeAudit,
		OriginalPayload: json.RawMessage(`{"verb": "create"}`),
		Error:           "CEL evaluation failed",
		ErrorType:       ErrorTypeCELMatch,
		PolicyName:      "test-policy",
		RuleIndex:       1,
		Resource: &DeadLetterResource{
			APIGroup:  "apps",
			Kind:      "Deployment",
			Name:      "my-deployment",
			Namespace: "default",
		},
		Tenant: &DeadLetterTenant{
			Type: "project",
			Name: "my-project",
		},
	}

	data, err := json.Marshal(dlEvent)
	if err != nil {
		t.Fatalf("failed to marshal DeadLetterEvent: %v", err)
	}

	var unmarshaled DeadLetterEvent
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal DeadLetterEvent: %v", err)
	}

	if unmarshaled.Type != dlEvent.Type {
		t.Errorf("Type = %q, want %q", unmarshaled.Type, dlEvent.Type)
	}
	if unmarshaled.PolicyName != dlEvent.PolicyName {
		t.Errorf("PolicyName = %q, want %q", unmarshaled.PolicyName, dlEvent.PolicyName)
	}
	if unmarshaled.RuleIndex != dlEvent.RuleIndex {
		t.Errorf("RuleIndex = %d, want %d", unmarshaled.RuleIndex, dlEvent.RuleIndex)
	}
	if unmarshaled.Resource == nil {
		t.Fatal("Resource should not be nil")
	}
	if unmarshaled.Resource.Kind != "Deployment" {
		t.Errorf("Resource.Kind = %q, want %q", unmarshaled.Resource.Kind, "Deployment")
	}
	if unmarshaled.Tenant == nil {
		t.Fatal("Tenant should not be nil")
	}
	if unmarshaled.Tenant.Type != "project" {
		t.Errorf("Tenant.Type = %q, want %q", unmarshaled.Tenant.Type, "project")
	}
	if unmarshaled.Tenant.Name != "my-project" {
		t.Errorf("Tenant.Name = %q, want %q", unmarshaled.Tenant.Name, "my-project")
	}
}

func TestDeadLetterEventSerializationOmitEmpty(t *testing.T) {
	dlEvent := DeadLetterEvent{
		Type:            EventTypeK8sEvent,
		OriginalPayload: json.RawMessage(`{}`),
		Error:           "test error",
		ErrorType:       ErrorTypeUnmarshal,
		RuleIndex:       -1,
		// Resource and Tenant are nil
	}

	data, err := json.Marshal(dlEvent)
	if err != nil {
		t.Fatalf("failed to marshal DeadLetterEvent: %v", err)
	}

	// Verify omitempty works
	dataStr := string(data)
	if strings.Contains(dataStr, `"resource"`) && !strings.Contains(dataStr, `"resource":null`) {
		// The resource field should be omitted entirely or be null
		var m map[string]interface{}
		json.Unmarshal(data, &m)
		if _, hasResource := m["resource"]; hasResource && m["resource"] != nil {
			t.Error("resource should be omitted when nil")
		}
	}
	if strings.Contains(dataStr, `"tenant"`) && !strings.Contains(dataStr, `"tenant":null`) {
		var m map[string]interface{}
		json.Unmarshal(data, &m)
		if _, hasTenant := m["tenant"]; hasTenant && m["tenant"] != nil {
			t.Error("tenant should be omitted when nil")
		}
	}
}

// mockPublishedMessage stores published messages for verification.
type mockPublishedMessage struct {
	Subject string
	Data    []byte
}

// testPublisher is a test wrapper that captures published messages.
// It uses a function-based approach to avoid implementing the full JetStreamContext interface.
type testPublisher struct {
	published   []mockPublishedMessage
	publishFunc func(subj string, data []byte) error
}

func (t *testPublisher) publish(ctx context.Context, eventType EventType, payload json.RawMessage, policyName string, ruleIndex int, errorType ErrorType, originalErr error, resource *DeadLetterResource, tenant *DeadLetterTenant) error {
	// Safely extract error message
	errMsg := ""
	if originalErr != nil {
		errMsg = originalErr.Error()
	}

	dlEvent := DeadLetterEvent{
		Type:            eventType,
		OriginalPayload: payload,
		Error:           errMsg,
		ErrorType:       errorType,
		PolicyName:      policyName,
		RuleIndex:       ruleIndex,
		Resource:        resource,
		Tenant:          tenant,
	}

	data, err := json.Marshal(dlEvent)
	if err != nil {
		return err
	}

	// Build subject: <prefix>.<event_type>.<api_group>.<kind>
	apiGroup := "unknown"
	kind := "unknown"
	if resource != nil {
		if resource.APIGroup != "" {
			apiGroup = resource.APIGroup
		} else {
			apiGroup = "core"
		}
		if resource.Kind != "" {
			kind = resource.Kind
		}
	}
	subject := "test.dlq." + string(eventType) + "." + apiGroup + "." + kind

	t.published = append(t.published, mockPublishedMessage{Subject: subject, Data: data})

	if t.publishFunc != nil {
		return t.publishFunc(subject, data)
	}
	return nil
}

func TestDLQPublish_SubjectConstruction(t *testing.T) {
	tests := []struct {
		name            string
		eventType       EventType
		resource        *DeadLetterResource
		wantSubjectPart string
	}{
		{
			name:      "audit with full resource",
			eventType: EventTypeAudit,
			resource: &DeadLetterResource{
				APIGroup: "apps",
				Kind:     "Deployment",
			},
			wantSubjectPart: "test.dlq.audit.apps.Deployment",
		},
		{
			name:      "k8s-event with core resource",
			eventType: EventTypeK8sEvent,
			resource: &DeadLetterResource{
				APIGroup: "", // Core resources have empty apiGroup
				Kind:     "Pod",
			},
			wantSubjectPart: "test.dlq.k8s-event.core.Pod",
		},
		{
			name:            "nil resource uses unknown",
			eventType:       EventTypeAudit,
			resource:        nil,
			wantSubjectPart: "test.dlq.audit.unknown.unknown",
		},
		{
			name:      "resource with empty kind",
			eventType: EventTypeK8sEvent,
			resource: &DeadLetterResource{
				APIGroup: "networking.k8s.io",
				Kind:     "",
			},
			wantSubjectPart: "test.dlq.k8s-event.networking.k8s.io.unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			publisher := &testPublisher{}
			ctx := context.Background()
			payload := json.RawMessage(`{"test": true}`)
			testErr := errors.New("test error")

			err := publisher.publish(ctx, tt.eventType, payload, "policy", 0, ErrorTypeCELMatch, testErr, tt.resource, nil)

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(publisher.published) != 1 {
				t.Fatalf("expected 1 published message, got %d", len(publisher.published))
			}

			if publisher.published[0].Subject != tt.wantSubjectPart {
				t.Errorf("subject = %q, want %q", publisher.published[0].Subject, tt.wantSubjectPart)
			}
		})
	}
}

func TestDLQPublish_PublishFailure(t *testing.T) {
	publishErr := errors.New("NATS connection failed")
	publisher := &testPublisher{
		publishFunc: func(subj string, data []byte) error {
			return publishErr
		},
	}

	ctx := context.Background()
	payload := json.RawMessage(`{"test": true}`)
	testErr := errors.New("original error")

	err := publisher.publish(ctx, EventTypeAudit, payload, "policy", 0, ErrorTypeCELMatch, testErr, nil, nil)

	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "NATS connection failed") {
		t.Errorf("error message = %q, want to contain %q", err.Error(), "NATS connection failed")
	}
}

func TestDLQPublish_NilError(t *testing.T) {
	publisher := &testPublisher{}
	ctx := context.Background()
	payload := json.RawMessage(`{"test": true}`)

	// Test with nil error (should not panic)
	err := publisher.publish(ctx, EventTypeAudit, payload, "policy", 0, ErrorTypeCELMatch, nil, nil, nil)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(publisher.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(publisher.published))
	}

	// Verify the error field is empty in the published message
	var dlEvent DeadLetterEvent
	if err := json.Unmarshal(publisher.published[0].Data, &dlEvent); err != nil {
		t.Fatalf("failed to unmarshal published data: %v", err)
	}

	if dlEvent.Error != "" {
		t.Errorf("Error field = %q, want empty string", dlEvent.Error)
	}
}

func TestDLQPublish_PayloadPreserved(t *testing.T) {
	publisher := &testPublisher{}
	ctx := context.Background()
	originalPayload := json.RawMessage(`{"verb": "create", "objectRef": {"name": "test-pod"}}`)
	testErr := errors.New("evaluation failed")
	resource := &DeadLetterResource{
		APIGroup:  "apps",
		Kind:      "Deployment",
		Name:      "my-deployment",
		Namespace: "default",
	}
	tenant := &DeadLetterTenant{
		Type: "project",
		Name: "my-project",
	}

	err := publisher.publish(ctx, EventTypeAudit, originalPayload, "test-policy", 2, ErrorTypeCELSummary, testErr, resource, tenant)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(publisher.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(publisher.published))
	}

	var dlEvent DeadLetterEvent
	if err := json.Unmarshal(publisher.published[0].Data, &dlEvent); err != nil {
		t.Fatalf("failed to unmarshal published data: %v", err)
	}

	// Verify all fields are preserved correctly
	if dlEvent.Type != EventTypeAudit {
		t.Errorf("Type = %q, want %q", dlEvent.Type, EventTypeAudit)
	}
	// Compare JSON payloads by unmarshaling to handle whitespace differences
	var originalParsed, preservedParsed map[string]interface{}
	json.Unmarshal(originalPayload, &originalParsed)
	json.Unmarshal(dlEvent.OriginalPayload, &preservedParsed)
	if originalParsed["verb"] != preservedParsed["verb"] {
		t.Errorf("OriginalPayload verb mismatch: got %v, want %v", preservedParsed["verb"], originalParsed["verb"])
	}
	if dlEvent.Error != "evaluation failed" {
		t.Errorf("Error = %q, want %q", dlEvent.Error, "evaluation failed")
	}
	if dlEvent.ErrorType != ErrorTypeCELSummary {
		t.Errorf("ErrorType = %q, want %q", dlEvent.ErrorType, ErrorTypeCELSummary)
	}
	if dlEvent.PolicyName != "test-policy" {
		t.Errorf("PolicyName = %q, want %q", dlEvent.PolicyName, "test-policy")
	}
	if dlEvent.RuleIndex != 2 {
		t.Errorf("RuleIndex = %d, want %d", dlEvent.RuleIndex, 2)
	}
	if dlEvent.Resource == nil {
		t.Fatal("Resource should not be nil")
	}
	if dlEvent.Resource.Kind != "Deployment" {
		t.Errorf("Resource.Kind = %q, want %q", dlEvent.Resource.Kind, "Deployment")
	}
	if dlEvent.Tenant == nil {
		t.Fatal("Tenant should not be nil")
	}
	if dlEvent.Tenant.Name != "my-project" {
		t.Errorf("Tenant.Name = %q, want %q", dlEvent.Tenant.Name, "my-project")
	}
}

func TestSentinelErrors(t *testing.T) {
	// Test that sentinel errors work correctly with errors.Is
	t.Run("ErrKindResolution", func(t *testing.T) {
		wrapped := errors.New("discovery cache miss")
		err := errors.Join(ErrKindResolution, wrapped)

		if !errors.Is(err, ErrKindResolution) {
			t.Error("errors.Is should return true for wrapped ErrKindResolution")
		}
	})

	t.Run("ErrActivityBuild", func(t *testing.T) {
		wrapped := errors.New("link conversion failed")
		err := errors.Join(ErrActivityBuild, wrapped)

		if !errors.Is(err, ErrActivityBuild) {
			t.Error("errors.Is should return true for wrapped ErrActivityBuild")
		}
	})

	t.Run("ErrKindResolution is distinct from ErrActivityBuild", func(t *testing.T) {
		if errors.Is(ErrKindResolution, ErrActivityBuild) {
			t.Error("ErrKindResolution should not match ErrActivityBuild")
		}
		if errors.Is(ErrActivityBuild, ErrKindResolution) {
			t.Error("ErrActivityBuild should not match ErrKindResolution")
		}
	})
}
