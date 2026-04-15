/**
 * MCP Roots — Server
 *
 * WHAT ARE ROOTS?
 * Roots are a CLIENT → SERVER primitive. The client declares a list of "roots"
 * (typically file:// URIs representing workspace directories) during capability
 * negotiation. The server can then ask the client "what roots do you have?" at
 * any time by sending a roots/list request.
 *
 * DIRECTION (unusual):
 * Most MCP flows go client → server:  client calls tools, reads resources, etc.
 * Roots reverse this for one specific query: the SERVER sends roots/list TO the
 * CLIENT and awaits the client's response. This is the MCP way of letting a
 * server discover the user's workspace context.
 *
 * REAL-WORLD USE CASES:
 * - IDE plugin (e.g. VS Code extension): the editor is the client. It declares
 *   the open workspace folders as roots. An AI server tool can then scope file
 *   searches to those directories.
 * - Claude Desktop: declares the user's configured project folders as roots so
 *   that connected MCP servers know which paths are "in scope."
 * - Any server that needs to know "where is the user's code?" without being
 *   hard-coded to a path uses roots to get that answer dynamically.
 *
 * CAPABILITY REQUIREMENT:
 * The client MUST declare `roots: {}` (or `roots: { listChanged: true }`) in its
 * ClientCapabilities during initialize. If it doesn't, server.listRoots() will
 * fail because the client has not advertised support for the roots/list request.
 *
 * CHANGE NOTIFICATIONS:
 * When the user opens a new folder, closes one, or reconfigures their workspace,
 * the client sends `notifications/roots/list_changed` to tell the server that the
 * root list has changed. The server can call server.listRoots() again to fetch
 * the updated list. We log this notification below.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  RootsListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_workspace_roots',
    description: 'List all roots (workspace directories) declared by the client.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_in_roots',
    description: 'Simulate a file search across all client roots matching a pattern.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Glob pattern to search for, e.g. "*.ts"' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'describe_workspace',
    description: 'Return a human-readable summary of the client workspace based on its roots.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
] as const;

// ─── Server Creation ──────────────────────────────────────────────────────────
//
// We declare no special server-side capabilities for roots — roots capability
// is declared by the CLIENT. The server just needs to call server.listRoots()
// when it wants root information.

const server = new Server(
  { name: 'roots-server', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
  console.error('[server] notifications/roots/list_changed received');
  console.error('[server]   Client says its workspace roots changed; refresh any cached root state now.');
});

// ─── Handler: tools/list ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// ─── Handler: tools/call ──────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  const ok = (text: string) => ({
    content: [{ type: 'text' as const, text }],
  });

  const toolError = (message: string) => ({
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  });

  switch (name) {
    case 'get_workspace_roots': {
      // SERVER calling CLIENT — this is the reversed direction.
      //
      // server.listRoots() sends a "roots/list" JSON-RPC REQUEST to the
      // connected client and awaits its response. Compare to the usual
      // direction where the client sends requests and the server responds.
      //
      // The client must have declared `roots: {}` in its capabilities during
      // the initialize handshake, otherwise this call will be rejected.
      const rootsResult = await server.listRoots();

      if (rootsResult.roots.length === 0) {
        return ok('Client declared no roots. The workspace appears to be empty.');
      }

      const lines = ['Workspace roots declared by client:', ''];
      for (const root of rootsResult.roots) {
        const label = root.name ? `${root.name}  (${root.uri})` : root.uri;
        lines.push(`  • ${label}`);
      }
      lines.push('', `Total: ${rootsResult.roots.length} root(s)`);
      return ok(lines.join('\n'));
    }

    case 'find_in_roots': {
      const pattern = String(a['pattern'] ?? '');
      if (!pattern) return toolError('pattern argument is required.');

      // Fetch the client's current roots.
      // Again: server → client direction. The server is asking the client
      // what directories exist so it can scope the search to them.
      const rootsResult = await server.listRoots();

      if (rootsResult.roots.length === 0) {
        return ok(`No roots declared. Cannot search for "${pattern}".`);
      }

      const lines = [`Searching for "${pattern}" across ${rootsResult.roots.length} root(s):`, ''];
      for (const root of rootsResult.roots) {
        const label = root.name ?? root.uri;
        // Simulated search result — in a real server you would use fs.glob or
        // a language server to actually scan the directory at root.uri.
        lines.push(`  [${label}]`);
        lines.push(`    Checked: ${root.uri}`);
        lines.push(`    Simulated matches: ${root.uri}/src/index.ts, ${root.uri}/src/utils.ts`);
        lines.push('');
      }
      lines.push(`Pattern "${pattern}" search complete.`);
      return ok(lines.join('\n'));
    }

    case 'describe_workspace': {
      // Once more: server asks client for roots before describing the workspace.
      const rootsResult = await server.listRoots();

      if (rootsResult.roots.length === 0) {
        return ok('No roots declared. The server has no workspace context.');
      }

      const rootCount = rootsResult.roots.length;
      const names = rootsResult.roots
        .map((r) => r.name ?? r.uri)
        .join(', ');

      const lines = [
        'Workspace Summary',
        '─────────────────',
        `  Root count : ${rootCount}`,
        `  Projects   : ${names}`,
        '',
        'Root details:',
      ];
      for (const root of rootsResult.roots) {
        lines.push(`  • ${root.name ?? '(unnamed)'}  →  ${root.uri}`);
      }
      lines.push('', 'The server can scope all file operations to these directories.');
      return ok(lines.join('\n'));
    }

    default:
      return toolError(
        `Unknown tool: "${name}". Available: ${TOOLS.map((t) => t.name).join(', ')}`,
      );
  }
});

// ─── Transport + Connect ──────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
