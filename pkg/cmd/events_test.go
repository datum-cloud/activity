package cmd

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/cli-runtime/pkg/genericclioptions"

	"go.miloapis.com/activity/pkg/cmd/common"
)

func TestEventsOptions_buildFieldSelector(t *testing.T) {
	tests := []struct {
		name          string
		eventType     string
		reason        string
		involvedKind  string
		involvedName  string
		fieldSelector string
		want          string
	}{
		{
			name: "no selectors",
			want: "",
		},
		{
			name:      "type only",
			eventType: "Warning",
			want:      "type=Warning",
		},
		{
			name:   "reason only",
			reason: "FailedMount",
			want:   "reason=FailedMount",
		},
		{
			name:         "involved kind only",
			involvedKind: "Pod",
			want:         "involvedObject.kind=Pod",
		},
		{
			name:         "involved name only",
			involvedName: "my-pod",
			want:         "involvedObject.name=my-pod",
		},
		{
			name:      "multiple shorthand selectors",
			eventType: "Warning",
			reason:    "FailedMount",
			want:      "type=Warning,reason=FailedMount",
		},
		{
			name:         "all shorthand selectors",
			eventType:    "Warning",
			reason:       "BackOff",
			involvedKind: "Pod",
			involvedName: "crashing-pod",
			want:         "type=Warning,reason=BackOff,involvedObject.kind=Pod,involvedObject.name=crashing-pod",
		},
		{
			name:          "explicit selector only",
			fieldSelector: "metadata.namespace=production",
			want:          "metadata.namespace=production",
		},
		{
			name:          "shorthand and explicit selector",
			eventType:     "Warning",
			fieldSelector: "metadata.namespace=production",
			want:          "type=Warning,metadata.namespace=production",
		},
		{
			name:          "all selectors",
			eventType:     "Warning",
			reason:        "FailedMount",
			involvedKind:  "Pod",
			involvedName:  "my-pod",
			fieldSelector: "metadata.namespace=default",
			want:          "type=Warning,reason=FailedMount,involvedObject.kind=Pod,involvedObject.name=my-pod,metadata.namespace=default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &EventsOptions{
				Type:          tt.eventType,
				Reason:        tt.reason,
				InvolvedKind:  tt.involvedKind,
				InvolvedName:  tt.involvedName,
				FieldSelector: tt.fieldSelector,
			}

			got := o.buildFieldSelector()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestEventsOptions_Validate(t *testing.T) {
	tests := []struct {
		name         string
		timeRange    common.TimeRangeFlags
		pagination   common.PaginationFlags
		eventType    string
		reason       string
		involvedKind string
		involvedName string
		wantErr      bool
		errMsg       string
	}{
		{
			name: "valid options",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			wantErr: false,
		},
		{
			name: "invalid time range",
			timeRange: common.TimeRangeFlags{
				StartTime: "",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			wantErr: true,
			errMsg:  "--start-time is required",
		},
		{
			name: "invalid pagination",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 0,
			},
			wantErr: true,
			errMsg:  "--limit must be between 1 and 1000",
		},
		{
			name: "valid event type - Normal",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			eventType: "Normal",
			wantErr:   false,
		},
		{
			name: "valid event type - Warning",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			eventType: "Warning",
			wantErr:   false,
		},
		{
			name: "invalid event type - lowercase",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			eventType: "warning",
			wantErr:   true,
			errMsg:    "event type must be 'Normal' or 'Warning'",
		},
		{
			name: "invalid event type - injection attempt",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			eventType: "Warning' || 'x' == 'x",
			wantErr:   true,
			errMsg:    "event type must be 'Normal' or 'Warning'",
		},
		{
			name: "invalid reason - contains equals",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			reason:  "type=Warning",
			wantErr: true,
			errMsg:  "invalid --reason value",
		},
		{
			name: "invalid involved-kind - contains comma",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			involvedKind: "Pod,Deployment",
			wantErr:      true,
			errMsg:       "invalid --involved-kind value",
		},
		{
			name: "invalid involved-name - field selector injection",
			timeRange: common.TimeRangeFlags{
				StartTime: "now-24h",
				EndTime:   "now",
			},
			pagination: common.PaginationFlags{
				Limit: 25,
			},
			involvedName: "pod-name,type=Warning",
			wantErr:      true,
			errMsg:       "invalid --involved-name value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &EventsOptions{
				TimeRange:    tt.timeRange,
				Pagination:   tt.pagination,
				Type:         tt.eventType,
				Reason:       tt.reason,
				InvolvedKind: tt.involvedKind,
				InvolvedName: tt.involvedName,
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

func TestKubeEventsToTable(t *testing.T) {
	now := metav1.NewTime(time.Date(2026, 2, 21, 15, 30, 0, 0, time.UTC))

	tests := []struct {
		name           string
		events         []corev1.Event
		includeHeaders bool
		wantRows       int
		wantColumns    int
	}{
		{
			name: "single event",
			events: []corev1.Event{
				{
					LastTimestamp: now,
					Type:          "Warning",
					Reason:        "FailedMount",
					InvolvedObject: corev1.ObjectReference{
						Kind:      "Pod",
						Name:      "my-pod",
						Namespace: "default",
					},
					Message: "Unable to mount volume",
				},
			},
			includeHeaders: true,
			wantRows:       1,
			wantColumns:    5,
		},
		{
			name: "multiple events",
			events: []corev1.Event{
				{
					LastTimestamp: now,
					Type:          "Normal",
					Reason:        "Pulled",
					InvolvedObject: corev1.ObjectReference{
						Kind: "Pod",
						Name: "app-pod",
					},
					Message: "Successfully pulled image",
				},
				{
					LastTimestamp: now,
					Type:          "Warning",
					Reason:        "BackOff",
					InvolvedObject: corev1.ObjectReference{
						Kind:      "Pod",
						Name:      "crash-pod",
						Namespace: "production",
					},
					Message: "Back-off restarting failed container",
				},
			},
			includeHeaders: true,
			wantRows:       2,
			wantColumns:    5,
		},
		{
			name:           "empty events",
			events:         []corev1.Event{},
			includeHeaders: true,
			wantRows:       0,
			wantColumns:    5,
		},
		{
			name: "event with long message",
			events: []corev1.Event{
				{
					LastTimestamp: now,
					Type:          "Warning",
					Reason:        "FailedScheduling",
					InvolvedObject: corev1.ObjectReference{
						Kind: "Pod",
						Name: "pending-pod",
					},
					Message: "This is a very long message that exceeds the 80 character limit and should be truncated when displayed in the table format to ensure readability",
				},
			},
			includeHeaders: true,
			wantRows:       1,
			wantColumns:    5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			table := kubeEventsToTable(tt.events, tt.includeHeaders)

			assert.NotNil(t, table)
			assert.Equal(t, "Table", table.Kind)
			assert.Len(t, table.ColumnDefinitions, tt.wantColumns)
			assert.Len(t, table.Rows, tt.wantRows)

			// Verify column names
			expectedColumns := []string{"Last Seen", "Type", "Reason", "Object", "Message"}
			for i, col := range table.ColumnDefinitions {
				assert.Equal(t, expectedColumns[i], col.Name)
			}
		})
	}
}

func TestKubeEventsToRows(t *testing.T) {
	now := metav1.NewTime(time.Date(2026, 2, 21, 15, 30, 0, 0, time.UTC))

	tests := []struct {
		name      string
		events    []corev1.Event
		wantCells [][]interface{}
	}{
		{
			name: "event with namespace",
			events: []corev1.Event{
				{
					LastTimestamp: now,
					Type:          "Warning",
					Reason:        "FailedMount",
					InvolvedObject: corev1.ObjectReference{
						Kind:      "Pod",
						Name:      "my-pod",
						Namespace: "production",
					},
					Message: "Unable to mount volume",
				},
			},
			wantCells: [][]interface{}{
				{"2026-02-21T15:30:00Z", "Warning", "FailedMount", "production/Pod/my-pod", "Unable to mount volume"},
			},
		},
		{
			name: "event without namespace",
			events: []corev1.Event{
				{
					LastTimestamp: now,
					Type:          "Normal",
					Reason:        "NodeReady",
					InvolvedObject: corev1.ObjectReference{
						Kind: "Node",
						Name: "node-1",
					},
					Message: "Node is ready",
				},
			},
			wantCells: [][]interface{}{
				{"2026-02-21T15:30:00Z", "Normal", "NodeReady", "Node/node-1", "Node is ready"},
			},
		},
		{
			name: "event with long message truncated",
			events: []corev1.Event{
				{
					LastTimestamp: now,
					Type:          "Warning",
					Reason:        "LongMessage",
					InvolvedObject: corev1.ObjectReference{
						Kind: "Pod",
						Name: "test-pod",
					},
					Message: "This is a very long message that exceeds the 80 character limit and should be truncated",
				},
			},
			wantCells: [][]interface{}{
				{"2026-02-21T15:30:00Z", "Warning", "LongMessage", "Pod/test-pod", "This is a very long message that exceeds the 80 character limit and should be..."},
			},
		},
		{
			name: "event with EventTime instead of LastTimestamp",
			events: []corev1.Event{
				{
					EventTime: metav1.NewMicroTime(now.Time),
					Type:      "Normal",
					Reason:    "Created",
					InvolvedObject: corev1.ObjectReference{
						Kind: "Pod",
						Name: "new-pod",
					},
					Message: "Pod created",
				},
			},
			wantCells: [][]interface{}{
				{"2026-02-21T15:30:00Z", "Normal", "Created", "Pod/new-pod", "Pod created"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rows := kubeEventsToRows(tt.events)

			require.Len(t, rows, len(tt.wantCells))
			for i, row := range rows {
				assert.Equal(t, tt.wantCells[i], row.Cells)
			}
		})
	}
}

func TestNewEventsOptions(t *testing.T) {
	ioStreams := genericclioptions.IOStreams{}

	o := NewEventsOptions(nil, ioStreams)

	assert.NotNil(t, o)
	assert.Equal(t, "now-24h", o.TimeRange.StartTime)
	assert.Equal(t, "now", o.TimeRange.EndTime)
	assert.Equal(t, int32(25), o.Pagination.Limit)
	assert.False(t, o.Pagination.AllPages)
	assert.NotNil(t, o.PrintFlags)
}

func TestEventsOptions_Complete(t *testing.T) {
	o := &EventsOptions{}

	err := o.Complete(nil)

	require.NoError(t, err)
}
