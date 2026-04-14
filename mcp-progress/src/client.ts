/**
 * MCP Progress Notifications Client
 *
 * THE OPT-IN PROGRESS PATTERN
 *
 * MCP progress notifications are a push-based, opt-in mechanism:
 *
 *   OPT-IN:  The client signals it wants progress by providing an `onprogress`
 *            callback in `RequestOptions`. The SDK automatically generates a
 *            `progressToken` (the numeric request message ID) and injects it
 *            into the request's `_meta` field before sending:
 *
 *              { _meta: { progressToken: <messageId> } }
 *
 *            The server reads `request.params._meta?.progressToken` and echoes
 *            it back in every `notifications/progress` message it sends.
 *
 *   PUSH:    Once opted in, the server drives the timing. The client does not
 *            poll — it simply registers a handler and receives updates whenever
 *            the server sends them. Two registration styles exist:
 *
 *              1. onprogress in RequestOptions — per-call callback, only fires
 *                 for that specific call's progress notifications. Preferred.
 *
 *              2. setNotificationHandler(ProgressNotificationSchema, handler) —
 *                 global handler that fires for ALL progress notifications from
 *                 the server, regardless of which call generated them. Useful
 *                 when you want one display layer for all concurrent calls.
 *
 *   SILENT:  If the client omits `onprogress`, no progressToken is sent and the
 *            server silently skips notifications. The call still completes and
 *            returns its final result — just without intermediate updates.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ProgressNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

// ─── Transport + Client ───────────────────────────────────────────────────────

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/server.ts'],
});

const client = new Client({ name: 'progress-client', version: '1.0.0' });

await client.connect(transport);

console.log('=== MCP Progress Notifications Demo ===\n');

// ─── Global Progress Notification Handler ─────────────────────────────────────
//
// PUSH-BASED: The server drives timing. This handler fires for every
// `notifications/progress` message the server sends, for any tool call.
//
// We use process.stdout.write with \r (carriage return without newline) to
// overwrite the current terminal line in-place, giving a live progress-bar feel.
// After each tool call we print a newline to advance past the last update line.
//
// Note: when you also pass `onprogress` in RequestOptions, the SDK routes
// that call's progress to the onprogress callback FIRST, then this handler
// also fires. They are not mutually exclusive.

client.setNotificationHandler(ProgressNotificationSchema, (notification) => {
  const { progress, total, message } = notification.params;
  const pct = total ? Math.round((progress / total) * 100) : '?';
  process.stdout.write(`\r  Progress: ${pct}% — ${message ?? ''}`);
  return Promise.resolve();
});

// ─── Demo 1: convert_files WITHOUT requesting progress ───────────────────────
//
// DEMONSTRATING THE OPT-OUT PATH: When the client omits `onprogress`, the SDK
// sends no progressToken in `_meta`. The server sees `progressToken === undefined`
// and skips all notifications. The call still completes normally — progress is
// simply not streamed. This is correct behavior for automated callers, tests, or
// any context where a progress UI is not needed.

console.log('--- convert_files (count=5, no progress requested) ---');
console.log('  Expect: no progress output — server silently skips notifications.\n');

const resultNoToken = await client.callTool({
  name: 'convert_files',
  arguments: { count: 5 },
});

const noTokenText = (resultNoToken.content as Array<{ type: string; text?: string }>)[0]?.text;
console.log(`  Result: ${noTokenText}\n`);

// ─── Demo 2: convert_files WITH progress requested ────────────────────────────
//
// OPTING IN VIA onprogress: Providing the `onprogress` callback in RequestOptions
// causes the SDK to automatically inject `_meta: { progressToken: <messageId> }`
// into the outgoing request. The server reads this token, echoes it back in each
// notification, and the SDK routes those notifications to this callback.
//
// The `progressToken` value is the numeric JSON-RPC message ID — the SDK manages
// it transparently so you never have to pick or track tokens manually.
//
// resetTimeoutOnProgress: true prevents the default request timeout from firing
// during a long-running tool that is actively sending progress updates.

console.log('--- convert_files (count=10, WITH progress requested) ---');

await client.callTool(
  { name: 'convert_files', arguments: { count: 10 } },
  undefined,
  {
    // The onprogress callback triggers the SDK to send progressToken in _meta.
    // This is the correct way to opt in to progress for a specific call.
    onprogress: () => {
      // The global setNotificationHandler above handles display.
      // onprogress here serves as the opt-in signal; you could also use
      // it for per-call logic (e.g. updating a specific UI component).
    },
    resetTimeoutOnProgress: true,
  },
);

// Advance past the last \r-overwritten progress line.
console.log('\n  Done.\n');

// ─── Demo 3: analyze_data WITH progress requested ─────────────────────────────
//
// This tool processes 50 rows but emits a notification every 10 rows,
// demonstrating that the server controls notification frequency. The client
// receives exactly 5 updates (rows 10, 20, 30, 40, 50) — the SDK just
// delivers whatever the server sends.

console.log('--- analyze_data (rows=50, WITH progress requested) ---');

await client.callTool(
  { name: 'analyze_data', arguments: { rows: 50 } },
  undefined,
  {
    onprogress: () => {
      // opt-in signal; display handled by global setNotificationHandler
    },
    resetTimeoutOnProgress: true,
  },
);

console.log('\n  Done.\n');

// ─── Close ────────────────────────────────────────────────────────────────────

await client.close();
console.log('Connection closed.');
