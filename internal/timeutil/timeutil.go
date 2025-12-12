package timeutil

import (
	"fmt"
	"strings"
	"time"
)

// ParseFlexibleTime parses time strings in RFC3339 or relative format using a specific reference time.
//
// The now parameter is used as the reference point for:
// - Relative time expressions (e.g., "now-7d" uses now as the starting point)
// - Future time validation (times after now are rejected)
//
// Using an explicit reference time ensures consistency when parsing multiple times
// and prevents sub-second drift between calls.
//
// Supported formats:
//   - RFC3339: "2024-01-01T00:00:00Z"
//   - RFC3339Nano: "2024-01-01T00:00:00.123456789Z"
//   - Relative past time: "now", "now-7d", "now-2h"
//
// Relative time units: s (seconds), m (minutes), h (hours), d (days), w (weeks)
//
// Note: Future times are rejected since audit logs are historical records.
// The "now+" syntax is not supported.
func ParseFlexibleTime(timeStr string, now time.Time) (time.Time, error) {
	var parsedTime time.Time
	var err error

	if t, parseErr := time.Parse(time.RFC3339, timeStr); parseErr == nil {
		parsedTime = t
	} else if t, parseErr := time.Parse(time.RFC3339Nano, timeStr); parseErr == nil {
		parsedTime = t
	} else if strings.HasPrefix(timeStr, "now") {
		parsedTime, err = ParseRelativeTime(timeStr, now)
		if err != nil {
			return time.Time{}, err
		}
	} else {
		return time.Time{}, fmt.Errorf("invalid time format: %s (use RFC3339 like '2024-01-01T00:00:00Z' or relative like 'now-7d')", timeStr)
	}

	// Reject future times - audit logs are historical records
	if parsedTime.After(now) {
		return time.Time{}, fmt.Errorf("time cannot be in the future: %s (audit logs are historical records)", timeStr)
	}

	return parsedTime, nil
}

// ParseRelativeTime parses relative time expressions using a specific reference time.
//
// The now parameter is used as the reference point for relative expressions.
// This ensures consistency when parsing multiple relative times.
//
// Only past times are supported (now- syntax) since audit logs are historical records.
// Future times (now+ syntax) are not supported.
//
// Days and weeks use AddDate to preserve clock time across DST transitions.
// Hours, minutes, and seconds use exact duration arithmetic.
//
// Examples: "now", "now-7d", "now-2h"
func ParseRelativeTime(expr string, now time.Time) (time.Time, error) {
	if expr == "now" {
		return now, nil
	}

	if !strings.HasPrefix(expr, "now-") {
		return time.Time{}, fmt.Errorf("relative time must start with 'now' or 'now-' (e.g., 'now-7d'). Future times are not supported for audit log queries")
	}

	offset := expr[4:]
	return applyOffset(now, offset, -1)
}

// applyOffset applies a time offset to the given time, handling DST correctly.
// For days/weeks, uses AddDate to preserve clock time. For hours/minutes/seconds, uses Add.
func applyOffset(t time.Time, offset string, sign int) (time.Time, error) {
	if len(offset) < 2 {
		return time.Time{}, fmt.Errorf("invalid duration: %s (must be <number><unit>, e.g., '7d', '2h')", offset)
	}

	unit := offset[len(offset)-1]
	valueStr := offset[:len(offset)-1]

	var value int
	if _, err := fmt.Sscanf(valueStr, "%d", &value); err != nil {
		return time.Time{}, fmt.Errorf("invalid duration value: %s (expected number before unit)", offset)
	}

	if value < 0 {
		return time.Time{}, fmt.Errorf("invalid duration value: %s (must be non-negative)", offset)
	}

	switch unit {
	case 'd':
		return t.AddDate(0, 0, sign*value), nil
	case 'w':
		return t.AddDate(0, 0, sign*value*7), nil
	case 'h':
		return t.Add(time.Duration(sign*value) * time.Hour), nil
	case 'm':
		return t.Add(time.Duration(sign*value) * time.Minute), nil
	case 's':
		return t.Add(time.Duration(sign*value) * time.Second), nil
	default:
		return time.Time{}, fmt.Errorf("invalid duration unit: %c (use s, m, h, d, or w)", unit)
	}
}
