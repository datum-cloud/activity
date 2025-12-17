// Package version provides version information for the Activity API server.
// Version information is injected at build time using ldflags.
package version

import (
	"fmt"
	"runtime"
)

var (
	// Version is the semantic version of the Activity API server (e.g., "v0.1.0", "v1.2.3")
	// This can be set via ldflags during build:
	//   -ldflags="-X 'go.miloapis.com/activity/internal/version.Version=v0.1.0'"
	Version = "dev"

	// GitCommit is the git commit hash of the build
	// This can be set via ldflags during build:
	//   -ldflags="-X 'go.miloapis.com/activity/internal/version.GitCommit=$(git rev-parse HEAD)'"
	GitCommit = "unknown"

	// GitTreeState indicates whether the git tree was clean or dirty during build
	// This can be set via ldflags during build:
	//   -ldflags="-X 'go.miloapis.com/activity/internal/version.GitTreeState=clean'"
	GitTreeState = "unknown"

	// BuildDate is the date when the binary was built (RFC3339 format)
	// This can be set via ldflags during build:
	//   -ldflags="-X 'go.miloapis.com/activity/internal/version.BuildDate=$(date -u '+%Y-%m-%dT%H:%M:%SZ')'"
	BuildDate = "unknown"
)

// Info contains version information
type Info struct {
	Version      string `json:"version"`
	GitCommit    string `json:"gitCommit"`
	GitTreeState string `json:"gitTreeState"`
	BuildDate    string `json:"buildDate"`
	GoVersion    string `json:"goVersion"`
	Compiler     string `json:"compiler"`
	Platform     string `json:"platform"`
}

// Get returns the overall version information
func Get() Info {
	return Info{
		Version:      Version,
		GitCommit:    GitCommit,
		GitTreeState: GitTreeState,
		BuildDate:    BuildDate,
		GoVersion:    runtime.Version(),
		Compiler:     runtime.Compiler,
		Platform:     fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
	}
}

// String returns a human-readable version string
func (i Info) String() string {
	return fmt.Sprintf("Activity API Server %s (commit: %s, built: %s, go: %s, platform: %s)",
		i.Version, i.GitCommit, i.BuildDate, i.GoVersion, i.Platform)
}
