// deno-lint-ignore-file require-await, no-unused-vars
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { tools } from '../../mod.ts';
import type { PluginContext, ToolContext } from '../../types.ts';

// Mock PluginContext
const mockContext: PluginContext & ToolContext = {
  pluginId: 'cortex-plugin-grafana',
  pluginDir: '/tmp/plugins/cortex-plugin-grafana',
  state: {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: async () => ({}),
  },
  config: {
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
  },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  host: {
    registerTool: () => {},
    unregisterTool: () => {},
  },
  sessionId: 'test-session',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
};

function findTool(name: string) {
  const tool = tools.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

Deno.test('tools array — exports all tools', () => {
  assertEquals(tools.length, 6);
  assertEquals(tools[0].definition.name, 'grafana_query_metrics');
  assertEquals(tools[1].definition.name, 'grafana_list_dashboards');
  assertEquals(tools[2].definition.name, 'grafana_get_dashboard');
  assertEquals(tools[3].definition.name, 'grafana_create_alert');
  assertEquals(tools[4].definition.name, 'grafana_analyze_incident');
  assertEquals(tools[5].definition.name, 'datadog_query');
});

Deno.test('grafana_query_metrics — rejects empty query', async () => {
  const tool = findTool('grafana_query_metrics');
  const result = await tool.execute({ 'query': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('grafana_list_dashboards — tool is defined with name and description', () => {
  const tool = findTool('grafana_list_dashboards');
  assertEquals(typeof tool.definition.description, 'string');
  assertEquals(tool.definition.description.length > 0, true);
});

Deno.test('grafana_get_dashboard — rejects empty dashboard_uid', async () => {
  const tool = findTool('grafana_get_dashboard');
  const result = await tool.execute({ 'dashboard_uid': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('grafana_create_alert — rejects empty name', async () => {
  const tool = findTool('grafana_create_alert');
  const result = await tool.execute({ 'name': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('grafana_analyze_incident — rejects empty metric', async () => {
  const tool = findTool('grafana_analyze_incident');
  const result = await tool.execute({ 'metric': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('datadog_query — rejects empty query', async () => {
  const tool = findTool('datadog_query');
  const result = await tool.execute({ 'query': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('all tools return durationMs', async () => {
  for (const tool of tools) {
    const args: Record<string, unknown> = {};
    const result = await tool.execute(args, mockContext);
    assertEquals(typeof result.durationMs, 'number');
    assertEquals(result.durationMs >= 0, true);
  }
});
