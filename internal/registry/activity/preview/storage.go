package preview

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

	"go.miloapis.com/activity/internal/apierrors"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/internal/registry/activity/policy"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// PolicyPreviewStorage implements REST storage for PolicyPreview resources.
// This is an ephemeral resource - it only supports Create operations and
// evaluates the policy against the provided inputs without persisting anything.
type PolicyPreviewStorage struct{}

// NewPolicyPreviewStorage creates a new REST storage for PolicyPreview.
func NewPolicyPreviewStorage() *PolicyPreviewStorage {
	return &PolicyPreviewStorage{}
}

var (
	_ rest.Scoper               = &PolicyPreviewStorage{}
	_ rest.Storage              = &PolicyPreviewStorage{}
	_ rest.Creater              = &PolicyPreviewStorage{}
	_ rest.SingularNameProvider = &PolicyPreviewStorage{}
)

// New returns an empty PolicyPreview.
func (s *PolicyPreviewStorage) New() runtime.Object {
	return &v1alpha1.PolicyPreview{}
}

// Destroy cleans up resources.
func (s *PolicyPreviewStorage) Destroy() {}

// NamespaceScoped returns false because PolicyPreview is cluster-scoped.
func (s *PolicyPreviewStorage) NamespaceScoped() bool {
	return false
}

// GetSingularName returns the singular name of the resource.
func (s *PolicyPreviewStorage) GetSingularName() string {
	return "policypreview"
}

// Create evaluates the policy against all inputs and returns the result.
func (s *PolicyPreviewStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	preview, ok := obj.(*v1alpha1.PolicyPreview)
	if !ok {
		return nil, errors.NewBadRequest("expected PolicyPreview object")
	}

	// Validate the entire preview spec
	if errs := validatePolicyPreview(preview); len(errs) > 0 {
		return nil, apierrors.NewValidationStatusError(
			v1alpha1.SchemeGroupVersion.WithKind("PolicyPreview").GroupKind(), "", errs)
	}

	// Evaluate the policy against all inputs
	result := evaluatePolicy(preview)

	return result, nil
}

// validatePolicyPreview validates the entire PolicyPreview spec.
func validatePolicyPreview(preview *v1alpha1.PolicyPreview) field.ErrorList {
	allErrs := field.ErrorList{}
	specPath := field.NewPath("spec")

	// Validate the policy spec
	policyPath := specPath.Child("policy")
	allErrs = append(allErrs, policy.ValidateActivityPolicySpec(&preview.Spec.Policy, policyPath)...)

	// Validate inputs
	allErrs = append(allErrs, validatePreviewInputs(preview.Spec.Inputs, specPath.Child("inputs"))...)

	return allErrs
}

// validatePreviewInputs validates the PolicyPreview inputs.
func validatePreviewInputs(inputs []v1alpha1.PolicyPreviewInput, inputsPath *field.Path) field.ErrorList {
	allErrs := field.ErrorList{}

	if len(inputs) == 0 {
		allErrs = append(allErrs, field.Required(inputsPath, "provide at least one audit log or event to test against the policy"))
		return allErrs
	}

	for i, input := range inputs {
		inputPath := inputsPath.Index(i)

		if input.Type == "" {
			allErrs = append(allErrs, field.Required(inputPath.Child("type"), "specify whether this input is an 'audit' log or 'event'"))
			continue
		}

		switch input.Type {
		case "audit":
			if input.Audit == nil {
				allErrs = append(allErrs, field.Required(inputPath.Child("audit"), "provide the audit log data to test"))
			}
		case "event":
			if input.Event == nil {
				allErrs = append(allErrs, field.Required(inputPath.Child("event"), "provide the event data to test"))
			}
		default:
			allErrs = append(allErrs, field.NotSupported(inputPath.Child("type"), input.Type, []string{"audit", "event"}))
		}
	}

	return allErrs
}

// evaluatePolicy evaluates the policy spec against all inputs and returns the result.
func evaluatePolicy(preview *v1alpha1.PolicyPreview) *v1alpha1.PolicyPreview {
	result := preview.DeepCopy()
	result.Status = v1alpha1.PolicyPreviewStatus{
		Activities: []v1alpha1.Activity{},
		Results:    make([]v1alpha1.PolicyPreviewInputResult, len(preview.Spec.Inputs)),
	}

	spec := &preview.Spec.Policy

	// Process each input
	for i, input := range preview.Spec.Inputs {
		inputResult := v1alpha1.PolicyPreviewInputResult{
			InputIndex:       i,
			Matched:          false,
			MatchedRuleIndex: -1,
		}

		switch input.Type {
		case "audit":
			activity, ruleIdx, err := evaluateAuditInput(spec, &input, preview.Spec.KindLabel, preview.Spec.KindLabelPlural)
			if err != nil {
				inputResult.Error = err.Error()
			} else if activity != nil {
				inputResult.Matched = true
				inputResult.MatchedRuleIndex = ruleIdx
				inputResult.MatchedRuleType = "audit"
				result.Status.Activities = append(result.Status.Activities, *activity)
			}

		case "event":
			activity, ruleIdx, err := evaluateEventInput(spec, &input, preview.Spec.KindLabel, preview.Spec.KindLabelPlural)
			if err != nil {
				inputResult.Error = err.Error()
			} else if activity != nil {
				inputResult.Matched = true
				inputResult.MatchedRuleIndex = ruleIdx
				inputResult.MatchedRuleType = "event"
				result.Status.Activities = append(result.Status.Activities, *activity)
			}
		}

		result.Status.Results[i] = inputResult
	}

	return result
}

// evaluateAuditInput evaluates audit rules against an audit log input.
// Returns the generated Activity, the matched rule index, and any error.
func evaluateAuditInput(spec *v1alpha1.ActivityPolicySpec, input *v1alpha1.PolicyPreviewInput, kindLabelOverride, kindLabelPluralOverride string) (*v1alpha1.Activity, int, error) {
	if input.Audit == nil {
		return nil, -1, fmt.Errorf("audit input is nil")
	}

	auditMap, err := auditEventToMap(input.Audit)
	if err != nil {
		return nil, -1, fmt.Errorf("failed to convert audit event: %w", err)
	}

	// Get kind labels (use spec overrides or derive from input)
	kindLabel := kindLabelOverride
	kindLabelPlural := kindLabelPluralOverride

	if kindLabel == "" {
		kindLabel = extractKindLabel(auditMap)
	}
	if kindLabelPlural == "" {
		kindLabelPlural = pluralize(kindLabel)
	}

	// Try each audit rule in order
	for i, rule := range spec.AuditRules {
		matched, err := cel.EvaluateAuditMatchWithKind(rule.Match, auditMap, kindLabel, kindLabelPlural)
		if err != nil {
			return nil, -1, fmt.Errorf("failed to evaluate rule %d match: %w", i, err)
		}

		if matched {
			// Generate summary
			summary, links, err := cel.EvaluateAuditSummaryWithKind(rule.Summary, auditMap, kindLabel, kindLabelPlural)
			if err != nil {
				return nil, -1, fmt.Errorf("failed to evaluate rule %d summary: %w", i, err)
			}

			// Build the Activity
			activity := buildActivityFromAudit(auditMap, spec, summary, links, kindLabel)
			return activity, i, nil
		}
	}

	// No rule matched
	return nil, -1, nil
}

// evaluateEventInput evaluates event rules against a Kubernetes event input.
// Returns the generated Activity, the matched rule index, and any error.
func evaluateEventInput(spec *v1alpha1.ActivityPolicySpec, input *v1alpha1.PolicyPreviewInput, kindLabelOverride, kindLabelPluralOverride string) (*v1alpha1.Activity, int, error) {
	if input.Event == nil || len(input.Event.Raw) == 0 {
		return nil, -1, fmt.Errorf("event input is nil or empty")
	}

	var eventMap map[string]interface{}
	if err := json.Unmarshal(input.Event.Raw, &eventMap); err != nil {
		return nil, -1, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Get kind labels (use spec overrides or derive from input)
	kindLabel := kindLabelOverride
	kindLabelPlural := kindLabelPluralOverride

	if kindLabel == "" {
		kindLabel = extractEventKindLabel(eventMap)
	}
	if kindLabelPlural == "" {
		kindLabelPlural = pluralize(kindLabel)
	}

	// Try each event rule in order
	for i, rule := range spec.EventRules {
		matched, err := cel.EvaluateEventMatchWithKind(rule.Match, eventMap, kindLabel, kindLabelPlural)
		if err != nil {
			return nil, -1, fmt.Errorf("failed to evaluate rule %d match: %w", i, err)
		}

		if matched {
			// Generate summary
			summary, links, err := cel.EvaluateEventSummaryWithKind(rule.Summary, eventMap, kindLabel, kindLabelPlural)
			if err != nil {
				return nil, -1, fmt.Errorf("failed to evaluate rule %d summary: %w", i, err)
			}

			// Build the Activity
			activity := buildActivityFromEvent(eventMap, spec, summary, links, kindLabel)
			return activity, i, nil
		}
	}

	// No rule matched
	return nil, -1, nil
}

// buildActivityFromAudit constructs an Activity from an audit event.
func buildActivityFromAudit(auditMap map[string]interface{}, spec *v1alpha1.ActivityPolicySpec, summary string, links []cel.Link, kindLabel string) *v1alpha1.Activity {
	objectRef, _ := auditMap["objectRef"].(map[string]interface{})
	user, _ := auditMap["user"].(map[string]interface{})

	// Extract timestamps
	var timestamp time.Time
	if ts, ok := auditMap["requestReceivedTimestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
			timestamp = t
		}
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	// Extract resource info
	namespace := getNestedString(objectRef, "namespace")
	resourceName := getNestedString(objectRef, "name")
	resourceUID := ""
	apiVersion := getNestedString(objectRef, "apiVersion")

	// Try to get UID from responseObject
	if responseObj, ok := auditMap["responseObject"].(map[string]interface{}); ok {
		if metadata, ok := responseObj["metadata"].(map[string]interface{}); ok {
			resourceUID = getNestedString(metadata, "uid")
		}
	}

	// Classify change source
	changeSource := classifyChangeSource(user)

	// Resolve actor
	actor := resolveActor(user)

	// Extract tenant info
	tenant := extractTenant(user)

	// Generate activity name
	activityName := fmt.Sprintf("act-%s", uuid.New().String()[:8])

	// Convert links
	activityLinks := convertLinks(links)

	// Use spec kind if kindLabel is empty
	kind := spec.Resource.Kind
	if kindLabel != "" {
		kind = kindLabel
	}

	return &v1alpha1.Activity{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v1alpha1.SchemeGroupVersion.String(),
			Kind:       "Activity",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              activityName,
			Namespace:         namespace,
			CreationTimestamp: metav1.NewTime(timestamp),
			Labels: map[string]string{
				"activity.miloapis.com/origin-type":   "audit",
				"activity.miloapis.com/change-source": changeSource,
				"activity.miloapis.com/api-group":     spec.Resource.APIGroup,
				"activity.miloapis.com/resource-kind": spec.Resource.Kind,
			},
		},
		Spec: v1alpha1.ActivitySpec{
			Summary:      summary,
			ChangeSource: changeSource,
			Actor:        actor,
			Resource: v1alpha1.ActivityResource{
				APIGroup:   spec.Resource.APIGroup,
				APIVersion: apiVersion,
				Kind:       kind,
				Name:       resourceName,
				Namespace:  namespace,
				UID:        resourceUID,
			},
			Links:  activityLinks,
			Tenant: tenant,
			Origin: v1alpha1.ActivityOrigin{
				Type: "audit",
				ID:   getNestedString(auditMap, "auditID"),
			},
		},
	}
}

// buildActivityFromEvent constructs an Activity from a Kubernetes event.
func buildActivityFromEvent(eventMap map[string]interface{}, spec *v1alpha1.ActivityPolicySpec, summary string, links []cel.Link, kindLabel string) *v1alpha1.Activity {
	regarding, _ := eventMap["regarding"].(map[string]interface{})

	// Extract timestamps
	var timestamp time.Time
	if ts, ok := eventMap["eventTime"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
			timestamp = t
		}
	}
	if timestamp.IsZero() {
		if metadata, ok := eventMap["metadata"].(map[string]interface{}); ok {
			if ts, ok := metadata["creationTimestamp"].(string); ok {
				if t, err := time.Parse(time.RFC3339, ts); err == nil {
					timestamp = t
				}
			}
		}
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	// Extract resource info from regarding
	namespace := getNestedString(regarding, "namespace")
	resourceName := getNestedString(regarding, "name")
	resourceUID := getNestedString(regarding, "uid")
	apiVersion := getNestedString(regarding, "apiVersion")

	// Events are typically system-generated
	changeSource := "system"

	// For events, actor is usually the reporting component
	reportingController := getNestedString(eventMap, "reportingController")
	actor := v1alpha1.ActivityActor{
		Type: "controller",
		Name: reportingController,
	}
	if actor.Name == "" {
		actor.Name = "unknown"
	}

	// Extract tenant info (may not be present in events)
	tenant := v1alpha1.ActivityTenant{
		Type: "global",
		Name: "default",
	}

	// Generate activity name
	activityName := fmt.Sprintf("act-%s", uuid.New().String()[:8])

	// Convert links
	activityLinks := convertLinks(links)

	// Use spec kind if kindLabel is empty
	kind := spec.Resource.Kind
	if kindLabel != "" {
		kind = kindLabel
	}

	// Get event UID for origin
	eventUID := ""
	if metadata, ok := eventMap["metadata"].(map[string]interface{}); ok {
		eventUID = getNestedString(metadata, "uid")
	}

	return &v1alpha1.Activity{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v1alpha1.SchemeGroupVersion.String(),
			Kind:       "Activity",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              activityName,
			Namespace:         namespace,
			CreationTimestamp: metav1.NewTime(timestamp),
			Labels: map[string]string{
				"activity.miloapis.com/origin-type":   "event",
				"activity.miloapis.com/change-source": changeSource,
				"activity.miloapis.com/api-group":     spec.Resource.APIGroup,
				"activity.miloapis.com/resource-kind": spec.Resource.Kind,
			},
		},
		Spec: v1alpha1.ActivitySpec{
			Summary:      summary,
			ChangeSource: changeSource,
			Actor:        actor,
			Resource: v1alpha1.ActivityResource{
				APIGroup:   spec.Resource.APIGroup,
				APIVersion: apiVersion,
				Kind:       kind,
				Name:       resourceName,
				Namespace:  namespace,
				UID:        resourceUID,
			},
			Links:  activityLinks,
			Tenant: tenant,
			Origin: v1alpha1.ActivityOrigin{
				Type: "event",
				ID:   eventUID,
			},
		},
	}
}

// classifyChangeSource determines whether an activity was initiated by a human or system.
func classifyChangeSource(user map[string]interface{}) string {
	if user == nil {
		return "system"
	}

	username := getNestedString(user, "username")

	// System service accounts
	if strings.HasPrefix(username, "system:serviceaccount:kube-system:") {
		return "system"
	}

	// Any system: prefixed username
	if strings.HasPrefix(username, "system:") {
		return "system"
	}

	// Usernames with @ are typically human users
	if strings.Contains(username, "@") {
		return "human"
	}

	// Service accounts
	if strings.HasPrefix(username, "serviceaccount:") {
		return "system"
	}

	// Usernames without special prefixes are likely human
	if username != "" && !strings.Contains(username, ":") {
		return "human"
	}

	return "system"
}

// resolveActor extracts actor information from the audit user field.
func resolveActor(user map[string]interface{}) v1alpha1.ActivityActor {
	if user == nil {
		return v1alpha1.ActivityActor{
			Type: "controller",
			Name: "unknown",
		}
	}

	username := getNestedString(user, "username")
	uid := getNestedString(user, "uid")

	actor := v1alpha1.ActivityActor{
		UID: uid,
	}

	switch {
	case strings.HasPrefix(username, "system:serviceaccount:"):
		actor.Type = "serviceaccount"
		parts := strings.Split(username, ":")
		if len(parts) >= 4 {
			actor.Name = parts[3]
		} else {
			actor.Name = username
		}

	case strings.HasPrefix(username, "system:"):
		actor.Type = "controller"
		parts := strings.Split(username, ":")
		if len(parts) >= 2 {
			actor.Name = parts[len(parts)-1]
		} else {
			actor.Name = username
		}

	default:
		actor.Type = "user"
		actor.Name = username
		if email := getNestedString(user, "email"); email != "" {
			actor.Email = email
		} else if strings.Contains(username, "@") {
			actor.Email = username
		}
	}

	if actor.Name == "" {
		actor.Name = "unknown"
	}

	return actor
}

// extractTenant extracts tenant information from user extra fields.
func extractTenant(user map[string]interface{}) v1alpha1.ActivityTenant {
	tenant := v1alpha1.ActivityTenant{
		Type: "global",
		Name: "default",
	}

	if user == nil {
		return tenant
	}

	extra, ok := user["extra"].(map[string]interface{})
	if !ok {
		return tenant
	}

	// Check for organization
	if orgs, ok := extra["organization"].([]interface{}); ok && len(orgs) > 0 {
		if org, ok := orgs[0].(string); ok {
			tenant.Type = "organization"
			tenant.Name = org
		}
	}

	// Check for project (more specific than organization)
	if projects, ok := extra["project"].([]interface{}); ok && len(projects) > 0 {
		if project, ok := projects[0].(string); ok {
			tenant.Type = "project"
			tenant.Name = project
		}
	}

	return tenant
}

// auditEventToMap converts an audit.Event struct to a map[string]interface{} for CEL evaluation.
func auditEventToMap(audit interface{}) (map[string]interface{}, error) {
	data, err := json.Marshal(audit)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal audit event: %w", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("failed to unmarshal audit event to map: %w", err)
	}

	return m, nil
}

// extractKindLabel extracts a human-readable kind label from an audit event map.
func extractKindLabel(auditMap map[string]interface{}) string {
	objectRef, _ := auditMap["objectRef"].(map[string]interface{})
	kind := getNestedString(objectRef, "kind")
	if kind == "" {
		return ""
	}
	return splitCamelCase(kind)
}

// extractEventKindLabel extracts a human-readable kind label from an event map.
func extractEventKindLabel(eventMap map[string]interface{}) string {
	regarding, _ := eventMap["regarding"].(map[string]interface{})
	kind := getNestedString(regarding, "kind")
	if kind == "" {
		return ""
	}
	return splitCamelCase(kind)
}

// splitCamelCase converts "HTTPProxy" to "HTTP Proxy", "PersistentVolume" to "Persistent Volume".
func splitCamelCase(s string) string {
	if s == "" {
		return ""
	}

	var result strings.Builder
	runes := []rune(s)

	for i := 0; i < len(runes); i++ {
		r := runes[i]

		if i > 0 && unicode.IsUpper(r) {
			prevUpper := unicode.IsUpper(runes[i-1])
			nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])

			if !prevUpper || (prevUpper && nextLower) {
				result.WriteRune(' ')
			}
		}

		result.WriteRune(r)
	}

	return result.String()
}

// pluralize converts a singular word to its plural form.
func pluralize(s string) string {
	if s == "" {
		return ""
	}

	irregulars := map[string]string{
		"Policy":  "Policies",
		"policy":  "policies",
		"Proxy":   "Proxies",
		"proxy":   "proxies",
		"Gateway": "Gateways",
		"gateway": "gateways",
	}

	if plural, ok := irregulars[s]; ok {
		return plural
	}

	lower := strings.ToLower(s)
	switch {
	case strings.HasSuffix(lower, "s"), strings.HasSuffix(lower, "x"),
		strings.HasSuffix(lower, "z"), strings.HasSuffix(lower, "ch"),
		strings.HasSuffix(lower, "sh"):
		return s + "es"
	case strings.HasSuffix(lower, "y") && len(lower) > 1 && !isVowel(rune(lower[len(lower)-2])):
		return s[:len(s)-1] + "ies"
	default:
		return s + "s"
	}
}

// isVowel returns true if the rune is a vowel.
func isVowel(r rune) bool {
	switch unicode.ToLower(r) {
	case 'a', 'e', 'i', 'o', 'u':
		return true
	}
	return false
}

// getNestedString extracts a string from a map, supporting nested access with multiple keys.
func getNestedString(m map[string]interface{}, keys ...string) string {
	if m == nil || len(keys) == 0 {
		return ""
	}

	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			if v, ok := current[key].(string); ok {
				return v
			}
			return ""
		}
		if nested, ok := current[key].(map[string]interface{}); ok {
			current = nested
		} else {
			return ""
		}
	}
	return ""
}

// convertLinks converts CEL links to API links.
func convertLinks(celLinks []cel.Link) []v1alpha1.ActivityLink {
	if len(celLinks) == 0 {
		return nil
	}

	links := make([]v1alpha1.ActivityLink, len(celLinks))
	for i, l := range celLinks {
		links[i] = v1alpha1.ActivityLink{
			Marker: l.Marker,
			Resource: v1alpha1.ActivityResource{
				APIGroup:  getStringFromMap(l.Resource, "apiGroup"),
				Kind:      getStringFromMap(l.Resource, "kind"),
				Name:      getStringFromMap(l.Resource, "name"),
				Namespace: getStringFromMap(l.Resource, "namespace"),
				UID:       getStringFromMap(l.Resource, "uid"),
			},
		}
	}
	return links
}

// getStringFromMap safely extracts a string from a map.
func getStringFromMap(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
