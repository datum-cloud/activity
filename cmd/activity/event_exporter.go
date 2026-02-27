package main

import (
	"os"
	"time"

	"github.com/spf13/cobra"
	"go.miloapis.com/activity/internal/eventexporter"
)

// NewEventExporterCommand creates the event-exporter subcommand.
func NewEventExporterCommand() *cobra.Command {
	cfg := eventexporter.Config{
		NATSUrl:         getEnvOrDefault("NATS_URL", "nats://nats.nats-system.svc.cluster.local:4222"),
		SubjectPrefix:   getEnvOrDefault("SUBJECT_PREFIX", "events.k8s"),
		ScopeType:       getEnvOrDefault("SCOPE_TYPE", "organization"),
		ScopeName:       getEnvOrDefault("SCOPE_NAME", "dev-org"),
		Kubeconfig:      os.Getenv("KUBECONFIG"),
		ResyncPeriod:    30 * time.Minute,
		HealthProbeAddr: getEnvOrDefault("HEALTH_PROBE_ADDR", ":8081"),
	}

	cmd := &cobra.Command{
		Use:   "event-exporter",
		Short: "Export Kubernetes Events to NATS JetStream",
		Long: `Watch Kubernetes Events and publish them to NATS JetStream for ingestion
into ClickHouse. This exporter uses events.k8s.io/v1 Event format for
consistency with the EventRecord API and ClickHouse schema.

Events are published with scope annotations for multi-tenant isolation.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return eventexporter.Run(cmd.Context(), cfg)
		},
	}

	flags := cmd.Flags()
	flags.StringVar(&cfg.NATSUrl, "nats-url", cfg.NATSUrl, "NATS server URL")
	flags.StringVar(&cfg.SubjectPrefix, "subject-prefix", cfg.SubjectPrefix, "NATS subject prefix")
	flags.StringVar(&cfg.ScopeType, "scope-type", cfg.ScopeType, "Scope type annotation value")
	flags.StringVar(&cfg.ScopeName, "scope-name", cfg.ScopeName, "Scope name annotation value")
	flags.StringVar(&cfg.Kubeconfig, "kubeconfig", cfg.Kubeconfig, "Path to kubeconfig (empty for in-cluster)")
	flags.DurationVar(&cfg.ResyncPeriod, "resync-period", cfg.ResyncPeriod, "Informer resync period")
	flags.StringVar(&cfg.HealthProbeAddr, "health-probe-addr", cfg.HealthProbeAddr, "Health probe server bind address")

	return cmd
}

// getEnvOrDefault returns the environment variable value or a default.
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
