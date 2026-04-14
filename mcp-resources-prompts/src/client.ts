/**
 * MCP Resources & Prompts Client
 *
 * FROM THE CLIENT'S PERSPECTIVE:
 *
 * Resources — the client calls resources/list to discover what data the server
 * exposes, then resources/read to fetch a specific resource by URI. Resources
 * have no side effects: reading a resource never changes server state.
 * They are content-addressed (identified by URI) rather than invoked by name
 * like tools.
 *
 * Prompts — the client calls prompts/list to discover available templates, then
 * prompts/get with concrete argument values to render one. The rendered result
 * is an array of { role, content } messages ready to be forwarded to an LLM —
 * no further transformation needed.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function getResourceText(content: { text?: string; blob?: string; mimeType?: string }): string {
  if (typeof content.text === 'string') {
    return content.text;
  }

  if (typeof content.blob === 'string') {
    return `[binary ${content.mimeType ?? 'application/octet-stream'} content omitted]`;
  }

  return '[empty resource content]';
}

const client = new Client({ name: 'resources-prompts-client', version: '1.0.0' });

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/server.ts'],
});

await client.connect(transport);
console.log('Connected to server\n');

// ─── Resources ────────────────────────────────────────────────────────────────
//
// Unlike tool calls (which run code and may have side effects), reading a
// resource is a pure data fetch. The server pre-declares every available
// resource with a URI and mimeType so the client knows what to expect before
// fetching. There is no execution — only content retrieval.

// List all resources the server exposes
const { resources } = await client.listResources();
console.log('=== Available Resources ===');
for (const r of resources) {
  console.log(`  [${r.name}]  ${r.uri}`);
}
console.log();

// Read the notes index (application/json) — returns all note IDs and titles
const indexResult = await client.readResource({ uri: 'notes://index' });
console.log('=== notes://index ===');
for (const c of indexResult.contents) {
  console.log(getResourceText(c));
}
console.log();

// Read a specific note (text/plain) — the transport-types note
const noteResult = await client.readResource({ uri: 'notes://note-2' });
console.log('=== notes://note-2 ===');
for (const c of noteResult.contents) {
  console.log(getResourceText(c));
}
console.log();

// ─── Prompts ─────────────────────────────────────────────────────────────────
//
// prompts/get renders a template with concrete values and returns a messages
// array. These messages are already in the shape expected by LLM APIs —
// you can pass them directly to a model without any further formatting.
// Unlike resources (content-addressed), prompts are invoked by name with
// named arguments, similar to calling a function.

// List all prompt templates the server exposes, including their arguments
const { prompts } = await client.listPrompts();
console.log('=== Available Prompts ===');
for (const p of prompts) {
  const args = p.arguments?.map((a) => `${a.name}${a.required ? '*' : ''}`).join(', ') ?? '';
  console.log(`  [${p.name}]  args: (${args})`);
  if (p.description) console.log(`    ${p.description}`);
}
console.log();

// Render summarize_note for note-1 — result is LLM-ready messages
const summarizeResult = await client.getPrompt({
  name: 'summarize_note',
  arguments: { note_id: 'note-1' },
});
console.log('=== Prompt: summarize_note(note_id="note-1") ===');
for (const msg of summarizeResult.messages) {
  const text = msg.content.type === 'text' ? msg.content.text : '[non-text content]';
  console.log(`[${msg.role}] ${text}`);
}
console.log();

// Render compare_notes for note-1 vs note-3 — produces a single user turn
const compareResult = await client.getPrompt({
  name: 'compare_notes',
  arguments: { note_id_1: 'note-1', note_id_2: 'note-3' },
});
console.log('=== Prompt: compare_notes(note_id_1="note-1", note_id_2="note-3") ===');
for (const msg of compareResult.messages) {
  const text = msg.content.type === 'text' ? msg.content.text : '[non-text content]';
  console.log(`[${msg.role}] ${text}`);
}
console.log();

await client.close();
console.log('Disconnected.');
