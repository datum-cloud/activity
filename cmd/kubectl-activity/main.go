package main

import (
	"fmt"
	"os"

	"go.miloapis.com/activity/pkg/cmd"
)

func main() {
	rootCmd := cmd.NewActivityCommand(cmd.ActivityCommandOptions{
		// Enable admin commands (policy preview, reindex management) in the
		// default kubectl plugin binary. Consumer CLIs that embed this package
		// can omit this flag to expose only end-user query capabilities.
		EnableAdminCommands: true,
	})
	rootCmd.Use = "kubectl-activity"

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
