/**
 * MCP Low-Level Server — Demo Client
 *
 * This client connects to the low-level math server via stdio, exactly like
 * the client in project 1 (mcp-stdio-math). The transport is unchanged —
 * the interesting difference is on the server side.
 *
 * What this demo shows:
 * - From the client's perspective, a low-level Server and a McpServer look
 *   IDENTICAL. The client sends the same JSON-RPC messages and receives the
 *   same responses. The difference is purely in how the server was implemented.
 * - This is the whole point of MCP: the protocol is the contract; the
 *   implementation is an internal detail.
 *
 * Lifecycle: spawn server → handshake → listTools → callTool × N → close
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ─── Transport ────────────────────────────────────────────────────────────────
//
// StdioClientTransport will spawn `npx tsx src/server.ts` as a child process.
// The low-level server reads from its stdin and writes to its stdout — same
// as any other stdio MCP server. The client has no idea (and doesn't care)
// that the server uses the raw Server class internally.

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/server.ts'],
});

const client = new Client({ name: 'lowlevel-math-client', version: '1.0.0' });

// ─── Connect ──────────────────────────────────────────────────────────────────
//
// This spawns the child process and runs the MCP initialize handshake.
// The server's capability declaration ({ tools: {} }) comes back here and
// the client stores it, enabling listTools() and callTool() calls.

await client.connect(transport);

console.log('=== Low-Level MCP Server Demo ===\n');
console.log('Connected. Server is running the raw `Server` class (not McpServer).\n');

// ─── List tools ───────────────────────────────────────────────────────────────
//
// The server's ListToolsRequestSchema handler returns the TOOLS array directly.
// No framework magic — just the plain object we defined.

const { tools } = await client.listTools();
console.log('Available tools:');
for (const tool of tools) {
  console.log(`  ${tool.name}: ${tool.description}`);
}
console.log();

// ─── Helper ───────────────────────────────────────────────────────────────────

async function call(name: string, args: Record<string, unknown>): Promise<void> {
  // Use unknown + narrowing to handle the SDK's discriminated union return type.
  const result = await client.callTool({ name, arguments: args }) as unknown as {
    isError?: boolean;
    content?: Array<{ type: string; text?: string }>;
  };
  const block = result.content?.[0];
  const text = block?.type === 'text' ? block.text : JSON.stringify(block);
  const prefix = result.isError ? '  ✗' : '  ✓';
  console.log(`${prefix} ${name}(${JSON.stringify(args)}) → ${text}`);
}

// ─── Tool calls ───────────────────────────────────────────────────────────────

// Normal usage
await call('add',         { a: 40, b: 2 });
await call('multiply',    { a: 6, b: 7 });
await call('square_root', { n: 144 });
await call('clamp',       { value: 150, min: 0, max: 100 });

console.log();

// Error paths — the server returns isError: true (tool-level errors,
// not protocol-level exceptions). The client still receives a normal result.
await call('square_root', { n: -9 });           // negative number
await call('clamp',       { value: 5, min: 10, max: 1 }); // min > max
await call('add',         { a: 'oops', b: 2 }); // wrong type

console.log();

// Unknown tool — server returns a descriptive tool-level error
await call('nonexistent_tool', {});

// ─── Close ────────────────────────────────────────────────────────────────────

await client.close();
console.log('\nDone. Child process terminated.');
