import type { PluginContext, Tool, ToolCallResult, ToolContext } from './types.ts';

let config: Record<string, string> = {};

async function resolveConfig(ctx: PluginContext): Promise<Record<string, string>> {
  const keys = ['grafanaUrl', 'grafanaApiKey', 'datadogApiKey', 'datadogAppKey', 'datadogSite'];
  const cfg: Record<string, string> = {};
  for (const k of keys) {
    cfg[k] = (await ctx.config.get(k)) ?? '';
  }
  return cfg;
}

export async function onLoad(ctx: PluginContext): Promise<void> {
  config = await resolveConfig(ctx);
}

function grafanaHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${config.grafanaApiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'CortexPrism-GrafanaPlugin/1.0.0',
  };
}

function datadogHeaders(): Record<string, string> {
  return {
    'DD-API-KEY': config.datadogApiKey,
    'DD-APPLICATION-KEY': config.datadogAppKey,
    'Content-Type': 'application/json',
    'User-Agent': 'CortexPrism-GrafanaPlugin/1.0.0',
  };
}

async function apiFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 30000,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(t);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, data: null, error: `API error ${res.status}: ${JSON.stringify(data)}` };
    }
    return { ok: true, data };
  } catch (e) {
    clearTimeout(t);
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, data: null, error: 'Request timeout' };
    }
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

const grafanaQueryMetricsTool: Tool = {
  definition: {
    name: 'grafana_query_metrics',
    description: 'Query metrics from a Grafana datasource',
    params: [
      {
        name: 'query',
        type: 'string',
        description: 'PromQL or datasource-specific query',
        required: true,
      },
      {
        name: 'datasource',
        type: 'string',
        description: 'Grafana datasource name or UID',
        required: true,
      },
      {
        name: 'time_range',
        type: 'string',
        description: 'Time range (e.g. 1h, 6h, 24h)',
        required: false,
        defaultValue: '1h',
      },
      {
        name: 'step',
        type: 'string',
        description: 'Query resolution step (e.g. 1m)',
        required: false,
        defaultValue: '1m',
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const query = String(args.query || '');
      const datasource = String(args.datasource || '');
      const timeRange = typeof args.time_range === 'string' && args.time_range
        ? args.time_range
        : '1h';
      const step = typeof args.step === 'string' && args.step ? args.step : '1m';
      if (!query) {
        return {
          toolName: 'grafana_query_metrics',
          success: false,
          output: '',
          error: 'query is required',
          durationMs: Date.now() - start,
        };
      }
      if (!datasource) {
        return {
          toolName: 'grafana_query_metrics',
          success: false,
          output: '',
          error: 'datasource is required',
          durationMs: Date.now() - start,
        };
      }
      const now = Math.floor(Date.now() / 1000);
      const rangeSeconds = parseDuration(timeRange);
      const from = now - rangeSeconds;
      const to = now;
      const url = `${config.grafanaUrl || 'http://localhost:3000'}/api/ds/query`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: grafanaHeaders(),
          body: JSON.stringify({
            queries: [{ refId: 'A', datasource: { uid: datasource }, expr: query }],
            from: String(from),
            to: String(to),
          }),
          signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) {
          const txt = await res.text();
          return {
            toolName: 'grafana_query_metrics',
            success: false,
            output: '',
            error: `Grafana error ${res.status}: ${txt}`,
            durationMs: Date.now() - start,
          };
        }
        const data = await res.json();
        return {
          toolName: 'grafana_query_metrics',
          success: true,
          output: JSON.stringify(data, null, 2),
          durationMs: Date.now() - start,
        };
      } catch (e) {
        clearTimeout(t);
        if (e instanceof Error && e.name === 'AbortError') {
          return {
            toolName: 'grafana_query_metrics',
            success: false,
            output: '',
            error: 'Request timeout (30s)',
            durationMs: Date.now() - start,
          };
        }
        throw e;
      }
    } catch (error) {
      return {
        toolName: 'grafana_query_metrics',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const grafanaListDashboardsTool: Tool = {
  definition: {
    name: 'grafana_list_dashboards',
    description: 'List available Grafana dashboards',
    params: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query to filter dashboard names',
        required: false,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      let url = `${config.grafanaUrl || 'http://localhost:3000'}/api/search?type=dash-db`;
      if (typeof args.query === 'string' && args.query) {
        url += `&query=${encodeURIComponent(args.query)}`;
      }
      const result = await apiFetch(url, grafanaHeaders());
      if (!result.ok) {
        return {
          toolName: 'grafana_list_dashboards',
          success: false,
          output: '',
          error: result.error || 'List failed',
          durationMs: Date.now() - start,
        };
      }
      return {
        toolName: 'grafana_list_dashboards',
        success: true,
        output: JSON.stringify(result.data, null, 2),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'grafana_list_dashboards',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const grafanaGetDashboardTool: Tool = {
  definition: {
    name: 'grafana_get_dashboard',
    description: 'Get the full JSON definition of a Grafana dashboard',
    params: [
      { name: 'dashboard_uid', type: 'string', description: 'Dashboard UID', required: true },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const uid = String(args.dashboard_uid || '');
      if (!uid) {
        return {
          toolName: 'grafana_get_dashboard',
          success: false,
          output: '',
          error: 'dashboard_uid is required',
          durationMs: Date.now() - start,
        };
      }
      const url = `${config.grafanaUrl || 'http://localhost:3000'}/api/dashboards/uid/${
        encodeURIComponent(uid)
      }`;
      const result = await apiFetch(url, grafanaHeaders());
      if (!result.ok) {
        return {
          toolName: 'grafana_get_dashboard',
          success: false,
          output: '',
          error: result.error || 'Get failed',
          durationMs: Date.now() - start,
        };
      }
      return {
        toolName: 'grafana_get_dashboard',
        success: true,
        output: JSON.stringify(result.data, null, 2),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'grafana_get_dashboard',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const grafanaCreateAlertTool: Tool = {
  definition: {
    name: 'grafana_create_alert',
    description: 'Create a Grafana alert rule on a metric',
    params: [
      { name: 'name', type: 'string', description: 'Alert rule name', required: true },
      { name: 'query', type: 'string', description: 'Metric query to evaluate', required: true },
      {
        name: 'condition',
        type: 'string',
        description: "Alert condition (e.g. 'gt 90')",
        required: true,
      },
      {
        name: 'datasource',
        type: 'string',
        description: 'Grafana datasource name or UID',
        required: true,
      },
      {
        name: 'notification_channel',
        type: 'string',
        description: 'Notification channel name or UID',
        required: false,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const name = String(args.name || '');
      const query = String(args.query || '');
      const condition = String(args.condition || '');
      const datasource = String(args.datasource || '');
      const notificationChannel = typeof args.notification_channel === 'string'
        ? args.notification_channel
        : null;
      if (!name) {
        return {
          toolName: 'grafana_create_alert',
          success: false,
          output: '',
          error: 'name is required',
          durationMs: Date.now() - start,
        };
      }
      if (!query) {
        return {
          toolName: 'grafana_create_alert',
          success: false,
          output: '',
          error: 'query is required',
          durationMs: Date.now() - start,
        };
      }
      if (!condition) {
        return {
          toolName: 'grafana_create_alert',
          success: false,
          output: '',
          error: 'condition is required',
          durationMs: Date.now() - start,
        };
      }
      if (!datasource) {
        return {
          toolName: 'grafana_create_alert',
          success: false,
          output: '',
          error: 'datasource is required',
          durationMs: Date.now() - start,
        };
      }
      const url = `${config.grafanaUrl || 'http://localhost:3000'}/api/v1/provisioning/alert-rules`;
      const body: Record<string, unknown> = {
        title: name,
        condition,
        data: [{
          refId: 'A',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          datasourceUid: datasource,
          model: { expr: query },
        }],
        noDataState: 'NoData',
        execErrState: 'Error',
        for: '5m',
      };
      if (notificationChannel) body['notifications'] = [{ uid: notificationChannel }];
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: grafanaHeaders(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) {
          const txt = await res.text();
          return {
            toolName: 'grafana_create_alert',
            success: false,
            output: '',
            error: `Grafana error ${res.status}: ${txt}`,
            durationMs: Date.now() - start,
          };
        }
        const data = await res.json();
        return {
          toolName: 'grafana_create_alert',
          success: true,
          output: JSON.stringify(data, null, 2),
          durationMs: Date.now() - start,
        };
      } catch (e) {
        clearTimeout(t);
        if (e instanceof Error && e.name === 'AbortError') {
          return {
            toolName: 'grafana_create_alert',
            success: false,
            output: '',
            error: 'Request timeout (15s)',
            durationMs: Date.now() - start,
          };
        }
        throw e;
      }
    } catch (error) {
      return {
        toolName: 'grafana_create_alert',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const grafanaAnalyzeIncidentTool: Tool = {
  definition: {
    name: 'grafana_analyze_incident',
    description: 'Analyze a metric spike for incident investigation',
    params: [
      { name: 'metric', type: 'string', description: 'Metric name to analyze', required: true },
      {
        name: 'time_range',
        type: 'string',
        description: 'Time range around the incident',
        required: true,
      },
      {
        name: 'datasource',
        type: 'string',
        description: 'Grafana datasource name or UID',
        required: true,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const metric = String(args.metric || '');
      const timeRange = String(args.time_range || '');
      const datasource = String(args.datasource || '');
      if (!metric) {
        return {
          toolName: 'grafana_analyze_incident',
          success: false,
          output: '',
          error: 'metric is required',
          durationMs: Date.now() - start,
        };
      }
      if (!timeRange) {
        return {
          toolName: 'grafana_analyze_incident',
          success: false,
          output: '',
          error: 'time_range is required',
          durationMs: Date.now() - start,
        };
      }
      if (!datasource) {
        return {
          toolName: 'grafana_analyze_incident',
          success: false,
          output: '',
          error: 'datasource is required',
          durationMs: Date.now() - start,
        };
      }
      const now = Math.floor(Date.now() / 1000);
      const rangeSeconds = parseDuration(timeRange);
      const from = now - rangeSeconds;
      const to = now;
      const url = `${config.grafanaUrl || 'http://localhost:3000'}/api/ds/query`;
      const body = JSON.stringify({
        queries: [{
          refId: 'A',
          datasource: { uid: datasource },
          expr: `${metric}`,
        }],
        from: String(from),
        to: String(to),
      });
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: grafanaHeaders(),
          body,
          signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) {
          const txt = await res.text();
          return {
            toolName: 'grafana_analyze_incident',
            success: false,
            output: '',
            error: `Grafana error ${res.status}: ${txt}`,
            durationMs: Date.now() - start,
          };
        }
        const rawData = await res.json();
        const frames = (rawData as Record<string, unknown>)?.results?.A?.frames || [];
        const analysis: Record<string, unknown> = {
          metric,
          datasource,
          time_range: timeRange,
          data_points: Array.isArray(frames) ? frames.length : 0,
          raw: rawData,
          generated_at: new Date().toISOString(),
        };
        return {
          toolName: 'grafana_analyze_incident',
          success: true,
          output: JSON.stringify(analysis, null, 2),
          durationMs: Date.now() - start,
        };
      } catch (e) {
        clearTimeout(t);
        if (e instanceof Error && e.name === 'AbortError') {
          return {
            toolName: 'grafana_analyze_incident',
            success: false,
            output: '',
            error: 'Request timeout (30s)',
            durationMs: Date.now() - start,
          };
        }
        throw e;
      }
    } catch (error) {
      return {
        toolName: 'grafana_analyze_incident',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const datadogQueryTool: Tool = {
  definition: {
    name: 'datadog_query',
    description: 'Query Datadog metrics directly',
    params: [
      {
        name: 'query',
        type: 'string',
        description: 'Datadog metrics query string',
        required: true,
      },
      {
        name: 'from_ts',
        type: 'string',
        description: 'Start time as UNIX seconds',
        required: false,
      },
      { name: 'to_ts', type: 'string', description: 'End time as UNIX seconds', required: false },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const query = String(args.query || '');
      if (!query) {
        return {
          toolName: 'datadog_query',
          success: false,
          output: '',
          error: 'query is required',
          durationMs: Date.now() - start,
        };
      }
      const now = Math.floor(Date.now() / 1000);
      const fromTs = typeof args.from_ts === 'string' ? parseInt(args.from_ts, 10) : now - 3600;
      const toTs = typeof args.to_ts === 'string' ? parseInt(args.to_ts, 10) : now;
      const site = config.datadogSite || 'datadoghq.com';
      const url = `https://api.${site}/api/v1/query?from=${fromTs}&to=${toTs}&query=${
        encodeURIComponent(query)
      }`;
      const result = await apiFetch(url, datadogHeaders());
      if (!result.ok) {
        return {
          toolName: 'datadog_query',
          success: false,
          output: '',
          error: result.error || 'Query failed',
          durationMs: Date.now() - start,
        };
      }
      return {
        toolName: 'datadog_query',
        success: true,
        output: JSON.stringify(result.data, null, 2),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'datadog_query',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 3600;
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return val;
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    default:
      return 3600;
  }
}

export async function onUnload(_ctx: PluginContext): Promise<void> {}

export const tools: Tool[] = [
  grafanaQueryMetricsTool,
  grafanaListDashboardsTool,
  grafanaGetDashboardTool,
  grafanaCreateAlertTool,
  grafanaAnalyzeIncidentTool,
  datadogQueryTool,
];
