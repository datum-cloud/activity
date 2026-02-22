package common

import (
	"fmt"

	"github.com/spf13/cobra"
)

// TimeRangeFlags contains common time range flags
type TimeRangeFlags struct {
	StartTime string
	EndTime   string
}

// AddTimeRangeFlags adds time range flags to a command
func AddTimeRangeFlags(cmd *cobra.Command, flags *TimeRangeFlags, defaultStart string) {
	cmd.Flags().StringVar(&flags.StartTime, "start-time", defaultStart, "Start time (relative: 'now-7d' or absolute: RFC3339)")
	cmd.Flags().StringVar(&flags.EndTime, "end-time", "now", "End time (relative: 'now' or absolute: RFC3339)")
}

// Validate checks that time range flags are valid
func (f *TimeRangeFlags) Validate() error {
	if f.StartTime == "" {
		return fmt.Errorf("--start-time is required")
	}
	if f.EndTime == "" {
		return fmt.Errorf("--end-time is required")
	}
	return nil
}

// PaginationFlags contains common pagination flags
type PaginationFlags struct {
	Limit         int32
	AllPages      bool
	ContinueAfter string
}

// AddPaginationFlags adds pagination flags to a command
func AddPaginationFlags(cmd *cobra.Command, flags *PaginationFlags, defaultLimit int32) {
	cmd.Flags().Int32Var(&flags.Limit, "limit", defaultLimit, "Maximum number of results per page (1-1000)")
	cmd.Flags().BoolVar(&flags.AllPages, "all-pages", false, "Fetch all pages of results")
	cmd.Flags().StringVar(&flags.ContinueAfter, "continue-after", "", "Pagination cursor from previous query")
}

// Validate checks that pagination flags are valid
func (f *PaginationFlags) Validate() error {
	if f.Limit < 1 || f.Limit > 1000 {
		return fmt.Errorf("--limit must be between 1 and 1000")
	}
	if f.AllPages && f.ContinueAfter != "" {
		return fmt.Errorf("--all-pages and --continue-after are mutually exclusive")
	}
	return nil
}

// OutputFlags contains common output flags
type OutputFlags struct {
	NoHeaders bool
	Debug     bool
}

// AddOutputFlags adds output flags to a command
func AddOutputFlags(cmd *cobra.Command, flags *OutputFlags) {
	cmd.Flags().BoolVar(&flags.NoHeaders, "no-headers", false, "Omit table headers")
	cmd.Flags().BoolVar(&flags.Debug, "debug", false, "Show debug information")
}

// SuggestFlags contains facet query flags
type SuggestFlags struct {
	Suggest string
}

// AddSuggestFlags adds suggest flag to a command
func AddSuggestFlags(cmd *cobra.Command, flags *SuggestFlags) {
	cmd.Flags().StringVar(&flags.Suggest, "suggest", "", "Show distinct values for a field (facet query)")
}

// IsSuggestMode returns true if suggest mode is active
func (f *SuggestFlags) IsSuggestMode() bool {
	return f.Suggest != ""
}
