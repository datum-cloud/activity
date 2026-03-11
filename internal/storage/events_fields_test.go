package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseFieldSelector_RegardingFields(t *testing.T) {
	tests := []struct {
		name           string
		selector       string
		expectedColumn string
		expectedOp     FieldSelectorOp
		expectedValue  string
		wantErr        bool
	}{
		{
			name:           "regarding.kind",
			selector:       "regarding.kind=Pod",
			expectedColumn: "regarding_kind",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "Pod",
			wantErr:        false,
		},
		{
			name:           "regarding.namespace",
			selector:       "regarding.namespace=default",
			expectedColumn: "regarding_namespace",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "default",
			wantErr:        false,
		},
		{
			name:           "regarding.name",
			selector:       "regarding.name=my-pod",
			expectedColumn: "regarding_name",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "my-pod",
			wantErr:        false,
		},
		{
			name:           "regarding.uid",
			selector:       "regarding.uid=123e4567-e89b-12d3-a456-426614174000",
			expectedColumn: "regarding_uid",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "123e4567-e89b-12d3-a456-426614174000",
			wantErr:        false,
		},
		{
			name:           "regarding.apiVersion",
			selector:       "regarding.apiVersion=apps/v1",
			expectedColumn: "regarding_api_version",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "apps/v1",
			wantErr:        false,
		},
		{
			name:           "regarding.fieldPath",
			selector:       "regarding.fieldPath=spec.containers{nginx}",
			expectedColumn: "regarding_field_path",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "spec.containers{nginx}",
			wantErr:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			terms, err := ParseFieldSelector(tt.selector)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, terms, 1)

			assert.Equal(t, tt.expectedColumn, terms[0].Column)
			assert.Equal(t, tt.expectedOp, terms[0].Operator)
			assert.Equal(t, tt.expectedValue, terms[0].Value)
		})
	}
}


func TestParseFieldSelector_RegardingWithMultipleFields(t *testing.T) {
	selector := "regarding.kind=Pod,regarding.namespace=default,type=Warning"
	terms, err := ParseFieldSelector(selector)
	require.NoError(t, err)
	require.Len(t, terms, 3)

	assert.Equal(t, "regarding_kind", terms[0].Column)
	assert.Equal(t, "Pod", terms[0].Value)

	assert.Equal(t, "regarding_namespace", terms[1].Column)
	assert.Equal(t, "default", terms[1].Value)

	assert.Equal(t, "type", terms[2].Column)
	assert.Equal(t, "Warning", terms[2].Value)
}

func TestParseFieldSelector_RegardingWithNotEqual(t *testing.T) {
	selector := "regarding.kind!=ConfigMap"
	terms, err := ParseFieldSelector(selector)
	require.NoError(t, err)
	require.Len(t, terms, 1)

	assert.Equal(t, "regarding_kind", terms[0].Column)
	assert.Equal(t, FieldSelectorNotEqual, terms[0].Operator)
	assert.Equal(t, "ConfigMap", terms[0].Value)
}

func TestResolveEventFieldSelector_RegardingFields(t *testing.T) {
	tests := []struct {
		field    string
		expected string
	}{
		{"regarding.kind", "regarding_kind"},
		{"regarding.namespace", "regarding_namespace"},
		{"regarding.name", "regarding_name"},
		{"regarding.uid", "regarding_uid"},
		{"regarding.apiVersion", "regarding_api_version"},
		{"regarding.fieldPath", "regarding_field_path"},
	}

	for _, tt := range tests {
		t.Run(tt.field, func(t *testing.T) {
			column, err := ResolveEventFieldSelector(tt.field)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, column)
		})
	}
}

func TestResolveEventFieldSelector_UnsupportedRegardingField(t *testing.T) {
	_, err := ResolveEventFieldSelector("regarding.unsupportedField")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported field selector")
}

func TestParseFieldSelector_RelatedFields(t *testing.T) {
	tests := []struct {
		name           string
		selector       string
		expectedColumn string
		expectedOp     FieldSelectorOp
		expectedValue  string
		wantErr        bool
	}{
		{
			name:           "related.apiVersion equality",
			selector:       "related.apiVersion=apps/v1",
			expectedColumn: "related_api_version",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "apps/v1",
			wantErr:        false,
		},
		{
			name:           "related.kind equality",
			selector:       "related.kind=Node",
			expectedColumn: "related_kind",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "Node",
			wantErr:        false,
		},
		{
			name:           "related.namespace equality",
			selector:       "related.namespace=kube-system",
			expectedColumn: "related_namespace",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "kube-system",
			wantErr:        false,
		},
		{
			name:           "related.name equality",
			selector:       "related.name=my-node",
			expectedColumn: "related_name",
			expectedOp:     FieldSelectorEqual,
			expectedValue:  "my-node",
			wantErr:        false,
		},
		{
			name:           "related.kind not-equal operator",
			selector:       "related.kind!=Node",
			expectedColumn: "related_kind",
			expectedOp:     FieldSelectorNotEqual,
			expectedValue:  "Node",
			wantErr:        false,
		},
		{
			name:    "related.unsupportedField returns error",
			selector: "related.unsupportedField=value",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			terms, err := ParseFieldSelector(tt.selector)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, terms, 1)

			assert.Equal(t, tt.expectedColumn, terms[0].Column)
			assert.Equal(t, tt.expectedOp, terms[0].Operator)
			assert.Equal(t, tt.expectedValue, terms[0].Value)
		})
	}
}

func TestResolveEventFieldSelector_RelatedFields(t *testing.T) {
	tests := []struct {
		field    string
		expected string
	}{
		{"related.apiVersion", "related_api_version"},
		{"related.kind", "related_kind"},
		{"related.namespace", "related_namespace"},
		{"related.name", "related_name"},
	}

	for _, tt := range tests {
		t.Run(tt.field, func(t *testing.T) {
			column, err := ResolveEventFieldSelector(tt.field)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, column)
		})
	}
}

func TestResolveEventFieldSelector_UnsupportedRelatedField(t *testing.T) {
	_, err := ResolveEventFieldSelector("related.unsupportedField")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported field selector")
}
