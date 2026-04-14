/**
 * MCP Lifecycle Demo — Client
 *
 * This client walks through every phase of the MCP connection lifecycle,
 * printing what happens at each step so the protocol sequence is visible.
 *
 * ── THE 6 LIFECYCLE PHASES ────────────────────────────────────────────────
 *
 * 1. initialize
 *    Triggered automatically by client.connect(). The client sends an
 *    "initialize" request with its protocol version and capabilities.
 *    The server responds with its version and capabilities.
 *
 * 2. initialized
 *    Immediately after receiving the server's initialize response, the client
 *    sends a "notifications/initialized" notification. The server logs this.
 *    After this point the session is fully live.
 *
 * 3. Normal operation
 *    Tool calls, resource reads, etc. We list tools and call slow_operation.
 *
 * 4. ping
 *    client.ping() sends a "ping" request to the server. The server must reply
 *    with {}. Useful as a health check or keep-alive probe.
 *
 * 5. cancellation
 *    We start a 3000 ms tool call, then abort it after 500 ms via an
 *    AbortController. The SDK sends "notifications/cancelled" to the server
 *    and rejects the callTool promise with an abort error on the client side.
 *
 * 6. close
 *    client.close() shuts down the transport. The child server process exits.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ─── Transport ────────────────────────────────────────────────────────────────

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/server.ts'],
});

const client = new Client({ name: 'lifecycle-demo-client', version: '1.0.0' });

// ─── Phase 1 + 2: connect (initialize + initialized) ─────────────────────────
//
// client.connect() does three things internally:
//   1. Spawns the server child process (stdio transport).
//   2. Sends the "initialize" JSON-RPC request with protocol version and
//      client capabilities. Waits for the server's response.
//   3. Sends "notifications/initialized" to confirm the handshake.
//
// By the time connect() resolves, both sides have agreed on capabilities and
// the session is fully established.

console.log('=== MCP Connection Lifecycle Demo ===\n');
console.log('[client] Phase 1+2 — connecting (triggers initialize + initialized)...');
await client.connect(transport);
console.log('[client] Connected.\n');

// Inspect what the server advertised during the initialize handshake.
const serverVersion = client.getServerVersion();
const serverCaps    = client.getServerCapabilities();
console.log('[client] Server info from initialize response:');
console.log(`  name:         ${serverVersion?.name}`);
console.log(`  version:      ${serverVersion?.version}`);
console.log(`  capabilities: ${JSON.stringify(serverCaps)}`);
console.log();

// ─── Phase 4: ping ────────────────────────────────────────────────────────────
//
// Send a ping to verify the server is alive. Use cases:
//   - Health check before a critical operation
//   - Keep-alive on long-idle connections (some transports time out)
//   - Verifying the connection survived a cancellation (shown below)
//
// The server must respond with {} within the SDK's default timeout.

console.log('[client] Phase 4 — sending ping...');
await client.ping();
console.log('[client] Ping OK (server responded with {})\n');

// ─── Phase 3: list tools ─────────────────────────────────────────────────────

console.log('[client] Phase 3 — listing tools...');
const { tools } = await client.listTools();
for (const tool of tools) {
  console.log(`  tool: ${tool.name} — ${tool.description}`);
}
console.log();

// ─── Phase 5: cancellation demo ──────────────────────────────────────────────
//
// AbortController integration with MCP:
//   - Pass an AbortSignal via the third argument to callTool().
//   - When controller.abort() is called, the SDK immediately:
//       a) Sends "notifications/cancelled" to the server with the requestId
//          and reason "Request aborted".
//       b) Rejects the callTool promise with an AbortError on the client side.
//   - The server receives the cancellation notification and should stop work.
//     (The server logs it; see server.ts Phase 5 handler.)
//
// The JSON-RPC notification sent over the wire looks like:
//   { "jsonrpc": "2.0", "method": "notifications/cancelled",
//     "params": { "requestId": "...", "reason": "Request aborted" } }

console.log('[client] Phase 5 — starting slow_operation (3000 ms), will cancel after 500 ms...');
const controller = new AbortController();

const callPromise = client.callTool(
  { name: 'slow_operation', arguments: { duration_ms: 3000 } },
  undefined,
  { signal: controller.signal },
);

await new Promise<void>((r) => setTimeout(r, 500));
controller.abort();
console.log('[client]   abort() called — SDK sends notifications/cancelled to server');

try {
  await callPromise;
} catch (e) {
  console.log('[client]   Tool call cancelled (expected):', (e as Error).message);
}
console.log();

// ─── Phase 3 (continued): normal call after cancellation ─────────────────────
//
// A cancellation does not tear down the session. The connection remains open
// and healthy. We verify this by doing a normal 500 ms tool call. If this
// succeeds, the lifecycle demo is complete.

console.log('[client] Phase 3 (post-cancel) — verifying session still healthy...');
const result = await client.callTool(
  { name: 'slow_operation', arguments: { duration_ms: 500 } },
) as unknown as { content?: Array<{ type: string; text?: string }> };
const text = result.content?.[0]?.text ?? '(no text)';
console.log(`[client]   Result: ${text}`);
console.log('[client]   Session is still healthy after cancellation.\n');

// ─── Phase 6: close ──────────────────────────────────────────────────────────
//
// client.close() sends EOF on the transport stdin, causing the server child
// process to exit. The MCP session ends cleanly.

console.log('[client] Phase 6 — closing connection...');
await client.close();
console.log('[client] Done. Lifecycle complete.\n');
console.log('Phases demonstrated: initialize → initialized → ping → list/call → cancel → close');
