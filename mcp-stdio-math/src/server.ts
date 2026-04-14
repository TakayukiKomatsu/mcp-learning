/**
 * MCP Calculator Server — stdio transport
 *
 * WHAT IS STDIO TRANSPORT?
 * The stdio transport is the simplest MCP transport. Instead of opening a
 * network socket, the server simply reads JSON-RPC messages from process.stdin
 * and writes responses to process.stdout. The client is responsible for
 * spawning this process as a child and piping its own streams to it.
 *
 * WHEN TO USE STDIO:
 * - Local tools (CLI helpers, IDE plugins, desktop apps)
 * - When you don't need multiple concurrent clients
 * - When you want zero infrastructure (no ports, no auth, no TLS)
 * - The model: one client ↔ one server process, tight coupling is fine
 *
 * For comparison, the SSE transport (project 2) and Streamable HTTP transport
 * (project 3) allow multiple clients to share a single long-running server process.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Server Creation ──────────────────────────────────────────────────────────
//
// McpServer is the high-level abstraction from the MCP SDK. It handles:
//   - The JSON-RPC message loop
//   - Protocol handshake (capability negotiation)
//   - Tool registration and dispatch
//   - Error formatting according to the MCP spec
//
// The lower-level `Server` class (also exported by the SDK) gives you raw
// access to the request/response lifecycle, but McpServer is what you want
// for 99% of use cases — it removes all the boilerplate.
const server = new McpServer({
  name: "mcp-stdio-math",
  version: "1.0.0",
});

// ─── Tool Response Format ─────────────────────────────────────────────────────
//
// Every tool must return: { content: Array<ContentBlock> }
//
// WHY AN ARRAY?
// MCP tools can return multi-modal content — a single response could contain
// text, images, or embedded resources. The array allows a tool to return,
// for example, a chart image AND a text summary together.
//
// CONTENT TYPES AVAILABLE:
//   { type: 'text',     text: string }          — plain text
//   { type: 'image',    data: string, mimeType } — base64-encoded image
//   { type: 'resource', resource: { uri, ... } } — embedded MCP resource
//
// For a calculator, plain text is always sufficient.

// ─── Tools ───────────────────────────────────────────────────────────────────
//
// NOTE ON API: This project uses `server.registerTool(name, { description, inputSchema }, handler)`.
// Projects 2 & 3 use the shorthand `server.tool(name, description, zodShape, handler)`.
// Both are valid — `tool()` is syntactic sugar added in later SDK versions.
// The underlying behaviour is identical.

// Add two numbers
server.registerTool(
  "add",
  {
    description: "Add two numbers together. Returns a + b.",
    inputSchema: z.object({
      a: z.number().describe("The first operand"),
      b: z.number().describe("The second operand"),
    }),
  },
  async ({ a, b }) => ({
    content: [{ type: "text" as const, text: `${a} + ${b} = ${a + b}` }],
  })
);

// Subtract b from a
server.registerTool(
  "subtract",
  {
    description: "Subtract b from a. Returns a - b.",
    inputSchema: z.object({
      a: z.number().describe("The number to subtract from"),
      b: z.number().describe("The number to subtract"),
    }),
  },
  async ({ a, b }) => ({
    content: [{ type: "text" as const, text: `${a} - ${b} = ${a - b}` }],
  })
);

// Multiply two numbers
server.registerTool(
  "multiply",
  {
    description: "Multiply two numbers together. Returns a * b.",
    inputSchema: z.object({
      a: z.number().describe("The first factor"),
      b: z.number().describe("The second factor"),
    }),
  },
  async ({ a, b }) => ({
    content: [{ type: "text" as const, text: `${a} * ${b} = ${a * b}` }],
  })
);

// Divide a by b — guards against division by zero
server.registerTool(
  "divide",
  {
    description:
      "Divide a by b. Returns a / b. Throws an error if b is zero.",
    inputSchema: z.object({
      a: z.number().describe("The dividend"),
      b: z.number().describe("The divisor (must not be zero)"),
    }),
  },
  async ({ a, b }) => {
    if (b === 0) {
      throw new Error("Division by zero is undefined");
    }
    return {
      content: [{ type: "text" as const, text: `${a} / ${b} = ${a / b}` }],
    };
  }
);

// Raise base to an exponent
server.registerTool(
  "power",
  {
    description:
      "Raise a base to an exponent. Returns base^exponent. Supports negative and fractional exponents.",
    inputSchema: z.object({
      base: z.number().describe("The base number"),
      exponent: z.number().describe("The exponent to raise the base to"),
    }),
  },
  async ({ base, exponent }) => ({
    content: [
      {
        type: "text" as const,
        text: `${base}^${exponent} = ${Math.pow(base, exponent)}`,
      },
    ],
  })
);

// Compute n! — capped at 20 to avoid floating-point overflow
server.registerTool(
  "factorial",
  {
    description:
      "Compute the factorial of a non-negative integer n (n!). Limited to n ≤ 20 to avoid overflow.",
    inputSchema: z.object({
      n: z
        .number()
        .int()
        .describe("A non-negative integer (0–20) whose factorial to compute"),
    }),
  },
  async ({ n }) => {
    if (n < 0) throw new Error("Factorial is not defined for negative numbers");
    if (n > 20) throw new Error("n must be ≤ 20 to avoid integer overflow");

    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;

    return {
      content: [{ type: "text" as const, text: `${n}! = ${result}` }],
    };
  }
);

// Compute the nth Fibonacci number (0-indexed)
server.registerTool(
  "fibonacci",
  {
    description:
      "Return the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1, fib(2)=1, …). Limited to n ≤ 50.",
    inputSchema: z.object({
      n: z
        .number()
        .int()
        .describe(
          "Zero-based index of the Fibonacci number to compute (0–50)"
        ),
    }),
  },
  async ({ n }) => {
    if (n < 0)
      throw new Error("Fibonacci index must be a non-negative integer");
    if (n > 50) throw new Error("n must be ≤ 50 to keep computation fast");

    let a = 0,
      b = 1;
    for (let i = 0; i < n; i++) {
      [a, b] = [b, a + b];
    }

    return {
      content: [{ type: "text" as const, text: `fibonacci(${n}) = ${a}` }],
    };
  }
);

// Convert between common measurement units
server.registerTool(
  "unit_convert",
  {
    description:
      "Convert a value between measurement units. Supported pairs: km↔miles, celsius↔fahrenheit, kg↔lbs.",
    inputSchema: z.object({
      value: z.number().describe("The numeric value to convert"),
      from: z
        .string()
        .describe(
          "Source unit: 'km', 'miles', 'celsius', 'fahrenheit', 'kg', or 'lbs'"
        ),
      to: z
        .string()
        .describe(
          "Target unit: 'km', 'miles', 'celsius', 'fahrenheit', 'kg', or 'lbs'"
        ),
    }),
  },
  async ({ value, from, to }) => {
    const key = `${from.toLowerCase()}:${to.toLowerCase()}`;
    let result: number;

    switch (key) {
      case "km:miles":
        result = value * 0.621371;
        break;
      case "miles:km":
        result = value * 1.60934;
        break;
      case "celsius:fahrenheit":
        result = value * (9 / 5) + 32;
        break;
      case "fahrenheit:celsius":
        result = (value - 32) * (5 / 9);
        break;
      case "kg:lbs":
        result = value * 2.20462;
        break;
      case "lbs:kg":
        result = value / 2.20462;
        break;
      default:
        throw new Error(
          `Unsupported conversion: ${from} → ${to}. ` +
            `Supported pairs: km/miles, celsius/fahrenheit, kg/lbs`
        );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `${value} ${from} = ${result.toFixed(4)} ${to}`,
        },
      ],
    };
  }
);

// ─── Transport & Connection ───────────────────────────────────────────────────
//
// StdioServerTransport wires process.stdin → JSON-RPC message parser and
// JSON-RPC serializer → process.stdout. It does NOT open any sockets.
//
// IMPORTANT: This process MUST be spawned by a client (see client.ts).
// If you run it directly in a terminal, stdin will be your keyboard and
// the server will sit silently waiting for well-formed JSON-RPC messages.
const transport = new StdioServerTransport();

// server.connect() performs the MCP capability negotiation handshake:
//   1. Client sends `initialize` with its protocol version and capabilities
//   2. Server replies with `initialize` response listing its own capabilities
//      (e.g., which tool features it supports)
//   3. Client sends `notifications/initialized` to confirm it's ready
//   4. From this point on, the client can call tools, list resources, etc.
//
// After connect() resolves, the server is live and listening on stdin.
await server.connect(transport);
