package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"go.miloapis.com/activity/pkg/apis/activity"
)

// RegisterConversions registers conversion functions with the scheme.
func RegisterConversions(s *runtime.Scheme) error {
	// ActivityPolicy conversions
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

	// ReindexJob conversions
	if err := s.AddGeneratedConversionFunc((*ReindexJob)(nil), (*activity.ReindexJob)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_v1alpha1_ReindexJob_To_activity_ReindexJob(a.(*ReindexJob), b.(*activity.ReindexJob), scope)
	}); err != nil {
		return err
	}
	if err := s.AddGeneratedConversionFunc((*activity.ReindexJob)(nil), (*ReindexJob)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_activity_ReindexJob_To_v1alpha1_ReindexJob(a.(*activity.ReindexJob), b.(*ReindexJob), scope)
	}); err != nil {
		return err
	}
	if err := s.AddGeneratedConversionFunc((*ReindexJobList)(nil), (*activity.ReindexJobList)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_v1alpha1_ReindexJobList_To_activity_ReindexJobList(a.(*ReindexJobList), b.(*activity.ReindexJobList), scope)
	}); err != nil {
		return err
	}
	if err := s.AddGeneratedConversionFunc((*activity.ReindexJobList)(nil), (*ReindexJobList)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_activity_ReindexJobList_To_v1alpha1_ReindexJobList(a.(*activity.ReindexJobList), b.(*ReindexJobList), scope)
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

// Convert_v1alpha1_ReindexJob_To_activity_ReindexJob converts from v1alpha1 to internal
func Convert_v1alpha1_ReindexJob_To_activity_ReindexJob(in *ReindexJob, out *activity.ReindexJob, s conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert Spec
	out.Spec.TimeRange.StartTime = in.Spec.TimeRange.StartTime
	out.Spec.TimeRange.EndTime = in.Spec.TimeRange.EndTime

	if in.Spec.PolicySelector != nil {
		out.Spec.PolicySelector = &activity.ReindexPolicySelector{
			Names:       in.Spec.PolicySelector.Names,
			MatchLabels: in.Spec.PolicySelector.MatchLabels,
		}
	}

	if in.Spec.Config != nil {
		out.Spec.Config = &activity.ReindexConfig{
			BatchSize: in.Spec.Config.BatchSize,
			RateLimit: in.Spec.Config.RateLimit,
			DryRun:    in.Spec.Config.DryRun,
		}
	}

	out.Spec.TTLSecondsAfterFinished = in.Spec.TTLSecondsAfterFinished

	// Convert Status
	out.Status.Phase = activity.ReindexJobPhase(in.Status.Phase)
	out.Status.Message = in.Status.Message

	if in.Status.Progress != nil {
		out.Status.Progress = &activity.ReindexProgress{
			TotalEvents:         in.Status.Progress.TotalEvents,
			ProcessedEvents:     in.Status.Progress.ProcessedEvents,
			ActivitiesGenerated: in.Status.Progress.ActivitiesGenerated,
			Errors:              in.Status.Progress.Errors,
			CurrentBatch:        in.Status.Progress.CurrentBatch,
			TotalBatches:        in.Status.Progress.TotalBatches,
		}
	}

	out.Status.StartedAt = in.Status.StartedAt
	out.Status.CompletedAt = in.Status.CompletedAt

	if in.Status.Conditions != nil {
		out.Status.Conditions = make([]activity.Condition, len(in.Status.Conditions))
		copy(out.Status.Conditions, in.Status.Conditions)
	}

	return nil
}

// Convert_activity_ReindexJob_To_v1alpha1_ReindexJob converts from internal to v1alpha1
func Convert_activity_ReindexJob_To_v1alpha1_ReindexJob(in *activity.ReindexJob, out *ReindexJob, s conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert Spec
	out.Spec.TimeRange.StartTime = in.Spec.TimeRange.StartTime
	out.Spec.TimeRange.EndTime = in.Spec.TimeRange.EndTime

	if in.Spec.PolicySelector != nil {
		out.Spec.PolicySelector = &ReindexPolicySelector{
			Names:       in.Spec.PolicySelector.Names,
			MatchLabels: in.Spec.PolicySelector.MatchLabels,
		}
	}

	if in.Spec.Config != nil {
		out.Spec.Config = &ReindexConfig{
			BatchSize: in.Spec.Config.BatchSize,
			RateLimit: in.Spec.Config.RateLimit,
			DryRun:    in.Spec.Config.DryRun,
		}
	}

	out.Spec.TTLSecondsAfterFinished = in.Spec.TTLSecondsAfterFinished

	// Convert Status
	out.Status.Phase = ReindexJobPhase(in.Status.Phase)
	out.Status.Message = in.Status.Message

	if in.Status.Progress != nil {
		out.Status.Progress = &ReindexProgress{
			TotalEvents:         in.Status.Progress.TotalEvents,
			ProcessedEvents:     in.Status.Progress.ProcessedEvents,
			ActivitiesGenerated: in.Status.Progress.ActivitiesGenerated,
			Errors:              in.Status.Progress.Errors,
			CurrentBatch:        in.Status.Progress.CurrentBatch,
			TotalBatches:        in.Status.Progress.TotalBatches,
		}
	}

	out.Status.StartedAt = in.Status.StartedAt
	out.Status.CompletedAt = in.Status.CompletedAt

	if in.Status.Conditions != nil {
		out.Status.Conditions = make([]metav1.Condition, len(in.Status.Conditions))
		copy(out.Status.Conditions, in.Status.Conditions)
	}

	return nil
}

// Convert_v1alpha1_ReindexJobList_To_activity_ReindexJobList converts from v1alpha1 to internal
func Convert_v1alpha1_ReindexJobList_To_activity_ReindexJobList(in *ReindexJobList, out *activity.ReindexJobList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = make([]activity.ReindexJob, len(in.Items))
	for i := range in.Items {
		if err := Convert_v1alpha1_ReindexJob_To_activity_ReindexJob(&in.Items[i], &out.Items[i], s); err != nil {
			return err
		}
	}
	return nil
}

// Convert_activity_ReindexJobList_To_v1alpha1_ReindexJobList converts from internal to v1alpha1
func Convert_activity_ReindexJobList_To_v1alpha1_ReindexJobList(in *activity.ReindexJobList, out *ReindexJobList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = make([]ReindexJob, len(in.Items))
	for i := range in.Items {
		if err := Convert_activity_ReindexJob_To_v1alpha1_ReindexJob(&in.Items[i], &out.Items[i], s); err != nil {
			return err
		}
	}
	return nil
}
