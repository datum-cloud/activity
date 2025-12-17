package timeutil

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseFlexibleTime_RFC3339(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name     string
		input    string
		expected time.Time
	}{
		{
			name:     "valid RFC3339",
			input:    "2024-01-01T00:00:00Z",
			expected: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "RFC3339 with timezone",
			input:    "2024-06-15T14:30:00-07:00",
			expected: time.Date(2024, 6, 15, 14, 30, 0, 0, time.FixedZone("", -7*3600)),
		},
		{
			name:     "RFC3339Nano with nanoseconds",
			input:    "2024-01-01T00:00:00.123456789Z",
			expected: time.Date(2024, 1, 1, 0, 0, 0, 123456789, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseFlexibleTime(tt.input, now)
			require.NoError(t, err)
			assert.True(t, tt.expected.Equal(result), "expected %v, got %v", tt.expected, result)
		})
	}
}

func TestParseFlexibleTime_Relative(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name         string
		input        string
		expectedDiff time.Duration
		tolerance    time.Duration
	}{
		{
			name:         "now",
			input:        "now",
			expectedDiff: 0,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "now-7d",
			input:        "now-7d",
			expectedDiff: -7 * 24 * time.Hour,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "now-2h",
			input:        "now-2h",
			expectedDiff: -2 * time.Hour,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "now-30m",
			input:        "now-30m",
			expectedDiff: -30 * time.Minute,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "now-90s",
			input:        "now-90s",
			expectedDiff: -90 * time.Second,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "now-1w",
			input:        "now-1w",
			expectedDiff: -7 * 24 * time.Hour,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "now-0d",
			input:        "now-0d",
			expectedDiff: 0,
			tolerance:    100 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseFlexibleTime(tt.input, now)
			require.NoError(t, err)

			actualDiff := result.Sub(now)
			diff := actualDiff - tt.expectedDiff
			if diff < 0 {
				diff = -diff
			}

			assert.True(t, diff < tt.tolerance,
				"expected diff %v (±%v), got %v (diff: %v)",
				tt.expectedDiff, tt.tolerance, actualDiff, diff)
		})
	}
}

func TestParseFlexibleTime_Invalid(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name        string
		input       string
		expectError string
	}{
		{
			name:        "invalid format",
			input:       "2024/01/01",
			expectError: "invalid time format",
		},
		{
			name:        "relative without now prefix",
			input:       "7d",
			expectError: "invalid time format",
		},
		{
			name:        "empty string",
			input:       "",
			expectError: "invalid time format",
		},
		{
			name:        "relative with invalid duration",
			input:       "now-abc",
			expectError: "invalid duration",
		},
		{
			name:        "relative with negative value",
			input:       "now--7d",
			expectError: "invalid duration",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseFlexibleTime(tt.input, now)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectError)
		})
	}
}

func TestParseFlexibleTime_FutureTimes(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name        string
		input       string
		expectError string
	}{
		{
			name:        "future relative syntax not supported - now+1d",
			input:       "now+1d",
			expectError: "Future times are not supported",
		},
		{
			name:        "future relative syntax not supported - now+2h",
			input:       "now+2h",
			expectError: "Future times are not supported",
		},
		{
			name:        "future relative syntax not supported - now+1w",
			input:       "now+1w",
			expectError: "Future times are not supported",
		},
		{
			name:        "future absolute time - RFC3339",
			input:       "2099-01-01T00:00:00Z",
			expectError: "time cannot be in the future",
		},
		{
			name:        "future absolute time - RFC3339Nano",
			input:       "2099-12-31T23:59:59.999999999Z",
			expectError: "time cannot be in the future",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseFlexibleTime(tt.input, now)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectError)
		})
	}
}

func TestParseFlexibleTime_PastAndCurrentTimes(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "now is accepted",
			input: "now",
		},
		{
			name:  "past relative time - now-1d",
			input: "now-1d",
		},
		{
			name:  "past relative time - now-2h",
			input: "now-2h",
		},
		{
			name:  "past absolute time",
			input: "2020-01-01T00:00:00Z",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseFlexibleTime(tt.input, now)
			require.NoError(t, err)
			assert.False(t, result.IsZero())
			// Should not be in the future
			assert.False(t, result.After(now))
		})
	}
}

func TestParseRelativeTime(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name         string
		input        string
		expectedDiff time.Duration
		tolerance    time.Duration
	}{
		{
			name:         "now",
			input:        "now",
			expectedDiff: 0,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "7 days ago",
			input:        "now-7d",
			expectedDiff: -7 * 24 * time.Hour,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "2 hours ago",
			input:        "now-2h",
			expectedDiff: -2 * time.Hour,
			tolerance:    100 * time.Millisecond,
		},
		{
			name:         "2 weeks ago",
			input:        "now-2w",
			expectedDiff: -14 * 24 * time.Hour,
			tolerance:    100 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseRelativeTime(tt.input, now)
			require.NoError(t, err)

			actualDiff := result.Sub(now)
			diff := actualDiff - tt.expectedDiff
			if diff < 0 {
				diff = -diff
			}

			assert.True(t, diff < tt.tolerance,
				"expected diff %v (±%v), got %v",
				tt.expectedDiff, tt.tolerance, actualDiff)
		})
	}
}

func TestParseRelativeTime_Invalid(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name        string
		input       string
		expectError string
	}{
		{
			name:        "missing now prefix",
			input:       "7d",
			expectError: "relative time must start with",
		},
		{
			name:        "now with invalid operator",
			input:       "now*7d",
			expectError: "relative time must start with",
		},
		{
			name:        "invalid duration",
			input:       "now-invalid",
			expectError: "invalid duration",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseRelativeTime(tt.input, now)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectError)
		})
	}
}

func TestParseFlexibleTime_MixedFormats(t *testing.T) {
	now := time.Now()
	// Test that we can parse different formats in the same session
	testCases := []string{
		"2020-01-01T00:00:00Z", // Changed to past date
		"now-7d",
		"2023-06-15T14:30:00-07:00", // Changed to past date
		"now",
		"now-2h",
	}

	for _, tc := range testCases {
		t.Run(tc, func(t *testing.T) {
			result, err := ParseFlexibleTime(tc, now)
			require.NoError(t, err)
			assert.False(t, result.IsZero(), "result should not be zero time")
		})
	}
}

// TestParseFlexibleTime_ConsistentNow tests that using the same reference time
// prevents sub-second drift when parsing multiple relative times
func TestParseFlexibleTime_ConsistentNow(t *testing.T) {
	now := time.Now()

	// Parse "now-7d" and "now" using the same reference time
	startTime, err := ParseFlexibleTime("now-7d", now)
	require.NoError(t, err)

	endTime, err := ParseFlexibleTime("now", now)
	require.NoError(t, err)

	// The difference should be exactly 7 days (168 hours)
	duration := endTime.Sub(startTime)
	expected := 7 * 24 * time.Hour

	// Should be exactly 168 hours with no sub-second drift
	assert.Equal(t, expected, duration,
		"Expected exactly %v, got %v (difference: %v)",
		expected, duration, duration-expected)
}

// TestParseFlexibleTime_MultipleQueries tests that parsing
// the same relative times with different reference times works correctly
func TestParseFlexibleTime_MultipleQueries(t *testing.T) {
	// Simulate two queries at slightly different times
	now1 := time.Now()
	time.Sleep(10 * time.Millisecond)
	now2 := time.Now()

	// Each query should use its own consistent reference time
	start1, err := ParseFlexibleTime("now-1h", now1)
	require.NoError(t, err)
	end1, err := ParseFlexibleTime("now", now1)
	require.NoError(t, err)

	start2, err := ParseFlexibleTime("now-1h", now2)
	require.NoError(t, err)
	end2, err := ParseFlexibleTime("now", now2)
	require.NoError(t, err)

	// Both queries should have exactly 1 hour duration
	duration1 := end1.Sub(start1)
	duration2 := end2.Sub(start2)

	assert.Equal(t, time.Hour, duration1, "First query should be exactly 1 hour")
	assert.Equal(t, time.Hour, duration2, "Second query should be exactly 1 hour")

	// The second query should be slightly later than the first
	assert.True(t, start2.After(start1), "Second query start should be after first")
	assert.True(t, end2.After(end1), "Second query end should be after first")
}

// TestDSTTransitions verifies that day-based calculations correctly handle DST transitions
func TestDSTTransitions(t *testing.T) {
	loc, err := time.LoadLocation("America/Los_Angeles")
	require.NoError(t, err)

	tests := []struct {
		name      string
		base      time.Time
		offset    string
		checkFunc func(t *testing.T, base, result time.Time)
	}{
		{
			name:   "DST spring forward - 1 day back should be same clock time",
			base:   time.Date(2024, 3, 11, 15, 0, 0, 0, loc), // Day after DST spring forward
			offset: "1d",
			checkFunc: func(t *testing.T, base, result time.Time) {
				expected := base.AddDate(0, 0, -1)
				assert.Equal(t, expected.Hour(), result.Hour(), "Hour should be preserved across DST")
				assert.Equal(t, expected.Day(), result.Day(), "Day should be 1 day earlier")
			},
		},
		{
			name:   "DST fall back - 1 day back should be same clock time",
			base:   time.Date(2024, 11, 4, 15, 0, 0, 0, loc), // Day after DST fall back
			offset: "1d",
			checkFunc: func(t *testing.T, base, result time.Time) {
				expected := base.AddDate(0, 0, -1)
				assert.Equal(t, expected.Hour(), result.Hour(), "Hour should be preserved across DST")
				assert.Equal(t, expected.Day(), result.Day(), "Day should be 1 day earlier")
			},
		},
		{
			name:   "Week across DST spring forward",
			base:   time.Date(2024, 3, 17, 10, 0, 0, 0, loc), // Week after DST
			offset: "1w",
			checkFunc: func(t *testing.T, base, result time.Time) {
				expected := base.AddDate(0, 0, -7)
				assert.Equal(t, expected.Hour(), result.Hour(), "Hour should be preserved")
				assert.Equal(t, expected.Day(), result.Day(), "Should be 7 days earlier")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := applyOffset(tt.base, tt.offset, -1)
			require.NoError(t, err)
			tt.checkFunc(t, tt.base, result)
		})
	}
}
