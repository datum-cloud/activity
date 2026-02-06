package record

import (
	"context"
)

// ActivityQueryParams holds custom query parameters for activity list requests.
type ActivityQueryParams struct {
	// StartTime filters activities to those after this time.
	// Supports RFC3339 or relative times like "now-7d".
	StartTime string

	// EndTime filters activities to those before this time.
	// Supports RFC3339 or relative times like "now".
	EndTime string

	// Search performs full-text search on activity summaries.
	Search string

	// ChangeSource filters by human or system changes.
	ChangeSource string

	// Filter is a CEL expression for advanced filtering.
	Filter string
}

// contextKey is a private type for context keys to avoid collisions.
type contextKey int

const (
	// activityQueryParamsKey is the context key for ActivityQueryParams.
	activityQueryParamsKey contextKey = iota
)

// WithActivityQueryParams returns a new context with the activity query params stored.
func WithActivityQueryParams(ctx context.Context, params ActivityQueryParams) context.Context {
	return context.WithValue(ctx, activityQueryParamsKey, params)
}

// ActivityQueryParamsFrom extracts ActivityQueryParams from the context.
// Returns an empty params struct if not present.
func ActivityQueryParamsFrom(ctx context.Context) ActivityQueryParams {
	params, _ := ctx.Value(activityQueryParamsKey).(ActivityQueryParams)
	return params
}
