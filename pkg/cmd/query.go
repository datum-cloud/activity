package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/cli-runtime/pkg/printers"

	activityv1alpha1 "go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
	clientset "go.miloapis.com/activity/pkg/client/clientset/versioned"
)

// QueryOptions contains the options for querying audit logs
type QueryOptions struct {
	StartTime     string
	EndTime       string
	Filter        string
	Limit         int32
	ContinueAfter string
	AllPages      bool

	PrintFlags *genericclioptions.PrintFlags
	genericclioptions.IOStreams
	configFlags *genericclioptions.ConfigFlags
}

// NewQueryOptions creates a new QueryOptions with default values
func NewQueryOptions(ioStreams genericclioptions.IOStreams) *QueryOptions {
	return &QueryOptions{
		IOStreams:   ioStreams,
		configFlags: genericclioptions.NewConfigFlags(true),
		PrintFlags:  genericclioptions.NewPrintFlags(""),
		Limit:       25,
		StartTime:   "now-24h",
		EndTime:     "now",
	}
}

// NewQueryCommand creates the query command
func NewQueryCommand(ioStreams genericclioptions.IOStreams) *cobra.Command {
	o := NewQueryOptions(ioStreams)

	cmd := &cobra.Command{
		Use:   "query",
		Short: "Query control plane audit logs",
		Long: `Query control plane audit logs from the activity API server.

This command allows you to search audit logs using time ranges and CEL filters.
Results can be displayed in various formats using standard kubectl output options.

Examples:
  # Query events from the last 24 hours (default)
  activity query

  # Query events from the last hour
  activity query --start-time "now-1h" --end-time "now"

  # Query deletions in the production namespace
  activity query --start-time "now-7d" --end-time "now" \
    --filter "verb == 'delete' && objectRef.namespace == 'production'"

  # Query with absolute timestamps
  activity query --start-time "2024-01-01T00:00:00Z" --end-time "2024-01-02T00:00:00Z"

  # Get all results across multiple pages
  activity query --start-time "now-7d" --end-time "now" --all-pages

  # Output as JSON or YAML
  activity query -o json
  activity query -o yaml

  # Use JSONPath to extract specific fields
  activity query -o jsonpath='{.items[*].verb}'

  # Use Go templates for custom output
  activity query -o go-template='{{range .items}}{{.verb}} {{.user.username}}{{"\n"}}{{end}}'

Time Formats:
  Relative: "now-7d", "now-2h", "now-30m" (units: s, m, h, d, w)
  Absolute: "2024-01-01T00:00:00Z" (RFC3339 with timezone)

Common Filters:
  verb == 'delete'                                    - All deletions
  objectRef.namespace == 'production'                 - Events in production
  verb in ['create', 'update', 'delete', 'patch']     - Write operations
  responseStatus.code >= 400                          - Failed requests
  user.username.startsWith('system:serviceaccount:')  - Service account activity
  objectRef.resource == 'secrets'                     - Secret access
`,
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := o.Complete(cmd); err != nil {
				return err
			}
			if err := o.Validate(); err != nil {
				return err
			}
			return o.Run(cmd.Context())
		},
	}

	// Add flags
	cmd.Flags().StringVar(&o.StartTime, "start-time", o.StartTime, "Start time for the query (default: now-24h, e.g., 'now-7d' or '2024-01-01T00:00:00Z')")
	cmd.Flags().StringVar(&o.EndTime, "end-time", o.EndTime, "End time for the query (default: now, e.g., 'now' or '2024-01-02T00:00:00Z')")
	cmd.Flags().StringVar(&o.Filter, "filter", "", "CEL filter expression to narrow results")
	cmd.Flags().Int32Var(&o.Limit, "limit", 25, "Maximum number of results per page (1-1000)")
	cmd.Flags().StringVar(&o.ContinueAfter, "continue-after", "", "Pagination cursor from previous query")
	cmd.Flags().BoolVar(&o.AllPages, "all-pages", false, "Fetch all pages of results (ignores --continue-after)")

	// Add printer flags (handles -o json, -o yaml, -o wide, etc.)
	o.PrintFlags.AddFlags(cmd)

	// Add kubeconfig flags
	o.configFlags.AddFlags(cmd.Flags())

	return cmd
}

// Complete fills in missing options
func (o *QueryOptions) Complete(cmd *cobra.Command) error {
	// Set up IO streams if not already set
	if o.Out == nil {
		o.Out = os.Stdout
	}
	if o.ErrOut == nil {
		o.ErrOut = os.Stderr
	}
	if o.In == nil {
		o.In = os.Stdin
	}

	return nil
}

// Validate checks that required options are set correctly
func (o *QueryOptions) Validate() error {
	if o.StartTime == "" {
		return fmt.Errorf("--start-time is required")
	}
	if o.EndTime == "" {
		return fmt.Errorf("--end-time is required")
	}
	if o.Limit < 1 || o.Limit > 1000 {
		return fmt.Errorf("--limit must be between 1 and 1000")
	}
	if o.AllPages && o.ContinueAfter != "" {
		return fmt.Errorf("--all-pages and --continue-after are mutually exclusive")
	}

	return nil
}

// Run executes the query
func (o *QueryOptions) Run(ctx context.Context) error {
	// Get REST config
	config, err := o.configFlags.ToRESTConfig()
	if err != nil {
		return fmt.Errorf("failed to get kubeconfig: %w", err)
	}

	// Create activity client
	client, err := clientset.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create activity client: %w", err)
	}

	if o.AllPages {
		return o.runAllPages(ctx, client)
	}

	return o.runSinglePage(ctx, client)
}

// runSinglePage executes a single query
func (o *QueryOptions) runSinglePage(ctx context.Context, client *clientset.Clientset) error {
	query := &activityv1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "query-",
		},
		Spec: activityv1alpha1.AuditLogQuerySpec{
			StartTime: o.StartTime,
			EndTime:   o.EndTime,
			Filter:    o.Filter,
			Limit:     o.Limit,
			Continue:  o.ContinueAfter,
		},
	}

	result, err := client.ActivityV1alpha1().AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("query failed: %w", err)
	}

	return o.printResults(result)
}

// runAllPages fetches all pages of results
func (o *QueryOptions) runAllPages(ctx context.Context, client *clientset.Clientset) error {
	var allEvents []auditv1.Event
	continueAfter := ""
	pageNum := 1

	// Check if using table output
	outputFormat := o.PrintFlags.OutputFormat
	isTableOutput := outputFormat == nil || *outputFormat == ""

	// Create table printer for table output
	var tablePrinter printers.ResourcePrinter
	if isTableOutput {
		tablePrinter = printers.NewTablePrinter(printers.PrintOptions{
			WithNamespace: false,
			Wide:          true,
		})
	}

	for {
		query := &activityv1alpha1.AuditLogQuery{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "query-",
			},
			Spec: activityv1alpha1.AuditLogQuerySpec{
				StartTime: o.StartTime,
				EndTime:   o.EndTime,
				Filter:    o.Filter,
				Limit:     o.Limit,
				Continue:  continueAfter,
			},
		}

		result, err := client.ActivityV1alpha1().AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("query failed on page %d: %w", pageNum, err)
		}

		// For table output, print each page as we get it
		if isTableOutput {
			if pageNum == 1 {
				// Print with header
				table := o.eventsToTable(result.Status.Results)
				if err := tablePrinter.PrintObj(table, o.Out); err != nil {
					return err
				}
			} else {
				// Print without header for subsequent pages
				table := &metav1.Table{
					TypeMeta: metav1.TypeMeta{
						Kind:       "Table",
						APIVersion: "meta.k8s.io/v1",
					},
					Rows: o.eventsToRows(result.Status.Results),
				}
				if err := tablePrinter.PrintObj(table, o.Out); err != nil {
					return err
				}
			}
		} else {
			// For JSON/YAML, collect all events
			allEvents = append(allEvents, result.Status.Results...)
		}

		// Check if there are more pages
		if result.Status.Continue == "" {
			break
		}

		continueAfter = result.Status.Continue
		pageNum++
	}

	// Print collected results for JSON/YAML
	if !isTableOutput {
		printer, err := o.PrintFlags.ToPrinter()
		if err != nil {
			return fmt.Errorf("failed to create printer: %w", err)
		}
		return o.printEvents(allEvents, printer)
	}

	return nil
}

// printResults outputs the query results in the specified format
func (o *QueryOptions) printResults(result *activityv1alpha1.AuditLogQuery) error {
	// For default output (table), use our custom table printer
	// For other formats (json, yaml, etc.), use the standard printer
	outputFormat := o.PrintFlags.OutputFormat
	if outputFormat == nil || *outputFormat == "" {
		// Use custom table printing
		return o.printTable(result.Status.Results, result.Status.Continue)
	}

	// Create printer for other formats
	printer, err := o.PrintFlags.ToPrinter()
	if err != nil {
		return fmt.Errorf("failed to create printer: %w", err)
	}

	// Print the events
	return o.printEvents(result.Status.Results, printer)
}

// printTable prints events as a formatted table
func (o *QueryOptions) printTable(events []auditv1.Event, continueToken string) error {
	// Convert events to table and use table printer
	table := o.eventsToTable(events)
	tablePrinter := printers.NewTablePrinter(printers.PrintOptions{
		WithNamespace: false,
		Wide:          true,
	})

	if err := tablePrinter.PrintObj(table, o.Out); err != nil {
		return err
	}

	// Print pagination info
	if continueToken != "" {
		fmt.Fprintf(o.ErrOut, "\nMore results available. Use --continue-after '%s' to get the next page.\n", continueToken)
		fmt.Fprintf(o.ErrOut, "Or use --all-pages to fetch all results automatically.\n")
	} else {
		fmt.Fprintf(o.ErrOut, "\nNo more results.\n")
	}

	return nil
}

// printEvents prints audit events using the configured printer
func (o *QueryOptions) printEvents(events []auditv1.Event, printer printers.ResourcePrinter) error {
	// Create an event list for printing the actual audit objects
	eventList := &auditv1.EventList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "EventList",
			APIVersion: "audit.k8s.io/v1",
		},
		Items: events,
	}
	return printer.PrintObj(eventList, o.Out)
}

// eventsToTable converts audit events to a Table object
func (o *QueryOptions) eventsToTable(events []auditv1.Event) *metav1.Table {
	return &metav1.Table{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Table",
			APIVersion: "meta.k8s.io/v1",
		},
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Timestamp", Type: "string", Description: "Time of the event"},
			{Name: "Verb", Type: "string", Description: "Action performed"},
			{Name: "User", Type: "string", Description: "User who performed the action"},
			{Name: "Namespace", Type: "string", Description: "Namespace of the resource"},
			{Name: "Resource", Type: "string", Description: "Resource type"},
			{Name: "Name", Type: "string", Description: "Resource name"},
			{Name: "Status", Type: "string", Description: "HTTP status code"},
		},
		Rows: o.eventsToRows(events),
	}
}

// eventsToRows converts audit events to table rows
func (o *QueryOptions) eventsToRows(events []auditv1.Event) []metav1.TableRow {
	rows := make([]metav1.TableRow, 0, len(events))
	for i := range events {
		timestamp := events[i].StageTimestamp.Time.Format("2006-01-02 15:04:05")
		verb := events[i].Verb
		username := events[i].User.Username

		namespace := ""
		resource := ""
		name := ""
		if events[i].ObjectRef != nil {
			namespace = events[i].ObjectRef.Namespace
			resource = events[i].ObjectRef.Resource
			name = events[i].ObjectRef.Name
		}

		status := ""
		if events[i].ResponseStatus != nil {
			status = fmt.Sprintf("%d", events[i].ResponseStatus.Code)
		}

		row := metav1.TableRow{
			Cells: []interface{}{timestamp, verb, username, namespace, resource, name, status},
		}
		rows = append(rows, row)
	}
	return rows
}
