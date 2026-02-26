package common

import (
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeRangeFlags_Validate(t *testing.T) {
	tests := []struct {
		name      string
		startTime string
		endTime   string
		wantErr   bool
		errMsg    string
	}{
		{
			name:      "valid time range",
			startTime: "now-24h",
			endTime:   "now",
			wantErr:   false,
		},
		{
			name:      "empty start time",
			startTime: "",
			endTime:   "now",
			wantErr:   true,
			errMsg:    "--start-time is required",
		},
		{
			name:      "empty end time",
			startTime: "now-24h",
			endTime:   "",
			wantErr:   true,
			errMsg:    "--end-time is required",
		},
		{
			name:      "both empty",
			startTime: "",
			endTime:   "",
			wantErr:   true,
			errMsg:    "--start-time is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flags := &TimeRangeFlags{
				StartTime: tt.startTime,
				EndTime:   tt.endTime,
			}

			err := flags.Validate()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestAddTimeRangeFlags(t *testing.T) {
	cmd := &cobra.Command{
		Use: "test",
	}
	flags := &TimeRangeFlags{}

	AddTimeRangeFlags(cmd, flags, "now-7d")

	// Verify flags were added
	assert.NotNil(t, cmd.Flags().Lookup("start-time"))
	assert.NotNil(t, cmd.Flags().Lookup("end-time"))

	// Verify default values
	assert.Equal(t, "now-7d", flags.StartTime)
	assert.Equal(t, "now", flags.EndTime)
}

func TestPaginationFlags_Validate(t *testing.T) {
	tests := []struct {
		name          string
		limit         int32
		allPages      bool
		continueAfter string
		wantErr       bool
		errMsg        string
	}{
		{
			name:     "valid limit",
			limit:    25,
			allPages: false,
			wantErr:  false,
		},
		{
			name:     "minimum limit",
			limit:    1,
			allPages: false,
			wantErr:  false,
		},
		{
			name:     "maximum limit",
			limit:    1000,
			allPages: false,
			wantErr:  false,
		},
		{
			name:     "limit too low",
			limit:    0,
			allPages: false,
			wantErr:  true,
			errMsg:   "--limit must be between 1 and 1000",
		},
		{
			name:     "limit too high",
			limit:    1001,
			allPages: false,
			wantErr:  true,
			errMsg:   "--limit must be between 1 and 1000",
		},
		{
			name:          "all-pages with continue-after",
			limit:         25,
			allPages:      true,
			continueAfter: "cursor123",
			wantErr:       true,
			errMsg:        "--all-pages and --continue-after are mutually exclusive",
		},
		{
			name:          "continue-after without all-pages",
			limit:         25,
			allPages:      false,
			continueAfter: "cursor123",
			wantErr:       false,
		},
		{
			name:     "all-pages without continue-after",
			limit:    25,
			allPages: true,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flags := &PaginationFlags{
				Limit:         tt.limit,
				AllPages:      tt.allPages,
				ContinueAfter: tt.continueAfter,
			}

			err := flags.Validate()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestAddPaginationFlags(t *testing.T) {
	cmd := &cobra.Command{
		Use: "test",
	}
	flags := &PaginationFlags{}

	AddPaginationFlags(cmd, flags, 50)

	// Verify flags were added
	assert.NotNil(t, cmd.Flags().Lookup("limit"))
	assert.NotNil(t, cmd.Flags().Lookup("all-pages"))
	assert.NotNil(t, cmd.Flags().Lookup("continue-after"))

	// Verify default values
	assert.Equal(t, int32(50), flags.Limit)
	assert.False(t, flags.AllPages)
	assert.Empty(t, flags.ContinueAfter)
}

func TestOutputFlags(t *testing.T) {
	cmd := &cobra.Command{
		Use: "test",
	}
	flags := &OutputFlags{}

	AddOutputFlags(cmd, flags)

	// Verify flags were added
	assert.NotNil(t, cmd.Flags().Lookup("no-headers"))
	assert.NotNil(t, cmd.Flags().Lookup("debug"))

	// Verify default values
	assert.False(t, flags.NoHeaders)
	assert.False(t, flags.Debug)
}

func TestSuggestFlags_IsSuggestMode(t *testing.T) {
	tests := []struct {
		name    string
		suggest string
		want    bool
	}{
		{
			name:    "suggest mode active",
			suggest: "user.username",
			want:    true,
		},
		{
			name:    "suggest mode inactive",
			suggest: "",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flags := &SuggestFlags{
				Suggest: tt.suggest,
			}

			got := flags.IsSuggestMode()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestAddSuggestFlags(t *testing.T) {
	cmd := &cobra.Command{
		Use: "test",
	}
	flags := &SuggestFlags{}

	AddSuggestFlags(cmd, flags)

	// Verify flag was added
	assert.NotNil(t, cmd.Flags().Lookup("suggest"))

	// Verify default value
	assert.Empty(t, flags.Suggest)
}
