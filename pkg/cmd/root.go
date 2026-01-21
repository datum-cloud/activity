package cmd

import (
	"os"

	"github.com/spf13/cobra"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/kubectl/pkg/cmd/util"
)

// ActivityCommandOptions contains options for creating the activity command
type ActivityCommandOptions struct {
	// Factory is the kubectl factory to use for building clients.
	// If nil, a default factory will be created.
	Factory util.Factory

	// IOStreams for command input/output.
	// If not set, defaults to os.Stdin/Stdout/Stderr.
	IOStreams genericclioptions.IOStreams

	// ConfigFlags for kubeconfig management.
	// If nil and Factory is nil, default ConfigFlags will be created.
	// This field is ignored if Factory is provided.
	ConfigFlags *genericclioptions.ConfigFlags
}

// NewActivityCommand creates the root command for the activity CLI
// with the provided options. This allows external clients to provide their own
// factory, IO streams, or config flags. Pass an empty ActivityCommandOptions{}
// to use defaults.
func NewActivityCommand(opts ActivityCommandOptions) *cobra.Command {
	// Set up IO streams
	ioStreams := opts.IOStreams
	if ioStreams.In == nil {
		ioStreams.In = os.Stdin
	}
	if ioStreams.Out == nil {
		ioStreams.Out = os.Stdout
	}
	if ioStreams.ErrOut == nil {
		ioStreams.ErrOut = os.Stderr
	}

	// Set up factory and config flags
	var f util.Factory
	var kubeConfigFlags *genericclioptions.ConfigFlags

	if opts.Factory != nil {
		// Use provided factory
		f = opts.Factory
	} else {
		// Create default factory
		if opts.ConfigFlags != nil {
			kubeConfigFlags = opts.ConfigFlags
		} else {
			kubeConfigFlags = genericclioptions.NewConfigFlags(true)
		}
		matchVersionKubeConfigFlags := util.NewMatchVersionFlags(kubeConfigFlags)
		f = util.NewFactory(matchVersionKubeConfigFlags)
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

	// Add global kubeconfig flags to root command if we created them
	// (external factory may manage its own flags)
	if kubeConfigFlags != nil {
		kubeConfigFlags.AddFlags(cmd.PersistentFlags())
	}

	// Add subcommands
	cmd.AddCommand(NewQueryCommand(f, ioStreams))
	cmd.AddCommand(NewHistoryCommand(f, ioStreams))

	return cmd
}
