# Grafana / Datadog Dashboard

Query metrics, create dashboards, and analyze incidents from Grafana and Datadog.

## Installation

```bash
cortex plugin install marketplace:cortex-plugin-grafana
cortex plugin install github:CortexPrism/cortex-plugin-grafana
cortex plugin install ./manifest.json
```

## Configuration

### Grafana
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `grafanaUrl` | text | `http://localhost:3000` | Grafana URL |
| `grafanaApiKey` | secret | — | API key or service account token |

### Datadog
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `datadogApiKey` | secret | — | Datadog API key |
| `datadogAppKey` | secret | — | Datadog application key |
| `datadogSite` | text | `datadoghq.com` | Datadog site |

## Tools

### grafana_query_metrics — Query metrics
- `query` (string, required) — PromQL or datasource query
- `datasource` (string, required) — Datasource name/UID
- `time_range` (string, default `"1h"`)
- `step` (string, default `"1m"`)

### grafana_list_dashboards — List dashboards
- `query` (string, optional) — Search filter

### grafana_get_dashboard — Get dashboard JSON
- `dashboard_uid` (string, required)

### grafana_create_alert — Create alert rule
- `name` (string, required)
- `query` (string, required)
- `condition` (string, required) — e.g. `"gt 90"`
- `datasource` (string, required)
- `notification_channel` (string, optional)

### grafana_analyze_incident — Analyze metric spike
- `metric` (string, required)
- `time_range` (string, required)
- `datasource` (string, required)

### datadog_query — Query Datadog metrics
- `query` (string, required)
- `from_ts` (string, optional) — UNIX seconds
- `to_ts` (string, optional) — UNIX seconds

## Capabilities

- `tools` — Tool execution
- `network:fetch` — HTTPS to Grafana/Datadog APIs

## Development

```bash
deno task test
deno fmt --check
deno lint
```

## License

MIT
