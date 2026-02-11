package apierrors

import (
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func TestNewValidationStatusError_MessageFormat(t *testing.T) {
	gk := schema.GroupKind{Group: "activity.miloapis.com", Kind: "PolicyPreview"}

	t.Run("single error includes detail and action in message", func(t *testing.T) {
		errs := field.ErrorList{
			field.Required(field.NewPath("spec", "inputs"),
				"provide at least one audit log or event to test"),
		}

		statusErr := NewValidationStatusError(gk, "", errs)

		expectedMsg := "Provide at least one audit log or event to test. Please correct this and try again."
		if statusErr.Error() != expectedMsg {
			t.Errorf("unexpected message:\ngot:  %s\nwant: %s", statusErr.Error(), expectedMsg)
		}

		// Single error should still have causes for field highlighting
		status := statusErr.Status()
		if len(status.Details.Causes) != 1 {
			t.Errorf("expected 1 cause, got %d", len(status.Details.Causes))
		}
	})

	t.Run("multiple errors directs to details", func(t *testing.T) {
		errs := field.ErrorList{
			field.Required(field.NewPath("spec", "policy", "resource", "apiGroup"),
				"specify the API group of the resource this policy targets"),
			field.Required(field.NewPath("spec", "policy", "resource", "kind"),
				"specify the kind of resource this policy targets"),
			field.Required(field.NewPath("spec", "inputs"),
				"provide at least one audit log or event to test"),
		}

		statusErr := NewValidationStatusError(gk, "", errs)

		// Message explains what's wrong and how to fix it
		expectedMsg := "Some fields are missing or invalid. See the error details for what needs to be corrected."
		if statusErr.Error() != expectedMsg {
			t.Errorf("unexpected message:\ngot:  %s\nwant: %s", statusErr.Error(), expectedMsg)
		}

		// Verify causes contain the details for client rendering
		status := statusErr.Status()
		if len(status.Details.Causes) != 3 {
			t.Errorf("expected 3 causes, got %d", len(status.Details.Causes))
		}

		// Verify each cause has field path and message
		expectedCauses := []struct {
			field   string
			message string
		}{
			{"spec.policy.resource.apiGroup", "specify the API group of the resource this policy targets"},
			{"spec.policy.resource.kind", "specify the kind of resource this policy targets"},
			{"spec.inputs", "provide at least one audit log or event to test"},
		}
		for i, expected := range expectedCauses {
			cause := status.Details.Causes[i]
			if cause.Field != expected.field {
				t.Errorf("cause[%d]: expected field %q, got %q", i, expected.field, cause.Field)
			}
			if cause.Message != expected.message {
				t.Errorf("cause[%d]: expected message %q, got %q", i, expected.message, cause.Message)
			}
		}
	})

	t.Run("causes include error type for client categorization", func(t *testing.T) {
		errs := field.ErrorList{
			field.Required(field.NewPath("spec", "inputs"), "inputs required"),
			field.Invalid(field.NewPath("spec", "policy", "match"), "bad expr", "invalid CEL"),
			field.NotSupported(field.NewPath("spec", "type"), "foo", []string{"bar", "baz"}),
		}

		statusErr := NewValidationStatusError(gk, "", errs)
		status := statusErr.Status()

		expectedTypes := []string{"FieldValueRequired", "FieldValueInvalid", "FieldValueNotSupported"}
		for i, expected := range expectedTypes {
			if string(status.Details.Causes[i].Type) != expected {
				t.Errorf("cause[%d]: expected type %q, got %q", i, expected, status.Details.Causes[i].Type)
			}
		}
	})
}
