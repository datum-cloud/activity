package activityprocessor

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/record"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

const (
	// EventReasonEvaluationFailed is the reason for Warning events when CEL evaluation fails.
	EventReasonEvaluationFailed = "EvaluationFailed"
)

// EventEmitter emits Kubernetes Warning events for policy evaluation failures.
type EventEmitter struct {
	client   client.Client
	recorder record.EventRecorder
}

// NewEventEmitter creates a new event emitter.
func NewEventEmitter(client client.Client, recorder record.EventRecorder) *EventEmitter {
	return &EventEmitter{
		client:   client,
		recorder: recorder,
	}
}

// EmitEvaluationError emits a Kubernetes Warning event for an evaluation failure.
func (e *EventEmitter) EmitEvaluationError(ctx context.Context, policyName string, ruleIndex int, err error) {
	// Fetch the current policy to emit event on it
	var policy v1alpha1.ActivityPolicy
	if fetchErr := e.client.Get(ctx, types.NamespacedName{Name: policyName}, &policy); fetchErr != nil {
		if client.IgnoreNotFound(fetchErr) == nil {
			// Policy was deleted, nothing to report
			return
		}
		klog.ErrorS(fetchErr, "Failed to fetch policy for event emission", "policy", policyName)
		return
	}

	// Build event message
	message := fmt.Sprintf("CEL evaluation failed on rule %d: %s",
		ruleIndex,
		truncateString(err.Error(), 200),
	)

	e.recorder.Event(&policy, corev1.EventTypeWarning, EventReasonEvaluationFailed, message)

	klog.V(2).InfoS("Emitted evaluation error event",
		"policy", policyName,
		"ruleIndex", ruleIndex,
	)
}

// truncateString truncates a string to the specified maximum length.
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
