package reindex

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

const (
	// ReindexStreamName is the NATS stream for reindexed activities
	ReindexStreamName = "ACTIVITIES_REINDEX"

	// ReindexSubjectPrefix is the subject prefix for reindexed activities
	ReindexSubjectPrefix = "activities.reindex"

	// Default retry configuration
	defaultMaxRetries     = 3
	defaultInitialBackoff = 1 * time.Second
	defaultMaxBackoff     = 30 * time.Second
	defaultBackoffMultiplier = 2.0
)

// Publisher handles publishing activities to NATS with retry logic.
type Publisher struct {
	js nats.JetStreamContext

	// Retry configuration
	maxRetries     int
	initialBackoff time.Duration
	maxBackoff     time.Duration
	multiplier     float64
}

// NewPublisher creates a new Publisher with default retry configuration.
func NewPublisher(js nats.JetStreamContext) *Publisher {
	return &Publisher{
		js:             js,
		maxRetries:     defaultMaxRetries,
		initialBackoff: defaultInitialBackoff,
		maxBackoff:     defaultMaxBackoff,
		multiplier:     defaultBackoffMultiplier,
	}
}

// PublishActivities publishes a batch of activities to the ACTIVITIES_REINDEX stream
// with exponential backoff retry on failure.
func (p *Publisher) PublishActivities(ctx context.Context, activities []*v1alpha1.Activity) error {
	for _, activity := range activities {
		if err := p.publishWithRetry(ctx, activity); err != nil {
			return fmt.Errorf("failed to publish activity %s: %w", activity.Name, err)
		}
	}

	klog.V(3).InfoS("Published activities to NATS",
		"count", len(activities),
		"stream", ReindexStreamName,
	)

	return nil
}

// publishWithRetry publishes a single activity with exponential backoff retry.
func (p *Publisher) publishWithRetry(ctx context.Context, activity *v1alpha1.Activity) error {
	activityJSON, err := json.Marshal(activity)
	if err != nil {
		return fmt.Errorf("failed to marshal activity: %w", err)
	}

	subject := buildReindexSubject(activity)

	var lastErr error
	backoff := p.initialBackoff

	for attempt := 0; attempt < p.maxRetries; attempt++ {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Attempt to publish
		_, err := p.js.Publish(subject, activityJSON)
		if err == nil {
			if attempt > 0 {
				klog.V(2).InfoS("Successfully published after retry",
					"activity", activity.Name,
					"attempt", attempt+1,
				)
			}
			return nil
		}

		lastErr = err
		klog.Warningf("Publish failed (attempt %d/%d): %v", attempt+1, p.maxRetries, err)

		// Don't wait after the last attempt
		if attempt < p.maxRetries-1 {
			select {
			case <-time.After(backoff):
				// Calculate next backoff
				backoff = time.Duration(float64(backoff) * p.multiplier)
				if backoff > p.maxBackoff {
					backoff = p.maxBackoff
				}
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	return fmt.Errorf("failed after %d retries: %w", p.maxRetries, lastErr)
}

// buildReindexSubject constructs the NATS subject for a reindexed activity.
// Format: activities.reindex.<tenant_type>.<api_group>.<kind>
func buildReindexSubject(activity *v1alpha1.Activity) string {
	// Handle nil activity or spec defensively
	if activity == nil {
		return ReindexSubjectPrefix + ".unknown.unknown.unknown"
	}

	// Extract tenant type
	tenantType := "unknown"
	if activity.Spec.Tenant.Type != "" {
		tenantType = sanitizeSubjectToken(activity.Spec.Tenant.Type)
	}

	// Extract resource info
	apiGroup := "core"
	kind := "unknown"
	if activity.Spec.Resource.APIGroup != "" {
		apiGroup = activity.Spec.Resource.APIGroup
	}
	if activity.Spec.Resource.Kind != "" {
		kind = activity.Spec.Resource.Kind
	}
	apiGroup = sanitizeSubjectToken(apiGroup)
	kind = sanitizeSubjectToken(kind)

	return fmt.Sprintf("%s.%s.%s.%s",
		ReindexSubjectPrefix,
		tenantType,
		apiGroup,
		kind,
	)
}

// sanitizeSubjectToken replaces characters that are invalid in NATS subjects.
func sanitizeSubjectToken(s string) string {
	// NATS subjects allow alphanumeric, dash, and underscore
	// Replace dots with dashes
	result := ""
	for _, c := range s {
		if c == '.' {
			result += "-"
		} else if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			result += string(c)
		} else {
			result += "_"
		}
	}
	return result
}
