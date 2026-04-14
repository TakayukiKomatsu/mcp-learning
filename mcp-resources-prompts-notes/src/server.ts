/**
 * MCP Notes Server — resources + prompts
 *
 * WHY THIS PROJECT EXISTS
 * -----------------------
 * Earlier examples focused on TOOLS only.
 *
 * In MCP, resources and prompts solve different problems:
 *   - TOOLS      → perform actions
 *   - RESOURCES  → expose readable data
 *   - PROMPTS    → expose reusable prompt templates
 *
 * This project demonstrates all three, but intentionally centers resources and
 * prompts so the distinction is easy to see.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'mcp-resources-prompts-notes',
  version: '1.0.0',
});

const notes = [
  { id: '1', title: 'MCP basics', body: 'Tools act. Resources provide data. Prompts provide reusable messages.' },
  { id: '2', title: 'Transport reminder', body: 'Transport decides how messages move, not what MCP means.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATIC RESOURCE
// ─────────────────────────────────────────────────────────────────────────────
// A fixed URI behaves like a named document that clients can discover and read.
server.registerResource(
  'notes-index',
  'notes://index',
  {
    title: 'Notes Index',
    description: 'A plain-text index of all demo notes',
    mimeType: 'text/plain',
  },
  async () => ({
    contents: [
      {
        uri: 'notes://index',
        text: notes.map((note) => `${note.id}. ${note.title}`).join('\n'),
      },
    ],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE RESOURCE
// ─────────────────────────────────────────────────────────────────────────────
// A ResourceTemplate says: "There is a family of resources matching this URI
// pattern." The variables are extracted and handed to your callback.
server.registerResource(
  'note-by-id',
  new ResourceTemplate('notes://{id}', {
    list: async () => ({
      resources: notes.map((note) => ({
        uri: `notes://${note.id}`,
        name: note.title,
      })),
    }),
  }),
  {
    title: 'Note By ID',
    description: 'A single note looked up by its ID',
    mimeType: 'text/plain',
  },
  async (uri, variables) => {
    const note = notes.find((item) => item.id === String(variables.id));

    if (!note) {
      throw new Error(`No note found for URI ${uri.href}`);
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: `# ${note.title}\n\n${note.body}`,
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────────────────────
// A prompt is NOT an action. It is a reusable message bundle that the client can
// request and then decide how to use.
server.registerPrompt(
  'summarize-note',
  {
    title: 'Summarize Note',
    description: 'Prompt template that asks an LLM to summarize a note.',
    argsSchema: {
      noteTitle: z.string().describe('The note title to mention'),
      noteBody: z.string().describe('The note content to summarize'),
    },
  },
  async ({ noteTitle, noteBody }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Summarize the following note in 3 bullet points.`,
            '',
            `Title: ${noteTitle}`,
            '',
            noteBody,
          ].join('\n'),
        },
      },
    ],
  })
);

// Tiny tool included only to contrast with resources/prompts.
server.registerTool(
  'create_summary_hint',
  {
    description: 'Return a short instruction string for summarizing notes.',
  },
  async () => ({
    content: [{ type: 'text' as const, text: 'Focus on concepts, not line-by-line details.' }],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Resources + prompts MCP server listening on stdio.');
}

main().catch((error) => {
  console.error('Resources/prompts server failed:', error);
  process.exit(1);
});
