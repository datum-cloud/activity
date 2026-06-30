package cel

import (
	"strings"
	"testing"
)

// TestValidateGuardedDerefs_Match covers unguarded deep dereferences of
// audit.responseObject / audit.requestObject in match expressions (issue #214).
func TestValidateGuardedDerefs_Match(t *testing.T) {
	tests := []struct {
		name        string
		expression  string
		wantErr     bool
		errContains string
	}{
		{
			name:        "VIOLATION: unguarded responseObject deep deref",
			expression:  "audit.responseObject.spec.foo == 'x'",
			wantErr:     true,
			errContains: "unguarded dereference of \"audit.responseObject.spec.foo\"",
		},
		{
			name:        "VIOLATION: root-only guard is insufficient",
			expression:  "(has(audit.responseObject) ? audit.responseObject.metadata.name : '') == 'x'",
			wantErr:     true,
			errContains: "unguarded dereference of \"audit.responseObject.metadata.name\"",
		},
		{
			name:        "VIOLATION: requestObject deep deref unguarded",
			expression:  "audit.requestObject.spec.replicas == 3",
			wantErr:     true,
			errContains: "unguarded dereference of \"audit.requestObject.spec.replicas\"",
		},
		{
			name:       "OK: fully guarded responseObject deref",
			expression: "(has(audit.responseObject.metadata) && has(audit.responseObject.metadata.name) ? audit.responseObject.metadata.name : '') == 'x'",
			wantErr:    false,
		},
		{
			name:       "OK: different root objectRef",
			expression: "audit.objectRef.name == 'foo'",
			wantErr:    false,
		},
		{
			name:       "OK: responseStatus code gate",
			expression: "audit.responseStatus.code < 300",
			wantErr:    false,
		},
		{
			name:       "OK: bare has(audit.responseObject)",
			expression: "has(audit.responseObject)",
			wantErr:    false,
		},
		{
			name:       "OK: bare audit.responseObject root read",
			expression: "audit.responseObject == {}",
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePolicyExpression(tt.expression, MatchExpression, AuditRule)
			checkErr(t, err, tt.wantErr, tt.errContains)
		})
	}
}

// TestValidateGuardedDerefs_Summary covers the same rule for embedded {{ }} CEL
// in summary templates, including the exact #215/#212 bug.
func TestValidateGuardedDerefs_Summary(t *testing.T) {
	tests := []struct {
		name        string
		expression  string
		wantErr     bool
		errContains string
	}{
		{
			name:        "VIOLATION: link with unguarded responseObject.metadata.name (#215/#212)",
			expression:  "{{ link(audit.responseObject.metadata.name, audit.objectRef) }}",
			wantErr:     true,
			errContains: "unguarded dereference of \"audit.responseObject.metadata.name\"",
		},
		{
			name:       "OK: guarded deref in summary",
			expression: "{{ has(audit.responseObject.metadata) && has(audit.responseObject.metadata.name) ? audit.responseObject.metadata.name : '' }}",
			wantErr:    false,
		},
		{
			name:       "OK: objectRef.name in summary",
			expression: "{{ link(audit.objectRef.name, audit.objectRef) }}",
			wantErr:    false,
		},
		{
			name:       "OK: static summary, no deref",
			expression: "{{ actor }} created {{ kind }}",
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePolicyExpression(tt.expression, SummaryExpression, AuditRule)
			checkErr(t, err, tt.wantErr, tt.errContains)
		})
	}
}

// TestValidateGuardedDerefs_DeepestOnly verifies that only the deepest violating
// path is reported per chain to keep errors actionable.
func TestValidateGuardedDerefs_DeepestOnly(t *testing.T) {
	err := ValidatePolicyExpression("audit.responseObject.metadata.name == 'x'", MatchExpression, AuditRule)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "audit.responseObject.metadata.name") {
		t.Errorf("expected deepest path in error, got %q", err.Error())
	}
	// The intermediate path should not be reported as its own violation.
	if strings.Contains(err.Error(), "of \"audit.responseObject.metadata\":") {
		t.Errorf("intermediate path should not be reported separately: %q", err.Error())
	}
}

func checkErr(t *testing.T, err error, wantErr bool, errContains string) {
	t.Helper()
	if wantErr {
		if err == nil {
			t.Fatalf("expected error containing %q, got nil", errContains)
		}
		if errContains != "" && !strings.Contains(err.Error(), errContains) {
			t.Errorf("expected error containing %q, got %q", errContains, err.Error())
		}
	} else if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
