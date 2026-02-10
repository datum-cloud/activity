package processor

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nats-io/nats.go"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// Publisher publishes Activity records to NATS JetStream.
// Activities are persisted to ClickHouse via Vector aggregator consuming from the stream.
type Publisher struct {
	js            nats.JetStreamContext
	subjectPrefix string
}

// NewPublisher creates a new activity publisher using JetStream.
func NewPublisher(js nats.JetStreamContext, subjectPrefix string) *Publisher {
	return &Publisher{
		js:            js,
		subjectPrefix: subjectPrefix,
	}
}

// Publish publishes an activity to NATS JetStream.
// The activity will be persisted to ClickHouse by Vector consuming from the stream.
func (p *Publisher) Publish(ctx context.Context, activity *v1alpha1.Activity) error {
	// Serialize activity to JSON
	data, err := json.Marshal(activity)
	if err != nil {
		return fmt.Errorf("failed to marshal activity: %w", err)
	}

	// Build NATS subject
	// Format: activities.<tenant_type>.<tenant_name>.<api_group>.<source>.<kind>.<namespace>.<name>
	subject := p.buildSubject(activity)

	// Use activity name as message ID for deduplication
	// Activity names contain the origin audit ID, ensuring uniqueness
	msgID := activity.Name

	// Publish to JetStream with message ID for deduplication
	_, err = p.js.Publish(subject, data, nats.MsgId(msgID), nats.Context(ctx))
	if err != nil {
		return fmt.Errorf("failed to publish activity to JetStream: %w", err)
	}

	klog.V(4).InfoS("Published activity to JetStream", "subject", subject, "msgID", msgID)
	return nil
}

// buildSubject constructs the NATS subject for an activity.
// Format: activities.<tenant_type>.<tenant_name>.<api_group>.<source>.<kind>.<namespace>.<name>
func (p *Publisher) buildSubject(activity *v1alpha1.Activity) string {
	parts := []string{p.subjectPrefix}

	// Tenant type and name
	tenantType := activity.Spec.Tenant.Type
	if tenantType == "" {
		tenantType = "platform"
	}
	parts = append(parts, tenantType)

	tenantName := activity.Spec.Tenant.Name
	if tenantName == "" {
		tenantName = "_" // Placeholder for empty tenant name
	}
	parts = append(parts, tenantName)

	// API group (replace dots with underscores for NATS compatibility)
	apiGroup := activity.Spec.Resource.APIGroup
	if apiGroup == "" {
		apiGroup = "core"
	}
	apiGroup = strings.ReplaceAll(apiGroup, ".", "_")
	parts = append(parts, apiGroup)

	// Origin type (audit or event)
	parts = append(parts, activity.Spec.Origin.Type)

	// Resource kind
	parts = append(parts, activity.Spec.Resource.Kind)

	// Namespace (use _ for cluster-scoped resources)
	namespace := activity.Spec.Resource.Namespace
	if namespace == "" {
		namespace = "_"
	}
	parts = append(parts, namespace)

	// Resource name
	parts = append(parts, activity.Spec.Resource.Name)

	return strings.Join(parts, ".")
}

// PublishBatch publishes multiple activities efficiently.
func (p *Publisher) PublishBatch(ctx context.Context, activities []*v1alpha1.Activity) error {
	var firstErr error

	for _, activity := range activities {
		if err := p.Publish(ctx, activity); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			klog.ErrorS(err, "Failed to publish activity", "activity", activity.Name)
		}
	}

	return firstErr
}
