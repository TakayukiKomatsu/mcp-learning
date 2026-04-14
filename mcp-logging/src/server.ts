/**
 * MCP Logging Server — stdio transport
 *
 * WHAT IS MCP LOGGING?
 * The MCP protocol has a built-in logging primitive that is entirely separate
 * from console.log. Instead of writing text to stderr/stdout, the server calls
 * server.sendLoggingMessage() which emits a `notifications/message` JSON-RPC
 * notification over the MCP transport itself.
 *
 * WHY THIS MATTERS:
 * When users run an MCP server inside a host application (e.g. Claude Desktop,
 * Cursor, VS Code), that host intercepts these log notifications and surfaces
 * them in its own UI — a log panel, a console tab, or a debug overlay. A plain
 * console.log written to stdout would either corrupt the JSON-RPC framing (on
 * stdio transport) or be silently discarded. MCP logging is the *correct* way
 * for a server to communicate diagnostic information to the host.
 *
 * The client controls which levels it receives via the `logging/setLevel` RPC,
 * so the server can emit verbose debug messages without flooding hosts that
 * only care about warnings and above.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  { name: "mcp-logging", version: "1.0.0" },
  // Declare the logging capability so the server handles logging/setLevel
  // requests from clients. Without this, the SDK rejects setLoggingLevel
  // calls with "Method not found" (-32601).
  { capabilities: { logging: {} } }
);

// ─── Tool: set_log_demo ───────────────────────────────────────────────────────
//
// Demonstrates all 8 RFC 5424 log severity levels supported by the MCP spec.
// Useful for seeing how a host renders each level's visual style.
server.tool(
  "set_log_demo",
  "Send one log message at each of the 8 MCP log severity levels",
  {},
  async () => {
    // server.sendLoggingMessage() emits a notifications/message JSON-RPC
    // notification. Parameters:
    //   level  — RFC 5424 severity string (see levels below)
    //   logger — optional string tag identifying the source component
    //   data   — arbitrary JSON value (string, object, array, etc.)
    //
    // RFC 5424 levels in descending severity order:
    //   emergency > alert > critical > error > warning > notice > info > debug
    //
    // The host filters to levels >= the level requested by the client via
    // logging/setLevel. So if the client requests 'warning', the server may
    // still call sendLoggingMessage at 'debug' level — the SDK will silently
    // drop those notifications before they reach the wire.

    await server.sendLoggingMessage({ level: "debug",     logger: "demo", data: "debug: lowest severity, verbose tracing" });
    await server.sendLoggingMessage({ level: "info",      logger: "demo", data: "info: general operational messages" });
    await server.sendLoggingMessage({ level: "notice",    logger: "demo", data: "notice: significant but normal events" });
    await server.sendLoggingMessage({ level: "warning",   logger: "demo", data: "warning: unexpected but recoverable" });
    await server.sendLoggingMessage({ level: "error",     logger: "demo", data: "error: operation failed" });
    await server.sendLoggingMessage({ level: "critical",  logger: "demo", data: "critical: component failure" });
    await server.sendLoggingMessage({ level: "alert",     logger: "demo", data: "alert: immediate action required" });
    await server.sendLoggingMessage({ level: "emergency", logger: "demo", data: "emergency: system is unusable" });

    return {
      content: [{ type: "text", text: "Sent 8 log messages at all severity levels" }],
    };
  }
);

// ─── Tool: process_batch ─────────────────────────────────────────────────────
//
// Demonstrates realistic in-progress logging: a server that streams diagnostic
// events while doing work, so the host can show live progress in its log UI.
// Also demonstrates error-level logs and how to correlate them with thrown
// errors that produce tool-level error responses.
server.tool(
  "process_batch",
  "Process a batch of items, emitting MCP log messages throughout",
  {
    count:   z.number().int().min(1).max(20).describe("Number of items to process"),
    fail_at: z.number().int().optional().describe("1-based item index at which to simulate a failure"),
  },
  async ({ count, fail_at }) => {
    try {
      for (let i = 1; i <= count; i++) {
        if (i === 1) {
          // First item gets an explicit 'starting' marker so the observer can
          // see when the batch actually begins (useful for latency measurement).
          await server.sendLoggingMessage({
            level: "debug",
            logger: "processor",
            data: { item: i, status: "starting" },
          });
        } else if (i === fail_at) {
          // Simulate a failure: emit an error-level log *before* throwing so
          // the host log UI shows the error context alongside the tool error.
          await server.sendLoggingMessage({
            level: "error",
            logger: "processor",
            data: { item: i, error: "Simulated failure" },
          });
          throw new Error(`Simulated failure at item ${i}`);
        } else if (i % 5 === 0) {
          // Every 5th item: emit an info-level checkpoint so the host can show
          // coarse-grained progress even when the client filters out debug logs.
          await server.sendLoggingMessage({
            level: "info",
            logger: "processor",
            data: { item: i, progress: "checkpoint" },
          });
        } else {
          await server.sendLoggingMessage({
            level: "debug",
            logger: "processor",
            data: { item: i, status: "done" },
          });
        }
      }

      // Final summary at info level — always visible regardless of client filter.
      await server.sendLoggingMessage({
        level: "info",
        logger: "processor",
        data: { total: count, status: "completed" },
      });

      return {
        content: [{ type: "text", text: `Processed ${count} items successfully` }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Failed at item ${fail_at}: ${msg}` }],
      };
    }
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
