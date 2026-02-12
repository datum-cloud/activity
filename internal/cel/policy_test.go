package cel

import (
	"strings"
	"testing"
)

func TestValidatePolicyExpression_MatchExpressions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		ruleType   PolicyRuleType
		wantErr    bool
		errContains string
	}{
		{
			name:       "valid audit verb match",
			expression: "audit.verb == 'create'",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid audit verb in list",
			expression: "audit.verb in ['update', 'patch']",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid audit subresource check",
			expression: "audit.objectRef.subresource == 'status'",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid true fallback",
			expression: "true",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid event reason match",
			expression: "event.reason == 'Programmed'",
			ruleType:   EventRule,
			wantErr:    false,
		},
		{
			name:       "valid event startsWith",
			expression: "event.reason.startsWith('Failed')",
			ruleType:   EventRule,
			wantErr:    false,
		},
		{
			name:       "invalid - non-boolean return",
			expression: "audit.verb",
			ruleType:   AuditRule,
			wantErr:    true,
			errContains: "must return a boolean",
		},
		{
			name:       "invalid - undefined variable",
			expression: "foo.bar == 'test'",
			ruleType:   AuditRule,
			wantErr:    true,
			errContains: "undeclared reference",
		},
		{
			name:       "invalid - empty expression",
			expression: "",
			ruleType:   AuditRule,
			wantErr:    true,
			errContains: "cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePolicyExpression(tt.expression, MatchExpression, tt.ruleType)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errContains)
				} else if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("expected error containing %q, got %q", tt.errContains, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestValidatePolicyExpression_SummaryExpressions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		ruleType   PolicyRuleType
		wantErr    bool
		errContains string
	}{
		{
			name:       "valid actor template",
			expression: "{{ actor }} created something",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid link function",
			expression: "{{ actor }} created {{ link('Deployment ' + audit.objectRef.name, audit.responseObject) }}",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid link in ternary expression",
			expression: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} modified {{ audit.objectRef.name }}",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid event summary",
			expression: "{{ link('HTTPProxy ' + event.regarding.name, event.regarding) }} is now programmed",
			ruleType:   EventRule,
			wantErr:    false,
		},
		{
			name:       "valid multiple templates",
			expression: "{{ actor }} updated Deployment {{ audit.objectRef.name }}",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "valid static summary (no templates)",
			expression: "Something happened",
			ruleType:   AuditRule,
			wantErr:    false,
		},
		{
			name:       "invalid - empty template expression",
			expression: "{{ }}",
			ruleType:   AuditRule,
			wantErr:    true,
			errContains: "empty expression",
		},
		{
			name:       "invalid - undefined variable in template",
			expression: "{{ foo.bar }}",
			ruleType:   AuditRule,
			wantErr:    true,
			errContains: "undeclared reference",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePolicyExpression(tt.expression, SummaryExpression, tt.ruleType)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errContains)
				} else if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("expected error containing %q, got %q", tt.errContains, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestEvaluateAuditSummary_TernaryWithLink(t *testing.T) {
	tests := []struct {
		name           string
		template       string
		auditMap       map[string]interface{}
		wantSummary    string
		wantLinkCount  int
		wantErr        bool
	}{
		{
			name:     "ternary evaluates to system (no link)",
			template: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} modified pod",
			auditMap: map[string]interface{}{
				"user": map[string]interface{}{
					"username": "system:serviceaccount:kube-system:default",
				},
				"objectRef": map[string]interface{}{
					"resource": "pods",
					"name":     "test-pod",
				},
			},
			wantSummary:   "System modified pod",
			wantLinkCount: 0,
			wantErr:       false,
		},
		{
			name:     "ternary evaluates to link (user actor)",
			template: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} modified pod",
			auditMap: map[string]interface{}{
				"user": map[string]interface{}{
					"username": "kubernetes-admin",
				},
				"objectRef": map[string]interface{}{
					"resource": "pods",
					"name":     "test-pod",
				},
			},
			wantSummary:   "kubernetes-admin modified pod",
			wantLinkCount: 1, // Link is captured even inside ternary
			wantErr:       false,
		},
		{
			name:     "standalone link function",
			template: "{{ link(audit.objectRef.name, audit.objectRef) }} was modified",
			auditMap: map[string]interface{}{
				"user": map[string]interface{}{
					"username": "admin",
				},
				"objectRef": map[string]interface{}{
					"resource": "pods",
					"name":     "my-pod",
				},
			},
			wantSummary:   "my-pod was modified",
			wantLinkCount: 1,
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary, links, err := EvaluateAuditSummary(tt.template, tt.auditMap)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if summary != tt.wantSummary {
				t.Errorf("got summary %q, want %q", summary, tt.wantSummary)
			}

			if len(links) != tt.wantLinkCount {
				t.Errorf("got %d links, want %d", len(links), tt.wantLinkCount)
			}
		})
	}
}
