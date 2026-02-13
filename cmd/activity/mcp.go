package main

import (
	"context"
	"fmt"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"go.miloapis.com/activity/internal/version"
	"go.miloapis.com/activity/pkg/mcp/tools"
)

// MCPServerOptions contains configuration for the MCP server.
type MCPServerOptions struct {
	// Kubernetes client configuration
	Kubeconfig string
	Context    string
	Namespace  string
}

// NewMCPServerOptions creates options with default values.
func NewMCPServerOptions() *MCPServerOptions {
	return &MCPServerOptions{
		Namespace: "default",
	}
}

// AddFlags adds MCP server flags to the flag set.
func (o *MCPServerOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar(&o.Kubeconfig, "kubeconfig", o.Kubeconfig,
		"Path to kubeconfig file. If not set, uses in-cluster config or default kubeconfig location (~/.kube/config)")
	fs.StringVar(&o.Context, "context", o.Context,
		"Kubeconfig context to use. If not set, uses the current context")
	fs.StringVar(&o.Namespace, "namespace", o.Namespace,
		"Namespace for namespaced resources like Activities (default: 'default')")
}

// NewMCPCommand creates the mcp subcommand that starts the MCP server.
func NewMCPCommand() *cobra.Command {
	options := NewMCPServerOptions()

	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "Start the MCP server for AI tool integration",
		Long: `Start an MCP (Model Context Protocol) server that exposes audit log
and activity query tools for AI assistants.

The server communicates via stdio and can be connected to Claude Desktop,
VS Code extensions, or other MCP-compatible clients.

The server uses the Activity API via a Kubernetes client, so it requires
a valid kubeconfig with access to the Activity API resources.

Available tools:

  Audit Log Tools:
    - query_audit_logs: Search audit logs with CEL filters
    - get_audit_log_facets: Get distinct values for audit log fields

  Activity Tools (human-readable summaries):
    - query_activities: Search human-readable activity summaries
    - get_activity_facets: Get distinct values for activity fields

  Investigation Tools:
    - find_failed_operations: Find operations that failed (4xx/5xx)
    - get_resource_history: Get change history for a specific resource
    - get_user_activity_summary: Get a user's recent actions

  Analytics Tools:
    - get_activity_timeline: Activity counts grouped by time buckets
    - summarize_recent_activity: Summary with top actors and resources
    - compare_activity_periods: Compare activity between time periods

  Policy Tools:
    - list_activity_policies: List configured ActivityPolicies
    - preview_activity_policy: Test a policy against sample inputs

Example configuration for Claude Desktop (claude_desktop_config.json):
  {
    "mcpServers": {
      "activity": {
        "command": "activity",
        "args": ["mcp", "--kubeconfig", "~/.kube/config"]
      }
    }
  }`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return RunMCPServer(options)
		},
	}

	flags := cmd.Flags()
	options.AddFlags(flags)

	return cmd
}

// RunMCPServer starts the MCP server with the given options.
func RunMCPServer(options *MCPServerOptions) error {
	// Create tool provider
	cfg := tools.Config{
		Kubeconfig: options.Kubeconfig,
		Context:    options.Context,
		Namespace:  options.Namespace,
	}

	provider, err := tools.NewToolProvider(cfg)
	if err != nil {
		return fmt.Errorf("failed to create tool provider: %w", err)
	}
	defer provider.Close()

	// Create MCP server
	mcpServer := provider.NewMCPServer(tools.ServerConfig{
		Name:    "activity",
		Version: version.Version,
	})

	// Start server on stdio
	fmt.Fprintln(os.Stderr, "Starting Activity MCP server...")
	if options.Kubeconfig != "" {
		fmt.Fprintln(os.Stderr, "Using kubeconfig:", options.Kubeconfig)
	} else {
		fmt.Fprintln(os.Stderr, "Using default kubeconfig")
	}
	if options.Context != "" {
		fmt.Fprintln(os.Stderr, "Using context:", options.Context)
	}

	return mcpServer.Run(context.Background(), &mcp.StdioTransport{})
}
