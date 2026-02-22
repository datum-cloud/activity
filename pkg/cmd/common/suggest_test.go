package common

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	activityv1alpha1 "go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

func TestPrintFacetTable(t *testing.T) {
	tests := []struct {
		name         string
		facet        activityv1alpha1.FacetResult
		wantContains []string
	}{
		{
			name: "facet with values",
			facet: activityv1alpha1.FacetResult{
				Field: "user.username",
				Values: []activityv1alpha1.FacetValue{
					{Value: "alice@example.com", Count: 142},
					{Value: "bob@example.com", Count: 89},
					{Value: "system:serviceaccount:default:sa", Count: 67},
				},
			},
			wantContains: []string{
				"FIELD: user.username",
				"alice@example.com",
				"142",
				"bob@example.com",
				"89",
				"system:serviceaccount:default:sa",
				"67",
			},
		},
		{
			name: "facet with no values",
			facet: activityv1alpha1.FacetResult{
				Field:  "verb",
				Values: []activityv1alpha1.FacetValue{},
			},
			wantContains: []string{
				"FIELD: verb",
			},
		},
		{
			name: "facet with single value",
			facet: activityv1alpha1.FacetResult{
				Field: "objectRef.resource",
				Values: []activityv1alpha1.FacetValue{
					{Value: "secrets", Count: 5},
				},
			},
			wantContains: []string{
				"FIELD: objectRef.resource",
				"secrets",
				"5",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer

			err := PrintFacetTable(tt.facet, &buf)

			require.NoError(t, err)
			output := buf.String()

			for _, want := range tt.wantContains {
				assert.Contains(t, output, want, "output should contain: %s", want)
			}
		})
	}
}

func TestPrintFacetTable_EmptyValues(t *testing.T) {
	var buf bytes.Buffer

	facet := activityv1alpha1.FacetResult{
		Field:  "test.field",
		Values: nil, // nil values
	}

	err := PrintFacetTable(facet, &buf)

	require.NoError(t, err)
	output := buf.String()
	assert.Contains(t, output, "FIELD: test.field")
}

func TestPrintFacetTable_LargeCount(t *testing.T) {
	var buf bytes.Buffer

	facet := activityv1alpha1.FacetResult{
		Field: "verb",
		Values: []activityv1alpha1.FacetValue{
			{Value: "get", Count: 1000000},
			{Value: "list", Count: 500000},
		},
	}

	err := PrintFacetTable(facet, &buf)

	require.NoError(t, err)
	output := buf.String()
	assert.Contains(t, output, "1000000")
	assert.Contains(t, output, "500000")
}

func TestPrintFacetTable_SpecialCharacters(t *testing.T) {
	var buf bytes.Buffer

	facet := activityv1alpha1.FacetResult{
		Field: "user.username",
		Values: []activityv1alpha1.FacetValue{
			{Value: "user@domain.com", Count: 10},
			{Value: "system:serviceaccount:kube-system:default", Count: 20},
			{Value: "user with spaces", Count: 5},
		},
	}

	err := PrintFacetTable(facet, &buf)

	require.NoError(t, err)
	output := buf.String()
	assert.Contains(t, output, "user@domain.com")
	assert.Contains(t, output, "system:serviceaccount:kube-system:default")
	assert.Contains(t, output, "user with spaces")
}
