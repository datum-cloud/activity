package common

import (
	"fmt"
	"io"
	"os"

	"golang.org/x/term"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/cli-runtime/pkg/printers"
)

// TablePrinter wraps the Kubernetes table printer with helper methods
type TablePrinter struct {
	PrintFlags *genericclioptions.PrintFlags
	IOStreams  genericclioptions.IOStreams
	NoHeaders  bool
}

// NewTablePrinter creates a new table printer
func NewTablePrinter(printFlags *genericclioptions.PrintFlags, ioStreams genericclioptions.IOStreams, noHeaders bool) *TablePrinter {
	return &TablePrinter{
		PrintFlags: printFlags,
		IOStreams:  ioStreams,
		NoHeaders:  noHeaders,
	}
}

// PrintTable prints a table to the output stream
func (p *TablePrinter) PrintTable(table *metav1.Table) error {
	// If no-headers flag is set, remove the first row (headers)
	if p.NoHeaders && len(table.Rows) > 0 {
		table = &metav1.Table{
			TypeMeta:          table.TypeMeta,
			ColumnDefinitions: table.ColumnDefinitions,
			Rows:              table.Rows, // Skip header handling, let printer do it
		}
	}

	tablePrinter := printers.NewTablePrinter(printers.PrintOptions{
		WithNamespace: false,
		Wide:          true,
		NoHeaders:     p.NoHeaders,
	})

	return tablePrinter.PrintObj(table, p.IOStreams.Out)
}

// PrintPaginationInfo prints pagination information to stderr
func (p *TablePrinter) PrintPaginationInfo(continueToken string, resultCount int) {
	if continueToken != "" {
		_, _ = fmt.Fprintf(p.IOStreams.ErrOut, "\nMore results available. Use --continue-after '%s' to get the next page.\n", continueToken)
		_, _ = fmt.Fprintf(p.IOStreams.ErrOut, "Or use --all-pages to fetch all results automatically.\n")
	} else if resultCount > 0 {
		_, _ = fmt.Fprintf(p.IOStreams.ErrOut, "\nNo more results.\n")
	}
}

// PrintAllPagesInfo prints info about fetched results
func (p *TablePrinter) PrintAllPagesInfo(totalCount int) {
	_, _ = fmt.Fprintf(p.IOStreams.ErrOut, "\nShowing %d results.\n", totalCount)
}

// SupportsColor checks if the output stream supports ANSI color codes
func SupportsColor(out io.Writer) bool {
	// Check if NO_COLOR environment variable is set (universal opt-out)
	if os.Getenv("NO_COLOR") != "" {
		return false
	}

	// Check if output is stdout
	if out != os.Stdout {
		return false
	}

	// Check TERM environment variable
	termEnv := os.Getenv("TERM")
	if termEnv == "dumb" || termEnv == "" {
		return false
	}

	// Check if stdout is a terminal
	return term.IsTerminal(int(os.Stdout.Fd()))
}

// CreatePrinter creates a printer based on output format
func CreatePrinter(printFlags *genericclioptions.PrintFlags) (printers.ResourcePrinter, error) {
	return printFlags.ToPrinter()
}

// IsDefaultOutputFormat checks if using default (table) output
func IsDefaultOutputFormat(printFlags *genericclioptions.PrintFlags) bool {
	outputFormat := printFlags.OutputFormat
	return outputFormat == nil || *outputFormat == ""
}

// CreateTablePrinter creates a configured table printer for consistent table output
func CreateTablePrinter(noHeaders bool) printers.ResourcePrinter {
	return printers.NewTablePrinter(printers.PrintOptions{
		WithNamespace: false,
		Wide:          true,
		NoHeaders:     noHeaders,
	})
}
