package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/processor"
)

// ProcessorOptions contains configuration for the activity processor.
type ProcessorOptions struct {
	// Kubernetes client config
	Kubeconfig string
	MasterURL  string

	// NATS configuration
	NATSInputURL       string
	NATSOutputURL      string
	NATSAuditSubject   string
	NATSEventSubject   string
	NATSActivityPrefix string

	// NATS TLS configuration
	NATSTLSEnabled  bool
	NATSTLSCertFile string
	NATSTLSKeyFile  string
	NATSTLSCAFile   string

	// Processing configuration
	Workers      int
	ResyncPeriod int

	// Health probes
	HealthProbeAddr string
}

// NewProcessorOptions creates options with default values.
func NewProcessorOptions() *ProcessorOptions {
	return &ProcessorOptions{
		NATSInputURL:       "nats://localhost:4222",
		NATSAuditSubject:   "audit.>",
		NATSEventSubject:   "events.>",
		NATSActivityPrefix: "activities",
		Workers:            4,
		ResyncPeriod:       30,
		HealthProbeAddr:    ":8081",
	}
}

// AddFlags adds processor flags to the command.
func (o *ProcessorOptions) AddFlags(fs *pflag.FlagSet) {
	// Kubernetes flags
	fs.StringVar(&o.Kubeconfig, "kubeconfig", o.Kubeconfig,
		"Path to a kubeconfig file. Only required if out-of-cluster.")
	fs.StringVar(&o.MasterURL, "master", o.MasterURL,
		"The address of the Kubernetes API server.")

	// NATS flags
	fs.StringVar(&o.NATSInputURL, "nats-input-url", o.NATSInputURL,
		"NATS URL for consuming audit logs and events.")
	fs.StringVar(&o.NATSOutputURL, "nats-output-url", o.NATSOutputURL,
		"NATS URL for publishing activities. Defaults to nats-input-url if not set.")
	fs.StringVar(&o.NATSAuditSubject, "nats-audit-subject", o.NATSAuditSubject,
		"NATS subject pattern for audit log events.")
	fs.StringVar(&o.NATSEventSubject, "nats-event-subject", o.NATSEventSubject,
		"NATS subject pattern for Kubernetes events.")
	fs.StringVar(&o.NATSActivityPrefix, "nats-activity-prefix", o.NATSActivityPrefix,
		"NATS subject prefix for publishing activities.")

	// NATS TLS flags
	fs.BoolVar(&o.NATSTLSEnabled, "nats-tls-enabled", o.NATSTLSEnabled,
		"Enable TLS for NATS connections.")
	fs.StringVar(&o.NATSTLSCertFile, "nats-tls-cert-file", o.NATSTLSCertFile,
		"Path to TLS client certificate file for NATS.")
	fs.StringVar(&o.NATSTLSKeyFile, "nats-tls-key-file", o.NATSTLSKeyFile,
		"Path to TLS client key file for NATS.")
	fs.StringVar(&o.NATSTLSCAFile, "nats-tls-ca-file", o.NATSTLSCAFile,
		"Path to TLS CA certificate file for NATS.")

	// Processing flags
	fs.IntVar(&o.Workers, "workers", o.Workers,
		"Number of worker goroutines for processing.")
	fs.IntVar(&o.ResyncPeriod, "resync-period", o.ResyncPeriod,
		"Resync period in seconds for ActivityPolicy cache.")

	// Health probe flags
	fs.StringVar(&o.HealthProbeAddr, "health-probe-addr", o.HealthProbeAddr,
		"Address for health probe endpoints.")
}

// NewProcessorCommand creates the processor subcommand.
func NewProcessorCommand() *cobra.Command {
	options := NewProcessorOptions()

	cmd := &cobra.Command{
		Use:   "processor",
		Short: "Run the activity processor",
		Long: `Run the activity processor that consumes audit logs and Kubernetes events
from NATS, translates them into human-readable Activity records using
ActivityPolicy rules, and publishes them to NATS JetStream.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return RunProcessor(options, cmd.Context())
		},
	}

	options.AddFlags(cmd.Flags())

	return cmd
}

// RunProcessor starts the activity processor.
func RunProcessor(options *ProcessorOptions, ctx context.Context) error {
	// Default output URL to input URL
	if options.NATSOutputURL == "" {
		options.NATSOutputURL = options.NATSInputURL
	}

	klog.Info("Starting Activity Processor")

	// Build the Kubernetes client configuration
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

	// Create dynamic client for watching ActivityPolicy
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return err
	}

	// Create discovery client and RESTMapper for resource-to-kind lookups
	// Use a cached discovery client with a deferred REST mapper so it can
	// refresh when new CRDs are registered without requiring a restart
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return err
	}

	cachedDiscoveryClient := memory.NewMemCacheClient(discoveryClient)
	restMapper := restmapper.NewDeferredDiscoveryRESTMapper(cachedDiscoveryClient)

	// Create the processor
	proc, err := processor.New(processor.Config{
		DynamicClient: dynamicClient,
		RESTMapper:    restMapper,

		NATSInputURL:       options.NATSInputURL,
		NATSOutputURL:      options.NATSOutputURL,
		NATSAuditSubject:   options.NATSAuditSubject,
		NATSEventSubject:   options.NATSEventSubject,
		NATSActivityPrefix: options.NATSActivityPrefix,

		NATSTLSEnabled:  options.NATSTLSEnabled,
		NATSTLSCertFile: options.NATSTLSCertFile,
		NATSTLSKeyFile:  options.NATSTLSKeyFile,
		NATSTLSCAFile:   options.NATSTLSCAFile,

		Workers:         options.Workers,
		ResyncPeriod:    options.ResyncPeriod,
		HealthProbeAddr: options.HealthProbeAddr,
	})
	if err != nil {
		return err
	}

	// Set up signal handling for graceful shutdown
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		select {
		case sig := <-sigChan:
			klog.Infof("Received signal %v, shutting down...", sig)
			cancel()
		case <-proc.ShutdownChan():
			klog.Info("Processor initiated shutdown (lame duck mode)")
			cancel()
		}
	}()

	// Run the processor
	if err := proc.Run(ctx); err != nil {
		return err
	}

	klog.Info("Activity Processor shutdown complete")
	return nil
}
