package policy

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	authnv1 "k8s.io/api/authentication/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/cli-runtime/pkg/genericclioptions"

	activityv1alpha1 "go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

func TestReadInlineAudit_ValidJSON(t *testing.T) {
	o := &PreviewOptions{
		InputAudit: `{"verb":"create","user":{"username":"alice@example.com","uid":"user-alice-123"},"objectRef":{"apiGroup":"networking.datumapis.com","resource":"httpproxies","name":"my-proxy"}}`,
	}

	inputs, err := o.readInlineAudit()
	if err != nil {
		t.Fatalf("readInlineAudit() failed: %v", err)
	}

	if len(inputs) != 1 {
		t.Fatalf("Expected 1 input, got %d", len(inputs))
	}

	input := inputs[0]
	if input.Type != "audit" {
		t.Errorf("Expected Type='audit', got %q", input.Type)
	}

	if input.Audit == nil {
		t.Fatal("Expected Audit to be non-nil")
	}

	if input.Audit.Verb != "create" {
		t.Errorf("Expected Verb='create', got %q", input.Audit.Verb)
	}

	if input.Audit.User.Username != "alice@example.com" {
		t.Errorf("Expected Username='alice@example.com', got %q", input.Audit.User.Username)
	}

	if input.Audit.User.UID != "user-alice-123" {
		t.Errorf("Expected UID='user-alice-123', got %q", input.Audit.User.UID)
	}

	if input.Audit.ObjectRef == nil {
		t.Fatal("Expected ObjectRef to be non-nil")
	}

	if input.Audit.ObjectRef.Resource != "httpproxies" {
		t.Errorf("Expected Resource='httpproxies', got %q", input.Audit.ObjectRef.Resource)
	}

	if input.Audit.ObjectRef.Name != "my-proxy" {
		t.Errorf("Expected Name='my-proxy', got %q", input.Audit.ObjectRef.Name)
	}
}

func TestReadInlineAudit_MinimalJSON(t *testing.T) {
	o := &PreviewOptions{
		InputAudit: `{"verb":"delete","user":{"username":"bob"}}`,
	}

	inputs, err := o.readInlineAudit()
	if err != nil {
		t.Fatalf("readInlineAudit() failed: %v", err)
	}

	if len(inputs) != 1 {
		t.Fatalf("Expected 1 input, got %d", len(inputs))
	}

	if inputs[0].Audit.Verb != "delete" {
		t.Errorf("Expected Verb='delete', got %q", inputs[0].Audit.Verb)
	}

	if inputs[0].Audit.User.Username != "bob" {
		t.Errorf("Expected Username='bob', got %q", inputs[0].Audit.User.Username)
	}
}

func TestReadInlineAudit_InvalidJSON(t *testing.T) {
	o := &PreviewOptions{
		InputAudit: `{"verb":"create"`,
	}

	_, err := o.readInlineAudit()
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestReadInlineAudit_EmptyString(t *testing.T) {
	o := &PreviewOptions{
		InputAudit: ``,
	}

	_, err := o.readInlineAudit()
	if err == nil {
		t.Error("Expected error for empty string, got nil")
	}
}

func TestReadInlineAudit_MalformedJSON(t *testing.T) {
	o := &PreviewOptions{
		InputAudit: `not json at all`,
	}

	_, err := o.readInlineAudit()
	if err == nil {
		t.Error("Expected error for malformed JSON, got nil")
	}
}

// TestReadInlineAudit_MatchesFileFormat verifies that inline audit produces
// the same structure as file-based inputs
func TestReadInlineAudit_MatchesFileFormat(t *testing.T) {
	inlineOpts := &PreviewOptions{
		InputAudit: `{"verb":"create","user":{"username":"alice@example.com"},"objectRef":{"resource":"httpproxies","name":"test"}}`,
	}

	inlineInputs, err := inlineOpts.readInlineAudit()
	if err != nil {
		t.Fatalf("readInlineAudit() failed: %v", err)
	}

	// Create equivalent file-based input manually
	fileBasedInput := activityv1alpha1.PolicyPreviewInput{
		Type: "audit",
		Audit: &auditv1.Event{
			Verb: "create",
			User: authnv1.UserInfo{
				Username: "alice@example.com",
			},
			ObjectRef: &auditv1.ObjectReference{
				Resource: "httpproxies",
				Name:     "test",
			},
		},
	}

	if len(inlineInputs) != 1 {
		t.Fatalf("Expected 1 input, got %d", len(inlineInputs))
	}

	inlineInput := inlineInputs[0]

	// Compare structure
	if inlineInput.Type != fileBasedInput.Type {
		t.Errorf("Type mismatch: inline=%q, file=%q", inlineInput.Type, fileBasedInput.Type)
	}

	if inlineInput.Audit.Verb != fileBasedInput.Audit.Verb {
		t.Errorf("Verb mismatch: inline=%q, file=%q", inlineInput.Audit.Verb, fileBasedInput.Audit.Verb)
	}

	if inlineInput.Audit.User.Username != fileBasedInput.Audit.User.Username {
		t.Errorf("Username mismatch: inline=%q, file=%q",
			inlineInput.Audit.User.Username, fileBasedInput.Audit.User.Username)
	}
}

func TestPreviewOptions_Validate(t *testing.T) {
	tests := []struct {
		name       string
		policyFile string
		inputFile  string
		inputAudit string
		dryRun     bool
		wantErr    bool
		errMsg     string
	}{
		{
			name:       "valid with input file",
			policyFile: "policy.yaml",
			inputFile:  "inputs.yaml",
			wantErr:    false,
		},
		{
			name:       "valid with inline audit",
			policyFile: "policy.yaml",
			inputAudit: `{"verb":"create"}`,
			wantErr:    false,
		},
		{
			name:       "valid dry-run without input",
			policyFile: "policy.yaml",
			dryRun:     true,
			wantErr:    false,
		},
		{
			name:    "missing policy file",
			wantErr: true,
			errMsg:  "--file is required",
		},
		{
			name:       "missing input without dry-run",
			policyFile: "policy.yaml",
			wantErr:    true,
			errMsg:     "either --input or --input-audit is required",
		},
		{
			name:       "both input file and inline audit",
			policyFile: "policy.yaml",
			inputFile:  "inputs.yaml",
			inputAudit: `{"verb":"create"}`,
			wantErr:    false, // inputFile takes precedence
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &PreviewOptions{
				PolicyFile: tt.policyFile,
				InputFile:  tt.inputFile,
				InputAudit: tt.inputAudit,
				DryRun:     tt.dryRun,
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

func TestNewPreviewOptions(t *testing.T) {
	ioStreams := genericclioptions.IOStreams{}

	o := NewPreviewOptions(nil, ioStreams)

	assert.NotNil(t, o)
	assert.NotNil(t, o.PrintFlags)
	assert.Equal(t, ioStreams, o.IOStreams)
}

func TestPreviewOptions_Complete(t *testing.T) {
	o := &PreviewOptions{}

	err := o.Complete(nil)

	require.NoError(t, err)
}

func TestReadInlineAudit_ComplexJSON(t *testing.T) {
	tests := []struct {
		name       string
		inputAudit string
		wantVerb   string
		wantUser   string
	}{
		{
			name:       "with response status",
			inputAudit: `{"verb":"create","user":{"username":"alice"},"responseStatus":{"code":201}}`,
			wantVerb:   "create",
			wantUser:   "alice",
		},
		{
			name:       "with namespace in objectRef",
			inputAudit: `{"verb":"delete","user":{"username":"bob"},"objectRef":{"namespace":"production","resource":"secrets","name":"db-pass"}}`,
			wantVerb:   "delete",
			wantUser:   "bob",
		},
		{
			name:       "with api group",
			inputAudit: `{"verb":"update","user":{"username":"admin"},"objectRef":{"apiGroup":"apps","resource":"deployments","name":"my-app"}}`,
			wantVerb:   "update",
			wantUser:   "admin",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &PreviewOptions{
				InputAudit: tt.inputAudit,
			}

			inputs, err := o.readInlineAudit()

			require.NoError(t, err)
			require.Len(t, inputs, 1)
			assert.Equal(t, "audit", inputs[0].Type)
			assert.Equal(t, tt.wantVerb, inputs[0].Audit.Verb)
			assert.Equal(t, tt.wantUser, inputs[0].Audit.User.Username)
		})
	}
}

func TestReadInlineAudit_ErrorMessages(t *testing.T) {
	tests := []struct {
		name           string
		inputAudit     string
		wantErrContain string
	}{
		{
			name:           "empty json",
			inputAudit:     "",
			wantErrContain: "failed to parse audit event JSON",
		},
		{
			name:           "invalid json structure",
			inputAudit:     `{invalid}`,
			wantErrContain: "failed to parse audit event JSON",
		},
		{
			name:           "unclosed brace",
			inputAudit:     `{"verb":"create"`,
			wantErrContain: "failed to parse audit event JSON",
		},
		{
			name:           "not json",
			inputAudit:     `this is plain text`,
			wantErrContain: "failed to parse audit event JSON",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &PreviewOptions{
				InputAudit: tt.inputAudit,
			}

			_, err := o.readInlineAudit()

			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErrContain)
		})
	}
}

func TestReadInputs_Priority(t *testing.T) {
	tests := []struct {
		name       string
		inputFile  string
		inputAudit string
		wantErr    bool
		errMsg     string
	}{
		{
			name:       "input file takes precedence",
			inputFile:  "test.yaml",
			inputAudit: `{"verb":"create"}`,
			wantErr:    true, // Will fail because file doesn't exist, but proves precedence
			errMsg:     "failed to open input file",
		},
		{
			name:       "falls back to inline audit",
			inputFile:  "",
			inputAudit: `{"verb":"create","user":{"username":"test"}}`,
			wantErr:    false,
		},
		{
			name:    "no inputs provided",
			wantErr: true,
			errMsg:  "no inputs provided",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &PreviewOptions{
				InputFile:  tt.inputFile,
				InputAudit: tt.inputAudit,
			}

			_, err := o.readInputs()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
