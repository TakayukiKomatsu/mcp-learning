// =============================================================================
// MCP Todo Server — Streamable HTTP Transport
// =============================================================================
//
// STREAMABLE HTTP TRANSPORT OVERVIEW
// -----------------------------------
// Streamable HTTP is the MODERN, RECOMMENDED MCP transport (as of 2024). It
// replaces SSE and offers a dramatically simpler design:
//
//   Single endpoint:  POST /mcp
//
//   Compare to SSE which needed TWO endpoints:
//     GET  /sse      — open persistent stream
//     POST /message  — send requests
//
// HOW IT DIFFERS FROM SSE
// -----------------------
// 1. SINGLE ENDPOINT
//    Streamable HTTP collapses everything into one POST endpoint. The same
//    request carries the JSON-RPC payload AND can optionally receive a
//    streaming SSE response back — or a simple JSON response. The server
//    decides which mode to use based on what the client's Accept header says.
//
// 2. STATELESS BY DEFAULT
//    Each POST /mcp request is fully self-contained. No prior connection
//    needed, no session state required on the server. This is the default
//    "stateless" mode used here, enabled by passing `sessionIdGenerator: undefined`.
//
//    Contrast with SSE: the SSE stream had to stay open, so every POST
//    /message had to land on the SAME server instance that held the stream.
//    Standard load balancers break that assumption. Streamable HTTP has no
//    such constraint — any instance can handle any request.
//
// 3. LOAD-BALANCER FRIENDLY
//    Because there's no persistent per-client state, you can deploy multiple
//    server instances behind a round-robin load balancer and requests will
//    be routed freely. Horizontal scaling works out of the box.
//
// 4. STATEFUL MODE IS OPTIONAL
//    If you DO need session state (e.g., subscriptions, multi-turn context),
//    you can pass a `sessionIdGenerator: () => randomUUID()` and manage a
//    session store yourself. That's an advanced pattern — this project uses
//    stateless mode (`sessionIdGenerator: undefined`) to show the simplest
//    possible working example.
//
// WHY IT'S THE RECOMMENDED TRANSPORT
// ------------------------------------
// - Simpler: one endpoint instead of two
// - Scales horizontally without sticky sessions
// - Works through standard HTTP infrastructure (proxies, CDNs, load balancers)
// - Can still stream responses via SSE when needed (hence "Streamable HTTP")
//
// =============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// createMcpExpressApp() returns a pre-configured Express app that:
//   1. Calls express.json() so req.body is populated — required for handleRequest()
//   2. Adds DNS rebinding protection middleware (host header validation) for
//      localhost servers, protecting against DNS rebinding attacks.
// This is the SDK-recommended way to create an Express app for MCP servers.
const app = createMcpExpressApp();

// =============================================================================
// TODO STORE
// =============================================================================
//
// The store lives at MODULE LEVEL — outside of any request handler, transport,
// or McpServer instance. This is crucial for stateless mode:
//
// - Each POST /mcp request creates a NEW StreamableHTTPServerTransport and a
//   NEW McpServer. These are ephemeral — they're created, used, and discarded
//   for every single request.
//
// - If the todos Map lived inside the request handler, it would be re-created
//   empty on every request and no data would ever persist.
//
// - By living at module level, the Map persists for the entire lifetime of the
//   Node.js process. All requests share the same in-memory store regardless of
//   how many transports or servers are created.
//
// In a production system you'd replace this with a database. But the
// architectural point is the same: persistence must live outside the
// per-request transport/server lifecycle.

interface Todo {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  done: boolean;
  createdAt: string;
}

const todos = new Map<string, Todo>();

// =============================================================================
// TOOL REGISTRATION
// =============================================================================
//
// IMPORTANT: In stateless mode, a brand-new McpServer is created for each
// incoming request. That means tools must be registered EVERY TIME. There is
// no "global" server that holds tool definitions across requests — each request
// bootstraps a fresh server and registers the full tool set from scratch.
//
// This is different from SSE mode, where a single McpServer is created once
// per client connection and tools are registered once at startup. In SSE,
// the server instance lives as long as the connection. In stateless Streamable
// HTTP, the server instance is request-scoped.
//
// The practical cost is negligible (registration is cheap), and the benefit is
// that there's no global state to manage, clean up, or worry about leaking.

function registerTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // TOOL RESPONSE FORMAT NOTE
  // ---------------------------------------------------------------------------
  // MCP tool responses return `{ content: ContentBlock[] }` where ContentBlock
  // is an array rather than a single value. This design supports:
  //
  //   1. MULTIPLE CONTENT BLOCKS: A single tool call can return a mix of text,
  //      images, or embedded resources (e.g., a chart + a caption).
  //
  //   2. STREAMING (advanced): In streaming mode, the server can push content
  //      blocks progressively — the client receives each block as it arrives
  //      over the SSE stream, rather than waiting for the full response.
  //      This is the "Streamable" in Streamable HTTP.
  //
  // For this project all tools return a single `{ type: 'text', text: string }`
  // block, which is the simplest valid content shape.

  // ---------------------------------------------------------------------------
  // create_todo
  // ---------------------------------------------------------------------------
  server.tool(
    'create_todo',
    'Create a new todo item',
    {
      title: z.string().describe('The todo title'),
      priority: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .describe('Priority level — defaults to medium'),
    },
    async ({ title, priority = 'medium' }) => {
      const id = randomUUID();
      const todo: Todo = {
        id,
        title,
        priority,
        done: false,
        createdAt: new Date().toISOString(),
      };
      todos.set(id, todo);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Created todo ${id}: ${title} (priority: ${priority})`,
          },
        ],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // list_todos
  // ---------------------------------------------------------------------------
  server.tool(
    'list_todos',
    'List todos, optionally filtered by status',
    {
      filter: z
        .enum(['all', 'done', 'pending'])
        .optional()
        .describe('Filter: all (default), done, or pending'),
    },
    async ({ filter = 'all' }) => {
      let items = Array.from(todos.values());

      if (filter === 'done') {
        items = items.filter((t) => t.done);
      } else if (filter === 'pending') {
        items = items.filter((t) => !t.done);
      }

      if (items.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No todos found.' }] };
      }

      const lines = items.map(
        (t, i) =>
          `${i + 1}. [${t.priority}] ${t.title} — ${t.done ? '✓ done' : '○ pending'} (id: ${t.id})`
      );

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  // ---------------------------------------------------------------------------
  // complete_todo
  // ---------------------------------------------------------------------------
  server.tool(
    'complete_todo',
    'Mark a todo as done',
    {
      id: z.string().describe('The todo ID to mark as complete'),
    },
    async ({ id }) => {
      const todo = todos.get(id);
      if (!todo) {
        throw new Error(`Todo not found: ${id}`);
      }
      todo.done = true;
      todos.set(id, todo);
      return {
        content: [{ type: 'text' as const, text: `Marked '${todo.title}' as done.` }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // delete_todo
  // ---------------------------------------------------------------------------
  server.tool(
    'delete_todo',
    'Delete a todo by ID',
    {
      id: z.string().describe('The todo ID to delete'),
    },
    async ({ id }) => {
      const todo = todos.get(id);
      if (!todo) {
        throw new Error(`Todo not found: ${id}`);
      }
      todos.delete(id);
      return {
        content: [{ type: 'text' as const, text: `Deleted '${todo.title}'.` }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // clear_all
  // ---------------------------------------------------------------------------
  server.tool(
    'clear_all',
    'Delete all todos',
    {},
    async () => {
      const count = todos.size;
      todos.clear();
      return {
        content: [{ type: 'text' as const, text: `Cleared ${count} todos.` }],
      };
    }
  );
}

// =============================================================================
// REQUEST HANDLER
// =============================================================================

app.post('/mcp', async (req, res) => {
  // ---------------------------------------------------------------------------
  // StreamableHTTPServerTransport — stateless mode
  // ---------------------------------------------------------------------------
  // `sessionIdGenerator: undefined` is what activates STATELESS mode. This is
  // the key difference from stateful mode:
  //
  //   STATELESS (sessionIdGenerator: undefined):
  //     - No session ID is included in response headers
  //     - No session validation is performed
  //     - Each request is fully independent — any server instance can handle it
  //     - Perfect for load-balanced deployments
  //
  //   STATEFUL (sessionIdGenerator: () => randomUUID()):
  //     - A session ID is generated and sent back in the Mcp-Session-Id header
  //     - Subsequent requests from the same client include that header
  //     - The server looks up and reuses the transport for that session
  //     - Enables subscriptions, streaming notifications, multi-turn context
  //     - Requires sticky sessions or a shared session store if load-balanced
  //
  // This project uses stateless mode because it's the simplest correct pattern
  // and works out of the box without any session management infrastructure.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  // Create a fresh McpServer for this request and register all tools.
  // See the TOOL REGISTRATION section above for why this happens per-request.
  const server = new McpServer({ name: 'todo-server', version: '1.0.0' });
  registerTools(server);

  // Clean up both the transport and server when the HTTP response closes.
  // This ensures no resources are leaked, even if the client disconnects early.
  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    // ---------------------------------------------------------------------------
    // server.connect(transport)
    // ---------------------------------------------------------------------------
    // "Connecting" a server to a transport does two things:
    //
    //   1. WIRES THE PLUMBING: The server registers message listeners on the
    //      transport. From this point, any JSON-RPC message that arrives through
    //      the transport will be dispatched to the server's request handlers.
    //
    //   2. CAPABILITY NEGOTIATION SETUP: The MCP protocol begins with an
    //      `initialize` handshake where the client announces its capabilities
    //      and the server responds with its own (available tools, resources,
    //      prompts, etc.). connect() sets up the server to handle that handshake.
    //
    // In stateless Streamable HTTP the full initialize→request→response cycle
    // happens within a single POST request, so connect() and handleRequest()
    // together do what in SSE required a persistent stream.
    await server.connect(transport);

    // ---------------------------------------------------------------------------
    // transport.handleRequest(req, res, req.body)
    // ---------------------------------------------------------------------------
    // This is where the actual work happens. handleRequest():
    //
    //   1. Reads the JSON-RPC message from req.body (already parsed by the
    //      express.json() middleware added by createMcpExpressApp()).
    //
    //   2. Dispatches the message to the McpServer (which runs the matching
    //      tool handler, resource handler, etc.).
    //
    //   3. Writes the JSON-RPC response back to `res`. For simple request/
    //      response pairs this is a plain JSON response. If the client sent
    //      an Accept: text/event-stream header, the SDK upgrades to SSE
    //      streaming for this response — that's the "Streamable" part of the
    //      transport name.
    //
    //   4. Closes/finalizes the response when done.
    //
    // After this call returns, the request is complete. The transport and server
    // instances are cleaned up via the res.on('close') handler above.
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(3002, () => {
  console.log('MCP Streamable HTTP Todo Server running on http://localhost:3002');
  console.log('  Endpoint: POST http://localhost:3002/mcp');
  console.log('  (No SSE connection needed — each request is independent)');
});
