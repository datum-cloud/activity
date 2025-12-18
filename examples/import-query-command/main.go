package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"k8s.io/cli-runtime/pkg/genericclioptions"

	"go.miloapis.com/activity/pkg/cmd"
)

// This example demonstrates how to import the query command into your own CLI
func main() {
	// Example 1: Use the entire activity command structure
	rootCmd1 := &cobra.Command{
		Use:   "mycli",
		Short: "My custom CLI tool",
	}
	rootCmd1.AddCommand(cmd.NewActivityCommand())
	// Usage: mycli activity query --start-time "now-1h" --end-time "now"

	// Example 2: Import just the query command directly
	rootCmd2 := &cobra.Command{
		Use:   "mycli",
		Short: "My custom CLI tool",
	}
	ioStreams := genericclioptions.IOStreams{
		In:     os.Stdin,
		Out:    os.Stdout,
		ErrOut: os.Stderr,
	}
	rootCmd2.AddCommand(cmd.NewQueryCommand(ioStreams))
	// Usage: mycli query --start-time "now-1h" --end-time "now"

	// For this example, we'll use the second approach
	if err := rootCmd2.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
