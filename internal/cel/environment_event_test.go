package cel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestBuildEventVars_RelatedField verifies that CEL expressions can safely
// reference event.related.* fields when the related object is present or absent.
func TestBuildEventVars_RelatedField(t *testing.T) {
	env, err := NewEventEnvironment(nil)
	require.NoError(t, err)

	tests := []struct {
		name       string
		eventMap   map[string]interface{}
		expression string
		want       interface{}
	}{
		{
			name: "event with related — access event.related.kind",
			eventMap: map[string]interface{}{
				"reason": "Scheduled",
				"type":   "Normal",
				"regarding": map[string]interface{}{
					"kind":      "Pod",
					"name":      "my-pod",
					"namespace": "default",
				},
				"related": map[string]interface{}{
					"kind":      "Node",
					"name":      "worker-node-1",
					"namespace": "",
				},
			},
			expression: "event.related.kind",
			want:       "Node",
		},
		{
			name: "event with related — access event.related.name",
			eventMap: map[string]interface{}{
				"reason": "Scheduled",
				"related": map[string]interface{}{
					"kind": "Node",
					"name": "worker-node-1",
				},
			},
			expression: "event.related.name",
			want:       "worker-node-1",
		},
		{
			name: "event WITHOUT related — has(event.related) returns false",
			eventMap: map[string]interface{}{
				"reason": "Pulled",
				"type":   "Normal",
				"regarding": map[string]interface{}{
					"kind": "Pod",
					"name": "my-pod",
				},
				// No "related" key present.
			},
			expression: "has(event.related)",
			want:       false,
		},
		{
			name: "event WITH related — has(event.related) returns true",
			eventMap: map[string]interface{}{
				"reason": "Scheduled",
				"related": map[string]interface{}{
					"kind": "Node",
					"name": "worker-node-1",
				},
			},
			expression: "has(event.related)",
			want:       true,
		},
		{
			name: "event WITH related — conditional access is safe",
			eventMap: map[string]interface{}{
				"reason": "Scheduled",
				"related": map[string]interface{}{
					"kind": "Node",
					"name": "worker-node-1",
				},
			},
			expression: "has(event.related) ? event.related.kind : ''",
			want:       "Node",
		},
		{
			name: "event WITHOUT related — conditional returns empty string",
			eventMap: map[string]interface{}{
				"reason": "Pulled",
				// No "related" key.
			},
			expression: "has(event.related) ? event.related.kind : ''",
			want:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vars := BuildEventVars(tt.eventMap)

			ast, issues := env.Compile(tt.expression)
			require.Nil(t, issues, "compilation issues: %v", issues)

			prg, err := env.Program(ast)
			require.NoError(t, err)

			out, _, err := prg.Eval(vars)
			require.NoError(t, err)

			assert.Equal(t, tt.want, out.Value())
		})
	}
}
