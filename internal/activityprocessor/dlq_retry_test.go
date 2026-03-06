package activityprocessor

import (
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"go.miloapis.com/activity/internal/processor"
)

func TestCalculateBackoff(t *testing.T) {
	config := DLQRetryConfig{
		BackoffBase:       1 * time.Minute,
		BackoffMultiplier: 2.0,
		BackoffMax:        24 * time.Hour,
	}

	controller := &DLQRetryController{
		config: config,
	}

	tests := []struct {
		name       string
		retryCount int
		want       time.Duration
	}{
		{
			name:       "first retry",
			retryCount: 0,
			want:       1 * time.Minute, // base * 2^0 = 1 minute
		},
		{
			name:       "second retry",
			retryCount: 1,
			want:       2 * time.Minute, // base * 2^1 = 2 minutes
		},
		{
			name:       "third retry",
			retryCount: 2,
			want:       4 * time.Minute, // base * 2^2 = 4 minutes
		},
		{
			name:       "tenth retry",
			retryCount: 9,
			want:       512 * time.Minute, // base * 2^9 = 512 minutes
		},
		{
			name:       "caps at maximum",
			retryCount: 20,
			want:       24 * time.Hour, // exceeds max, should cap
		},
		{
			name:       "overflow protection - very high retry count",
			retryCount: 50,
			want:       24 * time.Hour, // should cap at max to prevent overflow
		},
		{
			name:       "overflow protection - extreme retry count",
			retryCount: 100,
			want:       24 * time.Hour, // should cap at max
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := controller.calculateBackoff(tt.retryCount)
			if got != tt.want {
				t.Errorf("calculateBackoff(%d) = %v, want %v", tt.retryCount, got, tt.want)
			}
		})
	}
}

func TestCalculateBackoff_ExponentialGrowth(t *testing.T) {
	config := DLQRetryConfig{
		BackoffBase:       1 * time.Minute,
		BackoffMultiplier: 2.0,
		BackoffMax:        24 * time.Hour,
	}

	controller := &DLQRetryController{
		config: config,
	}

	// Test that backoff grows exponentially until it hits the cap
	var lastBackoff time.Duration
	for i := 0; i < 15; i++ {
		backoff := controller.calculateBackoff(i)

		// Verify backoff is non-negative
		if backoff < 0 {
			t.Errorf("calculateBackoff(%d) returned negative duration: %v", i, backoff)
		}

		// Verify backoff doesn't exceed maximum
		if backoff > config.BackoffMax {
			t.Errorf("calculateBackoff(%d) = %v, exceeds max %v", i, backoff, config.BackoffMax)
		}

		// Verify exponential growth (until we hit the cap)
		if i > 0 && lastBackoff < config.BackoffMax && backoff < config.BackoffMax {
			// Should roughly double (within floating point precision)
			if backoff < lastBackoff*19/10 { // Allow 10% margin for floating point
				t.Errorf("calculateBackoff(%d) = %v, expected ~2x previous %v", i, backoff, lastBackoff)
			}
		}

		lastBackoff = backoff
	}
}

func TestIsEligibleForRetry(t *testing.T) {
	controller := &DLQRetryController{
		config: DefaultDLQRetryConfig(),
	}

	now := time.Now()

	tests := []struct {
		name           string
		event          *processor.DeadLetterEvent
		currentTime    time.Time
		wantEligible   bool
		description    string
	}{
		{
			name: "first retry is always eligible",
			event: &processor.DeadLetterEvent{
				RetryCount:     0,
				NextRetryAfter: nil,
			},
			currentTime:  now,
			wantEligible: true,
			description:  "NextRetryAfter is nil, should be eligible",
		},
		{
			name: "backoff not expired",
			event: &processor.DeadLetterEvent{
				RetryCount:     1,
				NextRetryAfter: &metav1.Time{Time: now.Add(1 * time.Hour)},
			},
			currentTime:  now,
			wantEligible: false,
			description:  "NextRetryAfter is in the future, not eligible yet",
		},
		{
			name: "backoff just expired",
			event: &processor.DeadLetterEvent{
				RetryCount:     1,
				NextRetryAfter: &metav1.Time{Time: now.Add(-1 * time.Second)},
			},
			currentTime:  now,
			wantEligible: true,
			description:  "NextRetryAfter is in the past, should be eligible",
		},
		{
			name: "backoff expired long ago",
			event: &processor.DeadLetterEvent{
				RetryCount:     5,
				NextRetryAfter: &metav1.Time{Time: now.Add(-24 * time.Hour)},
			},
			currentTime:  now,
			wantEligible: true,
			description:  "NextRetryAfter is far in the past, should be eligible",
		},
		{
			name: "backoff expires exactly now",
			event: &processor.DeadLetterEvent{
				RetryCount:     1,
				NextRetryAfter: &metav1.Time{Time: now},
			},
			currentTime:  now.Add(1 * time.Nanosecond), // Just after
			wantEligible: true,
			description:  "Current time is just after NextRetryAfter",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := controller.isEligibleForRetry(tt.event, tt.currentTime)
			if got != tt.wantEligible {
				t.Errorf("isEligibleForRetry() = %v, want %v: %s",
					got, tt.wantEligible, tt.description)
			}
		})
	}
}

func TestExtractResourceInfo(t *testing.T) {
	tests := []struct {
		name             string
		event            *processor.DeadLetterEvent
		wantAPIGroup     string
		wantKind         string
		description      string
	}{
		{
			name: "nil resource",
			event: &processor.DeadLetterEvent{
				Resource: nil,
			},
			wantAPIGroup: "unknown",
			wantKind:     "unknown",
			description:  "Resource is nil, should return 'unknown' for both",
		},
		{
			name: "empty apiGroup",
			event: &processor.DeadLetterEvent{
				Resource: &processor.DeadLetterResource{
					APIGroup: "",
					Kind:     "Pod",
				},
			},
			wantAPIGroup: "core",
			wantKind:     "Pod",
			description:  "Empty apiGroup should be normalized to 'core'",
		},
		{
			name: "empty kind",
			event: &processor.DeadLetterEvent{
				Resource: &processor.DeadLetterResource{
					APIGroup: "apps",
					Kind:     "",
				},
			},
			wantAPIGroup: "apps",
			wantKind:     "unknown",
			description:  "Empty kind should return 'unknown'",
		},
		{
			name: "normal case",
			event: &processor.DeadLetterEvent{
				Resource: &processor.DeadLetterResource{
					APIGroup: "apps",
					Kind:     "Deployment",
				},
			},
			wantAPIGroup: "apps",
			wantKind:     "Deployment",
			description:  "Normal resource should return as-is",
		},
		{
			name: "core resource with explicit empty apiGroup",
			event: &processor.DeadLetterEvent{
				Resource: &processor.DeadLetterResource{
					APIGroup: "",
					Kind:     "Service",
				},
			},
			wantAPIGroup: "core",
			wantKind:     "Service",
			description:  "Core resources have empty apiGroup, should normalize to 'core'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotAPIGroup, gotKind := extractResourceInfo(tt.event)
			if gotAPIGroup != tt.wantAPIGroup {
				t.Errorf("extractResourceInfo() apiGroup = %q, want %q: %s",
					gotAPIGroup, tt.wantAPIGroup, tt.description)
			}
			if gotKind != tt.wantKind {
				t.Errorf("extractResourceInfo() kind = %q, want %q: %s",
					gotKind, tt.wantKind, tt.description)
			}
		})
	}
}

func TestComputePayloadHash(t *testing.T) {
	// These hash values are hardcoded expected results computed from the SHA256
	// algorithm to verify that computePayloadHash produces correct, deterministic
	// results. These are not arbitrary values - they are the first 8 hex characters
	// of the SHA256 hash for each specific input payload.
	tests := []struct {
		name     string
		payload  []byte
		want     string
	}{
		{
			name:    "empty payload",
			payload: []byte{},
			want:    "e3b0c442", // First 8 chars of SHA256 of empty string
		},
		{
			name:    "simple payload",
			payload: []byte("test"),
			want:    "9f86d081", // First 8 chars of SHA256 of "test"
		},
		{
			name:    "json payload",
			payload: []byte(`{"key":"value"}`),
			want:    "e43abcf3", // First 8 chars of SHA256 of this JSON
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := computePayloadHash(tt.payload)
			if got != tt.want {
				t.Errorf("computePayloadHash() = %q, want %q", got, tt.want)
			}
			// Verify it's always 8 characters (4 bytes in hex)
			if len(got) != 8 {
				t.Errorf("computePayloadHash() returned %d characters, want 8", len(got))
			}
		})
	}
}

func TestComputePayloadHash_Uniqueness(t *testing.T) {
	// Test that different payloads produce different hashes
	payload1 := []byte(`{"event":"create","resource":"pod-1"}`)
	payload2 := []byte(`{"event":"create","resource":"pod-2"}`)
	payload3 := []byte(`{"event":"delete","resource":"pod-1"}`)

	hash1 := computePayloadHash(payload1)
	hash2 := computePayloadHash(payload2)
	hash3 := computePayloadHash(payload3)

	if hash1 == hash2 {
		t.Error("Different payloads produced same hash")
	}
	if hash1 == hash3 {
		t.Error("Different payloads produced same hash")
	}
	if hash2 == hash3 {
		t.Error("Different payloads produced same hash")
	}
}

func TestComputePayloadHash_Deterministic(t *testing.T) {
	// Test that the same payload always produces the same hash
	payload := []byte(`{"test":"data","nested":{"key":"value"}}`)

	hash1 := computePayloadHash(payload)
	hash2 := computePayloadHash(payload)
	hash3 := computePayloadHash(payload)

	if hash1 != hash2 || hash2 != hash3 {
		t.Errorf("Same payload produced different hashes: %q, %q, %q", hash1, hash2, hash3)
	}
}
