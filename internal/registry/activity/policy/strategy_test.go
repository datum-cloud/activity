package policy

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

func TestValidateActivityPolicy(t *testing.T) {
	tests := []struct {
		name      string
		policy    *v1alpha1.ActivityPolicy
		wantErrs  int
		wantPaths []string
	}{
		{
			name: "valid policy with audit and event rules",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "HTTPProxy",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'",
							Summary: "{{ actor }} created HTTPProxy",
						},
					},
					EventRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "event.reason == 'Programmed'",
							Summary: "HTTPProxy is programmed",
						},
					},
				},
			},
			wantErrs: 0,
		},
		{
			name: "valid policy with fallback rule",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "Network",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "true",
							Summary: "{{ actor }} {{ audit.verb }}d HTTPProxy",
						},
					},
				},
			},
			wantErrs: 0,
		},
		{
			name: "valid policy with empty apiGroup (core API)",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "", // empty string is valid for core API resources (v1)
						Kind:     "Pod",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'",
							Summary: "{{ actor }} created HTTPProxy",
						},
					},
				},
			},
			wantErrs: 0,
		},
		{
			name: "missing kind",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'",
							Summary: "{{ actor }} created HTTPProxy",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.resource.kind"},
		},
		{
			name: "missing kind (apiGroup empty is valid for core API)",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'",
							Summary: "{{ actor }} created HTTPProxy",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.resource.kind"},
		},
		{
			name: "invalid match expression",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "HTTPProxy",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "invalid syntax !!!",
							Summary: "{{ actor }} created HTTPProxy",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.auditRules[0].match"},
		},
		{
			name: "invalid summary expression",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "HTTPProxy",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'",
							Summary: "{{ undefinedVar }}",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.auditRules[0].summary"},
		},
		{
			name: "missing match expression",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "HTTPProxy",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "",
							Summary: "{{ actor }} created HTTPProxy",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.auditRules[0].match"},
		},
		{
			name: "missing summary expression",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "HTTPProxy",
					},
					AuditRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'",
							Summary: "",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.auditRules[0].summary"},
		},
		{
			name: "event rule with wrong variable",
			policy: &v1alpha1.ActivityPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-policy",
				},
				Spec: v1alpha1.ActivityPolicySpec{
					Resource: v1alpha1.ActivityPolicyResource{
						APIGroup: "networking.datumapis.com",
						Kind:     "HTTPProxy",
					},
					EventRules: []v1alpha1.ActivityPolicyRule{
						{
							Match:   "audit.verb == 'create'", // should use event, not audit
							Summary: "HTTPProxy created",
						},
					},
				},
			},
			wantErrs:  1,
			wantPaths: []string{"spec.eventRules[0].match"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateActivityPolicy(tt.policy)

			if len(errs) != tt.wantErrs {
				t.Errorf("expected %d errors, got %d: %v", tt.wantErrs, len(errs), errs)
			}

			if tt.wantPaths != nil {
				for i, wantPath := range tt.wantPaths {
					if i >= len(errs) {
						t.Errorf("expected error at path %s, but only got %d errors", wantPath, len(errs))
						continue
					}
					if errs[i].Field != wantPath {
						t.Errorf("expected error at path %s, got %s", wantPath, errs[i].Field)
					}
				}
			}
		})
	}
}
