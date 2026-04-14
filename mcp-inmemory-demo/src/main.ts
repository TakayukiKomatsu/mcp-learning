/**
 * MCP InMemoryTransport Demo
 *
 * WHAT IS InMemoryTransport?
 * InMemoryTransport is a special MCP transport where the client and server
 * live in the SAME Node.js process, connected by in-process message queues.
 * There is no network, no sockets, no stdin/stdout pipes, no HTTP — messages
 * pass directly between two JavaScript objects in memory.
 *
 * The full MCP protocol still runs on top (JSON-RPC handshake, tool discovery,
 * capability negotiation), but all I/O is in-process and essentially instant.
 *
 * WHEN TO USE InMemoryTransport:
 * 1. Testing — spin up a real server in a test file and connect a client to it
 *    without needing a subprocess or a running HTTP server. Fast and reliable.
 * 2. Embedding — if you're building an app that IS the MCP server and also
 *    wants to call its own tools programmatically, InMemory avoids the overhead
 *    of spawning a subprocess (stdio) or making HTTP requests (Streamable HTTP).
 * 3. Benchmarking — isolate tool logic performance from transport overhead.
 *
 * HOW IT DIFFERS FROM THE OTHER TRANSPORTS:
 * - stdio:            client spawns server as a child process, IPC via pipes
 * - SSE:              two HTTP endpoints, persistent connection, deprecated
 * - Streamable HTTP:  single POST endpoint, stateless, works over a network
 * - InMemory:         zero I/O, same process, no serialization overhead
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printResult(call: string, text: string): void {
  console.log(`  ${call}`);
  console.log(`  → ${text}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== MCP InMemoryTransport Demo ===\n');

  // ── Step 1: Create the linked transport pair ───────────────────────────────
  //
  // InMemoryTransport.createLinkedPair() returns [clientTransport, serverTransport].
  // They are wired together: whatever clientTransport.send() writes, the
  // serverTransport receives as an incoming message — and vice versa.
  //
  // Think of it as two ends of a pipe, but entirely within the JavaScript heap.
  // No file descriptors, no sockets, no async I/O — just two objects with
  // linked message queues.
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // ── Step 2: Create and connect the SERVER first ────────────────────────────
  //
  // The server must be connected before the client because `client.connect()`
  // immediately sends an `initialize` request. If the server isn't listening yet,
  // that request would be lost. In network transports this is solved by the
  // server running independently; in InMemory mode, order matters.
  const server = new McpServer({ name: 'string-tools', version: '1.0.0' });

  // Register all string tools before connecting so they are available
  // the moment the client asks for them.

  // Reverse a string character by character
  server.registerTool(
    'reverse',
    {
      description: 'Reverse a string character by character. "hello" → "olleh".',
      inputSchema: z.object({
        text: z.string().describe('The string to reverse'),
      }),
    },
    async ({ text }) => ({
      content: [{ type: 'text' as const, text: text.split('').reverse().join('') }],
    }),
  );

  // Convert to uppercase
  server.registerTool(
    'uppercase',
    {
      description: 'Convert a string to UPPERCASE.',
      inputSchema: z.object({
        text: z.string().describe('The string to convert'),
      }),
    },
    async ({ text }) => ({
      content: [{ type: 'text' as const, text: text.toUpperCase() }],
    }),
  );

  // Convert to lowercase
  server.registerTool(
    'lowercase',
    {
      description: 'Convert a string to lowercase.',
      inputSchema: z.object({
        text: z.string().describe('The string to convert'),
      }),
    },
    async ({ text }) => ({
      content: [{ type: 'text' as const, text: text.toLowerCase() }],
    }),
  );

  // Count words by splitting on whitespace
  server.registerTool(
    'word_count',
    {
      description: 'Count the number of words in a string (split on whitespace).',
      inputSchema: z.object({
        text: z.string().describe('The string to count words in'),
      }),
    },
    async ({ text }) => {
      const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      return { content: [{ type: 'text' as const, text: `${count} word${count !== 1 ? 's' : ''}` }] };
    },
  );

  // Palindrome check: ignore spaces and case
  server.registerTool(
    'palindrome_check',
    {
      description:
        'Check whether a string is a palindrome. Ignores spaces and is case-insensitive.',
      inputSchema: z.object({
        text: z.string().describe('The string to check'),
      }),
    },
    async ({ text }) => {
      const clean = text.toLowerCase().replace(/\s+/g, '');
      const isPalindrome = clean === clean.split('').reverse().join('');
      return {
        content: [
          {
            type: 'text' as const,
            text: isPalindrome
              ? `"${text}" IS a palindrome`
              : `"${text}" is NOT a palindrome`,
          },
        ],
      };
    },
  );

  // Repeat a string N times
  server.registerTool(
    'repeat',
    {
      description: 'Repeat a string N times (1–10).',
      inputSchema: z.object({
        text: z.string().describe('The string to repeat'),
        times: z.number().int().min(1).max(10).describe('How many times to repeat (1–10)'),
      }),
    },
    async ({ text, times }) => ({
      content: [{ type: 'text' as const, text: text.repeat(times) }],
    }),
  );

  // Connect the server to its half of the transport pair. From this point on,
  // the server is ready to receive and handle JSON-RPC messages from the linked
  // client transport.
  await server.connect(serverTransport);

  // ── Step 3: Create and connect the CLIENT ─────────────────────────────────
  //
  // client.connect() fires the MCP initialize handshake synchronously (in terms
  // of the event loop — it awaits the server's response, but since both sides
  // are in the same process, there is no actual I/O wait). The round-trip is
  // measured in microseconds rather than milliseconds.
  const client = new Client({ name: 'string-client', version: '1.0.0' });
  await client.connect(clientTransport);

  // ── Step 4: Discover tools ────────────────────────────────────────────────
  //
  // listTools() sends a tools/list JSON-RPC request and returns the server's
  // tool registry. In InMemory mode this is still a proper MCP protocol exchange
  // — the same message that Claude or any other MCP client would send.
  const { tools } = await client.listTools();
  console.log(`Available tools: ${tools.map((t) => t.name).join(', ')}\n`);

  // ── Step 5: Call each tool and print results ───────────────────────────────

  // String transformation tools
  const reverseResult = await client.callTool({ name: 'reverse', arguments: { text: 'Hello, MCP!' } });
  printResult("reverse('Hello, MCP!')", getText(reverseResult));

  const upperResult = await client.callTool({ name: 'uppercase', arguments: { text: 'in-memory transport is fast' } });
  printResult("uppercase('in-memory transport is fast')", getText(upperResult));

  const lowerResult = await client.callTool({ name: 'lowercase', arguments: { text: 'NO NETWORK OVERHEAD' } });
  printResult("lowercase('NO NETWORK OVERHEAD')", getText(lowerResult));

  // Word count
  const wcResult = await client.callTool({
    name: 'word_count',
    arguments: { text: 'The quick brown fox jumps over the lazy dog' },
  });
  printResult("word_count('The quick brown fox jumps over the lazy dog')", getText(wcResult));

  // Palindrome checks
  const palYes = await client.callTool({ name: 'palindrome_check', arguments: { text: 'racecar' } });
  printResult("palindrome_check('racecar')", getText(palYes));

  const palNo = await client.callTool({ name: 'palindrome_check', arguments: { text: 'hello' } });
  printResult("palindrome_check('hello')", getText(palNo));

  const palSpace = await client.callTool({ name: 'palindrome_check', arguments: { text: 'never odd or even' } });
  printResult("palindrome_check('never odd or even')", getText(palSpace));

  // Repeat
  const repeatResult = await client.callTool({ name: 'repeat', arguments: { text: 'MCP! ', times: 3 } });
  printResult("repeat('MCP! ', 3)", getText(repeatResult));

  // ── Step 6: Close ─────────────────────────────────────────────────────────
  //
  // Closing the client sends an MCP `close` notification and tears down both
  // sides of the linked pair. Because they are in-process, there are no network
  // connections to drain or ports to release — it's effectively instantaneous.
  await client.close();

  console.log('Done. Both transports closed.');
}

// ─── Utility ──────────────────────────────────────────────────────────────────

// Accept `unknown` and narrow manually — the SDK's callTool return type is a
// discriminated union and different SDK versions expose slightly different shapes.
// Using unknown + narrowing is more robust than importing the internal type.
function getText(result: unknown): string {
  if (typeof result !== 'object' || result === null) return '(invalid result)';
  const r = result as Record<string, unknown>;
  if (r['isError']) return `ERROR: ${JSON.stringify(r['content'])}`;
  const content = r['content'];
  if (!Array.isArray(content) || content.length === 0) return '(empty)';
  const block = content[0] as Record<string, unknown>;
  if (block['type'] === 'text') return String(block['text'] ?? '(no text)');
  return JSON.stringify(block);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
