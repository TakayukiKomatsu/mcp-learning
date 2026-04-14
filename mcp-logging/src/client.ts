/**
 * MCP Logging Client — stdio transport demo
 *
 * CLIENT-SIDE LOGGING: HOW IT WORKS
 * MCP log messages travel as JSON-RPC *notifications* — one-way pushes from
 * the server that require no response. The client registers a notification
 * handler for the `notifications/message` method, and the SDK calls that
 * handler automatically whenever the server emits a log message.
 *
 * FILTERING WITH setLoggingLevel:
 * The client can call client.setLoggingLevel({ level }) to tell the server
 * which minimum severity it cares about. The SDK uses RFC 5424 ordering:
 *   emergency > alert > critical > error > warning > notice > info > debug
 * After calling setLoggingLevel('info'), the server will suppress debug and
 * below — so only info, notice, warning, error, critical, alert, emergency
 * notifications are delivered. This lets a verbose server stay quiet when the
 * host only wants actionable messages.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

// ─── Transport & Client ───────────────────────────────────────────────────────

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/server.ts"],
});

const client = new Client({
  name: "mcp-logging-client",
  version: "1.0.0",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printSection(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

async function callTool(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  if (result.content && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === "text") {
        console.log(`  => ${block.text}`);
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

await client.connect(transport);

// Push-based notification handler: the server does NOT wait for a request —
// it fires notifications/message at any time while a tool is executing.
// setNotificationHandler registers a callback that the SDK invokes on each
// matching notification. The handler runs synchronously in the message loop,
// so it must not block. Here we just format and print to stdout.
client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
  const { level, logger, data } = notification.params;
  console.log(`  [${level.toUpperCase()}] ${logger ?? "server"}: ${JSON.stringify(data)}`);
});

// ─── Step 1: Show all 8 log levels ───────────────────────────────────────────

printSection("Step 1: setLoggingLevel('debug') — receive ALL log levels");

// setLoggingLevel(level) sends a logging/setLevel request to the server,
// telling it the minimum severity we want to receive. 'debug' is the lowest
// level, so this requests every log message the server emits. Without calling
// setLoggingLevel, many servers default to 'warning' or 'info', silently
// dropping debug-level messages.
await client.setLoggingLevel("debug");
console.log("  Requested level: debug (all messages)");

await callTool("set_log_demo", {});

// ─── Step 2: Filter to info+ then run a batch ─────────────────────────────────

printSection("Step 2: setLoggingLevel('info') — only info and above");

// Raising the level to 'info' via setLoggingLevel("info") filters out debug
// messages. The process_batch tool sends 'debug' for most items and 'info'
// for every 5th — so with this filter we only see the checkpoints and the
// final summary, not per-item noise.
await client.setLoggingLevel("info");
console.log("  Requested level: info (debug messages suppressed)");
console.log("  Calling process_batch(count=8) — expect checkpoints at item 5 + final summary:");

await callTool("process_batch", { count: 8 });

// ─── Step 3: Error log from a failing batch ────────────────────────────────────

printSection("Step 3: process_batch with fail_at=3 — error log should appear");

console.log("  Calling process_batch(count=5, fail_at=3) — expect error log at item 3:");
await callTool("process_batch", { count: 5, fail_at: 3 });

// ─── Done ─────────────────────────────────────────────────────────────────────

printSection("Done");
console.log("  MCP logging demo complete.");

await client.close();
