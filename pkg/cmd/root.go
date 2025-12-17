package cmd

import (
	"github.com/spf13/cobra"
	"k8s.io/cli-runtime/pkg/genericclioptions"
)

// NewActivityCommand creates the root command for the activity CLI
func NewActivityCommand() *cobra.Command {
	ioStreams := genericclioptions.IOStreams{
		In:     nil,
		Out:    nil,
		ErrOut: nil,
	}

	cmd := &cobra.Command{
		Use:   "activity",
		Short: "Query control plane audit logs",
		Long: `The activity plugin provides commands to query and analyze audit logs
stored in your control plane's activity API server.

Use this tool to investigate incidents, track resource changes, generate compliance
reports, or analyze user activity.`,
		SilenceUsage: true,
	}

	// Add subcommands
	cmd.AddCommand(NewQueryCommand(ioStreams))

	return cmd
}
