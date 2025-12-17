package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	activityapiserver "go.miloapis.com/activity/internal/apiserver"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/internal/version"
	"go.miloapis.com/activity/pkg/generated/openapi"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	apiopenapi "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/component-base/cli"
	cliflag "k8s.io/component-base/cli/flag"
	basecompatibility "k8s.io/component-base/compatibility"
	"k8s.io/component-base/logs"
	logsapi "k8s.io/component-base/logs/api/v1"
	"k8s.io/klog/v2"

	// Register JSON logging format
	_ "k8s.io/component-base/logs/json/register"
)

func init() {
	utilruntime.Must(logsapi.AddFeatureGates(utilfeature.DefaultMutableFeatureGate))
	utilfeature.DefaultMutableFeatureGate.Set("LoggingBetaOptions=true")
}

func main() {
	cmd := NewActivityServerCommand()
	code := cli.Run(cmd)
	os.Exit(code)
}

// NewActivityServerCommand creates the root command with subcommands for the activity server.
func NewActivityServerCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "activity",
		Short: "Activity - query Kubernetes audit logs",
		Long: `Activity extends Kubernetes with audit log querying capabilities.

Connects to ClickHouse to query historical audit events and exposes them as
AuditLogQuery resources accessible through kubectl or any Kubernetes client.`,
	}

	cmd.AddCommand(NewServeCommand())
	cmd.AddCommand(NewVersionCommand())

	return cmd
}

// NewServeCommand creates the serve subcommand that starts the API server.
func NewServeCommand() *cobra.Command {
	options := NewActivityServerOptions()

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the API server",
		Long: `Start the API server and begin serving requests.

Connects to ClickHouse and exposes AuditLogQuery resources for querying
historical Kubernetes audit events through kubectl.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := options.Complete(); err != nil {
				return err
			}
			if err := options.Validate(); err != nil {
				return err
			}
			return Run(options, cmd.Context())
		},
	}

	namedFlagSets := &cliflag.NamedFlagSets{}

	flags := cmd.Flags()
	options.AddFlags(flags)

	logsapi.AddFlags(options.Logs, namedFlagSets.FlagSet("logs"))
	klog.InitFlags(nil)
	flags.AddGoFlagSet(flag.CommandLine)

	for _, f := range namedFlagSets.FlagSets {
		flags.AddFlagSet(f)
	}

	return cmd
}

// NewVersionCommand creates the version subcommand to display build information.
func NewVersionCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "version",
		Short: "Show version information",
		Long:  `Show the version, git commit, and build details.`,
		Run: func(cmd *cobra.Command, args []string) {
			info := version.Get()
			fmt.Printf("Activity Server\n")
			fmt.Printf("  Version:       %s\n", info.Version)
			fmt.Printf("  Git Commit:    %s\n", info.GitCommit)
			fmt.Printf("  Git Tree:      %s\n", info.GitTreeState)
			fmt.Printf("  Build Date:    %s\n", info.BuildDate)
			fmt.Printf("  Go Version:    %s\n", info.GoVersion)
			fmt.Printf("  Go Compiler:   %s\n", info.Compiler)
			fmt.Printf("  Platform:      %s\n", info.Platform)
		},
	}

	return cmd
}

// ActivityServerOptions contains configuration for the activity server.
type ActivityServerOptions struct {
	RecommendedOptions *options.RecommendedOptions

	Logs *logsapi.LoggingConfiguration

	ClickHouseAddress  string
	ClickHouseDatabase string
	ClickHouseUsername string
	ClickHousePassword string
	ClickHouseTable    string

	MaxQueryWindow time.Duration // Maximum time range allowed for queries
	MaxPageSize    int32         // Maximum number of results per page
}

// NewActivityServerOptions creates options with default values.
func NewActivityServerOptions() *ActivityServerOptions {
	o := &ActivityServerOptions{
		RecommendedOptions: options.NewRecommendedOptions(
			"/registry/activity.miloapis.com",
			activityapiserver.Codecs.LegacyCodec(activityapiserver.Scheme.PrioritizedVersionsAllGroups()...),
		),
		Logs:               logsapi.NewLoggingConfiguration(),
		ClickHouseAddress:  "localhost:9000",
		ClickHouseDatabase: "audit",
		ClickHouseUsername: "default",
		ClickHousePassword: "",
		ClickHouseTable:    "events",
		MaxQueryWindow:     30 * 24 * time.Hour,
		MaxPageSize:        1000,
	}

	// Disable etcd since we use ClickHouse for storage.
	o.RecommendedOptions.Etcd = nil

	// Disable admission plugins since this server doesn't mutate or validate resources.
	o.RecommendedOptions.Admission = nil

	return o
}

func (o *ActivityServerOptions) AddFlags(fs *pflag.FlagSet) {
	o.RecommendedOptions.AddFlags(fs)

	fs.StringVar(&o.ClickHouseAddress, "clickhouse-address", o.ClickHouseAddress,
		"ClickHouse server address (host:port)")
	fs.StringVar(&o.ClickHouseDatabase, "clickhouse-database", o.ClickHouseDatabase,
		"Database containing audit log data")
	fs.StringVar(&o.ClickHouseUsername, "clickhouse-username", o.ClickHouseUsername,
		"Username for ClickHouse authentication")
	fs.StringVar(&o.ClickHousePassword, "clickhouse-password", o.ClickHousePassword,
		"Password for ClickHouse authentication")
	fs.StringVar(&o.ClickHouseTable, "clickhouse-table", o.ClickHouseTable,
		"Table containing audit events")

	fs.DurationVar(&o.MaxQueryWindow, "max-query-window", o.MaxQueryWindow,
		"Maximum time range for a single query (e.g., 720h for 30 days)")
	fs.Int32Var(&o.MaxPageSize, "max-page-size", o.MaxPageSize,
		"Maximum results returned per page")
}

func (o *ActivityServerOptions) Complete() error {
	return nil
}

// Validate ensures required configuration is provided.
func (o *ActivityServerOptions) Validate() error {
	errors := []error{}

	if o.ClickHouseAddress == "" {
		errors = append(errors, fmt.Errorf("--clickhouse-address is required"))
	}
	if o.ClickHouseDatabase == "" {
		errors = append(errors, fmt.Errorf("--clickhouse-database is required"))
	}
	if o.ClickHouseTable == "" {
		errors = append(errors, fmt.Errorf("--clickhouse-table is required"))
	}

	if len(errors) > 0 {
		return fmt.Errorf("validation errors: %v", errors)
	}

	return nil
}

// Config builds the complete server configuration from options.
func (o *ActivityServerOptions) Config() (*activityapiserver.Config, error) {
	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts(
		"localhost", nil, nil); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	genericConfig := genericapiserver.NewRecommendedConfig(activityapiserver.Codecs)

	// Set effective version to match the Kubernetes version we're built against.
	genericConfig.EffectiveVersion = basecompatibility.NewEffectiveVersionFromString("1.34", "", "")

	namer := apiopenapi.NewDefinitionNamer(activityapiserver.Scheme)
	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(openapi.GetOpenAPIDefinitions, namer)
	genericConfig.OpenAPIV3Config.Info.Title = "Activity"
	genericConfig.OpenAPIV3Config.Info.Version = version.Version

	if err := o.RecommendedOptions.ApplyTo(genericConfig); err != nil {
		return nil, fmt.Errorf("failed to apply recommended options: %w", err)
	}

	serverConfig := &activityapiserver.Config{
		GenericConfig: genericConfig,
		ExtraConfig: activityapiserver.ExtraConfig{
			ClickHouseConfig: storage.ClickHouseConfig{
				Address:        o.ClickHouseAddress,
				Database:       o.ClickHouseDatabase,
				Username:       o.ClickHouseUsername,
				Password:       o.ClickHousePassword,
				Table:          o.ClickHouseTable,
				MaxQueryWindow: o.MaxQueryWindow,
				MaxPageSize:    o.MaxPageSize,
			},
		},
	}

	return serverConfig, nil
}

// Run initializes and starts the server.
func Run(options *ActivityServerOptions, ctx context.Context) error {
	if err := logsapi.ValidateAndApply(options.Logs, utilfeature.DefaultMutableFeatureGate); err != nil {
		return fmt.Errorf("failed to apply logging configuration: %w", err)
	}

	config, err := options.Config()
	if err != nil {
		return err
	}

	server, err := config.Complete().New()
	if err != nil {
		return err
	}

	defer logs.FlushLogs()

	klog.Info("Starting Activity server...")
	klog.Info("Metrics available at https://<server-address>/metrics")
	return server.Run(ctx)
}
