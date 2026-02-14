// Package tools provides MCP (Model Context Protocol) tools for interacting with
// the Activity service. These tools can be used standalone or embedded into an
// external MCP server.
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
	activityclient "go.miloapis.com/activity/pkg/client/clientset/versioned/typed/activity/v1alpha1"
)

// ToolProvider provides MCP tools for interacting with the Activity API.
// It wraps a Kubernetes client and exposes query capabilities as MCP tools.
type ToolProvider struct {
	client    activityclient.ActivityV1alpha1Interface
	namespace string
}

// Config contains configuration for the ToolProvider.
type Config struct {
	// Kubeconfig is the path to a kubeconfig file.
	// If empty, uses in-cluster config or default kubeconfig location.
	Kubeconfig string

	// Context is the kubeconfig context to use.
	// If empty, uses the current context.
	Context string

	// Namespace for namespaced resources (e.g., Activities).
	// If empty, uses "default".
	Namespace string
}

// NewToolProvider creates a new ToolProvider with the given configuration.
func NewToolProvider(cfg Config) (*ToolProvider, error) {
	var restConfig *rest.Config
	var err error

	if cfg.Kubeconfig != "" {
		// Load from specified kubeconfig file
		loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: cfg.Kubeconfig}
		configOverrides := &clientcmd.ConfigOverrides{}
		if cfg.Context != "" {
			configOverrides.CurrentContext = cfg.Context
		}
		kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
		restConfig, err = kubeConfig.ClientConfig()
	} else {
		// Try in-cluster config first, fall back to default kubeconfig
		restConfig, err = rest.InClusterConfig()
		if err != nil {
			loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
			configOverrides := &clientcmd.ConfigOverrides{}
			if cfg.Context != "" {
				configOverrides.CurrentContext = cfg.Context
			}
			kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
			restConfig, err = kubeConfig.ClientConfig()
		}
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes config: %w", err)
	}

	client, err := activityclient.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create activity client: %w", err)
	}

	namespace := cfg.Namespace
	if namespace == "" {
		namespace = "default"
	}

	return &ToolProvider{
		client:    client,
		namespace: namespace,
	}, nil
}

// NewToolProviderWithClient creates a ToolProvider with an existing client.
// This is useful for embedding the tools into an existing application.
func NewToolProviderWithClient(client activityclient.ActivityV1alpha1Interface, namespace string) *ToolProvider {
	if namespace == "" {
		namespace = "default"
	}
	return &ToolProvider{
		client:    client,
		namespace: namespace,
	}
}

// Close releases resources held by the ToolProvider.
func (p *ToolProvider) Close() error {
	// Kubernetes client doesn't need explicit cleanup
	return nil
}

// RegisterTools registers all activity tools with an MCP server.
func (p *ToolProvider) RegisterTools(server *mcp.Server) {
	// Register query_audit_logs tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "query_audit_logs",
		Description: "Search audit logs from the Kubernetes control plane. Use this to investigate incidents, track resource changes, or analyze user activity. Results are returned newest-first.",
	}, p.handleQueryAuditLogs)

	// Register get_audit_log_facets tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_audit_log_facets",
		Description: "Get distinct values and counts for audit log fields. Use this to discover what verbs, users, resources, and namespaces appear in the audit logs. Useful for building filters or understanding activity patterns.",
	}, p.handleGetAuditLogFacets)

	// Register query_activities tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "query_activities",
		Description: "Search human-readable activity summaries. Activities are translated from audit logs into friendly descriptions like 'alice created HTTP proxy api-gateway'. Use this to understand what changed in plain language.",
	}, p.handleQueryActivities)

	// Register get_activity_facets tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_activity_facets",
		Description: "Get distinct values and counts for activity fields. Discover who's active, what resources are changing, and whether changes are human or automated.",
	}, p.handleGetActivityFacets)

	// Register find_failed_operations tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "find_failed_operations",
		Description: "Find operations that failed (HTTP 4xx/5xx responses). Use this to debug permission issues, find failed deployments, or investigate security events.",
	}, p.handleFindFailedOperations)

	// Register get_resource_history tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_resource_history",
		Description: "Get the change history for a specific resource. See who changed what, when, with field-level diffs where available. Use this to understand how a resource evolved over time.",
	}, p.handleGetResourceHistory)

	// Register get_user_activity_summary tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_user_activity_summary",
		Description: "Get a summary of a specific user's recent actions. See what resources they modified, when, and how often. Useful for security reviews and understanding user behavior.",
	}, p.handleGetUserActivitySummary)

	// Register get_activity_timeline tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_activity_timeline",
		Description: "Get activity counts grouped by time buckets (hourly/daily). Use this to visualize activity patterns, identify peak periods, and correlate with incidents.",
	}, p.handleGetActivityTimeline)

	// Register summarize_recent_activity tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "summarize_recent_activity",
		Description: "Generate a summary of recent activity including top actors, most changed resources, and key highlights. Perfect for status updates and handoffs.",
	}, p.handleSummarizeRecentActivity)

	// Register compare_activity_periods tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "compare_activity_periods",
		Description: "Compare activity between two time periods. Identify what changed, new actors, increased/decreased activity. Use this for incident investigation and trend analysis.",
	}, p.handleCompareActivityPeriods)

	// Register list_activity_policies tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_activity_policies",
		Description: "List configured ActivityPolicies that translate audit logs into human-readable summaries. See what resource types have translation rules and their status.",
	}, p.handleListActivityPolicies)

	// Register preview_activity_policy tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "preview_activity_policy",
		Description: "Test an ActivityPolicy against sample audit events to see what activities would be generated. Use this to develop and debug policies before deployment.",
	}, p.handlePreviewActivityPolicy)

	// Register query_kubernetes_events tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "query_kubernetes_events",
		Description: "Search Kubernetes Events stored in the Activity service. Events include pod scheduling, container creation, warnings, and errors. Use this to investigate cluster issues, debug deployment problems, or monitor system health.",
	}, p.handleQueryKubernetesEvents)

	// Register get_kubernetes_event_facets tool
	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_kubernetes_event_facets",
		Description: "Get distinct values and counts for Kubernetes Event fields. Use this to discover what event types, reasons, source components, and involved resources appear in the event stream. Useful for building filters or understanding event patterns.",
	}, p.handleGetKubernetesEventFacets)
}

// QueryAuditLogsArgs contains the arguments for the query_audit_logs tool.
type QueryAuditLogsArgs struct {
	// StartTime is the beginning of the search window.
	// Supports relative times (e.g., 'now-7d', 'now-2h') or RFC3339 timestamps.
	StartTime string `json:"startTime" jsonschema:"description=Start of search window. Supports relative times (e.g. 'now-7d') or RFC3339 timestamps. Required."`

	// EndTime is the end of the search window.
	// Supports relative times (e.g., 'now') or RFC3339 timestamps.
	EndTime string `json:"endTime" jsonschema:"description=End of search window. Supports relative times (e.g. 'now') or RFC3339 timestamps. Required."`

	// Filter is a CEL filter expression to narrow results.
	Filter string `json:"filter,omitempty" jsonschema:"description=CEL filter expression. Available fields: verb, user.username, user.uid, responseStatus.code, objectRef.namespace, objectRef.resource, objectRef.name, objectRef.apiGroup. Examples: verb == 'delete', objectRef.namespace == 'production'"`

	// Limit is the maximum number of results to return.
	Limit int `json:"limit,omitempty" jsonschema:"description=Maximum results to return (default: 100, max: 1000)"`
}

// handleQueryAuditLogs handles the query_audit_logs tool invocation.
func (p *ToolProvider) handleQueryAuditLogs(ctx context.Context, req *mcp.CallToolRequest, args QueryAuditLogsArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 100
	}

	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-query-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: args.StartTime,
			EndTime:   args.EndTime,
			Filter:    args.Filter,
			Limit:     limit,
		},
	}

	result, err := p.client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Format results
	output := map[string]any{
		"count":              len(result.Status.Results),
		"continue":           result.Status.Continue,
		"effectiveStartTime": result.Status.EffectiveStartTime,
		"effectiveEndTime":   result.Status.EffectiveEndTime,
		"events":             result.Status.Results,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// GetAuditLogFacetsArgs contains the arguments for the get_audit_log_facets tool.
type GetAuditLogFacetsArgs struct {
	// Fields to get facets for.
	Fields []string `json:"fields" jsonschema:"description=Fields to get facets for. Supported: verb, user.username, user.uid, responseStatus.code, objectRef.namespace, objectRef.resource, objectRef.apiGroup"`

	// StartTime is the beginning of the time window for facet aggregation.
	StartTime string `json:"startTime,omitempty" jsonschema:"description=Start of time window for facet aggregation (e.g. 'now-7d')"`

	// EndTime is the end of the time window for facet aggregation.
	EndTime string `json:"endTime,omitempty" jsonschema:"description=End of time window for facet aggregation (e.g. 'now')"`

	// Filter is a CEL filter to narrow down audit logs before computing facets.
	Filter string `json:"filter,omitempty" jsonschema:"description=CEL filter to narrow down audit logs before computing facets"`

	// Limit is the maximum number of distinct values per field.
	Limit int `json:"limit,omitempty" jsonschema:"description=Maximum distinct values per field (default: 20, max: 100)"`
}

// handleGetAuditLogFacets handles the get_audit_log_facets tool invocation.
func (p *ToolProvider) handleGetAuditLogFacets(ctx context.Context, req *mcp.CallToolRequest, args GetAuditLogFacetsArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 20
	}

	startTime := args.StartTime
	if startTime == "" {
		startTime = "now-7d"
	}

	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	facetSpecs := make([]v1alpha1.FacetSpec, 0, len(args.Fields))
	for _, field := range args.Fields {
		facetSpecs = append(facetSpecs, v1alpha1.FacetSpec{
			Field: field,
			Limit: limit,
		})
	}

	query := &v1alpha1.AuditLogFacetsQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-facets-",
		},
		Spec: v1alpha1.AuditLogFacetsQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: startTime,
				End:   endTime,
			},
			Filter: args.Filter,
			Facets: facetSpecs,
		},
	}

	result, err := p.client.AuditLogFacetsQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Convert to output format
	output := make(map[string]any)
	for _, facet := range result.Status.Facets {
		values := make([]map[string]any, 0, len(facet.Values))
		for _, v := range facet.Values {
			values = append(values, map[string]any{
				"value": v.Value,
				"count": v.Count,
			})
		}
		output[facet.Field] = values
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// QueryActivitiesArgs contains the arguments for the query_activities tool.
type QueryActivitiesArgs struct {
	// StartTime is the beginning of the search window.
	StartTime string `json:"startTime" jsonschema:"Start of search window (e.g. 'now-7d'). Required."`

	// EndTime is the end of the search window.
	EndTime string `json:"endTime" jsonschema:"End of search window (e.g. 'now'). Required."`

	// ChangeSource filters by change source.
	ChangeSource string `json:"changeSource,omitempty" jsonschema:"Filter by 'human' or 'system' changes"`

	// ActorName filters by actor name.
	ActorName string `json:"actorName,omitempty" jsonschema:"Filter by actor name/email"`

	// ResourceKind filters by resource kind.
	ResourceKind string `json:"resourceKind,omitempty" jsonschema:"Filter by resource kind (e.g. 'HTTPProxy')"`

	// APIGroup filters by API group.
	APIGroup string `json:"apiGroup,omitempty" jsonschema:"Filter by API group"`

	// Search performs full-text search on summary.
	Search string `json:"search,omitempty" jsonschema:"Full-text search on activity summary"`

	// Limit is the maximum number of results to return.
	Limit int `json:"limit,omitempty" jsonschema:"Maximum results (default: 100, max: 1000)"`
}

// handleQueryActivities handles the query_activities tool invocation.
func (p *ToolProvider) handleQueryActivities(ctx context.Context, req *mcp.CallToolRequest, args QueryActivitiesArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 100
	}

	// Build label selector for field filtering
	var labelSelectors []string
	if args.ChangeSource != "" {
		labelSelectors = append(labelSelectors, fmt.Sprintf("spec.changeSource=%s", args.ChangeSource))
	}
	if args.ActorName != "" {
		labelSelectors = append(labelSelectors, fmt.Sprintf("spec.actor.name=%s", args.ActorName))
	}
	if args.ResourceKind != "" {
		labelSelectors = append(labelSelectors, fmt.Sprintf("spec.resource.kind=%s", args.ResourceKind))
	}
	if args.APIGroup != "" {
		labelSelectors = append(labelSelectors, fmt.Sprintf("spec.resource.apiGroup=%s", args.APIGroup))
	}

	// Build list options
	listOpts := metav1.ListOptions{
		Limit: int64(limit),
	}
	if len(labelSelectors) > 0 {
		listOpts.LabelSelector = joinSelectors(labelSelectors)
	}

	// Add time range as field selectors if needed
	var fieldSelectors []string
	if args.StartTime != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("metadata.creationTimestamp>=%s", args.StartTime))
	}
	if args.EndTime != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("metadata.creationTimestamp<%s", args.EndTime))
	}
	if len(fieldSelectors) > 0 {
		listOpts.FieldSelector = joinSelectors(fieldSelectors)
	}

	result, err := p.client.Activities(p.namespace).List(ctx, listOpts)
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Format results
	activities := make([]map[string]any, 0, len(result.Items))
	for _, activity := range result.Items {
		// Apply search filter client-side if specified
		if args.Search != "" && !containsIgnoreCase(activity.Spec.Summary, args.Search) {
			continue
		}

		activityMap := map[string]any{
			"name":         activity.Name,
			"summary":      activity.Spec.Summary,
			"changeSource": activity.Spec.ChangeSource,
			"actor": map[string]any{
				"type": activity.Spec.Actor.Type,
				"name": activity.Spec.Actor.Name,
			},
			"resource": map[string]any{
				"apiGroup":  activity.Spec.Resource.APIGroup,
				"kind":      activity.Spec.Resource.Kind,
				"name":      activity.Spec.Resource.Name,
				"namespace": activity.Spec.Resource.Namespace,
			},
			"timestamp": activity.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
		}
		activities = append(activities, activityMap)
	}

	output := map[string]any{
		"count":      len(activities),
		"activities": activities,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// GetActivityFacetsArgs contains the arguments for the get_activity_facets tool.
type GetActivityFacetsArgs struct {
	// Fields to get facets for.
	Fields []string `json:"fields" jsonschema:"Fields to get facets for. Supported: spec.actor.name, spec.actor.type, spec.resource.kind, spec.resource.apiGroup, spec.resource.namespace, spec.changeSource"`

	// StartTime is the beginning of the time window.
	StartTime string `json:"startTime,omitempty" jsonschema:"Start of time window (e.g. 'now-7d')"`

	// EndTime is the end of the time window.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of time window (e.g. 'now')"`

	// Filter narrows the activities before computing facets using CEL.
	Filter string `json:"filter,omitempty" jsonschema:"CEL filter expression to narrow results"`

	// Limit is the maximum number of distinct values per field.
	Limit int `json:"limit,omitempty" jsonschema:"Maximum distinct values per field (default: 20, max: 100)"`
}

// handleGetActivityFacets handles the get_activity_facets tool invocation.
func (p *ToolProvider) handleGetActivityFacets(ctx context.Context, req *mcp.CallToolRequest, args GetActivityFacetsArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 20
	}

	startTime := args.StartTime
	if startTime == "" {
		startTime = "now-7d"
	}

	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	facetSpecs := make([]v1alpha1.FacetSpec, 0, len(args.Fields))
	for _, field := range args.Fields {
		facetSpecs = append(facetSpecs, v1alpha1.FacetSpec{
			Field: field,
			Limit: limit,
		})
	}

	query := &v1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-activity-facets-",
		},
		Spec: v1alpha1.ActivityFacetQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: startTime,
				End:   endTime,
			},
			Filter: args.Filter,
			Facets: facetSpecs,
		},
	}

	result, err := p.client.ActivityFacetQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Convert to output format
	output := make(map[string]any)
	for _, facet := range result.Status.Facets {
		values := make([]map[string]any, 0, len(facet.Values))
		for _, v := range facet.Values {
			values = append(values, map[string]any{
				"value": v.Value,
				"count": v.Count,
			})
		}
		output[facet.Field] = values
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// FindFailedOperationsArgs contains the arguments for the find_failed_operations tool.
type FindFailedOperationsArgs struct {
	// StartTime is the beginning of the search window.
	StartTime string `json:"startTime" jsonschema:"Start of search window. Required."`

	// EndTime is the end of the search window.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of search window (default: 'now')"`

	// StatusCodeMin is the minimum status code to include.
	StatusCodeMin int `json:"statusCodeMin,omitempty" jsonschema:"Minimum status code (default: 400)"`

	// StatusCodeMax is the maximum status code to include.
	StatusCodeMax int `json:"statusCodeMax,omitempty" jsonschema:"Maximum status code (default: 599)"`

	// Username filters by actor.
	Username string `json:"username,omitempty" jsonschema:"Filter by actor username"`

	// Resource filters by resource type.
	Resource string `json:"resource,omitempty" jsonschema:"Filter by resource type"`

	// Verb filters by verb.
	Verb string `json:"verb,omitempty" jsonschema:"Filter by verb (create, update, delete, etc.)"`

	// Limit is the maximum number of results.
	Limit int `json:"limit,omitempty" jsonschema:"Maximum results (default: 100)"`
}

// handleFindFailedOperations handles the find_failed_operations tool invocation.
func (p *ToolProvider) handleFindFailedOperations(ctx context.Context, req *mcp.CallToolRequest, args FindFailedOperationsArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 100
	}

	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	statusCodeMin := args.StatusCodeMin
	if statusCodeMin == 0 {
		statusCodeMin = 400
	}

	statusCodeMax := args.StatusCodeMax
	if statusCodeMax == 0 {
		statusCodeMax = 599
	}

	// Build CEL filter for failed operations
	filters := []string{
		fmt.Sprintf("responseStatus.code >= %d", statusCodeMin),
		fmt.Sprintf("responseStatus.code <= %d", statusCodeMax),
	}

	if args.Username != "" {
		filters = append(filters, fmt.Sprintf("user.username == '%s'", args.Username))
	}
	if args.Resource != "" {
		filters = append(filters, fmt.Sprintf("objectRef.resource == '%s'", args.Resource))
	}
	if args.Verb != "" {
		filters = append(filters, fmt.Sprintf("verb == '%s'", args.Verb))
	}

	filter := joinFilters(filters, " && ")

	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-failed-ops-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: args.StartTime,
			EndTime:   endTime,
			Filter:    filter,
			Limit:     limit,
		},
	}

	result, err := p.client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Count by status code
	statusCodeCounts := make(map[int]int)
	failures := make([]map[string]any, 0, len(result.Status.Results))

	for _, event := range result.Status.Results {
		code := int(event.ResponseStatus.Code)
		statusCodeCounts[code]++

		failure := map[string]any{
			"timestamp":  event.RequestReceivedTimestamp.Format("2006-01-02T15:04:05Z"),
			"user":       event.User.Username,
			"verb":       event.Verb,
			"resource":   event.ObjectRef.Resource,
			"name":       event.ObjectRef.Name,
			"namespace":  event.ObjectRef.Namespace,
			"statusCode": code,
		}

		if event.ResponseStatus.Message != "" {
			failure["message"] = event.ResponseStatus.Message
		}

		failures = append(failures, failure)
	}

	output := map[string]any{
		"count":        len(failures),
		"byStatusCode": statusCodeCounts,
		"failures":     failures,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// GetResourceHistoryArgs contains the arguments for the get_resource_history tool.
type GetResourceHistoryArgs struct {
	// ResourceUID is the UID of the resource to get history for.
	ResourceUID string `json:"resourceUID,omitempty" jsonschema:"UID of the resource (alternative to apiGroup/kind/name)"`

	// APIGroup of the resource.
	APIGroup string `json:"apiGroup,omitempty" jsonschema:"API group of the resource"`

	// Kind of the resource.
	Kind string `json:"kind,omitempty" jsonschema:"Kind of the resource (e.g. 'HTTPProxy')"`

	// Name of the resource.
	Name string `json:"name,omitempty" jsonschema:"Name of the resource"`

	// Namespace of the resource.
	Namespace string `json:"namespace,omitempty" jsonschema:"Namespace of the resource (if namespaced)"`

	// StartTime limits history to after this time.
	StartTime string `json:"startTime,omitempty" jsonschema:"Start of history window (default: 'now-30d')"`

	// EndTime limits history to before this time.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of history window (default: 'now')"`

	// Limit is the maximum number of events to return.
	Limit int `json:"limit,omitempty" jsonschema:"Maximum events (default: 100)"`
}

// handleGetResourceHistory handles the get_resource_history tool invocation.
func (p *ToolProvider) handleGetResourceHistory(ctx context.Context, req *mcp.CallToolRequest, args GetResourceHistoryArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 100
	}

	startTime := args.StartTime
	if startTime == "" {
		startTime = "now-30d"
	}

	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	// Build filter based on provided identifiers
	var filters []string

	if args.ResourceUID != "" {
		filters = append(filters, fmt.Sprintf("objectRef.uid == '%s'", args.ResourceUID))
	} else {
		if args.Name == "" {
			return errorResult("Either resourceUID or name is required"), nil, nil
		}
		filters = append(filters, fmt.Sprintf("objectRef.name == '%s'", args.Name))

		if args.APIGroup != "" {
			filters = append(filters, fmt.Sprintf("objectRef.apiGroup == '%s'", args.APIGroup))
		}
		if args.Kind != "" {
			// Kind maps to resource (lowercase plural), so we'll search by name pattern
			filters = append(filters, fmt.Sprintf("objectRef.resource.contains('%s')", strings.ToLower(args.Kind)))
		}
		if args.Namespace != "" {
			filters = append(filters, fmt.Sprintf("objectRef.namespace == '%s'", args.Namespace))
		}
	}

	// Only include mutation verbs for history
	filters = append(filters, "verb in ['create', 'update', 'patch', 'delete']")

	filter := joinFilters(filters, " && ")

	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-resource-history-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: startTime,
			EndTime:   endTime,
			Filter:    filter,
			Limit:     limit,
		},
	}

	result, err := p.client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Build history timeline
	history := make([]map[string]any, 0, len(result.Status.Results))
	for _, event := range result.Status.Results {
		entry := map[string]any{
			"timestamp": event.RequestReceivedTimestamp.Format("2006-01-02T15:04:05Z"),
			"actor":     event.User.Username,
			"verb":      event.Verb,
			"success":   event.ResponseStatus.Code < 400,
		}

		if event.ResponseStatus.Code >= 400 {
			entry["statusCode"] = event.ResponseStatus.Code
			entry["message"] = event.ResponseStatus.Message
		}

		history = append(history, entry)
	}

	// Build resource identifier for output
	resource := map[string]any{}
	if len(result.Status.Results) > 0 {
		ref := result.Status.Results[0].ObjectRef
		resource["apiGroup"] = ref.APIGroup
		resource["resource"] = ref.Resource
		resource["name"] = ref.Name
		resource["namespace"] = ref.Namespace
	} else {
		resource["name"] = args.Name
		resource["kind"] = args.Kind
		resource["apiGroup"] = args.APIGroup
		resource["namespace"] = args.Namespace
	}

	output := map[string]any{
		"resource": resource,
		"count":    len(history),
		"history":  history,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// GetUserActivitySummaryArgs contains the arguments for the get_user_activity_summary tool.
type GetUserActivitySummaryArgs struct {
	// Username is the username or email to get activity for.
	Username string `json:"username,omitempty" jsonschema:"Username or email (alternative to userUID)"`

	// UserUID is the user UID to get activity for.
	UserUID string `json:"userUID,omitempty" jsonschema:"User UID (more reliable than username)"`

	// StartTime is the beginning of the time window.
	StartTime string `json:"startTime,omitempty" jsonschema:"Start of window (default: 'now-7d')"`

	// EndTime is the end of the time window.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of window (default: 'now')"`

	// IncludeDetails includes individual activities in the response.
	IncludeDetails bool `json:"includeDetails,omitempty" jsonschema:"Include individual activities (default: false)"`
}

// handleGetUserActivitySummary handles the get_user_activity_summary tool invocation.
func (p *ToolProvider) handleGetUserActivitySummary(ctx context.Context, req *mcp.CallToolRequest, args GetUserActivitySummaryArgs) (*mcp.CallToolResult, any, error) {
	if args.Username == "" && args.UserUID == "" {
		return errorResult("Either username or userUID is required"), nil, nil
	}

	startTime := args.StartTime
	if startTime == "" {
		startTime = "now-7d"
	}

	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	// Build filter
	var filter string
	if args.UserUID != "" {
		filter = fmt.Sprintf("user.uid == '%s'", args.UserUID)
	} else {
		filter = fmt.Sprintf("user.username == '%s'", args.Username)
	}

	// Query audit logs to build summary
	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-user-summary-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: startTime,
			EndTime:   endTime,
			Filter:    filter,
			Limit:     1000, // Get more events for summary
		},
	}

	result, err := p.client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Build summary
	verbCounts := make(map[string]int)
	resourceCounts := make(map[string]int)
	dayCounts := make(map[string]int)
	var recentActions []map[string]any
	var username, userUID string

	for i, event := range result.Status.Results {
		if username == "" {
			username = event.User.Username
			userUID = event.User.UID
		}

		verbCounts[event.Verb]++
		resourceCounts[event.ObjectRef.Resource]++

		day := event.RequestReceivedTimestamp.Format("2006-01-02")
		dayCounts[day]++

		if args.IncludeDetails && i < 20 {
			recentActions = append(recentActions, map[string]any{
				"timestamp": event.RequestReceivedTimestamp.Format("2006-01-02T15:04:05Z"),
				"verb":      event.Verb,
				"resource":  event.ObjectRef.Resource,
				"name":      event.ObjectRef.Name,
				"namespace": event.ObjectRef.Namespace,
			})
		}
	}

	// Convert day counts to sorted list
	dayList := make([]map[string]any, 0, len(dayCounts))
	for day, count := range dayCounts {
		dayList = append(dayList, map[string]any{
			"date":  day,
			"count": count,
		})
	}

	output := map[string]any{
		"user": map[string]any{
			"username": username,
			"uid":      userUID,
		},
		"timeRange": map[string]any{
			"start": result.Status.EffectiveStartTime,
			"end":   result.Status.EffectiveEndTime,
		},
		"totalActions": len(result.Status.Results),
		"breakdown": map[string]any{
			"byVerb":     verbCounts,
			"byResource": resourceCounts,
			"byDay":      dayList,
		},
	}

	if args.IncludeDetails && len(recentActions) > 0 {
		output["recentActions"] = recentActions
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// GetActivityTimelineArgs contains the arguments for the get_activity_timeline tool.
type GetActivityTimelineArgs struct {
	// StartTime is the beginning of the timeline.
	StartTime string `json:"startTime" jsonschema:"Start of timeline. Required."`

	// EndTime is the end of the timeline.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of timeline (default: 'now')"`

	// BucketSize is the time bucket size.
	BucketSize string `json:"bucketSize,omitempty" jsonschema:"Bucket size: 'hour', 'day', 'week' (default: auto based on range)"`

	// GroupBy adds additional grouping.
	GroupBy string `json:"groupBy,omitempty" jsonschema:"Additional grouping: 'actor', 'kind', 'changeSource'"`

	// Filter is a CEL filter expression.
	Filter string `json:"filter,omitempty" jsonschema:"CEL filter expression to narrow results"`
}

// handleGetActivityTimeline handles the get_activity_timeline tool invocation.
func (p *ToolProvider) handleGetActivityTimeline(ctx context.Context, req *mcp.CallToolRequest, args GetActivityTimelineArgs) (*mcp.CallToolResult, any, error) {
	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	// Query audit logs to build timeline
	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-timeline-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: args.StartTime,
			EndTime:   endTime,
			Filter:    args.Filter,
			Limit:     1000,
		},
	}

	result, err := p.client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Determine bucket size
	bucketFormat := "2006-01-02T15:00:00Z" // hourly default
	bucketSize := args.BucketSize
	if bucketSize == "" {
		bucketSize = "hour"
	}

	switch bucketSize {
	case "day":
		bucketFormat = "2006-01-02T00:00:00Z"
	case "week":
		bucketFormat = "2006-01-02T00:00:00Z" // We'll round to week start
	}

	// Count by bucket
	bucketCounts := make(map[string]int)
	var peakBucket string
	var peakCount int

	for _, event := range result.Status.Results {
		bucket := event.RequestReceivedTimestamp.Format(bucketFormat)
		bucketCounts[bucket]++

		if bucketCounts[bucket] > peakCount {
			peakCount = bucketCounts[bucket]
			peakBucket = bucket
		}
	}

	// Convert to sorted list
	buckets := make([]map[string]any, 0, len(bucketCounts))
	for bucket, count := range bucketCounts {
		entry := map[string]any{
			"timestamp": bucket,
			"count":     count,
		}
		if bucket == peakBucket {
			entry["note"] = "peak"
		}
		buckets = append(buckets, entry)
	}

	// Calculate average
	var avg float64
	if len(buckets) > 0 {
		avg = float64(len(result.Status.Results)) / float64(len(buckets))
	}

	output := map[string]any{
		"timeRange": map[string]any{
			"start": result.Status.EffectiveStartTime,
			"end":   result.Status.EffectiveEndTime,
		},
		"bucketSize":       bucketSize,
		"totalCount":       len(result.Status.Results),
		"buckets":          buckets,
		"peakBucket":       map[string]any{"timestamp": peakBucket, "count": peakCount},
		"averagePerBucket": avg,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// SummarizeRecentActivityArgs contains the arguments for the summarize_recent_activity tool.
type SummarizeRecentActivityArgs struct {
	// StartTime is the beginning of the summary window.
	StartTime string `json:"startTime" jsonschema:"Start of summary window. Required."`

	// EndTime is the end of the summary window.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of summary window (default: 'now')"`

	// ChangeSource filters by change source.
	ChangeSource string `json:"changeSource,omitempty" jsonschema:"Filter to 'human' or 'system' changes"`

	// TopN is the number of top items per category.
	TopN int `json:"topN,omitempty" jsonschema:"Number of top items per category (default: 5)"`
}

// handleSummarizeRecentActivity handles the summarize_recent_activity tool invocation.
func (p *ToolProvider) handleSummarizeRecentActivity(ctx context.Context, req *mcp.CallToolRequest, args SummarizeRecentActivityArgs) (*mcp.CallToolResult, any, error) {
	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	topN := args.TopN
	if topN == 0 {
		topN = 5
	}

	// Build filter
	var filter string
	if args.ChangeSource != "" {
		filter = fmt.Sprintf("verb in ['create', 'update', 'patch', 'delete']")
	} else {
		filter = "verb in ['create', 'update', 'patch', 'delete']" // Only mutations for summary
	}

	// Query audit logs
	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-summary-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: args.StartTime,
			EndTime:   endTime,
			Filter:    filter,
			Limit:     1000,
		},
	}

	result, err := p.client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Build summary statistics
	actorCounts := make(map[string]int)
	resourceCounts := make(map[string]int)
	verbCounts := make(map[string]int)
	var humanChanges, systemChanges int
	var deletions []map[string]any

	for _, event := range result.Status.Results {
		actorCounts[event.User.Username]++
		resourceCounts[event.ObjectRef.Resource]++
		verbCounts[event.Verb]++

		// Classify as human or system
		if isSystemUser(event.User.Username) {
			systemChanges++
		} else {
			humanChanges++
		}

		// Track deletions
		if event.Verb == "delete" && len(deletions) < topN {
			deletions = append(deletions, map[string]any{
				"resource":  event.ObjectRef.Resource,
				"name":      event.ObjectRef.Name,
				"namespace": event.ObjectRef.Namespace,
				"actor":     event.User.Username,
			})
		}
	}

	// Get top actors and resources
	topActors := getTopN(actorCounts, topN)
	topResources := getTopN(resourceCounts, topN)

	// Build highlights
	highlights := []string{
		fmt.Sprintf("%d total changes (%d human, %d system)", len(result.Status.Results), humanChanges, systemChanges),
	}

	if len(topActors) > 0 {
		highlights = append(highlights, fmt.Sprintf("Most active: %s (%d changes)", topActors[0]["name"], topActors[0]["count"]))
	}

	if len(topResources) > 0 {
		highlights = append(highlights, fmt.Sprintf("Most changed resource type: %s (%d changes)", topResources[0]["name"], topResources[0]["count"]))
	}

	if len(deletions) > 0 {
		highlights = append(highlights, fmt.Sprintf("%d resources deleted", verbCounts["delete"]))
	}

	output := map[string]any{
		"timeRange": map[string]any{
			"start": result.Status.EffectiveStartTime,
			"end":   result.Status.EffectiveEndTime,
		},
		"totalActivities": len(result.Status.Results),
		"humanChanges":    humanChanges,
		"systemChanges":   systemChanges,
		"highlights":      highlights,
		"topActors":       topActors,
		"topResources":    topResources,
		"byVerb":          verbCounts,
	}

	if len(deletions) > 0 {
		output["deletions"] = deletions
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// CompareActivityPeriodsArgs contains the arguments for the compare_activity_periods tool.
type CompareActivityPeriodsArgs struct {
	// BaselineStart is the start of the baseline period.
	BaselineStart string `json:"baselineStart" jsonschema:"Start of baseline period. Required."`

	// BaselineEnd is the end of the baseline period.
	BaselineEnd string `json:"baselineEnd" jsonschema:"End of baseline period. Required."`

	// ComparisonStart is the start of the comparison period.
	ComparisonStart string `json:"comparisonStart" jsonschema:"Start of comparison period. Required."`

	// ComparisonEnd is the end of the comparison period.
	ComparisonEnd string `json:"comparisonEnd" jsonschema:"End of comparison period. Required."`

	// GroupBy specifies how to compare.
	GroupBy string `json:"groupBy,omitempty" jsonschema:"Compare by 'actor', 'resource', 'verb' (default: all)"`
}

// handleCompareActivityPeriods handles the compare_activity_periods tool invocation.
func (p *ToolProvider) handleCompareActivityPeriods(ctx context.Context, req *mcp.CallToolRequest, args CompareActivityPeriodsArgs) (*mcp.CallToolResult, any, error) {
	// Query baseline period
	baselineQuery := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-compare-baseline-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: args.BaselineStart,
			EndTime:   args.BaselineEnd,
			Limit:     1000,
		},
	}

	baselineResult, err := p.client.AuditLogQueries().Create(ctx, baselineQuery, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Baseline query failed: %v", err)), nil, nil
	}

	// Query comparison period
	comparisonQuery := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-compare-comparison-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: args.ComparisonStart,
			EndTime:   args.ComparisonEnd,
			Limit:     1000,
		},
	}

	comparisonResult, err := p.client.AuditLogQueries().Create(ctx, comparisonQuery, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Comparison query failed: %v", err)), nil, nil
	}

	// Build counts for both periods
	baselineCounts := buildCounts(baselineResult.Status.Results)
	comparisonCounts := buildCounts(comparisonResult.Status.Results)

	// Find differences
	newInComparison := findNew(baselineCounts.actors, comparisonCounts.actors)
	increasedActivity := findIncreased(baselineCounts.resources, comparisonCounts.resources)
	decreasedActivity := findDecreased(baselineCounts.resources, comparisonCounts.resources)

	// Calculate change percentage
	var changePercent float64
	if baselineCounts.total > 0 {
		changePercent = float64(comparisonCounts.total-baselineCounts.total) / float64(baselineCounts.total) * 100
	}

	output := map[string]any{
		"baseline": map[string]any{
			"start": baselineResult.Status.EffectiveStartTime,
			"end":   baselineResult.Status.EffectiveEndTime,
			"count": baselineCounts.total,
		},
		"comparison": map[string]any{
			"start": comparisonResult.Status.EffectiveStartTime,
			"end":   comparisonResult.Status.EffectiveEndTime,
			"count": comparisonCounts.total,
		},
		"changePercent":     changePercent,
		"newInComparison":   newInComparison,
		"increasedActivity": increasedActivity,
		"decreasedActivity": decreasedActivity,
	}

	// Add analysis summary
	analysis := fmt.Sprintf("Comparison period shows %.0f%% %s activity.",
		absFloat(changePercent),
		ternary(changePercent >= 0, "more", "less"))

	if len(newInComparison) > 0 {
		analysis += fmt.Sprintf(" %d new actors appeared.", len(newInComparison))
	}

	output["analysis"] = analysis

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// ListActivityPoliciesArgs contains the arguments for the list_activity_policies tool.
type ListActivityPoliciesArgs struct {
	// APIGroup filters by resource API group.
	APIGroup string `json:"apiGroup,omitempty" jsonschema:"Filter by resource API group"`

	// Kind filters by resource kind.
	Kind string `json:"kind,omitempty" jsonschema:"Filter by resource kind"`

	// IncludeRules includes full rule definitions in output.
	IncludeRules bool `json:"includeRules,omitempty" jsonschema:"Include full rule definitions (default: false)"`
}

// handleListActivityPolicies handles the list_activity_policies tool invocation.
func (p *ToolProvider) handleListActivityPolicies(ctx context.Context, req *mcp.CallToolRequest, args ListActivityPoliciesArgs) (*mcp.CallToolResult, any, error) {
	result, err := p.client.ActivityPolicies().List(ctx, metav1.ListOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	policies := make([]map[string]any, 0, len(result.Items))
	for _, policy := range result.Items {
		// Apply filters
		if args.APIGroup != "" && policy.Spec.Resource.APIGroup != args.APIGroup {
			continue
		}
		if args.Kind != "" && policy.Spec.Resource.Kind != args.Kind {
			continue
		}

		policyMap := map[string]any{
			"name": policy.Name,
			"resource": map[string]any{
				"apiGroup": policy.Spec.Resource.APIGroup,
				"kind":     policy.Spec.Resource.Kind,
			},
			"auditRuleCount": len(policy.Spec.AuditRules),
			"eventRuleCount": len(policy.Spec.EventRules),
		}

		// Get status
		status := "Unknown"
		for _, cond := range policy.Status.Conditions {
			if cond.Type == "Ready" {
				if cond.Status == "True" {
					status = "Ready"
				} else {
					status = cond.Reason
				}
				break
			}
		}
		policyMap["status"] = status

		if args.IncludeRules {
			policyMap["auditRules"] = policy.Spec.AuditRules
			policyMap["eventRules"] = policy.Spec.EventRules
		}

		policies = append(policies, policyMap)
	}

	output := map[string]any{
		"policies": policies,
		"summary":  fmt.Sprintf("%d policies covering %d resource types", len(policies), len(policies)),
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// PreviewActivityPolicyArgs contains the arguments for the preview_activity_policy tool.
type PreviewActivityPolicyArgs struct {
	// Policy is the ActivityPolicy spec to test.
	Policy v1alpha1.ActivityPolicySpec `json:"policy" jsonschema:"ActivityPolicy spec to test"`

	// Inputs are sample audit/event inputs to test.
	Inputs []v1alpha1.PolicyPreviewInput `json:"inputs" jsonschema:"Sample inputs to test against the policy"`

	// KindLabel is the human-readable kind label.
	KindLabel string `json:"kindLabel,omitempty" jsonschema:"Human-readable kind label (e.g. 'HTTP proxy')"`
}

// handlePreviewActivityPolicy handles the preview_activity_policy tool invocation.
func (p *ToolProvider) handlePreviewActivityPolicy(ctx context.Context, req *mcp.CallToolRequest, args PreviewActivityPolicyArgs) (*mcp.CallToolResult, any, error) {
	preview := &v1alpha1.PolicyPreview{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-preview-",
		},
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: args.Policy,
			Inputs: args.Inputs,
		},
	}

	result, err := p.client.PolicyPreviews().Create(ctx, preview, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Preview failed: %v", err)), nil, nil
	}

	if result.Status.Error != "" {
		return errorResult(fmt.Sprintf("Preview error: %s", result.Status.Error)), nil, nil
	}

	// Format results
	results := make([]map[string]any, 0, len(result.Status.Results))
	for _, r := range result.Status.Results {
		resultMap := map[string]any{
			"inputIndex": r.InputIndex,
			"matched":    r.Matched,
		}

		if r.Matched {
			resultMap["matchedRule"] = map[string]any{
				"type":  r.MatchedRuleType,
				"index": r.MatchedRuleIndex,
			}
		}

		if r.Error != "" {
			resultMap["error"] = r.Error
		}

		results = append(results, resultMap)
	}

	// Format generated activities
	activities := make([]map[string]any, 0, len(result.Status.Activities))
	for _, a := range result.Status.Activities {
		activities = append(activities, map[string]any{
			"summary": a.Spec.Summary,
			"actor": map[string]any{
				"type": a.Spec.Actor.Type,
				"name": a.Spec.Actor.Name,
			},
			"resource": map[string]any{
				"kind": a.Spec.Resource.Kind,
				"name": a.Spec.Resource.Name,
			},
		})
	}

	output := map[string]any{
		"results":    results,
		"activities": activities,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// QueryKubernetesEventsArgs contains the arguments for the query_kubernetes_events tool.
type QueryKubernetesEventsArgs struct {
	// Namespace to query events from. If empty, queries all namespaces.
	Namespace string `json:"namespace,omitempty" jsonschema:"Namespace to query events from. Leave empty for all namespaces."`

	// InvolvedObjectKind filters by the kind of the involved object.
	InvolvedObjectKind string `json:"involvedObjectKind,omitempty" jsonschema:"Filter by involved object kind (e.g. 'Pod', 'Deployment', 'ReplicaSet')"`

	// InvolvedObjectName filters by the name of the involved object.
	InvolvedObjectName string `json:"involvedObjectName,omitempty" jsonschema:"Filter by involved object name"`

	// Reason filters by event reason.
	Reason string `json:"reason,omitempty" jsonschema:"Filter by event reason (e.g. 'Scheduled', 'Pulled', 'Created', 'FailedScheduling')"`

	// Type filters by event type.
	Type string `json:"type,omitempty" jsonschema:"Filter by event type: 'Normal' or 'Warning'"`

	// SourceComponent filters by source component.
	SourceComponent string `json:"sourceComponent,omitempty" jsonschema:"Filter by source component (e.g. 'kubelet', 'scheduler', 'deployment-controller')"`

	// Limit is the maximum number of results to return.
	Limit int `json:"limit,omitempty" jsonschema:"Maximum results to return (default: 100, max: 1000)"`
}

// handleQueryKubernetesEvents handles the query_kubernetes_events tool invocation.
func (p *ToolProvider) handleQueryKubernetesEvents(ctx context.Context, req *mcp.CallToolRequest, args QueryKubernetesEventsArgs) (*mcp.CallToolResult, any, error) {
	limit := int64(args.Limit)
	if limit == 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	// Build field selector for filtering
	var fieldSelectors []string
	if args.InvolvedObjectKind != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("involvedObject.kind=%s", args.InvolvedObjectKind))
	}
	if args.InvolvedObjectName != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("involvedObject.name=%s", args.InvolvedObjectName))
	}
	if args.Reason != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("reason=%s", args.Reason))
	}
	if args.Type != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("type=%s", args.Type))
	}
	if args.SourceComponent != "" {
		fieldSelectors = append(fieldSelectors, fmt.Sprintf("source.component=%s", args.SourceComponent))
	}

	listOpts := metav1.ListOptions{
		Limit: limit,
	}
	if len(fieldSelectors) > 0 {
		listOpts.FieldSelector = joinSelectors(fieldSelectors)
	}

	// Use the REST client to list events
	// Events are exposed at /apis/activity.miloapis.com/v1alpha1/namespaces/{namespace}/events
	namespace := args.Namespace
	if namespace == "" {
		namespace = p.namespace
	}

	var eventList corev1.EventList
	err := p.client.RESTClient().Get().
		Namespace(namespace).
		Resource("events").
		VersionedParams(&listOpts, metav1.ParameterCodec).
		Do(ctx).
		Into(&eventList)

	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Format results
	events := make([]map[string]any, 0, len(eventList.Items))
	for _, event := range eventList.Items {
		eventMap := map[string]any{
			"name":      event.Name,
			"namespace": event.Namespace,
			"type":      event.Type,
			"reason":    event.Reason,
			"message":   event.Message,
			"involvedObject": map[string]any{
				"kind":      event.InvolvedObject.Kind,
				"name":      event.InvolvedObject.Name,
				"namespace": event.InvolvedObject.Namespace,
			},
			"source": map[string]any{
				"component": event.Source.Component,
				"host":      event.Source.Host,
			},
			"count": event.Count,
		}

		// Use the most recent timestamp available
		if event.LastTimestamp.Time.IsZero() {
			if event.EventTime.Time.IsZero() {
				eventMap["timestamp"] = event.FirstTimestamp.Format("2006-01-02T15:04:05Z")
			} else {
				eventMap["timestamp"] = event.EventTime.Format("2006-01-02T15:04:05Z")
			}
		} else {
			eventMap["timestamp"] = event.LastTimestamp.Format("2006-01-02T15:04:05Z")
		}

		events = append(events, eventMap)
	}

	output := map[string]any{
		"count":  len(events),
		"events": events,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// GetKubernetesEventFacetsArgs contains the arguments for the get_kubernetes_event_facets tool.
type GetKubernetesEventFacetsArgs struct {
	// Fields to get facets for.
	Fields []string `json:"fields" jsonschema:"Fields to get facets for. Supported: involvedObject.kind, involvedObject.namespace, reason, type, source.component, namespace"`

	// StartTime is the beginning of the time window for facet aggregation.
	StartTime string `json:"startTime,omitempty" jsonschema:"Start of time window for facet aggregation (e.g. 'now-7d')"`

	// EndTime is the end of the time window for facet aggregation.
	EndTime string `json:"endTime,omitempty" jsonschema:"End of time window for facet aggregation (e.g. 'now')"`

	// Limit is the maximum number of distinct values per field.
	Limit int `json:"limit,omitempty" jsonschema:"Maximum distinct values per field (default: 20, max: 100)"`
}

// handleGetKubernetesEventFacets handles the get_kubernetes_event_facets tool invocation.
func (p *ToolProvider) handleGetKubernetesEventFacets(ctx context.Context, req *mcp.CallToolRequest, args GetKubernetesEventFacetsArgs) (*mcp.CallToolResult, any, error) {
	limit := int32(args.Limit)
	if limit == 0 {
		limit = 20
	}

	startTime := args.StartTime
	if startTime == "" {
		startTime = "now-7d"
	}

	endTime := args.EndTime
	if endTime == "" {
		endTime = "now"
	}

	facetSpecs := make([]v1alpha1.FacetSpec, 0, len(args.Fields))
	for _, field := range args.Fields {
		facetSpecs = append(facetSpecs, v1alpha1.FacetSpec{
			Field: field,
			Limit: limit,
		})
	}

	query := &v1alpha1.EventFacetQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "mcp-event-facets-",
		},
		Spec: v1alpha1.EventFacetQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: startTime,
				End:   endTime,
			},
			Facets: facetSpecs,
		},
	}

	result, err := p.client.EventFacetQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return errorResult(fmt.Sprintf("Query failed: %v", err)), nil, nil
	}

	// Convert to output format
	output := make(map[string]any)
	for _, facet := range result.Status.Facets {
		values := make([]map[string]any, 0, len(facet.Values))
		for _, v := range facet.Values {
			values = append(values, map[string]any{
				"value": v.Value,
				"count": v.Count,
			})
		}
		output[facet.Field] = values
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to format results: %v", err)), nil, nil
	}

	return textResult(string(jsonBytes)), nil, nil
}

// Helper functions

func textResult(text string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: text},
		},
	}
}

func errorResult(message string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{
			&mcp.TextContent{Text: message},
		},
	}
}

func joinSelectors(selectors []string) string {
	return strings.Join(selectors, ",")
}

func joinFilters(filters []string, sep string) string {
	return strings.Join(filters, sep)
}

func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

func isSystemUser(username string) bool {
	return strings.HasPrefix(username, "system:") ||
		strings.Contains(username, "serviceaccount") ||
		strings.Contains(username, "controller")
}

func getTopN(counts map[string]int, n int) []map[string]any {
	// Convert to slice and sort
	type kv struct {
		Key   string
		Value int
	}
	var sorted []kv
	for k, v := range counts {
		sorted = append(sorted, kv{k, v})
	}

	// Sort by count descending
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].Value > sorted[i].Value {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	// Take top N
	result := make([]map[string]any, 0, n)
	for i := 0; i < len(sorted) && i < n; i++ {
		result = append(result, map[string]any{
			"name":  sorted[i].Key,
			"count": sorted[i].Value,
		})
	}
	return result
}

type periodCounts struct {
	total     int
	actors    map[string]int
	resources map[string]int
	verbs     map[string]int
}

func buildCounts(events []auditv1.Event) periodCounts {
	counts := periodCounts{
		total:     len(events),
		actors:    make(map[string]int),
		resources: make(map[string]int),
		verbs:     make(map[string]int),
	}

	for _, event := range events {
		counts.actors[event.User.Username]++
		counts.resources[event.ObjectRef.Resource]++
		counts.verbs[event.Verb]++
	}

	return counts
}

func findNew(baseline, comparison map[string]int) []map[string]any {
	var result []map[string]any
	for k, v := range comparison {
		if _, exists := baseline[k]; !exists {
			result = append(result, map[string]any{
				"name":  k,
				"count": v,
				"note":  "Not present in baseline",
			})
		}
	}
	return result
}

func findIncreased(baseline, comparison map[string]int) []map[string]any {
	var result []map[string]any
	for k, v := range comparison {
		if baselineV, exists := baseline[k]; exists && v > baselineV {
			changePercent := float64(v-baselineV) / float64(baselineV) * 100
			if changePercent >= 50 { // Only include significant increases
				result = append(result, map[string]any{
					"name":          k,
					"baseline":      baselineV,
					"comparison":    v,
					"changePercent": changePercent,
				})
			}
		}
	}
	return result
}

func findDecreased(baseline, comparison map[string]int) []map[string]any {
	var result []map[string]any
	for k, v := range baseline {
		if compV, exists := comparison[k]; exists && compV < v {
			changePercent := float64(v-compV) / float64(v) * 100
			if changePercent >= 50 { // Only include significant decreases
				result = append(result, map[string]any{
					"name":          k,
					"baseline":      v,
					"comparison":    compV,
					"changePercent": -changePercent,
				})
			}
		}
	}
	return result
}

func absFloat(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
