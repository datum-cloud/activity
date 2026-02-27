package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	"github.com/nats-io/nats.go"
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

	// NATS configuration (required)
	NATSURL        string
	NATSTLSEnabled bool
	NATSTLSCertFile string
	NATSTLSKeyFile  string
	NATSTLSCAFile   string
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

	// NATS flags (required)
	fs.StringVar(&o.NATSURL, "nats-url", o.NATSURL,
		"NATS server URL (e.g., nats://localhost:4222). Required.")
	fs.BoolVar(&o.NATSTLSEnabled, "nats-tls-enabled", o.NATSTLSEnabled,
		"Enable TLS for NATS connection.")
	fs.StringVar(&o.NATSTLSCertFile, "nats-tls-cert-file", o.NATSTLSCertFile,
		"Path to client certificate file for NATS TLS.")
	fs.StringVar(&o.NATSTLSKeyFile, "nats-tls-key-file", o.NATSTLSKeyFile,
		"Path to client private key file for NATS TLS.")
	fs.StringVar(&o.NATSTLSCAFile, "nats-tls-ca-file", o.NATSTLSCAFile,
		"Path to CA certificate file for NATS TLS.")
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
	// Validate required flags
	if options.NATSURL == "" {
		return fmt.Errorf("--nats-url is required")
	}

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

	managerOpts := controller.ManagerOptions{
		Workers:         options.Workers,
		MetricsAddr:     options.MetricsAddr,
		HealthProbeAddr: options.HealthProbeAddr,
	}

	// Initialize NATS JetStream connection
	klog.Info("Initializing NATS JetStream connection")

	var natsOpts []nats.Option

	// Configure TLS if enabled
	if options.NATSTLSEnabled {
		tlsConfig := &tls.Config{
			MinVersion: tls.VersionTLS12,
		}

		// Load client cert/key if provided
		if options.NATSTLSCertFile != "" && options.NATSTLSKeyFile != "" {
			cert, err := tls.LoadX509KeyPair(options.NATSTLSCertFile, options.NATSTLSKeyFile)
			if err != nil {
				return fmt.Errorf("failed to load NATS TLS client cert: %w", err)
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}

		// Load CA cert if provided
		if options.NATSTLSCAFile != "" {
			caCert, err := os.ReadFile(options.NATSTLSCAFile)
			if err != nil {
				return fmt.Errorf("failed to read NATS TLS CA file: %w", err)
			}
			caCertPool := x509.NewCertPool()
			if !caCertPool.AppendCertsFromPEM(caCert) {
				return fmt.Errorf("failed to parse NATS TLS CA certificate")
			}
			tlsConfig.RootCAs = caCertPool
		}

		natsOpts = append(natsOpts, nats.Secure(tlsConfig))
	}

	natsConn, err := nats.Connect(options.NATSURL, natsOpts...)
	if err != nil {
		return fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := natsConn.JetStream()
	if err != nil {
		natsConn.Close()
		return fmt.Errorf("failed to get JetStream context: %w", err)
	}
	managerOpts.JetStream = js
	klog.Info("NATS JetStream initialized", "url", options.NATSURL)

	// Create the controller manager
	mgr, err := controller.NewManager(config, managerOpts)
	if err != nil {
		return err
	}

	// Use controller-runtime's signal handler for graceful shutdown
	ctx := ctrl.SetupSignalHandler()

	// Run the controller manager
	runErr := controller.Run(ctx, mgr)

	// Clean up NATS connection on shutdown
	klog.Info("Closing NATS connection")
	natsConn.Close()

	if runErr != nil {
		return runErr
	}

	klog.Info("Controller manager shutdown complete")
	return nil
}
