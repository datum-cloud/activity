package main

import (
	"fmt"
	"os"

	"go.miloapis.com/activity/pkg/cmd"
)

func main() {
	rootCmd := cmd.NewActivityCommand()
	rootCmd.Use = "kubectl-activity"

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
