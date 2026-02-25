package preview

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

	"go.miloapis.com/activity/internal/apierrors"
	"go.miloapis.com/activity/internal/processor"
	"go.miloapis.com/activity/internal/registry/activity/policy"
	"go.miloapis.com/activity/pkg/apis/activity"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// PolicyPreviewStorage implements REST storage for PolicyPreview resources.
// This is an ephemeral resource - it only supports Create operations and
// evaluates the policy against the provided inputs without persisting anything.
type PolicyPreviewStorage struct{}

// NewPolicyPreviewStorage creates a new REST storage for PolicyPreview.
func NewPolicyPreviewStorage() *PolicyPreviewStorage {
	return &PolicyPreviewStorage{}
}

var (
	_ rest.Scoper               = &PolicyPreviewStorage{}
	_ rest.Storage              = &PolicyPreviewStorage{}
	_ rest.Creater              = &PolicyPreviewStorage{}
	_ rest.SingularNameProvider = &PolicyPreviewStorage{}
)

// New returns an empty PolicyPreview.
func (s *PolicyPreviewStorage) New() runtime.Object {
	return &v1alpha1.PolicyPreview{}
}

// Destroy cleans up resources.
func (s *PolicyPreviewStorage) Destroy() {}

// NamespaceScoped returns false because PolicyPreview is cluster-scoped.
func (s *PolicyPreviewStorage) NamespaceScoped() bool {
	return false
}

// GetSingularName returns the singular name of the resource.
func (s *PolicyPreviewStorage) GetSingularName() string {
	return "policypreview"
}

// Create evaluates the policy against all inputs and returns the result.
func (s *PolicyPreviewStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	preview, ok := obj.(*v1alpha1.PolicyPreview)
	if !ok {
		return nil, errors.NewBadRequest("expected PolicyPreview object")
	}

	// Validate the entire preview spec
	if errs := validatePolicyPreview(preview); len(errs) > 0 {
		return nil, apierrors.NewValidationStatusError(
			v1alpha1.SchemeGroupVersion.WithKind("PolicyPreview").GroupKind(), "", errs)
	}

	// Evaluate the policy against all inputs
	result := evaluatePolicy(preview)

	return result, nil
}

// validatePolicyPreview validates the entire PolicyPreview spec.
func validatePolicyPreview(preview *v1alpha1.PolicyPreview) field.ErrorList {
	allErrs := field.ErrorList{}
	specPath := field.NewPath("spec")

	// Convert v1alpha1 ActivityPolicySpec to internal type for validation
	internalSpec := convertPolicySpecToInternal(&preview.Spec.Policy)

	// Validate the policy spec
	policyPath := specPath.Child("policy")
	allErrs = append(allErrs, policy.ValidateActivityPolicySpec(internalSpec, policyPath)...)

	// Validate inputs
	allErrs = append(allErrs, validatePreviewInputs(preview.Spec.Inputs, specPath.Child("inputs"))...)

	return allErrs
}

// convertPolicySpecToInternal converts a v1alpha1 ActivityPolicySpec to the internal type.
func convertPolicySpecToInternal(in *v1alpha1.ActivityPolicySpec) *activity.ActivityPolicySpec {
	out := &activity.ActivityPolicySpec{
		Resource: activity.ActivityPolicyResource{
			APIGroup: in.Resource.APIGroup,
			Kind:     in.Resource.Kind,
		},
	}

	out.AuditRules = make([]activity.ActivityPolicyRule, len(in.AuditRules))
	for i, rule := range in.AuditRules {
		out.AuditRules[i] = activity.ActivityPolicyRule{
			Match:   rule.Match,
			Summary: rule.Summary,
		}
	}

	out.EventRules = make([]activity.ActivityPolicyRule, len(in.EventRules))
	for i, rule := range in.EventRules {
		out.EventRules[i] = activity.ActivityPolicyRule{
			Match:   rule.Match,
			Summary: rule.Summary,
		}
	}

	return out
}

// validatePreviewInputs validates the PolicyPreview inputs.
func validatePreviewInputs(inputs []v1alpha1.PolicyPreviewInput, inputsPath *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	if len(inputs) == 0 {
		allErrs = append(allErrs, field.Required(inputsPath, "provide at least one audit log or event to test against the policy"))
		return allErrs
	}

	for i, input := range inputs {
		inputPath := inputsPath.Index(i)

		if input.Type == "" {
			allErrs = append(allErrs, field.Required(inputPath.Child("type"), "specify whether this input is an 'audit' log or 'event'"))
			continue
		}

		switch input.Type {
		case "audit":
			if input.Audit == nil {
				allErrs = append(allErrs, field.Required(inputPath.Child("audit"), "provide the audit log data to test"))
			}
		case "event":
			if input.Event == nil {
				allErrs = append(allErrs, field.Required(inputPath.Child("event"), "provide the event data to test"))
			}
		default:
			allErrs = append(allErrs, field.NotSupported(inputPath.Child("type"), input.Type, []string{"audit", "event"}))
		}
	}

	return allErrs
}

// evaluatePolicy evaluates the policy spec against all inputs and returns the result.
func evaluatePolicy(preview *v1alpha1.PolicyPreview) *v1alpha1.PolicyPreview {
	result := preview.DeepCopy()
	result.Status = v1alpha1.PolicyPreviewStatus{
		Activities: []v1alpha1.Activity{},
		Results:    make([]v1alpha1.PolicyPreviewInputResult, len(preview.Spec.Inputs)),
	}

	spec := &preview.Spec.Policy

	// Process each input
	for i, input := range preview.Spec.Inputs {
		inputResult := v1alpha1.PolicyPreviewInputResult{
			InputIndex:       i,
			Matched:          false,
			MatchedRuleIndex: -1,
		}

		switch input.Type {
		case "audit":
			evalResult, err := evaluateAuditInput(spec, &input)
			if err != nil {
				inputResult.Error = err.Error()
			} else if evalResult.Activity != nil {
				inputResult.Matched = true
				inputResult.MatchedRuleIndex = evalResult.MatchedRuleIndex
				inputResult.MatchedRuleType = evalResult.MatchedRuleType
				result.Status.Activities = append(result.Status.Activities, *evalResult.Activity)
			}

		case "event":
			evalResult, err := evaluateEventInput(spec, &input)
			if err != nil {
				inputResult.Error = err.Error()
			} else if evalResult.Activity != nil {
				inputResult.Matched = true
				inputResult.MatchedRuleIndex = evalResult.MatchedRuleIndex
				inputResult.MatchedRuleType = evalResult.MatchedRuleType
				result.Status.Activities = append(result.Status.Activities, *evalResult.Activity)
			}
		}

		result.Status.Results[i] = inputResult
	}

	return result
}

// evaluateAuditInput evaluates audit rules against an audit log input using the shared processor.
func evaluateAuditInput(spec *v1alpha1.ActivityPolicySpec, input *v1alpha1.PolicyPreviewInput) (*processor.EvaluationResult, error) {
	if input.Audit == nil {
		return nil, fmt.Errorf("audit input is nil")
	}

	return processor.EvaluateAuditRules(spec, input.Audit)
}

// evaluateEventInput evaluates event rules against a Kubernetes event input using the shared processor.
func evaluateEventInput(spec *v1alpha1.ActivityPolicySpec, input *v1alpha1.PolicyPreviewInput) (*processor.EvaluationResult, error) {
	if input.Event == nil || len(input.Event.Raw) == 0 {
		return nil, fmt.Errorf("event input is nil or empty")
	}

	var eventMap map[string]interface{}
	if err := json.Unmarshal(input.Event.Raw, &eventMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	return processor.EvaluateEventRules(spec, eventMap)
}
