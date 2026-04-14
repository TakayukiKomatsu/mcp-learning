/**
 * MCP Notes Server — InMemoryTransport edition
 *
 * WHY THIS PROJECT EXISTS
 * -----------------------
 * Your earlier projects showed three ways for a client and server to talk across
 * process or network boundaries:
 *   - stdio                 → same machine, separate processes
 *   - SSE                   → HTTP + server-sent events
 *   - Streamable HTTP       → modern HTTP transport
 *
 * InMemoryTransport is different:
 *   - client and server live inside the SAME Node.js process
 *   - there is NO port, NO socket, NO subprocess
 *   - messages are exchanged by linked transport objects in memory
 *
 * This is mostly useful for tests and demos, but it is a great way to learn the
 * MCP lifecycle with almost all infrastructure stripped away.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * We export a factory so `client.ts` can create a fresh server instance inside
 * the same process.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-inmemory-notes',
    version: '1.0.0',
  });

  // A tiny in-memory data set is enough for learning.
  const notes: string[] = [];

  server.registerTool(
    'add_note',
    {
      description: 'Add a note to the in-memory note list.',
      inputSchema: z.object({
        text: z.string().min(1).describe('The note text to store'),
      }),
    },
    async ({ text }) => {
      notes.push(text);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Added note #${notes.length}: ${text}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List all notes currently held in server memory.',
    },
    async () => {
      if (notes.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No notes stored yet.' }],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: notes.map((note, index) => `${index + 1}. ${note}`).join('\n'),
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Unlike stdio/SSE/HTTP, InMemoryTransport does not make sense as a standalone
 * long-running server script. There is no external process or port to wait on.
 *
 * So `npm run server` prints guidance and exits. The real demo lives in
 * `client.ts`, where both ends are wired together in one process.
 */
console.log('InMemoryTransport has no standalone server process.');
console.log('Run `npm run client` to create a client/server linked pair in memory.');
