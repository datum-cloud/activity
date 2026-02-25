package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"go.miloapis.com/activity/pkg/apis/activity"
)

// RegisterConversions registers conversion functions with the scheme.
func RegisterConversions(s *runtime.Scheme) error {
	if err := s.AddGeneratedConversionFunc((*ActivityPolicy)(nil), (*activity.ActivityPolicy)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_v1alpha1_ActivityPolicy_To_activity_ActivityPolicy(a.(*ActivityPolicy), b.(*activity.ActivityPolicy), scope)
	}); err != nil {
		return err
	}
	if err := s.AddGeneratedConversionFunc((*activity.ActivityPolicy)(nil), (*ActivityPolicy)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_activity_ActivityPolicy_To_v1alpha1_ActivityPolicy(a.(*activity.ActivityPolicy), b.(*ActivityPolicy), scope)
	}); err != nil {
		return err
	}
	if err := s.AddGeneratedConversionFunc((*ActivityPolicyList)(nil), (*activity.ActivityPolicyList)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_v1alpha1_ActivityPolicyList_To_activity_ActivityPolicyList(a.(*ActivityPolicyList), b.(*activity.ActivityPolicyList), scope)
	}); err != nil {
		return err
	}
	if err := s.AddGeneratedConversionFunc((*activity.ActivityPolicyList)(nil), (*ActivityPolicyList)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_activity_ActivityPolicyList_To_v1alpha1_ActivityPolicyList(a.(*activity.ActivityPolicyList), b.(*ActivityPolicyList), scope)
	}); err != nil {
		return err
	}
	return nil
}

// Convert_v1alpha1_ActivityPolicy_To_activity_ActivityPolicy converts from v1alpha1 to internal
func Convert_v1alpha1_ActivityPolicy_To_activity_ActivityPolicy(in *ActivityPolicy, out *activity.ActivityPolicy, s conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert Spec
	out.Spec.Resource.APIGroup = in.Spec.Resource.APIGroup
	out.Spec.Resource.Kind = in.Spec.Resource.Kind

	out.Spec.AuditRules = make([]activity.ActivityPolicyRule, len(in.Spec.AuditRules))
	for i, rule := range in.Spec.AuditRules {
		out.Spec.AuditRules[i].Match = rule.Match
		out.Spec.AuditRules[i].Summary = rule.Summary
	}

	out.Spec.EventRules = make([]activity.ActivityPolicyRule, len(in.Spec.EventRules))
	for i, rule := range in.Spec.EventRules {
		out.Spec.EventRules[i].Match = rule.Match
		out.Spec.EventRules[i].Summary = rule.Summary
	}

	// Convert Status - Conditions are the same type (metav1.Condition)
	out.Status.ObservedGeneration = in.Status.ObservedGeneration
	if in.Status.Conditions != nil {
		out.Status.Conditions = make([]activity.Condition, len(in.Status.Conditions))
		copy(out.Status.Conditions, in.Status.Conditions)
	}

	return nil
}

// Convert_activity_ActivityPolicy_To_v1alpha1_ActivityPolicy converts from internal to v1alpha1
func Convert_activity_ActivityPolicy_To_v1alpha1_ActivityPolicy(in *activity.ActivityPolicy, out *ActivityPolicy, s conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert Spec
	out.Spec.Resource.APIGroup = in.Spec.Resource.APIGroup
	out.Spec.Resource.Kind = in.Spec.Resource.Kind

	out.Spec.AuditRules = make([]ActivityPolicyRule, len(in.Spec.AuditRules))
	for i, rule := range in.Spec.AuditRules {
		out.Spec.AuditRules[i].Match = rule.Match
		out.Spec.AuditRules[i].Summary = rule.Summary
	}

	out.Spec.EventRules = make([]ActivityPolicyRule, len(in.Spec.EventRules))
	for i, rule := range in.Spec.EventRules {
		out.Spec.EventRules[i].Match = rule.Match
		out.Spec.EventRules[i].Summary = rule.Summary
	}

	// Convert Status - Conditions are the same type (metav1.Condition)
	out.Status.ObservedGeneration = in.Status.ObservedGeneration
	if in.Status.Conditions != nil {
		out.Status.Conditions = make([]metav1.Condition, len(in.Status.Conditions))
		copy(out.Status.Conditions, in.Status.Conditions)
	}

	return nil
}

// Convert_v1alpha1_ActivityPolicyList_To_activity_ActivityPolicyList converts from v1alpha1 to internal
func Convert_v1alpha1_ActivityPolicyList_To_activity_ActivityPolicyList(in *ActivityPolicyList, out *activity.ActivityPolicyList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = make([]activity.ActivityPolicy, len(in.Items))
	for i := range in.Items {
		if err := Convert_v1alpha1_ActivityPolicy_To_activity_ActivityPolicy(&in.Items[i], &out.Items[i], s); err != nil {
			return err
		}
	}
	return nil
}

// Convert_activity_ActivityPolicyList_To_v1alpha1_ActivityPolicyList converts from internal to v1alpha1
func Convert_activity_ActivityPolicyList_To_v1alpha1_ActivityPolicyList(in *activity.ActivityPolicyList, out *ActivityPolicyList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = make([]ActivityPolicy, len(in.Items))
	for i := range in.Items {
		if err := Convert_activity_ActivityPolicy_To_v1alpha1_ActivityPolicy(&in.Items[i], &out.Items[i], s); err != nil {
			return err
		}
	}
	return nil
}
