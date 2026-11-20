import { TrueForge } from '@truefoundry/trueforge-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';

export function loopback(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Use a local TrueForge HTTP origin');
  }
  return parsed.origin;
}

export function terminalStatus(state: unknown): 'done' | 'cancelled' | { error: string } {
  if (state && typeof state === 'object' && 'status' in state) {
    if (state.status === 'done' || state.status === 'cancelled') return state.status;
    if (state.status === 'error' && 'message' in state && typeof state.message === 'string') {
      return { error: state.message };
    }
  }
  throw new Error('TrueForge returned an invalid terminal event');
}

export type ToolHandler = (name: string, input: Record<string, unknown>) => Promise<string>;
const path = z.string().min(1).max(500);
const query = z.string().min(1).max(200);
const specs = {
  list_files: { prefix: z.string().max(300).optional() },
  search: { query, prefix: z.string().max(300).optional() },
  find_symbol: { query, prefix: z.string().max(300).optional() },
  context: { query },
  read_file: { path, start: z.number().int().min(1).optional(), lines: z.number().int().min(1).max(400).optional() },
  stage_file: { path, original: z.string().max(150000), content: z.string().max(150000) },
  stage_replace: { path, before: z.string().min(1).max(40000), after: z.string().max(40000) },
  stage_selection: { content: z.string().max(30000) },
  get_diff: { path },
  run_pytest: { targets: z.array(path).min(1).max(10) },
};
const descriptions = {
  list_files: 'List repository files, optionally under a prefix.',
  search: 'Search for literal case-insensitive text. Optionally limit results to a path prefix.',
  find_symbol: 'Find declarations for a symbol.',
  context: 'Retrieve ranked excerpts for a broad topic. For a particular implementation, use search and then read_file.',
  read_file: 'Read a file or a one-based range of lines from the workspace or staging.',
  stage_file: 'Stage full file contents. Pass exact current contents as original. For a new file pass empty original.',
  stage_replace: 'Stage a targeted replacement. Before must match exactly once in the current or staged file. Use for large files.',
  stage_selection: 'Stage a replacement for the current selection in inline mode.',
  get_diff: 'Read the staged patch for a file.',
  run_pytest: 'Request approval to run pytest against selected repository test files in isolation.',
};

export async function bridge(client: TrueForge, inline: boolean, invoke: ToolHandler, signal: AbortSignal) {
  const id = randomUUID().replaceAll('-', '');
  const name = 'forgepilot-' + id.slice(0, 16);
  const endpoint = '/mcp/' + id;
  const names = (Object.keys(specs) as (keyof typeof specs)[]).filter(key =>
    inline ? key === 'stage_selection' : key !== 'stage_selection');
  const server = createServer(async (req, res) => {
    if (req.url !== endpoint || req.method !== 'POST' || signal.aborted || req.headers.origin) {
      res.writeHead(404).end();
      return;
    }
    const mcp = new McpServer({ name: 'ForgePilot Workspace', version: '1.0.0' });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    for (const key of names) {
      mcp.registerTool(key, {
        description: descriptions[key],
        inputSchema: specs[key] as z.ZodRawShape,
        annotations: { destructiveHint: false, readOnlyHint: !key.startsWith('stage_') && key !== 'run_pytest' },
      }, async input => {
        try {
          signal.throwIfAborted();
          return { content: [{ type: 'text', text: await invoke(key, input) }] };
        } catch (error) {
          return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed' }] };
        }
      });
    }
    res.once('close', () => { void mcp.close(); });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500).end();
    }
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ok);
  });
  const close = () => { server.close(); server.closeAllConnections(); };
  signal.addEventListener('abort', close, { once: true });
  try {
    signal.throwIfAborted();
    await client.settings.mcpServers.create({ manifest: {
      name, description: 'Run-scoped ForgePilot workspace operations', type: 'remote',
      url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + endpoint,
    } }, { abortSignal: signal });
  } catch (error) {
    close();
    throw error;
  }
  return { name, close: async () => {
    close();
    try { await client.settings.mcpServers.delete(name, { timeoutInSeconds: 3, maxRetries: 0 }); }
    catch { /* The expired MCP endpoint remains disabled. */ }
  } };
}
