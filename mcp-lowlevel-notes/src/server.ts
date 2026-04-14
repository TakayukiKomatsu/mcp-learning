/**
 * MCP Notes Server — low-level `Server` API
 *
 * WHY THIS PROJECT EXISTS
 * -----------------------
 * `McpServer` is the ergonomic, high-level API. It lets you register tools,
 * prompts, and resources with almost no boilerplate.
 *
 * The lower-level `Server` class is closer to the wire protocol:
 *   - you manually handle request schemas
 *   - you manually return `tools/list` responses
 *   - you manually dispatch `tools/call`
 *
 * This is useful when you want to understand what `McpServer` is doing for you
 * under the hood.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// We keep the tool catalog in plain data because low-level Server does not give
// us a convenience `registerTool()` method.
const tools = [
  {
    name: 'echo_note',
    description: 'Echo a note back to the caller with simple formatting.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The note text to echo',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'note_length',
    description: 'Return the number of characters in a note.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The note text to measure',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
] as const;

const server = new Server(
  {
    name: 'mcp-lowlevel-notes',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle `tools/list` manually.
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...tools] };
});

// Handle `tools/call` manually.
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  if (toolName === 'echo_note') {
    const text = String(args.text ?? '');
    return {
      content: [{ type: 'text', text: `Echo from low-level Server: ${text}` }],
    };
  }

  if (toolName === 'note_length') {
    const text = String(args.text ?? '');
    return {
      content: [{ type: 'text', text: `Length: ${text.length} characters` }],
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Low-level MCP server listening on stdio.');
  console.error('This server manually handles tools/list and tools/call.');
}

main().catch((error) => {
  console.error('Low-level server failed:', error);
  process.exit(1);
});
