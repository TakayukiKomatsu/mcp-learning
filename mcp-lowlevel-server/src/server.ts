/**
 * MCP Low-Level Server — using the raw `Server` class
 *
 * WHAT IS THE LOW-LEVEL SERVER?
 * The MCP TypeScript SDK ships two server APIs:
 *
 *   1. McpServer  (high-level) — used in the other three projects.
 *      You call server.tool() or server.registerTool() and it handles
 *      JSON-RPC dispatch, schema validation, error wrapping, and capability
 *      advertisement automatically.
 *
 *   2. Server (low-level) — used here.
 *      You call server.setRequestHandler(SchemaType, handlerFn) to register
 *      handlers for individual JSON-RPC request types. You are responsible for
 *      returning exactly the right shape. There is no auto-validation, no
 *      automatic capability negotiation beyond what you explicitly declare.
 *
 * WHY LEARN THE LOW-LEVEL API?
 * - It shows you exactly what McpServer does under the hood.
 * - You need it if you want to handle MCP request types that McpServer
 *   doesn't expose (e.g. Resources, Prompts, Sampling) in a customized way.
 * - It gives you full control over the response shape and error codes.
 *
 * This server uses the stdio transport (same as project 1) so you can focus
 * on the Server API difference without any new transport concepts.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  // These are the JSON-RPC request schema types the SDK exports.
  // Each one matches a specific MCP method name (e.g. "tools/list", "tools/call").
  // You pass them to setRequestHandler() so the Server knows which incoming
  // message type to route to your handler.
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Tool Definitions ─────────────────────────────────────────────────────────
//
// With the low-level API there is no zod schema attached to tools at registration
// time — the tool list is just a plain JSON-serialisable object that gets sent
// verbatim to the client. You define the inputSchema as a JSON Schema object
// (the same format that zod's z.object().toJsonSchema() would produce).
//
// The benefit: you have full control over the schema shape.
// The cost: no runtime validation — you must validate arguments yourself.

const TOOLS = [
  {
    name: 'add',
    description: 'Add two numbers. Returns a + b.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        a: { type: 'number', description: 'First operand' },
        b: { type: 'number', description: 'Second operand' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers. Returns a × b.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        a: { type: 'number', description: 'First operand' },
        b: { type: 'number', description: 'Second operand' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'square_root',
    description: 'Compute the square root of a non-negative number.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        n: { type: 'number', description: 'A non-negative number' },
      },
      required: ['n'],
    },
  },
  {
    name: 'clamp',
    description: 'Clamp a value between min and max (inclusive).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        value: { type: 'number', description: 'The value to clamp' },
        min:   { type: 'number', description: 'Lower bound' },
        max:   { type: 'number', description: 'Upper bound' },
      },
      required: ['value', 'min', 'max'],
    },
  },
] as const;

// ─── Server Creation ──────────────────────────────────────────────────────────
//
// new Server(info, options) takes:
//   - info: { name, version } — identifies this server to clients
//   - options.capabilities — declares what this server can do.
//     You MUST list 'tools: {}' here if you want clients to call tools/list
//     and tools/call. Unlike McpServer, the low-level Server does not
//     infer capabilities from registered handlers.

const server = new Server(
  { name: 'lowlevel-math', version: '1.0.0' },
  {
    capabilities: {
      // Declaring tools capability tells clients: "this server supports the
      // tools/list and tools/call request methods."
      tools: {},
    },
  },
);

// ─── Handler: tools/list ──────────────────────────────────────────────────────
//
// setRequestHandler(Schema, handler) registers a handler for one JSON-RPC
// method. ListToolsRequestSchema matches incoming messages with method
// "tools/list". The handler must return { tools: ToolDefinition[] }.
//
// With McpServer, this handler is generated automatically from registered tools.
// Here we write it ourselves — so you can see exactly what McpServer does.

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Return the tool list as plain JSON. No magic — just an object that matches
  // the MCP tools/list response schema.
  return { tools: TOOLS };
});

// ─── Handler: tools/call ──────────────────────────────────────────────────────
//
// CallToolRequestSchema matches "tools/call" messages. The request has:
//   request.params.name    — which tool to call
//   request.params.arguments — the arguments object (unvalidated — your job!)
//
// The handler must return:
//   { content: Array<{ type: 'text', text: string } | ...>, isError?: boolean }
//
// Errors in MCP tools come in two flavours:
//   1. Tool-level errors: return { content: [...], isError: true }
//      The call "succeeded" at the protocol level but the tool reports failure.
//      The client receives a result, not an exception.
//   2. Protocol-level errors: throw an McpError (or let an exception bubble).
//      The client receives a JSON-RPC error response.
//
// For user-facing tool errors (bad args, domain errors) prefer option 1.
// For unrecoverable server errors prefer option 2.

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  // Helper: return a successful text result
  const ok = (text: string) => ({
    content: [{ type: 'text' as const, text }],
  });

  // Helper: return a tool-level error (protocol call succeeded, tool failed)
  const toolError = (message: string) => ({
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  });

  // Manual argument access — unlike McpServer/zod, we receive a plain object.
  // We must cast and validate ourselves.
  const a = (args as Record<string, unknown>);

  switch (name) {
    case 'add': {
      const x = Number(a['a']);
      const y = Number(a['b']);
      if (isNaN(x) || isNaN(y)) return toolError('Arguments a and b must be numbers.');
      return ok(`${x} + ${y} = ${x + y}`);
    }

    case 'multiply': {
      const x = Number(a['a']);
      const y = Number(a['b']);
      if (isNaN(x) || isNaN(y)) return toolError('Arguments a and b must be numbers.');
      return ok(`${x} × ${y} = ${x * y}`);
    }

    case 'square_root': {
      const n = Number(a['n']);
      if (isNaN(n)) return toolError('Argument n must be a number.');
      if (n < 0) return toolError(`Cannot take square root of negative number: ${n}`);
      return ok(`√${n} = ${Math.sqrt(n)}`);
    }

    case 'clamp': {
      const value = Number(a['value']);
      const min   = Number(a['min']);
      const max   = Number(a['max']);
      if (isNaN(value) || isNaN(min) || isNaN(max)) return toolError('Arguments value, min, max must be numbers.');
      if (min > max) return toolError(`min (${min}) must be ≤ max (${max}).`);
      const result = Math.min(Math.max(value, min), max);
      return ok(`clamp(${value}, ${min}, ${max}) = ${result}`);
    }

    default:
      // Unknown tool — return a tool-level error.
      // (Alternatively you could throw new McpError(ErrorCode.MethodNotFound, ...))
      return toolError(`Unknown tool: "${name}". Available: ${TOOLS.map((t) => t.name).join(', ')}`);
  }
});

// ─── Transport + Connect ──────────────────────────────────────────────────────
//
// The transport layer is exactly the same as in project 1 (stdio).
// This confirms that the low-level Server API is transport-agnostic —
// you can swap stdio for SSE or Streamable HTTP without changing any handler code.

const transport = new StdioServerTransport();

// server.connect() performs the capability negotiation handshake and then
// enters the JSON-RPC message loop, reading from stdin and writing to stdout.
await server.connect(transport);
