package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/spf13/cobra"
	"golang.org/x/term"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/cli-runtime/pkg/printers"
	"k8s.io/kubectl/pkg/cmd/util"

	activityv1alpha1 "go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
	clientset "go.miloapis.com/activity/pkg/client/clientset/versioned"
	"go.miloapis.com/activity/pkg/cmd/common"
)

// HistoryOptions contains the options for viewing resource history
type HistoryOptions struct {
	Namespace     string
	Resource      string
	Name          string
	ShowDiff      bool
	ContinueAfter string
	AllPages      bool

	// Common flags
	TimeRange  common.TimeRangeFlags
	Pagination common.PaginationFlags

	PrintFlags *genericclioptions.PrintFlags
	genericclioptions.IOStreams
	Factory util.Factory
}

// NewHistoryOptions creates a new HistoryOptions with default values
func NewHistoryOptions(f util.Factory, ioStreams genericclioptions.IOStreams) *HistoryOptions {
	return &HistoryOptions{
		IOStreams:  ioStreams,
		Factory:    f,
		PrintFlags: genericclioptions.NewPrintFlags(""),
		TimeRange: common.TimeRangeFlags{
			StartTime: "now-30d",
			EndTime:   "now",
		},
		Pagination: common.PaginationFlags{
			Limit: 100,
		},
	}
}

// NewHistoryCommand creates the history command
func NewHistoryCommand(f util.Factory, ioStreams genericclioptions.IOStreams) *cobra.Command {
	o := NewHistoryOptions(f, ioStreams)

	cmd := &cobra.Command{
		Use:   "history RESOURCE_TYPE NAME",
		Short: "View the change history of a specific resource",
		Long: `View the change history of a specific resource over time by querying audit logs.

This command shows you the history of changes to a resource, displaying each modification
in chronological order. Use --diff to see what changed between consecutive versions.

The command accepts the resource type and name as separate arguments:
  - RESOURCE_TYPE: The type of resource (e.g., domains, dnsrecordsets, configmaps, secrets)
  - NAME: The name of the specific resource instance

Use the -n/--namespace flag for namespaced resources.

Examples:
  # View change history of a domain
  activity history domains miloapis-com-0c8dxl -n default

  # View change history of a DNS record set
  activity history dnsrecordsets dns-record-www-example-com -n production

  # View history with diff to see what changed
  activity history configmaps app-config -n default --diff

  # View changes from the last 7 days
  activity history secrets api-credentials -n default --start-time "now-7d"

  # Get all changes (fetch all pages)
  activity history domains example-com -n default --all-pages

  # Use different output formats
  activity history configmaps app-settings -n default -o json
  activity history secrets db-password -n default -o yaml

Output Modes:
  Default (table): Shows a table with timestamp, verb, user, and status code
  --diff: Shows unified diff between consecutive resource versions
  -o json/yaml: Output raw audit events in JSON or YAML format
`,
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := o.Complete(cmd, args); err != nil {
				return err
			}
			if err := o.Validate(); err != nil {
				return err
			}
			return o.Run(cmd.Context())
		},
	}

	// Add flags
	common.AddTimeRangeFlags(cmd, &o.TimeRange, "now-30d")
	common.AddPaginationFlags(cmd, &o.Pagination, 100)
	cmd.Flags().BoolVar(&o.ShowDiff, "diff", false, "Show diff between consecutive resource versions")

	// Add printer flags
	o.PrintFlags.AddFlags(cmd)

	return cmd
}

// Complete fills in missing options
func (o *HistoryOptions) Complete(cmd *cobra.Command, args []string) error {
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

	// Parse resource type and name from arguments
	if len(args) != 2 {
		return fmt.Errorf("exactly two arguments are required: RESOURCE_TYPE NAME")
	}

	o.Resource = args[0]
	o.Name = args[1]

	// Get namespace from the factory's namespace flag if available
	// The -n/--namespace flag is handled by the kubectl factory
	if o.Factory != nil {
		namespace, enforceNamespace, err := o.Factory.ToRawKubeConfigLoader().Namespace()
		if err != nil {
			return fmt.Errorf("failed to get namespace: %w", err)
		}
		// Only set namespace if it's explicitly set or enforced
		if enforceNamespace || namespace != "" {
			o.Namespace = namespace
		}
	}

	return nil
}

// Validate checks that required options are set correctly
func (o *HistoryOptions) Validate() error {
	if o.Resource == "" {
		return fmt.Errorf("resource type is required")
	}
	if o.Name == "" {
		return fmt.Errorf("resource name is required")
	}
	if err := o.TimeRange.Validate(); err != nil {
		return err
	}
	if err := o.Pagination.Validate(); err != nil {
		return err
	}

	return nil
}

// Run executes the history command
func (o *HistoryOptions) Run(ctx context.Context) error {
	// Get REST config from factory
	config, err := o.Factory.ToRESTConfig()
	if err != nil {
		return fmt.Errorf("failed to get kubeconfig: %w", err)
	}

	// Create activity client
	client, err := clientset.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create activity client: %w", err)
	}

	if o.Pagination.AllPages {
		return o.runAllPages(ctx, client)
	}

	return o.runSinglePage(ctx, client)
}

// runSinglePage executes a single query
func (o *HistoryOptions) runSinglePage(ctx context.Context, client *clientset.Clientset) error {
	filter := o.buildFilter()

	query := &activityv1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "history-",
		},
		Spec: activityv1alpha1.AuditLogQuerySpec{
			StartTime: o.TimeRange.StartTime,
			EndTime:   o.TimeRange.EndTime,
			Filter:    filter,
			Limit:     o.Pagination.Limit,
			Continue:  o.Pagination.ContinueAfter,
		},
	}

	result, err := client.ActivityV1alpha1().AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("query failed: %w", err)
	}

	return o.printResults(result)
}

// runAllPages fetches all pages of results
func (o *HistoryOptions) runAllPages(ctx context.Context, client *clientset.Clientset) error {
	var allEvents []auditv1.Event
	continueAfter := ""
	pageNum := 1
	filter := o.buildFilter()

	// Check if using custom output format
	outputFormat := o.PrintFlags.OutputFormat
	isCustomFormat := outputFormat != nil && *outputFormat != ""

	// For table or diff output, we need all events before processing
	for {
		query := &activityv1alpha1.AuditLogQuery{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "history-",
			},
			Spec: activityv1alpha1.AuditLogQuerySpec{
				StartTime: o.TimeRange.StartTime,
				EndTime:   o.TimeRange.EndTime,
				Filter:    filter,
				Limit:     o.Pagination.Limit,
				Continue:  continueAfter,
			},
		}

		result, err := client.ActivityV1alpha1().AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("query failed on page %d: %w", pageNum, err)
		}

		allEvents = append(allEvents, result.Status.Results...)

		// Check if there are more pages
		if result.Status.Continue == "" {
			break
		}

		continueAfter = result.Status.Continue
		pageNum++
	}

	// Reverse events to show oldest first (since results come newest-first)
	for i := 0; i < len(allEvents)/2; i++ {
		j := len(allEvents) - i - 1
		allEvents[i], allEvents[j] = allEvents[j], allEvents[i]
	}

	// Print results based on output format
	if isCustomFormat {
		printer, err := o.PrintFlags.ToPrinter()
		if err != nil {
			return fmt.Errorf("failed to create printer: %w", err)
		}
		return o.printEvents(allEvents, printer)
	} else if o.ShowDiff {
		return o.printDiff(allEvents)
	} else {
		return o.printTableAllEvents(allEvents)
	}
}

// buildFilter creates a CEL filter for the specified resource
func (o *HistoryOptions) buildFilter() string {
	filters := []string{
		fmt.Sprintf("objectRef.resource == '%s'", common.EscapeCELString(o.Resource)),
		fmt.Sprintf("objectRef.name == '%s'", common.EscapeCELString(o.Name)),
		// Only include verbs that modify the resource
		"verb in ['create', 'update', 'patch', 'delete']",
	}

	if o.Namespace != "" {
		filters = append(filters, fmt.Sprintf("objectRef.namespace == '%s'", common.EscapeCELString(o.Namespace)))
	}

	return strings.Join(filters, " && ")
}

// printResults outputs the query results in the specified format
func (o *HistoryOptions) printResults(result *activityv1alpha1.AuditLogQuery) error {
	// Reverse events to show oldest first
	events := result.Status.Results
	for i := 0; i < len(events)/2; i++ {
		j := len(events) - i - 1
		events[i], events[j] = events[j], events[i]
	}

	// Check output format
	outputFormat := o.PrintFlags.OutputFormat
	if outputFormat != nil && *outputFormat != "" {
		printer, err := o.PrintFlags.ToPrinter()
		if err != nil {
			return fmt.Errorf("failed to create printer: %w", err)
		}
		return o.printEvents(events, printer)
	}

	if o.ShowDiff {
		return o.printDiff(events)
	}

	return o.printTable(events, result.Status.Continue)
}

// printTable prints events as a formatted table
func (o *HistoryOptions) printTable(events []auditv1.Event, continueToken string) error {
	table := o.eventsToTable(events)
	tablePrinter := common.CreateTablePrinter(false)

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

// printTableAllEvents prints all events as a table (for --all-pages)
func (o *HistoryOptions) printTableAllEvents(events []auditv1.Event) error {
	table := o.eventsToTable(events)
	tablePrinter := common.CreateTablePrinter(false)

	if err := tablePrinter.PrintObj(table, o.Out); err != nil {
		return err
	}

	fmt.Fprintf(o.ErrOut, "\nShowing %d events.\n", len(events))
	return nil
}

// printDiff shows the diff between consecutive resource versions
func (o *HistoryOptions) printDiff(events []auditv1.Event) error {
	if len(events) == 0 {
		fmt.Fprintf(o.Out, "No changes found for this resource.\n")
		return nil
	}

	useColor := o.supportsColor()
	var prevObject map[string]interface{}

	for i, event := range events {
		timestamp := event.StageTimestamp.Format("2006-01-02 15:04:05")
		username := event.User.Username
		verb := event.Verb

		// Get current object state
		var currObject map[string]interface{}
		if event.ResponseObject != nil && len(event.ResponseObject.Raw) > 0 {
			if err := json.Unmarshal(event.ResponseObject.Raw, &currObject); err != nil {
				fmt.Fprintf(o.ErrOut, "Warning: failed to parse response object for event %d: %v\n", i, err)
				continue
			}
		}

		// Print pretty header for this change
		o.printChangeHeader(i+1, timestamp, verb, username, event.ResponseStatus, useColor)

		// Show diff if we have both previous and current objects
		if prevObject != nil && currObject != nil {
			// Remove metadata noise for cleaner diffs
			cleanPrev := o.cleanObjectForDiff(prevObject)
			cleanCurr := o.cleanObjectForDiff(currObject)

			changes := o.summarizeChanges(cleanPrev, cleanCurr)
			if changes != "" {
				if useColor {
					fmt.Fprintf(o.Out, "\n\033[1m📝 Changes:\033[0m %s\n", changes)
				} else {
					fmt.Fprintf(o.Out, "\nChanges: %s\n", changes)
				}
			}

			fmt.Fprintf(o.Out, "\n")
			if err := o.printObjectDiff(cleanPrev, cleanCurr); err != nil {
				fmt.Fprintf(o.ErrOut, "Warning: failed to generate diff: %v\n", err)
			}
		} else if currObject != nil {
			// First change or create - show the full object state
			cleanCurr := o.cleanObjectForDiff(currObject)

			if verb == "create" {
				if useColor {
					fmt.Fprintf(o.Out, "\n\033[32m✨ Created resource\033[0m\n\n")
				} else {
					fmt.Fprintf(o.Out, "\nCreated resource\n\n")
				}
			} else {
				// First change we're seeing (update/patch but no previous state)
				if useColor {
					fmt.Fprintf(o.Out, "\n\033[33m📸 Initial state (oldest available change)\033[0m\n\n")
				} else {
					fmt.Fprintf(o.Out, "\nInitial state (oldest available change)\n\n")
				}
			}

			if err := o.printObjectPretty(cleanCurr, useColor); err != nil {
				fmt.Fprintf(o.ErrOut, "Warning: failed to print object: %v\n", err)
			}
		} else if verb == "delete" && prevObject != nil {
			if useColor {
				fmt.Fprintf(o.Out, "\n\033[31m🗑️  Deleted resource\033[0m\n\n")
			} else {
				fmt.Fprintf(o.Out, "\nDeleted resource\n\n")
			}
			cleanPrev := o.cleanObjectForDiff(prevObject)
			if err := o.printObjectPretty(cleanPrev, useColor); err != nil {
				fmt.Fprintf(o.ErrOut, "Warning: failed to print object: %v\n", err)
			}
		}

		// Update previous object for next iteration
		if currObject != nil {
			prevObject = currObject
		}
	}

	if useColor {
		fmt.Fprintf(o.ErrOut, "\n\033[2m──────────────────────────────────────────────────────────────\033[0m\n")
		fmt.Fprintf(o.ErrOut, "\033[1mTotal:\033[0m %d changes\n", len(events))
	} else {
		fmt.Fprintf(o.ErrOut, "\n──────────────────────────────────────────────────────────────\n")
		fmt.Fprintf(o.ErrOut, "Total: %d changes\n", len(events))
	}
	return nil
}

// printChangeHeader prints a nicely formatted header for each change
func (o *HistoryOptions) printChangeHeader(changeNum int, timestamp, verb, username string, status *metav1.Status, useColor bool) {
	if useColor {
		// Box drawing characters for a nice border
		fmt.Fprintf(o.Out, "\n\033[2m╭─────────────────────────────────────────────────────────────╮\033[0m\n")

		// Change number with emoji
		var verbEmoji string
		var verbColor string
		switch verb {
		case "create":
			verbEmoji = "✨"
			verbColor = "\033[32m" // green
		case "update", "patch":
			verbEmoji = "📝"
			verbColor = "\033[33m" // yellow
		case "delete":
			verbEmoji = "🗑️"
			verbColor = "\033[31m" // red
		default:
			verbEmoji = "•"
			verbColor = "\033[0m"
		}

		fmt.Fprintf(o.Out, "\033[2m│\033[0m \033[1;36mChange #%-3d\033[0m %s %s%-8s\033[0m", changeNum, verbEmoji, verbColor, verb)

		// Status code with color
		if status != nil {
			statusColor := "\033[32m" // green for success
			if status.Code >= 400 {
				statusColor = "\033[31m" // red for errors
			}
			fmt.Fprintf(o.Out, " %s[%d]\033[0m", statusColor, status.Code)
		}
		fmt.Fprintf(o.Out, "\n")

		fmt.Fprintf(o.Out, "\033[2m│\033[0m \033[90m🕐 %s\033[0m\n", timestamp)
		fmt.Fprintf(o.Out, "\033[2m│\033[0m \033[90m👤 %s\033[0m\n", username)
		fmt.Fprintf(o.Out, "\033[2m╰─────────────────────────────────────────────────────────────╯\033[0m")
	} else {
		fmt.Fprintf(o.Out, "\n╭─────────────────────────────────────────────────────────────╮\n")
		fmt.Fprintf(o.Out, "│ Change #%-3d  %-8s", changeNum, verb)
		if status != nil {
			fmt.Fprintf(o.Out, " [%d]", status.Code)
		}
		fmt.Fprintf(o.Out, "\n")
		fmt.Fprintf(o.Out, "│ %s\n", timestamp)
		fmt.Fprintf(o.Out, "│ %s\n", username)
		fmt.Fprintf(o.Out, "╰─────────────────────────────────────────────────────────────╯")
	}
}

// cleanObjectForDiff removes noisy fields from objects to make diffs cleaner
func (o *HistoryOptions) cleanObjectForDiff(obj map[string]interface{}) map[string]interface{} {
	cleaned := make(map[string]interface{})

	// Copy everything except metadata noise
	for k, v := range obj {
		// Skip these metadata fields that change on every update
		if k == "metadata" {
			if meta, ok := v.(map[string]interface{}); ok {
				cleanedMeta := make(map[string]interface{})
				for mk, mv := range meta {
					// Keep only useful metadata
					switch mk {
					case "name", "namespace", "labels", "annotations":
						cleanedMeta[mk] = mv
					}
				}
				if len(cleanedMeta) > 0 {
					cleaned[k] = cleanedMeta
				}
			}
		} else if k != "managedFields" && k != "resourceVersion" && k != "generation" && k != "uid" {
			cleaned[k] = v
		}
	}

	return cleaned
}

// summarizeChanges provides a one-line summary of what changed
func (o *HistoryOptions) summarizeChanges(prev, curr map[string]interface{}) string {
	changes := []string{}

	// Track changed top-level fields
	for k := range curr {
		if k == "status" || k == "metadata" {
			continue // These are too noisy
		}
		prevVal, _ := json.Marshal(prev[k])
		currVal, _ := json.Marshal(curr[k])
		if string(prevVal) != string(currVal) {
			changes = append(changes, k)
		}
	}

	// Check for removed fields
	for k := range prev {
		if k == "status" || k == "metadata" {
			continue
		}
		if _, exists := curr[k]; !exists {
			changes = append(changes, k+" (removed)")
		}
	}

	if len(changes) == 0 {
		return "metadata only"
	}

	if len(changes) > 3 {
		return fmt.Sprintf("%s and %d more fields", strings.Join(changes[:3], ", "), len(changes)-3)
	}

	return strings.Join(changes, ", ")
}

// printObjectPretty prints a JSON object with syntax highlighting
func (o *HistoryOptions) printObjectPretty(obj map[string]interface{}, useColor bool) error {
	objJSON, err := json.MarshalIndent(obj, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal object: %w", err)
	}

	if useColor {
		// Simple JSON syntax highlighting
		highlighted := o.highlightJSON(string(objJSON))
		if _, err := fmt.Fprintln(o.Out, highlighted); err != nil {
			return fmt.Errorf("failed to print highlighted object: %w", err)
		}
	} else {
		if _, err := fmt.Fprintln(o.Out, string(objJSON)); err != nil {
			return fmt.Errorf("failed to print object: %w", err)
		}
	}
	return nil
}

// highlightJSON adds basic syntax highlighting to JSON
func (o *HistoryOptions) highlightJSON(jsonStr string) string {
	const (
		colorKey    = "\033[36m" // cyan for keys
		colorString = "\033[33m" // yellow for string values
		colorNumber = "\033[35m" // magenta for numbers
		colorBool   = "\033[32m" // green for booleans
		colorNull   = "\033[90m" // gray for null
		colorReset  = "\033[0m"
	)

	lines := strings.Split(jsonStr, "\n")
	for i, line := range lines {
		// Highlight keys (simplified - looks for "key":)
		if strings.Contains(line, ":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key := parts[0]
				value := parts[1]

				// Colorize the key
				key = strings.ReplaceAll(key, `"`, colorKey+`"`+colorReset)

				// Colorize the value based on type
				value = strings.TrimSpace(value)
				if strings.HasPrefix(value, `"`) {
					// String value
					value = colorString + value + colorReset
				} else if value == "true" || value == "false" {
					// Boolean
					value = colorBool + value + colorReset
				} else if value == "null" || value == "null," {
					// Null
					value = colorNull + value + colorReset
				} else if len(value) > 0 && (value[0] >= '0' && value[0] <= '9') {
					// Number
					value = colorNumber + value + colorReset
				}

				lines[i] = key + ":" + " " + value
			}
		}
	}

	return strings.Join(lines, "\n")
}

// printObjectDiff prints a unified diff between two objects
func (o *HistoryOptions) printObjectDiff(prev, curr map[string]interface{}) error {
	prevJSON, err := json.MarshalIndent(prev, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal previous object: %w", err)
	}

	currJSON, err := json.MarshalIndent(curr, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal current object: %w", err)
	}

	diff := difflib.UnifiedDiff{
		A:        difflib.SplitLines(string(prevJSON)),
		B:        difflib.SplitLines(string(currJSON)),
		FromFile: "Previous",
		ToFile:   "Current",
		Context:  3,
	}

	diffText, err := difflib.GetUnifiedDiffString(diff)
	if err != nil {
		return fmt.Errorf("failed to generate diff: %w", err)
	}

	if diffText == "" {
		_, _ = fmt.Fprintf(o.Out, "(no changes detected)\n")
	} else {
		// Colorize the diff output if terminal supports it
		colorizedDiff := o.colorizeDiff(diffText)
		if _, err := fmt.Fprint(o.Out, colorizedDiff); err != nil {
			return fmt.Errorf("failed to print diff: %w", err)
		}
	}

	return nil
}

// colorizeDiff adds ANSI color codes to diff output
func (o *HistoryOptions) colorizeDiff(diff string) string {
	// Check if output is a terminal that supports color
	if !o.supportsColor() {
		return diff
	}

	// ANSI color codes
	const (
		colorReset  = "\033[0m"
		colorRed    = "\033[31m" // for deletions (-)
		colorGreen  = "\033[32m" // for additions (+)
		colorCyan   = "\033[36m" // for file headers (@@ and ---)
		colorBold   = "\033[1m"  // for header emphasis
	)

	lines := strings.Split(diff, "\n")
	colorizedLines := make([]string, len(lines))

	for i, line := range lines {
		if len(line) == 0 {
			colorizedLines[i] = line
			continue
		}

		switch {
		case strings.HasPrefix(line, "---") || strings.HasPrefix(line, "+++"):
			// File headers
			colorizedLines[i] = colorBold + colorCyan + line + colorReset
		case strings.HasPrefix(line, "@@"):
			// Hunk headers
			colorizedLines[i] = colorCyan + line + colorReset
		case strings.HasPrefix(line, "-"):
			// Deletions
			colorizedLines[i] = colorRed + line + colorReset
		case strings.HasPrefix(line, "+"):
			// Additions
			colorizedLines[i] = colorGreen + line + colorReset
		default:
			// Context lines
			colorizedLines[i] = line
		}
	}

	return strings.Join(colorizedLines, "\n")
}

// supportsColor checks if the output stream supports ANSI color codes
func (o *HistoryOptions) supportsColor() bool {
	// Check if NO_COLOR environment variable is set (universal opt-out)
	if os.Getenv("NO_COLOR") != "" {
		return false
	}

	// Check if output is a terminal (not redirected to a file)
	if o.Out != os.Stdout {
		return false
	}

	// Check TERM environment variable
	termEnv := os.Getenv("TERM")
	if termEnv == "dumb" || termEnv == "" {
		return false
	}

	// Check if stdout is a terminal using term.IsTerminal
	// os.Stdout.Fd() returns the file descriptor for stdout
	return term.IsTerminal(int(os.Stdout.Fd()))
}

// printEvents prints audit events using the configured printer
func (o *HistoryOptions) printEvents(events []auditv1.Event, printer printers.ResourcePrinter) error {
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
func (o *HistoryOptions) eventsToTable(events []auditv1.Event) *metav1.Table {
	return &metav1.Table{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Table",
			APIVersion: "meta.k8s.io/v1",
		},
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Timestamp", Type: "string", Description: "Time of the event"},
			{Name: "Verb", Type: "string", Description: "Action performed"},
			{Name: "User", Type: "string", Description: "User who performed the action"},
			{Name: "Status", Type: "string", Description: "HTTP status code"},
		},
		Rows: o.eventsToRows(events),
	}
}

// eventsToRows converts audit events to table rows
func (o *HistoryOptions) eventsToRows(events []auditv1.Event) []metav1.TableRow {
	rows := make([]metav1.TableRow, 0, len(events))
	for i := range events {
		timestamp := events[i].StageTimestamp.Format("2006-01-02 15:04:05")
		verb := events[i].Verb
		username := events[i].User.Username

		status := ""
		if events[i].ResponseStatus != nil {
			status = fmt.Sprintf("%d", events[i].ResponseStatus.Code)
		}

		row := metav1.TableRow{
			Cells: []interface{}{timestamp, verb, username, status},
		}
		rows = append(rows, row)
	}
	return rows
}
