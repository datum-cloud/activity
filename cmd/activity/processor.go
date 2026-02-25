package main

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	"go.miloapis.com/activity/internal/activityprocessor"
)

// ProcessorOptions contains configuration for the activity processor.
type ProcessorOptions struct {
	// Kubernetes configuration
	Kubeconfig string
	MasterURL  string

	// NATS configuration
	NATSURL        string
	NATSStreamName string
	ConsumerName   string

	// NATS event stream configuration
	NATSEventStream   string
	NATSEventConsumer string

	// Output NATS stream
	OutputStreamName    string
	OutputSubjectPrefix string

	// NATS TLS/mTLS configuration
	NATSTLSEnabled  bool
	NATSTLSCertFile string
	NATSTLSKeyFile  string
	NATSTLSCAFile   string

	// Processing configuration
	Workers   int
	BatchSize int
	AckWait   time.Duration

	// Health probe configuration
	HealthProbeAddr string
}

// NewProcessorOptions creates options with default values.
func NewProcessorOptions() *ProcessorOptions {
	return &ProcessorOptions{
		NATSURL:             "nats://localhost:4222",
		NATSStreamName:      "AUDIT_EVENTS",
		ConsumerName:        "activity-processor@activity.miloapis.com",
		NATSEventStream:     "EVENTS",
		NATSEventConsumer:   "activity-event-processor",
		OutputStreamName:    "ACTIVITIES",
		OutputSubjectPrefix: "activities",
		Workers:             4,
		BatchSize:           100,
		AckWait:             30 * time.Second,
		HealthProbeAddr:     ":8081",
	}
}

// AddFlags adds processor flags to the command.
func (o *ProcessorOptions) AddFlags(fs *pflag.FlagSet) {
	// Kubernetes flags
	fs.StringVar(&o.Kubeconfig, "kubeconfig", o.Kubeconfig,
		"Path to a kubeconfig file. Only required if out-of-cluster.")
	fs.StringVar(&o.MasterURL, "master", o.MasterURL,
		"The address of the Kubernetes API server. Overrides any value in kubeconfig.")

	// NATS flags
	fs.StringVar(&o.NATSURL, "nats-url", o.NATSURL,
		"NATS server URL.")
	fs.StringVar(&o.NATSStreamName, "nats-stream", o.NATSStreamName,
		"NATS JetStream stream name for audit events.")
	fs.StringVar(&o.ConsumerName, "consumer-name", o.ConsumerName,
		"Durable consumer name for the audit log processor.")
	fs.StringVar(&o.NATSEventStream, "nats-event-stream", o.NATSEventStream,
		"NATS JetStream stream name for Kubernetes events.")
	fs.StringVar(&o.NATSEventConsumer, "nats-event-consumer", o.NATSEventConsumer,
		"Durable consumer name for the event processor.")
	fs.StringVar(&o.OutputStreamName, "output-stream", o.OutputStreamName,
		"NATS JetStream stream name for generated activities.")
	fs.StringVar(&o.OutputSubjectPrefix, "output-subject-prefix", o.OutputSubjectPrefix,
		"Subject prefix for published activities.")

	// NATS TLS/mTLS flags
	fs.BoolVar(&o.NATSTLSEnabled, "nats-tls-enabled", o.NATSTLSEnabled,
		"Enable TLS for NATS connection.")
	fs.StringVar(&o.NATSTLSCertFile, "nats-tls-cert-file", o.NATSTLSCertFile,
		"Path to client certificate file for mTLS authentication.")
	fs.StringVar(&o.NATSTLSKeyFile, "nats-tls-key-file", o.NATSTLSKeyFile,
		"Path to client private key file for mTLS authentication.")
	fs.StringVar(&o.NATSTLSCAFile, "nats-tls-ca-file", o.NATSTLSCAFile,
		"Path to CA certificate file for server verification.")

	// Processing flags
	fs.IntVar(&o.Workers, "workers", o.Workers,
		"Number of worker goroutines for processing.")
	fs.IntVar(&o.BatchSize, "batch-size", o.BatchSize,
		"Number of messages to fetch per batch.")
	fs.DurationVar(&o.AckWait, "ack-wait", o.AckWait,
		"Time to wait before message redelivery.")

	// Health probe flags
	fs.StringVar(&o.HealthProbeAddr, "health-probe-addr", o.HealthProbeAddr,
		"Address for health probe server (e.g., :8081). Set to empty to disable.")
}

// NewProcessorCommand creates the processor subcommand.
func NewProcessorCommand() *cobra.Command {
	options := NewProcessorOptions()

	cmd := &cobra.Command{
		Use:   "processor",
		Short: "Run the activity processor",
		Long: `Run the activity processor that consumes audit events and Kubernetes events from NATS,
evaluates ActivityPolicy rules, and generates human-readable Activity resources.

The processor:
- Connects to NATS JetStream to consume Kubernetes audit events (AUDIT_EVENTS stream)
- Connects to NATS JetStream to consume Kubernetes events (EVENTS stream)
- Watches ActivityPolicy resources to know which rules to apply
- Evaluates CEL expressions to match and transform events
- Publishes activities to NATS for downstream consumption (Vector writes to ClickHouse)`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Set up controller-runtime logging
			ctrl.SetLogger(zap.New(zap.UseDevMode(true)))

			return RunProcessor(options)
		},
	}

	options.AddFlags(cmd.Flags())

	return cmd
}

// RunProcessor starts the activity processor.
func RunProcessor(options *ProcessorOptions) error {
	klog.Info("Starting Activity Processor")

	// Build Kubernetes client configuration
	var restConfig *rest.Config
	var err error

	if options.Kubeconfig != "" {
		restConfig, err = clientcmd.BuildConfigFromFlags(options.MasterURL, options.Kubeconfig)
	} else {
		restConfig, err = rest.InClusterConfig()
	}
	if err != nil {
		return fmt.Errorf("failed to build kubeconfig: %w", err)
	}

	// Create processor
	processorConfig := activityprocessor.Config{
		NATSURL:             options.NATSURL,
		NATSStreamName:      options.NATSStreamName,
		ConsumerName:        options.ConsumerName,
		NATSEventStream:     options.NATSEventStream,
		NATSEventConsumer:   options.NATSEventConsumer,
		OutputStreamName:    options.OutputStreamName,
		OutputSubjectPrefix: options.OutputSubjectPrefix,
		NATSTLSEnabled:      options.NATSTLSEnabled,
		NATSTLSCertFile:     options.NATSTLSCertFile,
		NATSTLSKeyFile:      options.NATSTLSKeyFile,
		NATSTLSCAFile:       options.NATSTLSCAFile,
		Workers:             options.Workers,
		BatchSize:           options.BatchSize,
		AckWait:             options.AckWait,
		MaxDeliver:          5,
		HealthProbeAddr:     options.HealthProbeAddr,
	}

	proc, err := activityprocessor.New(processorConfig, restConfig)
	if err != nil {
		return fmt.Errorf("failed to create processor: %w", err)
	}

	// Use controller-runtime's signal handler for graceful shutdown
	ctx := ctrl.SetupSignalHandler()

	// Start the processor
	if err := proc.Start(ctx); err != nil {
		return fmt.Errorf("failed to start processor: %w", err)
	}

	// Wait for shutdown signal
	<-ctx.Done()

	// Graceful shutdown
	proc.Stop()

	klog.Info("Activity processor shutdown complete")
	return nil
}
