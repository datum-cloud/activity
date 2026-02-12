package main

import (
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	"go.miloapis.com/activity/internal/controller"
)

// ControllerManagerOptions contains configuration for the controller manager.
type ControllerManagerOptions struct {
	Kubeconfig      string
	MasterURL       string
	Workers         int
	MetricsAddr     string
	HealthProbeAddr string
}

// NewControllerManagerOptions creates options with default values.
func NewControllerManagerOptions() *ControllerManagerOptions {
	return &ControllerManagerOptions{
		Workers:         2,
		MetricsAddr:     ":8080",
		HealthProbeAddr: ":8081",
	}
}

// AddFlags adds controller manager flags to the command.
func (o *ControllerManagerOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar(&o.Kubeconfig, "kubeconfig", o.Kubeconfig,
		"Path to a kubeconfig file. Only required if out-of-cluster.")
	fs.StringVar(&o.MasterURL, "master", o.MasterURL,
		"The address of the Kubernetes API server. Overrides any value in kubeconfig.")
	fs.IntVar(&o.Workers, "workers", o.Workers,
		"Number of worker threads for the controller.")
	fs.StringVar(&o.MetricsAddr, "metrics-addr", o.MetricsAddr,
		"The address to bind the metrics endpoint.")
	fs.StringVar(&o.HealthProbeAddr, "health-probe-addr", o.HealthProbeAddr,
		"The address to bind the health probe endpoint.")
}

// NewControllerManagerCommand creates the controller-manager subcommand.
func NewControllerManagerCommand() *cobra.Command {
	options := NewControllerManagerOptions()

	cmd := &cobra.Command{
		Use:   "controller-manager",
		Short: "Run the controller manager",
		Long: `Run the controller manager that watches for changes to Activity resources
and reconciles the desired state. This includes managing ActivityPolicy resources
and ensuring consistent state across the cluster.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Set up controller-runtime logging
			ctrl.SetLogger(zap.New(zap.UseDevMode(true)))

			return RunControllerManager(options)
		},
	}

	options.AddFlags(cmd.Flags())

	return cmd
}

// RunControllerManager starts the controller manager.
func RunControllerManager(options *ControllerManagerOptions) error {
	klog.Info("Starting Activity Controller Manager")

	// Build the client configuration
	var config *rest.Config
	var err error

	if options.Kubeconfig != "" {
		config, err = clientcmd.BuildConfigFromFlags(options.MasterURL, options.Kubeconfig)
	} else {
		config, err = rest.InClusterConfig()
	}
	if err != nil {
		return err
	}

	// Create the controller manager
	mgr, err := controller.NewManager(config, controller.ManagerOptions{
		Workers:         options.Workers,
		MetricsAddr:     options.MetricsAddr,
		HealthProbeAddr: options.HealthProbeAddr,
	})
	if err != nil {
		return err
	}

	// Use controller-runtime's signal handler for graceful shutdown
	ctx := ctrl.SetupSignalHandler()

	// Run the controller manager
	if err := controller.Run(ctx, mgr); err != nil {
		return err
	}

	klog.Info("Controller manager shutdown complete")
	return nil
}
