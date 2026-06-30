package cel

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/google/cel-go/cel"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// guardedDerefRoots are the audit fields whose deep dereferences are unsafe at
// runtime. These fields are absent (or replaced by a metav1.Status object) on
// non-2xx responses, so dereferencing nested fields throws "no such key" and
// sends the event to the dead-letter queue.
var guardedDerefRoots = []string{
	"audit.responseObject",
	"audit.requestObject",
}

// ValidateGuardedDerefs inspects a compiled CEL AST and rejects expressions that
// perform an UNGUARDED deep dereference of audit.responseObject or
// audit.requestObject (e.g. audit.responseObject.metadata.name) without a
// corresponding has() guard for that exact path.
//
// These roots are defaulted to empty maps at evaluation time, so reading the
// root itself (audit.responseObject) or guarding only the root
// (has(audit.responseObject)) is insufficient: any field beyond the root throws
// "no such key" at runtime on non-2xx responses. Each indexed level must be
// guarded with has().
//
// Validation only — it does not affect runtime defaulting or evaluation.
func ValidateGuardedDerefs(ast *cel.Ast) error {
	if ast == nil {
		return nil
	}

	parsed, err := cel.AstToParsedExpr(ast)
	if err != nil {
		// If we cannot recover the AST we cannot statically analyze it; do not
		// block the policy on an internal conversion failure.
		return nil
	}

	root := parsed.GetExpr()
	if root == nil {
		return nil
	}

	// Pass 1: collect every has() guarded path.
	guarded := make(map[string]bool)
	collectGuardedPaths(root, guarded)

	// Pass 2: collect unguarded deep dereferences rooted at the unsafe roots.
	violations := make(map[string]bool)
	collectViolations(root, guarded, violations)

	if len(violations) == 0 {
		return nil
	}

	// Keep only the deepest violating path per chain to reduce noise: drop any
	// path that is a strict prefix of another violating path.
	paths := make([]string, 0, len(violations))
	for p := range violations {
		paths = append(paths, p)
	}
	sort.Strings(paths)

	deepest := make([]string, 0, len(paths))
	for _, p := range paths {
		isPrefix := false
		for _, other := range paths {
			if other != p && strings.HasPrefix(other, p+".") {
				isPrefix = true
				break
			}
		}
		if !isPrefix {
			deepest = append(deepest, p)
		}
	}

	errs := make([]error, 0, len(deepest))
	for _, p := range deepest {
		errs = append(errs, unguardedDerefError(p))
	}
	return errors.Join(errs...)
}

// unguardedDerefError builds the actionable error message for a single violation.
func unguardedDerefError(path string) error {
	// Build the guard suggestion for the example path: chain has() over every
	// indexed level of the path beyond the root.
	parent := path[:strings.LastIndex(path, ".")]
	return fmt.Errorf(
		"unguarded dereference of %q: responseObject/requestObject is absent or a "+
			"metav1.Status on non-2xx responses, so this throws \"no such key\" at runtime "+
			"and sends events to the DLQ. Guard each level with has() "+
			"(e.g. has(%s) && has(%s) ? %s : \"\") or gate on audit.responseStatus.code < 300, "+
			"or use a field present regardless of outcome such as audit.objectRef.name.",
		path, parent, path, path,
	)
}

// collectGuardedPaths walks the AST and records the dot-path of every has()
// expression (a SelectExpr with TestOnly == true).
func collectGuardedPaths(e *expr.Expr, guarded map[string]bool) {
	if e == nil {
		return
	}

	switch k := e.ExprKind.(type) {
	case *expr.Expr_SelectExpr:
		sel := k.SelectExpr
		if sel.GetTestOnly() {
			if p := selectPath(e); p != "" {
				guarded[p] = true
			}
		}
		// Continue walking the operand so nested has() inside larger
		// expressions are still collected.
		collectGuardedPaths(sel.GetOperand(), guarded)

	case *expr.Expr_CallExpr:
		call := k.CallExpr
		collectGuardedPaths(call.GetTarget(), guarded)
		for _, arg := range call.GetArgs() {
			collectGuardedPaths(arg, guarded)
		}

	case *expr.Expr_ListExpr:
		for _, elem := range k.ListExpr.GetElements() {
			collectGuardedPaths(elem, guarded)
		}

	case *expr.Expr_StructExpr:
		for _, entry := range k.StructExpr.GetEntries() {
			collectGuardedPaths(entry.GetValue(), guarded)
		}

	case *expr.Expr_ComprehensionExpr:
		comp := k.ComprehensionExpr
		collectGuardedPaths(comp.GetIterRange(), guarded)
		collectGuardedPaths(comp.GetAccuInit(), guarded)
		collectGuardedPaths(comp.GetLoopCondition(), guarded)
		collectGuardedPaths(comp.GetLoopStep(), guarded)
		collectGuardedPaths(comp.GetResult(), guarded)
	}
}

// collectViolations walks the AST and records unguarded deep dereferences rooted
// at an unsafe root. TestOnly (has()) selects are skipped so that the guards
// themselves are never flagged.
func collectViolations(e *expr.Expr, guarded map[string]bool, violations map[string]bool) {
	if e == nil {
		return
	}

	switch k := e.ExprKind.(type) {
	case *expr.Expr_SelectExpr:
		sel := k.SelectExpr
		if sel.GetTestOnly() {
			// Do not descend into has() subtrees — those are guards, not reads.
			return
		}
		if p := selectPath(e); p != "" {
			if isUnsafeDeepPath(p) && !guarded[p] {
				violations[p] = true
			}
		}
		collectViolations(sel.GetOperand(), guarded, violations)

	case *expr.Expr_CallExpr:
		call := k.CallExpr
		collectViolations(call.GetTarget(), guarded, violations)
		for _, arg := range call.GetArgs() {
			collectViolations(arg, guarded, violations)
		}

	case *expr.Expr_ListExpr:
		for _, elem := range k.ListExpr.GetElements() {
			collectViolations(elem, guarded, violations)
		}

	case *expr.Expr_StructExpr:
		for _, entry := range k.StructExpr.GetEntries() {
			collectViolations(entry.GetValue(), guarded, violations)
		}

	case *expr.Expr_ComprehensionExpr:
		comp := k.ComprehensionExpr
		collectViolations(comp.GetIterRange(), guarded, violations)
		collectViolations(comp.GetAccuInit(), guarded, violations)
		collectViolations(comp.GetLoopCondition(), guarded, violations)
		collectViolations(comp.GetLoopStep(), guarded, violations)
		collectViolations(comp.GetResult(), guarded, violations)
	}
}

// isUnsafeDeepPath reports whether path is a dereference of an unsafe root with
// at least one field beyond the root (e.g. audit.responseObject.metadata). Bare
// roots (audit.responseObject) are safe because they are defaulted.
func isUnsafeDeepPath(path string) bool {
	for _, root := range guardedDerefRoots {
		if strings.HasPrefix(path, root+".") {
			return true
		}
	}
	return false
}

// selectPath builds the dot-path for a Select chain rooted at an identifier.
// Returns "" when the chain is not a pure ident/select path (e.g. it indexes
// into a call result), meaning it cannot be statically resolved and is skipped.
func selectPath(e *expr.Expr) string {
	if e == nil {
		return ""
	}

	switch k := e.ExprKind.(type) {
	case *expr.Expr_IdentExpr:
		return k.IdentExpr.GetName()

	case *expr.Expr_SelectExpr:
		sel := k.SelectExpr
		parent := selectPath(sel.GetOperand())
		if parent == "" {
			return ""
		}
		return parent + "." + sel.GetField()

	default:
		return ""
	}
}
