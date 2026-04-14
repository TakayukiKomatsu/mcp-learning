/**
 * MCP Progress Notifications Server
 *
 * WHAT ARE PROGRESS NOTIFICATIONS?
 * Progress notifications are a mechanism for a server to stream incremental
 * status updates to the client during a long-running tool call. Instead of the
 * client waiting silently until the tool returns, the server sends
 * `notifications/progress` messages at any point during execution.
 *
 * WHEN TO USE THEM?
 * Use progress notifications for tools that:
 *   - Process many items in a loop (file conversions, row analysis, etc.)
 *   - Have meaningful intermediate milestones to communicate
 *   - May take more than a couple of seconds — where a progress bar helps UX
 *
 * THE PROGRESSTOKEN CONTRACT
 * Progress is opt-in per request. The client signals it wants updates by
 * including a `progressToken` in the request's `_meta` field:
 *
 *   { _meta: { progressToken: 'some-unique-token' } }
 *
 * The server MUST check that a token was provided before sending any progress
 * notifications. If the client did not supply a token, it cannot receive
 * progress — sending would be a protocol violation and the messages would be
 * silently dropped or cause errors.
 *
 * This server uses the low-level `Server` class (not `McpServer`) so we can
 * call `extra.sendNotification()` directly from within the request handler,
 * which is the correct transport-aware way to associate the notification with
 * the in-flight request.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Server Creation ──────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mcp-progress', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'convert_files',
    description: 'Simulates converting N files, streaming progress as each file is processed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        count: {
          type: 'integer',
          description: 'Number of files to convert (1-20)',
          minimum: 1,
          maximum: 20,
        },
      },
      required: ['count'],
    },
  },
  {
    name: 'analyze_data',
    description: 'Simulates analyzing N rows of data, emitting progress every 10 rows.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rows: {
          type: 'integer',
          description: 'Number of data rows to analyze (1-200)',
          minimum: 1,
          maximum: 200,
        },
      },
      required: ['rows'],
    },
  },
] as const;

// ─── Handler: tools/list ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// ─── Handler: tools/call ──────────────────────────────────────────────────────
//
// HOW TO READ THE progressToken FROM THE REQUEST
//
// When the client sends a `tools/call` request with progress opted in, the
// JSON-RPC message looks like:
//
//   {
//     "method": "tools/call",
//     "params": {
//       "name": "convert_files",
//       "arguments": { "count": 10 },
//       "_meta": { "progressToken": "job-1" }
//     }
//   }
//
// The SDK parses this into `request.params._meta?.progressToken`.
// The token can be a string or a number — both are valid per the MCP spec.
// If the client did not include `_meta` or did not include `progressToken`,
// the value is `undefined`.

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args = {}, _meta } = request.params;

  // HOW TO CHECK WHETHER PROGRESS IS REQUESTED
  //
  // We must check for `undefined` specifically (not falsy) because `0` is a
  // valid progressToken value. A missing token means the client is not
  // listening for progress — sending would be wasteful and potentially
  // protocol-incorrect. Only send progress when explicitly opted in.
  const progressToken = _meta?.progressToken;

  const a = args as Record<string, unknown>;

  switch (name) {
    case 'convert_files': {
      const count = Number(a['count']);
      if (!Number.isInteger(count) || count < 1 || count > 20) {
        return {
          content: [{ type: 'text' as const, text: 'count must be an integer between 1 and 20.' }],
          isError: true as const,
        };
      }

      for (let i = 1; i <= count; i++) {
        // THE PROGRESS NOTIFICATION SHAPE
        //
        // `notifications/progress` carries four fields in `params`:
        //   - progressToken: echoes back the token from the original request,
        //     so the client can correlate this update to the right call.
        //   - progress: current step (e.g. 3 files done).
        //   - total: optional total steps; lets the client compute a percentage.
        //   - message: optional human-readable status string for display.
        //
        // WHY progressToken !== undefined?
        // Without this guard, we would send notifications even when the client
        // did not request them — it has no handler registered and the messages
        // would either be silently ignored or cause a protocol error depending
        // on the client implementation. This check enforces the opt-in contract.
        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken,
              progress: i,
              total: count,
              message: `Converting file ${i}/${count}`,
            },
          });
        }

        // Simulate real work: 50 ms per file.
        await new Promise<void>((r) => setTimeout(r, 50));
      }

      return {
        content: [{ type: 'text' as const, text: `Converted ${count} file(s) successfully.` }],
      };
    }

    case 'analyze_data': {
      const rows = Number(a['rows']);
      if (!Number.isInteger(rows) || rows < 1 || rows > 200) {
        return {
          content: [{ type: 'text' as const, text: 'rows must be an integer between 1 and 200.' }],
          isError: true as const,
        };
      }

      for (let i = 1; i <= rows; i++) {
        // Emit progress every 10 rows (and on the final row) to avoid
        // flooding the client with one notification per row for large datasets.
        if (progressToken !== undefined && (i % 10 === 0 || i === rows)) {
          await extra.sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken,
              progress: i,
              total: rows,
              message: `Analyzed ${i}/${rows} rows`,
            },
          });
        }

        // Simulate real per-row work: 20 ms per row.
        await new Promise<void>((r) => setTimeout(r, 20));
      }

      return {
        content: [{ type: 'text' as const, text: `Analyzed ${rows} row(s) successfully.` }],
      };
    }

    default:
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: "${name}".` }],
        isError: true as const,
      };
  }
});

// ─── Transport + Connect ──────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
