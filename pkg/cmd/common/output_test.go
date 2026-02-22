package common

import (
	"bytes"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestNewTablePrinter(t *testing.T) {
	printFlags := genericclioptions.NewPrintFlags("")
	ioStreams := genericclioptions.IOStreams{
		Out:    os.Stdout,
		ErrOut: os.Stderr,
		In:     os.Stdin,
	}

	printer := NewTablePrinter(printFlags, ioStreams, true)

	assert.NotNil(t, printer)
	assert.Equal(t, printFlags, printer.PrintFlags)
	assert.Equal(t, ioStreams, printer.IOStreams)
	assert.True(t, printer.NoHeaders)
}

func TestTablePrinter_PrintTable(t *testing.T) {
	tests := []struct {
		name      string
		noHeaders bool
		table     *metav1.Table
		wantErr   bool
	}{
		{
			name:      "print table with headers",
			noHeaders: false,
			table: &metav1.Table{
				ColumnDefinitions: []metav1.TableColumnDefinition{
					{Name: "Name", Type: "string"},
					{Name: "Status", Type: "string"},
				},
				Rows: []metav1.TableRow{
					{Cells: []interface{}{"test1", "success"}},
					{Cells: []interface{}{"test2", "failed"}},
				},
			},
			wantErr: false,
		},
		{
			name:      "print table without headers",
			noHeaders: true,
			table: &metav1.Table{
				ColumnDefinitions: []metav1.TableColumnDefinition{
					{Name: "Name", Type: "string"},
					{Name: "Status", Type: "string"},
				},
				Rows: []metav1.TableRow{
					{Cells: []interface{}{"test1", "success"}},
				},
			},
			wantErr: false,
		},
		{
			name:      "empty table",
			noHeaders: false,
			table: &metav1.Table{
				ColumnDefinitions: []metav1.TableColumnDefinition{
					{Name: "Name", Type: "string"},
				},
				Rows: []metav1.TableRow{},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			printFlags := genericclioptions.NewPrintFlags("")
			ioStreams := genericclioptions.IOStreams{
				Out:    &buf,
				ErrOut: &bytes.Buffer{},
				In:     &bytes.Buffer{},
			}

			printer := NewTablePrinter(printFlags, ioStreams, tt.noHeaders)
			err := printer.PrintTable(tt.table)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				// Empty tables may not produce output, so only check non-empty tables
				if len(tt.table.Rows) > 0 {
					assert.NotEmpty(t, buf.String())
				}
			}
		})
	}
}

func TestTablePrinter_PrintPaginationInfo(t *testing.T) {
	tests := []struct {
		name          string
		continueToken string
		resultCount   int
		wantContains  []string
	}{
		{
			name:          "with continue token",
			continueToken: "cursor123",
			resultCount:   25,
			wantContains: []string{
				"More results available",
				"--continue-after 'cursor123'",
				"--all-pages",
			},
		},
		{
			name:          "no continue token with results",
			continueToken: "",
			resultCount:   10,
			wantContains: []string{
				"No more results",
			},
		},
		{
			name:          "no continue token no results",
			continueToken: "",
			resultCount:   0,
			wantContains:  []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var errBuf bytes.Buffer
			printFlags := genericclioptions.NewPrintFlags("")
			ioStreams := genericclioptions.IOStreams{
				Out:    &bytes.Buffer{},
				ErrOut: &errBuf,
				In:     &bytes.Buffer{},
			}

			printer := NewTablePrinter(printFlags, ioStreams, false)
			printer.PrintPaginationInfo(tt.continueToken, tt.resultCount)

			output := errBuf.String()
			for _, want := range tt.wantContains {
				assert.Contains(t, output, want)
			}
		})
	}
}

func TestTablePrinter_PrintAllPagesInfo(t *testing.T) {
	var errBuf bytes.Buffer
	printFlags := genericclioptions.NewPrintFlags("")
	ioStreams := genericclioptions.IOStreams{
		Out:    &bytes.Buffer{},
		ErrOut: &errBuf,
		In:     &bytes.Buffer{},
	}

	printer := NewTablePrinter(printFlags, ioStreams, false)
	printer.PrintAllPagesInfo(42)

	output := errBuf.String()
	assert.Contains(t, output, "Showing 42 results")
}

func TestSupportsColor(t *testing.T) {
	tests := []struct {
		name      string
		setupEnv  func()
		cleanupEnv func()
		out       *os.File
		want      bool
	}{
		{
			name: "NO_COLOR set",
			setupEnv: func() {
				os.Setenv("NO_COLOR", "1")
			},
			cleanupEnv: func() {
				os.Unsetenv("NO_COLOR")
			},
			out:  os.Stdout,
			want: false,
		},
		{
			name: "not stdout",
			setupEnv: func() {},
			cleanupEnv: func() {},
			out:  os.Stderr,
			want: false,
		},
		{
			name: "TERM is dumb",
			setupEnv: func() {
				os.Setenv("TERM", "dumb")
			},
			cleanupEnv: func() {
				os.Unsetenv("TERM")
			},
			out:  os.Stdout,
			want: false,
		},
		{
			name: "TERM is empty",
			setupEnv: func() {
				os.Setenv("TERM", "")
			},
			cleanupEnv: func() {
				os.Unsetenv("TERM")
			},
			out:  os.Stdout,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupEnv()
			defer tt.cleanupEnv()

			got := SupportsColor(tt.out)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestCreatePrinter(t *testing.T) {
	printFlags := genericclioptions.NewPrintFlags("")

	printer, err := CreatePrinter(printFlags)

	require.NoError(t, err)
	assert.NotNil(t, printer)
}

func TestIsDefaultOutputFormat(t *testing.T) {
	tests := []struct {
		name         string
		outputFormat *string
		want         bool
	}{
		{
			name:         "nil output format",
			outputFormat: nil,
			want:         true,
		},
		{
			name:         "empty output format",
			outputFormat: stringPtr(""),
			want:         true,
		},
		{
			name:         "json output format",
			outputFormat: stringPtr("json"),
			want:         false,
		},
		{
			name:         "yaml output format",
			outputFormat: stringPtr("yaml"),
			want:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			printFlags := genericclioptions.NewPrintFlags("")
			printFlags.OutputFormat = tt.outputFormat

			got := IsDefaultOutputFormat(printFlags)
			assert.Equal(t, tt.want, got)
		})
	}
}

func stringPtr(s string) *string {
	return &s
}
