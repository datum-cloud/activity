package preview

import (
	"context"
	"encoding/json"
	"testing"

	authnv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

func TestPolicyPreviewStorage_Create_SingleAuditMatch(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	preview := &v1alpha1.PolicyPreview{
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: v1alpha1.ActivityPolicySpec{
				Resource: v1alpha1.ActivityPolicyResource{
					APIGroup: "networking.datumapis.com",
					Kind:     "HTTPProxy",
				},
				AuditRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `audit.verb == "create"`,
						Summary: `{{ actor }} created HTTPProxy`,
					},
				},
			},
			Inputs: []v1alpha1.PolicyPreviewInput{
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "create",
						User: authnv1.UserInfo{
							Username: "alice@example.com",
							UID:      "user-alice-123",
						},
						ObjectRef: &auditv1.ObjectReference{
							APIGroup: "networking.datumapis.com",
							Resource: "httpproxies",
							Name:     "my-proxy",
						},
					},
				},
			},
		},
	}

	result, err := storage.Create(context.Background(), preview, nil, &metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	resultPreview, ok := result.(*v1alpha1.PolicyPreview)
	if !ok {
		t.Fatalf("Expected *v1alpha1.PolicyPreview, got %T", result)
	}

	if resultPreview.Status.Error != "" {
		t.Errorf("Unexpected error: %s", resultPreview.Status.Error)
	}

	// Check results
	if len(resultPreview.Status.Results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(resultPreview.Status.Results))
	}

	if !resultPreview.Status.Results[0].Matched {
		t.Error("Expected rule to match, but it didn't")
	}

	if resultPreview.Status.Results[0].MatchedRuleIndex != 0 {
		t.Errorf("Expected MatchedRuleIndex=0, got %d", resultPreview.Status.Results[0].MatchedRuleIndex)
	}

	if resultPreview.Status.Results[0].MatchedRuleType != "audit" {
		t.Errorf("Expected MatchedRuleType='audit', got %s", resultPreview.Status.Results[0].MatchedRuleType)
	}

	// Check activities
	if len(resultPreview.Status.Activities) != 1 {
		t.Fatalf("Expected 1 activity, got %d", len(resultPreview.Status.Activities))
	}

	activity := resultPreview.Status.Activities[0]

	expectedSummary := "alice@example.com created HTTPProxy"
	if activity.Spec.Summary != expectedSummary {
		t.Errorf("Expected Summary=%q, got %q", expectedSummary, activity.Spec.Summary)
	}

	if activity.Spec.Actor.Name != "user-alice-123" {
		t.Errorf("Expected Actor.Name='user-alice-123', got %q", activity.Spec.Actor.Name)
	}

	if activity.Spec.ChangeSource != "human" {
		t.Errorf("Expected ChangeSource='human', got %q", activity.Spec.ChangeSource)
	}

	if activity.Spec.Origin.Type != "audit" {
		t.Errorf("Expected Origin.Type='audit', got %q", activity.Spec.Origin.Type)
	}
}

func TestPolicyPreviewStorage_Create_MultipleInputs(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	preview := &v1alpha1.PolicyPreview{
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: v1alpha1.ActivityPolicySpec{
				Resource: v1alpha1.ActivityPolicyResource{
					APIGroup: "networking.datumapis.com",
					Kind:     "HTTPProxy",
				},
				AuditRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `audit.verb == "create"`,
						Summary: `{{ actor }} created HTTPProxy`,
					},
					{
						Match:   `audit.verb == "delete"`,
						Summary: `{{ actor }} deleted HTTPProxy`,
					},
				},
			},
			Inputs: []v1alpha1.PolicyPreviewInput{
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "create",
						User: authnv1.UserInfo{
							Username: "alice@example.com",
						},
						ObjectRef: &auditv1.ObjectReference{
							APIGroup: "networking.datumapis.com",
							Resource: "httpproxies",
							Name:     "proxy-1",
						},
					},
				},
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "delete",
						User: authnv1.UserInfo{
							Username: "bob@example.com",
						},
						ObjectRef: &auditv1.ObjectReference{
							APIGroup: "networking.datumapis.com",
							Resource: "httpproxies",
							Name:     "proxy-2",
						},
					},
				},
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "update", // No matching rule
						User: authnv1.UserInfo{
							Username: "charlie@example.com",
						},
					},
				},
			},
		},
	}

	result, err := storage.Create(context.Background(), preview, nil, &metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	resultPreview := result.(*v1alpha1.PolicyPreview)

	// Check results
	if len(resultPreview.Status.Results) != 3 {
		t.Fatalf("Expected 3 results, got %d", len(resultPreview.Status.Results))
	}

	// First input should match rule 0
	if !resultPreview.Status.Results[0].Matched {
		t.Error("Expected first input to match")
	}
	if resultPreview.Status.Results[0].MatchedRuleIndex != 0 {
		t.Errorf("Expected first input MatchedRuleIndex=0, got %d", resultPreview.Status.Results[0].MatchedRuleIndex)
	}

	// Second input should match rule 1
	if !resultPreview.Status.Results[1].Matched {
		t.Error("Expected second input to match")
	}
	if resultPreview.Status.Results[1].MatchedRuleIndex != 1 {
		t.Errorf("Expected second input MatchedRuleIndex=1, got %d", resultPreview.Status.Results[1].MatchedRuleIndex)
	}

	// Third input should not match
	if resultPreview.Status.Results[2].Matched {
		t.Error("Expected third input NOT to match")
	}
	if resultPreview.Status.Results[2].MatchedRuleIndex != -1 {
		t.Errorf("Expected third input MatchedRuleIndex=-1, got %d", resultPreview.Status.Results[2].MatchedRuleIndex)
	}

	// Check activities - should have 2 (only matched inputs)
	if len(resultPreview.Status.Activities) != 2 {
		t.Fatalf("Expected 2 activities, got %d", len(resultPreview.Status.Activities))
	}

	// First activity
	if resultPreview.Status.Activities[0].Spec.Summary != "alice@example.com created HTTPProxy" {
		t.Errorf("Unexpected first activity summary: %q", resultPreview.Status.Activities[0].Spec.Summary)
	}

	// Second activity
	if resultPreview.Status.Activities[1].Spec.Summary != "bob@example.com deleted HTTPProxy" {
		t.Errorf("Unexpected second activity summary: %q", resultPreview.Status.Activities[1].Spec.Summary)
	}
}

func TestPolicyPreviewStorage_Create_MixedAuditAndEvent(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	eventData := map[string]interface{}{
		"reason":              "Deployed",
		"message":             "Successfully deployed",
		"reportingController": "deploy-controller",
		"regarding": map[string]interface{}{
			"apiVersion": "networking.datumapis.com/v1",
			"kind":       "HTTPProxy",
			"name":       "event-proxy",
			"namespace":  "default",
		},
	}
	eventBytes, _ := json.Marshal(eventData)

	preview := &v1alpha1.PolicyPreview{
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: v1alpha1.ActivityPolicySpec{
				Resource: v1alpha1.ActivityPolicyResource{
					APIGroup: "networking.datumapis.com",
					Kind:     "HTTPProxy",
				},
				AuditRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `audit.verb == "create"`,
						Summary: `{{ actor }} created HTTPProxy`,
					},
				},
				EventRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `event.reason == "Deployed"`,
						Summary: `{{ actor }} deployed HTTPProxy`,
					},
				},
			},
			Inputs: []v1alpha1.PolicyPreviewInput{
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "create",
						User: authnv1.UserInfo{
							Username: "alice@example.com",
						},
						ObjectRef: &auditv1.ObjectReference{
							APIGroup: "networking.datumapis.com",
							Resource: "httpproxies",
							Name:     "audit-proxy",
						},
					},
				},
				{
					Type: "event",
					Event: &runtime.RawExtension{
						Raw: eventBytes,
					},
				},
			},
		},
	}

	result, err := storage.Create(context.Background(), preview, nil, &metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	resultPreview := result.(*v1alpha1.PolicyPreview)

	// Check results
	if len(resultPreview.Status.Results) != 2 {
		t.Fatalf("Expected 2 results, got %d", len(resultPreview.Status.Results))
	}

	// First input (audit) should match
	if !resultPreview.Status.Results[0].Matched {
		t.Error("Expected audit input to match")
	}
	if resultPreview.Status.Results[0].MatchedRuleType != "audit" {
		t.Errorf("Expected first result type='audit', got %q", resultPreview.Status.Results[0].MatchedRuleType)
	}

	// Second input (event) should match
	if !resultPreview.Status.Results[1].Matched {
		t.Error("Expected event input to match")
	}
	if resultPreview.Status.Results[1].MatchedRuleType != "event" {
		t.Errorf("Expected second result type='event', got %q", resultPreview.Status.Results[1].MatchedRuleType)
	}

	// Check activities
	if len(resultPreview.Status.Activities) != 2 {
		t.Fatalf("Expected 2 activities, got %d", len(resultPreview.Status.Activities))
	}

	// First activity (from audit)
	if resultPreview.Status.Activities[0].Spec.Origin.Type != "audit" {
		t.Errorf("Expected first activity origin='audit', got %q", resultPreview.Status.Activities[0].Spec.Origin.Type)
	}

	// Second activity (from event)
	if resultPreview.Status.Activities[1].Spec.Origin.Type != "event" {
		t.Errorf("Expected second activity origin='event', got %q", resultPreview.Status.Activities[1].Spec.Origin.Type)
	}
	if resultPreview.Status.Activities[1].Spec.Summary != "deploy-controller deployed HTTPProxy" {
		t.Errorf("Unexpected event activity summary: %q", resultPreview.Status.Activities[1].Spec.Summary)
	}
}

func TestPolicyPreviewStorage_Create_AuditNoMatch(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	preview := &v1alpha1.PolicyPreview{
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: v1alpha1.ActivityPolicySpec{
				Resource: v1alpha1.ActivityPolicyResource{
					APIGroup: "networking.datumapis.com",
					Kind:     "HTTPProxy",
				},
				AuditRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `audit.verb == "delete"`,
						Summary: `{{ actor }} deleted HTTPProxy`,
					},
				},
			},
			Inputs: []v1alpha1.PolicyPreviewInput{
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "create", // Different verb - should not match
						User: authnv1.UserInfo{
							Username: "alice@example.com",
						},
					},
				},
			},
		},
	}

	result, err := storage.Create(context.Background(), preview, nil, &metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	resultPreview := result.(*v1alpha1.PolicyPreview)

	if resultPreview.Status.Results[0].Matched {
		t.Error("Expected rule NOT to match, but it did")
	}

	if resultPreview.Status.Results[0].MatchedRuleIndex != -1 {
		t.Errorf("Expected MatchedRuleIndex=-1, got %d", resultPreview.Status.Results[0].MatchedRuleIndex)
	}

	// No activities should be generated
	if len(resultPreview.Status.Activities) != 0 {
		t.Errorf("Expected 0 activities, got %d", len(resultPreview.Status.Activities))
	}
}

func TestPolicyPreviewStorage_Create_InvalidInput(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	// Valid policy to use for input validation tests
	validPolicy := v1alpha1.ActivityPolicySpec{
		Resource: v1alpha1.ActivityPolicyResource{
			APIGroup: "test.example.com",
			Kind:     "TestResource",
		},
		AuditRules: []v1alpha1.ActivityPolicyRule{
			{
				Match:   "true",
				Summary: `HTTPProxy changed`,
			},
		},
	}

	tests := []struct {
		name    string
		preview *v1alpha1.PolicyPreview
		wantErr string
	}{
		{
			name: "no inputs",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: validPolicy,
					Inputs: []v1alpha1.PolicyPreviewInput{},
				},
			},
			wantErr: "Provide at least one audit log or event to test against the policy.",
		},
		{
			name: "missing input type",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: validPolicy,
					Inputs: []v1alpha1.PolicyPreviewInput{
						{Type: ""},
					},
				},
			},
			wantErr: "Specify whether this input is an 'audit' log or 'event'.",
		},
		{
			name: "invalid input type",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: validPolicy,
					Inputs: []v1alpha1.PolicyPreviewInput{
						{Type: "invalid"},
					},
				},
			},
			wantErr: `Supported values: "audit", "event".`,
		},
		{
			name: "audit type without audit data",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: validPolicy,
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type:  "audit",
							Audit: nil,
						},
					},
				},
			},
			wantErr: "Provide the audit log data to test.",
		},
		{
			name: "event type without event data",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: validPolicy,
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type:  "event",
							Event: nil,
						},
					},
				},
			},
			wantErr: "Provide the event data to test.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := storage.Create(context.Background(), tt.preview, nil, &metav1.CreateOptions{})
			if err == nil {
				t.Fatal("Expected error, got nil")
			}
			if !containsSubstring(err.Error(), tt.wantErr) {
				t.Errorf("Expected error containing %q, got %q", tt.wantErr, err.Error())
			}
		})
	}
}

func TestPolicyPreviewStorage_Create_InvalidPolicy(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	tests := []struct {
		name    string
		preview *v1alpha1.PolicyPreview
		wantErr string
	}{
		{
			name: "missing inputs",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: v1alpha1.ActivityPolicySpec{
						Resource: v1alpha1.ActivityPolicyResource{
							APIGroup: "", // empty apiGroup is valid for core API resources (v1)
							Kind:     "Pod",
						},
						AuditRules: []v1alpha1.ActivityPolicyRule{
							{
								Match:   "true",
								Summary: `HTTPProxy changed`,
							},
						},
					},
					// Inputs missing - this is what we're testing
				},
			},
			wantErr: "Provide at least one audit log or event to test",
		},
		{
			name: "missing kind",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: v1alpha1.ActivityPolicySpec{
						Resource: v1alpha1.ActivityPolicyResource{
							APIGroup: "test.example.com",
						},
						AuditRules: []v1alpha1.ActivityPolicyRule{
							{
								Match:   "true",
								Summary: `HTTPProxy changed`,
							},
						},
					},
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type: "audit",
							Audit: &auditv1.Event{
								Verb: "create",
							},
						},
					},
				},
			},
			wantErr: "Specify the kind of resource this policy targets",
		},
		{
			name: "invalid match expression",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: v1alpha1.ActivityPolicySpec{
						Resource: v1alpha1.ActivityPolicyResource{
							APIGroup: "test.example.com",
							Kind:     "TestResource",
						},
						AuditRules: []v1alpha1.ActivityPolicyRule{
							{
								Match:   "invalid.expression[",
								Summary: `HTTPProxy changed`,
							},
						},
					},
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type: "audit",
							Audit: &auditv1.Event{
								Verb: "create",
							},
						},
					},
				},
			},
			wantErr: "Invalid match expression",
		},
		{
			name: "invalid summary expression",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: v1alpha1.ActivityPolicySpec{
						Resource: v1alpha1.ActivityPolicyResource{
							APIGroup: "test.example.com",
							Kind:     "TestResource",
						},
						AuditRules: []v1alpha1.ActivityPolicyRule{
							{
								Match:   "true",
								Summary: `{{ undeclared_variable }}`,
							},
						},
					},
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type: "audit",
							Audit: &auditv1.Event{
								Verb: "create",
							},
						},
					},
				},
			},
			wantErr: "Invalid summary expression",
		},
		{
			name: "missing match expression",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: v1alpha1.ActivityPolicySpec{
						Resource: v1alpha1.ActivityPolicyResource{
							APIGroup: "test.example.com",
							Kind:     "TestResource",
						},
						AuditRules: []v1alpha1.ActivityPolicyRule{
							{
								Summary: `HTTPProxy changed`,
							},
						},
					},
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type: "audit",
							Audit: &auditv1.Event{
								Verb: "create",
							},
						},
					},
				},
			},
			wantErr: "Provide a CEL expression that determines when this rule applies",
		},
		{
			name: "missing summary expression",
			preview: &v1alpha1.PolicyPreview{
				Spec: v1alpha1.PolicyPreviewSpec{
					Policy: v1alpha1.ActivityPolicySpec{
						Resource: v1alpha1.ActivityPolicyResource{
							APIGroup: "test.example.com",
							Kind:     "TestResource",
						},
						AuditRules: []v1alpha1.ActivityPolicyRule{
							{
								Match: "true",
							},
						},
					},
					Inputs: []v1alpha1.PolicyPreviewInput{
						{
							Type: "audit",
							Audit: &auditv1.Event{
								Verb: "create",
							},
						},
					},
				},
			},
			wantErr: "Provide a template for the activity summary",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := storage.Create(context.Background(), tt.preview, nil, &metav1.CreateOptions{})
			if err == nil {
				t.Fatal("Expected error, got nil")
			}
			if !containsSubstring(err.Error(), tt.wantErr) {
				t.Errorf("Expected error containing %q, got %q", tt.wantErr, err.Error())
			}
		})
	}
}

func TestPolicyPreviewStorage_Create_ActivityFields(t *testing.T) {
	storage := NewPolicyPreviewStorage()

	preview := &v1alpha1.PolicyPreview{
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: v1alpha1.ActivityPolicySpec{
				Resource: v1alpha1.ActivityPolicyResource{
					APIGroup: "networking.datumapis.com",
					Kind:     "HTTPProxy",
				},
				AuditRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `audit.verb == "create"`,
						Summary: `{{ actor }} created HTTPProxy`,
					},
				},
			},
			Inputs: []v1alpha1.PolicyPreviewInput{
				{
					Type: "audit",
					Audit: &auditv1.Event{
						AuditID: "test-audit-123",
						Verb:    "create",
						User: authnv1.UserInfo{
							Username: "system:serviceaccount:default:my-sa",
							UID:      "uid-123",
						},
						ObjectRef: &auditv1.ObjectReference{
							APIGroup:   "networking.datumapis.com",
							APIVersion: "v1",
							Resource:   "httpproxies",
							Name:       "my-proxy",
							Namespace:  "test-ns",
						},
					},
				},
			},
		},
	}

	result, err := storage.Create(context.Background(), preview, nil, &metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	resultPreview := result.(*v1alpha1.PolicyPreview)
	activity := resultPreview.Status.Activities[0]

	// Check actor fields
	if activity.Spec.Actor.Type != "system" {
		t.Errorf("Expected Actor.Type='system', got %q", activity.Spec.Actor.Type)
	}
	if activity.Spec.Actor.Name != "serviceaccount:default:my-sa" {
		t.Errorf("Expected Actor.Name='serviceaccount:default:my-sa', got %q", activity.Spec.Actor.Name)
	}
	if activity.Spec.Actor.UID != "uid-123" {
		t.Errorf("Expected Actor.UID='uid-123', got %q", activity.Spec.Actor.UID)
	}

	// Check resource fields
	if activity.Spec.Resource.APIGroup != "networking.datumapis.com" {
		t.Errorf("Expected Resource.APIGroup='networking.datumapis.com', got %q", activity.Spec.Resource.APIGroup)
	}
	if activity.Spec.Resource.Name != "my-proxy" {
		t.Errorf("Expected Resource.Name='my-proxy', got %q", activity.Spec.Resource.Name)
	}
	if activity.Spec.Resource.Namespace != "test-ns" {
		t.Errorf("Expected Resource.Namespace='test-ns', got %q", activity.Spec.Resource.Namespace)
	}

	// Check origin fields
	if activity.Spec.Origin.Type != "audit" {
		t.Errorf("Expected Origin.Type='audit', got %q", activity.Spec.Origin.Type)
	}
	if activity.Spec.Origin.ID != "test-audit-123" {
		t.Errorf("Expected Origin.ID='test-audit-123', got %q", activity.Spec.Origin.ID)
	}

	// Check change source (service account should be system)
	if activity.Spec.ChangeSource != "system" {
		t.Errorf("Expected ChangeSource='system', got %q", activity.Spec.ChangeSource)
	}

	// Check labels
	if activity.Labels["activity.miloapis.com/origin-type"] != "audit" {
		t.Errorf("Expected label origin-type='audit', got %q", activity.Labels["activity.miloapis.com/origin-type"])
	}
}

func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && contains(s, substr)))
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
