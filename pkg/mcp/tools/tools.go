// Package tools provides MCP (Model Context Protocol) tools for interacting with
// the Activity service. These tools can be used standalone or embedded into an
// external MCP server.
package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
