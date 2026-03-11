package reindexjob

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/cli-runtime/pkg/genericclioptions"
)

func TestNewCreateOptions(t *testing.T) {
	ioStreams := genericclioptions.IOStreams{}

	o := NewCreateOptions(nil, ioStreams)

	assert.NotNil(t, o)
	assert.Equal(t, "now", o.EndTime)
	assert.Empty(t, o.StartTime)
	assert.Equal(t, int32(0), o.BatchSize)
	assert.Equal(t, int32(0), o.RateLimit)
	assert.False(t, o.DryRun)
	assert.Equal(t, int32(0), o.TTL)
	assert.NotNil(t, o.PrintFlags)
}

func TestCreateOptions_Validate(t *testing.T) {
	tests := []struct {
		name      string
		startTime string
		batchSize int32
		rateLimit int32
		ttl       int32
		wantErr   bool
		errMsg    string
	}{
		{
			name:      "valid defaults - start time only",
			startTime: "now-7d",
			wantErr:   false,
		},
		{
			name:      "valid absolute start time",
			startTime: "2026-02-01T00:00:00Z",
			wantErr:   false,
		},
		{
			name:      "valid batch-size at minimum boundary",
			startTime: "now-7d",
			batchSize: 100,
			wantErr:   false,
		},
		{
			name:      "valid batch-size at maximum boundary",
			startTime: "now-7d",
			batchSize: 10000,
			wantErr:   false,
		},
		{
			name:      "valid batch-size in range",
			startTime: "now-7d",
			batchSize: 500,
			wantErr:   false,
		},
		{
			name:      "valid rate-limit at minimum boundary",
			startTime: "now-7d",
			rateLimit: 10,
			wantErr:   false,
		},
		{
			name:      "valid rate-limit at maximum boundary",
			startTime: "now-7d",
			rateLimit: 1000,
			wantErr:   false,
		},
		{
			name:      "valid rate-limit in range",
			startTime: "now-7d",
			rateLimit: 100,
			wantErr:   false,
		},
		{
			name:      "valid ttl",
			startTime: "now-7d",
			ttl:       3600,
			wantErr:   false,
		},
		{
			name:      "valid zero ttl retains indefinitely",
			startTime: "now-7d",
			ttl:       0,
			wantErr:   false,
		},
		{
			name:      "empty start-time fails",
			startTime: "",
			wantErr:   true,
			errMsg:    "--start-time is required",
		},
		{
			name:      "batch-size one below minimum fails",
			startTime: "now-7d",
			batchSize: 99,
			wantErr:   true,
			errMsg:    "--batch-size must be between 100 and 10000",
		},
		{
			name:      "batch-size of 1 fails",
			startTime: "now-7d",
			batchSize: 1,
			wantErr:   true,
			errMsg:    "--batch-size must be between 100 and 10000",
		},
		{
			name:      "batch-size one above maximum fails",
			startTime: "now-7d",
			batchSize: 10001,
			wantErr:   true,
			errMsg:    "--batch-size must be between 100 and 10000",
		},
		{
			name:      "rate-limit one below minimum fails",
			startTime: "now-7d",
			rateLimit: 9,
			wantErr:   true,
			errMsg:    "--rate-limit must be between 10 and 1000",
		},
		{
			name:      "rate-limit of 1 fails",
			startTime: "now-7d",
			rateLimit: 1,
			wantErr:   true,
			errMsg:    "--rate-limit must be between 10 and 1000",
		},
		{
			name:      "rate-limit one above maximum fails",
			startTime: "now-7d",
			rateLimit: 1001,
			wantErr:   true,
			errMsg:    "--rate-limit must be between 10 and 1000",
		},
		{
			name:      "negative ttl fails",
			startTime: "now-7d",
			ttl:       -1,
			wantErr:   true,
			errMsg:    "--ttl must be >= 0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &CreateOptions{
				StartTime: tt.startTime,
				BatchSize: tt.batchSize,
				RateLimit: tt.rateLimit,
				TTL:       tt.ttl,
			}

			err := o.Validate()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestCreateOptions_Complete(t *testing.T) {
	o := &CreateOptions{}

	err := o.Complete(nil)

	require.NoError(t, err)
}

func TestNewListOptions(t *testing.T) {
	ioStreams := genericclioptions.IOStreams{}

	o := NewListOptions(nil, ioStreams)

	assert.NotNil(t, o)
	assert.NotNil(t, o.PrintFlags)
}

func TestListOptions_Validate(t *testing.T) {
	t.Run("valid - no required fields", func(t *testing.T) {
		o := &ListOptions{}

		err := o.Validate()

		require.NoError(t, err)
	})
}

func TestListOptions_Complete(t *testing.T) {
	o := &ListOptions{}

	err := o.Complete(nil)

	require.NoError(t, err)
}

func TestNewStatusOptions(t *testing.T) {
	ioStreams := genericclioptions.IOStreams{}

	o := NewStatusOptions(nil, ioStreams)

	assert.NotNil(t, o)
	assert.Empty(t, o.Name)
	assert.NotNil(t, o.PrintFlags)
}

func TestStatusOptions_Validate(t *testing.T) {
	tests := []struct {
		name    string
		jobName string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid name",
			jobName: "reindex-abc123",
			wantErr: false,
		},
		{
			name:    "empty name fails",
			jobName: "",
			wantErr: true,
			errMsg:  "name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &StatusOptions{
				Name: tt.jobName,
			}

			err := o.Validate()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestStatusOptions_Complete(t *testing.T) {
	o := &StatusOptions{}

	err := o.Complete(nil)

	require.NoError(t, err)
}

func TestNewDeleteOptions(t *testing.T) {
	ioStreams := genericclioptions.IOStreams{}

	o := NewDeleteOptions(nil, ioStreams)

	assert.NotNil(t, o)
	assert.Empty(t, o.Name)
}

func TestDeleteOptions_Validate(t *testing.T) {
	tests := []struct {
		name    string
		jobName string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid name",
			jobName: "reindex-abc123",
			wantErr: false,
		},
		{
			name:    "empty name fails",
			jobName: "",
			wantErr: true,
			errMsg:  "name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &DeleteOptions{
				Name: tt.jobName,
			}

			err := o.Validate()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestDeleteOptions_Complete(t *testing.T) {
	o := &DeleteOptions{}

	err := o.Complete(nil)

	require.NoError(t, err)
}
