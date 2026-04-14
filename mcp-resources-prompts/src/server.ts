/**
 * MCP Resources & Prompts Server
 *
 * WHAT ARE RESOURCES?
 * Resources are READ-ONLY data sources exposed by the server. Think of them
 * like files or database records — they have a URI (address), a name, a
 * mimeType, and text/binary content. Clients call resources/list to discover
 * what's available and resources/read to fetch the content.
 *
 * Resources differ from Tools in a fundamental way:
 *   - Tools DO things (they have side effects, they run code, they call APIs).
 *   - Resources ARE things (they expose data for the LLM to read, no side effects).
 *
 * Use resources when the LLM needs to read data without triggering actions.
 * Use tools when the LLM needs to perform an operation or change state.
 *
 * WHAT ARE PROMPTS?
 * Prompts are reusable, parameterised prompt templates. Clients call
 * prompts/list to discover available templates and prompts/get to render one
 * with concrete argument values. The result is an array of messages (user /
 * assistant turns) that can be fed directly to an LLM.
 *
 * Prompts are useful for packaging up multi-turn conversation starters or
 * consistent instructions that should always be worded the same way.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ─── In-memory notes store ────────────────────────────────────────────────────

const notes = new Map<string, { title: string; content: string; tags: string[] }>([
  ['note-1', {
    title: 'MCP Basics',
    content: 'MCP stands for Model Context Protocol. It standardises how LLMs connect to external tools and data.',
    tags: ['mcp', 'intro'],
  }],
  ['note-2', {
    title: 'Transport Types',
    content: 'MCP supports stdio, SSE (deprecated), and Streamable HTTP transports. Each has different trade-offs.',
    tags: ['mcp', 'transport'],
  }],
  ['note-3', {
    title: 'Resources vs Tools',
    content: 'Tools DO things (side effects). Resources ARE things (read-only data). Use resources for data the LLM should read, tools for actions it should take.',
    tags: ['mcp', 'concepts'],
  }],
]);

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'resources-prompts-server',
  version: '1.0.0',
});

// ─── Resources ────────────────────────────────────────────────────────────────
//
// Resources are registered with server.resource(name, uri, metadata, handler).
//
// URI scheme: we use the custom "notes://" scheme.
//   notes://index      — the catalogue of all notes
//   notes://<id>       — a specific note by its ID
//
// mimeType tells the client what kind of content to expect so it can decide
// how to display or process it (e.g. render JSON, display plain text).
//
// The handler returns a `contents` array. Each element has:
//   uri      — echoed back so the client can correlate the response
//   mimeType — content type of this particular piece of content
//   text     — the actual content as a string (use `blob` for binary)

// Static resource: an index of all notes as JSON
server.resource(
  'notes-index',
  'notes://index',
  { description: 'List of all notes with their IDs and titles', mimeType: 'application/json' },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(
        [...notes.entries()].map(([id, n]) => ({ id, title: n.title, tags: n.tags })),
        null,
        2,
      ),
    }],
  }),
);

// Per-note resources: one resource per note, addressed by ID
for (const [id, note] of notes) {
  // Each note is exposed as plain text with a simple markdown-style header
  server.resource(
    `note-${id}`,
    `notes://${id}`,
    { description: `Note: ${note.title}`, mimeType: 'text/plain' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'text/plain',
        text: `# ${note.title}\n\nTags: ${note.tags.join(', ')}\n\n${note.content}`,
      }],
    }),
  );
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
//
// Prompts are registered with server.prompt(name, metadata, handler).
//
// `arguments` declares the named parameters the template accepts. Each entry
// has a name, optional description, and required flag. The handler receives
// these as an object keyed by argument name.
//
// The handler returns a `messages` array — each element is a { role, content }
// object matching MCP's message shape. This array maps directly to LLM
// conversation turns and can be sent as-is to any MCP-compatible model.
//
// Including an `assistant` turn (like in explain_concept below) pre-seeds the
// conversation with a starter response, useful for role-prompting.

// Prompt: render a summarisation request for a single note
server.prompt(
  'summarize_note',
  'Generate a prompt to summarise a specific note',
  { note_id: z.string().describe('ID of the note to summarise') },
  async ({ note_id }) => {
    const note = notes.get(note_id);
    if (!note) throw new Error(`Note not found: ${note_id}`);
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please summarise the following note in 2-3 sentences:\n\nTitle: ${note.title}\n\n${note.content}`,
        },
      }],
    };
  },
);

// Prompt: render a comparison request for two notes side-by-side
server.prompt(
  'compare_notes',
  'Generate a prompt to compare two notes',
  { note_id_1: z.string(), note_id_2: z.string() },
  async ({ note_id_1, note_id_2 }) => {
    const a = notes.get(note_id_1), b = notes.get(note_id_2);
    if (!a) throw new Error(`Note not found: ${note_id_1}`);
    if (!b) throw new Error(`Note not found: ${note_id_2}`);
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Compare these two notes and highlight the key differences:\n\nNote 1 — ${a.title}:\n${a.content}\n\nNote 2 — ${b.title}:\n${b.content}`,
        },
      }],
    };
  },
);

// Prompt: explain an MCP concept with a pre-seeded assistant opener
server.prompt(
  'explain_concept',
  'Prompt template for explaining an MCP concept to a beginner',
  { concept: z.string() },
  async ({ concept }) => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Explain "${concept}" in simple terms, as if I am new to MCP.` },
      },
      {
        // Pre-seeded assistant turn: gives the LLM a warm, approachable tone from the start
        role: 'assistant',
        content: { type: 'text', text: 'Sure! Let me break that down for you...' },
      },
    ],
  }),
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
