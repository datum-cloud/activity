package apierrors

import (
	"fmt"
	"net/http"
	"unicode"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// capitalizeFirst capitalizes the first letter of a string.
func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	runes := []rune(s)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

// NewValidationError creates a user-friendly validation error that includes
// structured field-level causes. The summary message provides a brief overview,
// while clients should use the causes array for detailed field-level rendering.
func NewValidationError(gk schema.GroupKind, name string, errs field.ErrorList) *metav1.Status {
	causes := make([]metav1.StatusCause, 0, len(errs))
	for _, err := range errs {
		causes = append(causes, metav1.StatusCause{
			Type:    metav1.CauseType(err.Type),
			Message: err.Detail,
			Field:   err.Field,
		})
	}

	// Summary message following error message best practices:
	// 1. What went wrong
	// 2. How to fix it
	var message string
	if len(errs) == 1 {
		message = fmt.Sprintf("%s. Please correct this and try again.", capitalizeFirst(errs[0].Detail))
	} else {
		message = "Some fields are missing or invalid. See the error details for what needs to be corrected."
	}

	return &metav1.Status{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "Status",
		},
		Status:  metav1.StatusFailure,
		Code:    http.StatusUnprocessableEntity,
		Reason:  metav1.StatusReasonInvalid,
		Message: message,
		Details: &metav1.StatusDetails{
			Group:  gk.Group,
			Kind:   gk.Kind,
			Name:   name,
			Causes: causes,
		},
	}
}

// StatusError wraps a Status as an error.
type StatusError struct {
	ErrStatus metav1.Status
}

func (e *StatusError) Error() string {
	return e.ErrStatus.Message
}

// Status returns the Status object.
func (e *StatusError) Status() metav1.Status {
	return e.ErrStatus
}

// NewValidationStatusError creates a StatusError with a user-friendly validation message.
func NewValidationStatusError(gk schema.GroupKind, name string, errs field.ErrorList) *StatusError {
	return &StatusError{ErrStatus: *NewValidationError(gk, name, errs)}
}
