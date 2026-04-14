/**
 * MCP Roots — Demo Client
 *
 * WHAT ARE ROOTS?
 * Roots are a CLIENT → SERVER data flow. The client owns a list of workspace
 * roots (file:// URIs) and the server can request them via roots/list at any
 * time. This lets a server discover the user's workspace context without being
 * hard-coded to any particular path.
 *
 * DIRECTION:
 * Unlike most MCP interactions (client calls server), roots/list is initiated
 * BY THE SERVER. The server sends a roots/list request; the client must have a
 * handler registered to respond with the current list.
 *
 * REAL-WORLD USE CASES:
 * - VS Code MCP extension declares open workspace folders as roots.
 * - Claude Desktop declares configured project directories as roots.
 * - Any client that wants to give a server workspace context uses roots.
 *
 * DEMO SEQUENCE:
 * 1. Connect (with roots capability declared + handler registered)
 * 2. List available tools
 * 3. Call get_workspace_roots   — server queries client, client responds
 * 4. Call find_in_roots         — server uses roots to scope simulated search
 * 5. Call describe_workspace    — server summarises workspace from roots
 * 6. Simulate roots change      — add a new root, send list_changed notification
 * 7. Call get_workspace_roots   — server sees the updated list
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// ─── Mutable roots list ───────────────────────────────────────────────────────
//
// We keep the roots in a variable so we can mutate it later to simulate a
// workspace change (step 6). The request handler closes over this variable.

let roots = [
  { uri: 'file:///Users/dev/my-project',  name: 'My Project'     },
  { uri: 'file:///Users/dev/shared-lib',  name: 'Shared Library' },
  { uri: 'file:///tmp/scratch',           name: 'Scratch'        },
];

// ─── Client Creation ──────────────────────────────────────────────────────────
//
// We pass `roots: { listChanged: true }` in capabilities to tell the server:
//   1. We support the roots/list request method (the server may call it).
//   2. We will send notifications/roots/list_changed when our root list changes.
//
// Without this capability declaration, the server's server.listRoots() call
// would be rejected because the client has not advertised roots support.

const client = new Client(
  { name: 'roots-client', version: '1.0.0' },
  {
    capabilities: {
      roots: { listChanged: true },
    },
  },
);

// ─── roots/list request handler ───────────────────────────────────────────────
//
// This is the client handling a SERVER-INITIATED request — the reversed
// direction in MCP. When the server calls server.listRoots(), the SDK sends a
// "roots/list" JSON-RPC request to us. We must have this handler registered
// BEFORE connecting, otherwise the server's request arrives with no handler.
//
// The handler simply returns the current value of `roots`. Because it closes
// over the variable (not a snapshot), any mutation to `roots` is immediately
// visible to the next server query.

client.setRequestHandler(ListRootsRequestSchema, async () => ({
  roots,
}));

// ─── Transport ────────────────────────────────────────────────────────────────

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/server.ts'],
});

await client.connect(transport);

console.log('=== MCP Roots Demo ===\n');
console.log('Connected. Client has declared roots capability.\n');

// ─── Helper ───────────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<void> {
  const result = await client.callTool({ name, arguments: args }) as unknown as {
    isError?: boolean;
    content?: Array<{ type: string; text?: string }>;
  };
  const block = result.content?.[0];
  const text = block?.type === 'text' ? block.text : JSON.stringify(block);
  const prefix = result.isError ? '  [ERROR]' : '';
  console.log(prefix ? `${prefix} ${text}` : text);
  console.log();
}

// ─── Step 1: list tools ───────────────────────────────────────────────────────

const { tools } = await client.listTools();
console.log('Available tools:');
for (const tool of tools) {
  console.log(`  • ${tool.name}: ${tool.description}`);
}
console.log();

// ─── Step 2: get_workspace_roots ──────────────────────────────────────────────
//
// The server will call server.listRoots() → sends roots/list to us → our
// handler responds with the current `roots` array → server formats it as text.

console.log('--- get_workspace_roots (initial roots) ---');
await callTool('get_workspace_roots');

// ─── Step 3: find_in_roots ────────────────────────────────────────────────────

console.log('--- find_in_roots { pattern: "*.ts" } ---');
await callTool('find_in_roots', { pattern: '*.ts' });

// ─── Step 4: describe_workspace ──────────────────────────────────────────────

console.log('--- describe_workspace ---');
await callTool('describe_workspace');

// ─── Step 5: simulate roots change ───────────────────────────────────────────
//
// In a real IDE client this would happen when the user opens a new folder.
// We update the in-memory list and then notify the server that it changed.
// The server can listen for notifications/roots/list_changed and re-fetch.

console.log('--- Simulating workspace change: adding New Feature Branch ---');
roots.push({ uri: 'file:///Users/dev/new-feature', name: 'New Feature Branch' });

// Clients push root changes reactively using this notification. The server
// receives it and knows its cached roots (if any) are stale. Our server does
// not cache — it calls server.listRoots() fresh on each tool call — but
// sending the notification is correct protocol behaviour regardless.
await client.notification({ method: 'notifications/roots/list_changed', params: {} });
console.log('Sent notifications/roots/list_changed\n');

// ─── Step 6: get_workspace_roots after change ─────────────────────────────────
//
// The server calls server.listRoots() again. This time our handler returns
// four roots (the original three plus the new one).

console.log('--- get_workspace_roots (after change) ---');
await callTool('get_workspace_roots');

// ─── Close ────────────────────────────────────────────────────────────────────

await client.close();
console.log('Done. Child process terminated.');
