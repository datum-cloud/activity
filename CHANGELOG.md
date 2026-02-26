# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **New `audit` command** - Query Kubernetes audit logs with time ranges, filters, and pagination
  - Shorthand filters: `--namespace`, `--resource`, `--verb`, `--user`
  - CEL expression support via `--filter`
  - Facet queries via `--suggest` for field value discovery
  - Multiple output formats: table, json, yaml, jsonpath, go-template
- **New `events` command** - Query Kubernetes events with 60-day retention
  - Filter by event type (Normal, Warning), reason, involved object
  - Field selector support for complex queries
  - Suggest mode for discovering event reasons and types
- **New `feed` command** - Query human-readable activity summaries
  - Filter by actor, resource kind, change source (human/system)
  - Full-text search in activity summaries
  - Watch mode for live activity streaming (placeholder for future implementation)
  - Special `summary` output format for minimal, readable output
- **New `policy preview` command** - Test ActivityPolicy rules before deployment
  - Preview policies against sample audit events
  - Dry-run mode for syntax validation
  - Detailed error messages for rule failures
- **Common utilities package** (`pkg/cmd/common/`)
  - Shared flag definitions for consistent UX across all commands
  - Reusable output formatters and table printers
  - Facet query helpers for suggest mode
- **Comprehensive time range support** - All commands support relative (`now-7d`) and absolute (RFC3339) time formats
- **Consistent pagination** - All commands support `--limit`, `--all-pages`, and `--continue-after`
- **Suggest mode** - Discover distinct field values across all query commands

### Changed

- **CLI command structure reorganized** - Commands now organized by data source:
  - `audit` - Audit logs
  - `events` - Kubernetes events
  - `feed` - Activity summaries
  - `history` - Resource change history
  - `policy preview` - Policy testing
- **Updated CLI user guide** - Complete rewrite with new command structure, common patterns, and comprehensive examples

### Breaking Changes

- **`query` command replaced with `audit`** - The old `kubectl activity query` command is now `kubectl activity audit`
  - All flags remain the same
  - Only the command name has changed
  - Migration: Simply replace `query` with `audit` in your scripts
  - Rationale: `audit` is clearer and more accurately describes what the command does

### Deprecated

- **Old `query` command** - Use `audit` command instead

## [0.2.0] - 2025-XX-XX

Previous release information would go here.

## [0.1.0] - 2025-XX-XX

Initial release.

[Unreleased]: https://github.com/datum-cloud/activity/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/datum-cloud/activity/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/datum-cloud/activity/releases/tag/v0.1.0
