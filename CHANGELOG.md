# Changelog

## [Unreleased]

### Added

- Structured logging via ctx.logger in lifecycle hooks

### Changed

- Renamed manifest file from `cortex.json` to `manifest.json` for consistency with Cortex standard
- Standardized UI section structure to `ui.settings` format
- Normalized parameter naming: `defaultValue` → `default`, `options` → `enum`
- Added `homepage` field with repository URL
- Added `dependencies` field to manifest

## [1.0.1] — 2026-06-15

### Added

- Initial release

## [1.0.1] — 2026-06-17

### Added

- Initial project setup

## [1.0.0] — 2026-06-15

### Added

- Initial release of cortex-plugin-grafana
- `grafana_query_metrics` — Query metrics from Grafana datasources
- `grafana_list_dashboards` — List available dashboards
- `grafana_get_dashboard` — Get full dashboard JSON
- `grafana_create_alert` — Create alert rules
- `grafana_analyze_incident` — Analyze metric spikes
- `datadog_query` — Query Datadog metrics directly
