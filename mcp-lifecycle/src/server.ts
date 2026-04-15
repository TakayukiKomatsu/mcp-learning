/**
 * MCP Lifecycle Demo — Server
 *
 * This server uses the low-level `Server` class to make every phase of the
 * MCP connection lifecycle visible through explicit handler registration and
 * console logging.
 *
 * ── THE 6 LIFECYCLE PHASES ────────────────────────────────────────────────
 *
 * 1. initialize
 *    Client sends an "initialize" request containing its protocol version and
 *    capabilities. The server responds with its own version and capabilities.
 *    The SDK's Server class handles this automatically — you don't need to
 *    register a handler for it.
 *
 * 2. initialized
 *    After the server's initialize response, the client sends an
 *    "notifications/initialized" notification to confirm the handshake is
 *    complete. The session is now fully live. We catch this with
 *    setNotificationHandler(InitializedNotificationSchema, ...).
 *
 * 3. Normal operation
 *    Once initialized, the client can send tool calls, resource reads, etc.
 *    Here we expose a single tool: slow_operation(duration_ms).
 *
 * 4. ping
 *    Either side can send a "ping" request at any time to verify the other
 *    side is still alive. The response must be an empty object {}.
 *    We register a PingRequestSchema handler so the log shows when it fires.
 *
 * 5. cancellation
 *    The client can send a "notifications/cancelled" notification with the
 *    requestId of an in-flight request. The server should abort that work if
 *    possible. We log the cancelled requestId here; in production you would
 *    signal the running handler via an AbortController or similar mechanism.
 *
 * 6. close
 *    Either side closes the transport. The session ends. No special handler
 *    is needed — the process exits naturally when stdin closes.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  PingRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CancelledNotificationSchema,
  InitializedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';

const runningOperations = new Map<string | number, AbortController>();

function sleepWithAbort(duration: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, duration);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new Error('Operation aborted by cancellation notification'));
    };

    signal.addEventListener('abort', onAbort);
  });
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'slow_operation',
    description:
      'Simulates a slow operation. Sleeps for duration_ms (max 5000) then returns.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        duration_ms: {
          type: 'number',
          description: 'How long to sleep in milliseconds (max 5000)',
        },
      },
      required: ['duration_ms'],
    },
  },
] as const;

// ─── Server Creation ──────────────────────────────────────────────────────────
//
// new Server(info, options):
//   - info: { name, version } — sent to the client during initialize
//   - options.capabilities — what this server supports; must declare tools: {}
//     to allow tools/list and tools/call.
//
// The Server class handles the initialize request/response automatically.
// You observe post-init state via the InitializedNotificationSchema handler.

const server = new Server(
  { name: 'lifecycle-demo', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// ─── Phase 2: initialized notification ───────────────────────────────────────
//
// Triggered: immediately after the client receives the server's initialize
// response. The client sends "notifications/initialized" — no payload — to
// signal the handshake is complete and normal operation can begin.
//
// This is the earliest point at which you can safely assume the client is
// ready to receive tool list changes, log messages, etc.

server.setNotificationHandler(InitializedNotificationSchema, async () => {
  console.error('[server] Phase 2 — initialized notification received');
  console.error('[server]   Handshake complete. Session is now live.');
});

// ─── Phase 4: ping ────────────────────────────────────────────────────────────
//
// Triggered: when either side sends a "ping" request.
//
// Use case: heartbeat / health check. If the other side fails to respond to
// a ping within a timeout, the caller can treat the connection as dead and
// close/reconnect. The response MUST be an empty object {}.
//
// Either client or server may initiate a ping. Here we handle client → server
// pings (the client also handles server → client pings automatically).

server.setRequestHandler(PingRequestSchema, async () => {
  console.error('[server] Phase 4 — ping received, sending pong {}');
  return {};
});

// ─── Phase 3: tools/list ─────────────────────────────────────────────────────
//
// Triggered: when the client calls client.listTools().
// Returns the static tool manifest. The low-level API requires us to write
// this handler ourselves — McpServer generates it automatically.

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[server] Phase 3 — tools/list request received');
  return { tools: TOOLS };
});

// ─── Phase 3: tools/call ─────────────────────────────────────────────────────
//
// Triggered: when the client calls client.callTool(...).
//
// The slow_operation tool sleeps for up to 5000 ms. This makes it a realistic
// target for cancellation: the client can abort the call mid-sleep and the
// transport will drop the response even if the server finishes the sleep.
//
// This demo now does true cooperative cancellation: we store an AbortController
// per in-flight request ID, and the notifications/cancelled handler aborts the
// matching controller immediately.

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  if (name === 'slow_operation') {
    const raw = Number(a['duration_ms']);
    const duration = Math.min(isNaN(raw) ? 1000 : raw, 5000);
    const controller = new AbortController();
    runningOperations.set(extra.requestId, controller);
    console.error(`[server] Phase 3 — slow_operation starting (${duration} ms)`);
    try {
      await sleepWithAbort(duration, controller.signal);
      console.error(`[server] Phase 3 — slow_operation complete`);
      return {
        content: [{ type: 'text' as const, text: `Slept for ${duration} ms.` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[server] Phase 3 — slow_operation aborted`);
      return {
        content: [{ type: 'text' as const, text: message }],
        isError: true as const,
      };
    } finally {
      runningOperations.delete(extra.requestId);
    }
  }

  return {
    content: [{ type: 'text' as const, text: `Unknown tool: "${name}"` }],
    isError: true as const,
  };
});

// ─── Phase 5: cancellation ────────────────────────────────────────────────────
//
// Triggered: when the client sends "notifications/cancelled" with a requestId.
//
// Cancellation in MCP is a notification, not a request — the server does NOT
// send a response. The notification carries:
//   params.requestId — the id of the in-flight request to abort
//   params.reason    — optional human-readable reason
//
// The server should stop work for that requestId as soon as possible.
// In this demo we really do that by aborting the matching AbortController.

server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
  const { requestId, reason } = notification.params;
  console.error(`[server] Phase 5 — cancellation received`);
  console.error(`[server]   requestId: ${requestId}`);
  console.error(`[server]   reason:    ${reason ?? '(none)'}`);
  const controller =
    typeof requestId === 'string' || typeof requestId === 'number'
      ? runningOperations.get(requestId)
      : undefined;
  if (controller) {
    controller.abort();
    console.error(`[server]   Matching operation aborted.`);
  } else {
    console.error(`[server]   No active operation matched that requestId.`);
  }
});

// ─── Phase 6: transport + connect ────────────────────────────────────────────
//
// StdioServerTransport reads JSON-RPC messages from stdin and writes to stdout.
// server.connect() performs the initialize handshake and enters the message loop.
// Phase 6 (close) happens automatically when stdin closes — no handler needed.

const transport = new StdioServerTransport();
await server.connect(transport);
