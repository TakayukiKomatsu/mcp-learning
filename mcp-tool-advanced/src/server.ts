/**
 * MCP Advanced Tool Features Server — stdio transport
 *
 * WHAT ARE TOOL ANNOTATIONS?
 * Annotations are metadata hints attached to a tool definition. They do NOT
 * change what the tool does — they tell clients and LLMs how the tool behaves,
 * so callers can make informed decisions about when it is safe to invoke it.
 *
 * WHY ANNOTATIONS MATTER:
 * An LLM agent or UI client can inspect annotations to decide whether to ask
 * the user for confirmation, show a warning, or call the tool automatically
 * without interrupting the user.
 *
 * THE FOUR ANNOTATION TYPES:
 *
 *   readOnlyHint: true
 *     The tool does not modify any state. It is always safe to call without
 *     side-effects. Clients can call it freely without user confirmation.
 *
 *   destructiveHint: true
 *     The tool may delete or irreversibly overwrite data. Clients should warn
 *     the user and request explicit confirmation before calling.
 *
 *   idempotentHint: true
 *     Calling the tool multiple times with the same arguments produces the
 *     same result as calling it once. Safe to retry on network failure.
 *     idempotentHint: false means repeated calls have cumulative effects.
 *
 *   openWorldHint: true
 *     The tool interacts with systems outside the MCP server itself — e.g.,
 *     external APIs, the network, the filesystem, or a database. Clients may
 *     want to show this to users so they understand the tool reaches "outside".
 *
 * WHAT IS outputSchema?
 * In addition to returning human-readable text in `content`, a tool can
 * declare an `outputSchema` (a Zod schema) to signal that it also returns
 * machine-parseable JSON in `structuredContent`.
 *
 * HOW structuredContent DIFFERS FROM content:
 *   content        — an array of text/image/resource blocks; intended for
 *                    display to a human or an LLM reading the conversation.
 *   structuredContent — a single JSON object matching the outputSchema; intended
 *                    for programmatic consumption by the client code directly,
 *                    without scraping or parsing the text in `content`.
 *
 * DOMAIN: In-memory file system demo.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── In-memory file system ────────────────────────────────────────────────────
//
// This is the server's state. All tools operate on this Map.
// Because it is module-level, it persists for the lifetime of the process.
const fileSystem = new Map<string, { content: string; size: number; createdAt: string }>([
  ["readme.txt", { content: "Welcome to the MCP file system demo.", size: 36, createdAt: "2026-01-01T00:00:00Z" }],
  ["notes.txt", { content: "Remember to study MCP tool annotations.", size: 39, createdAt: "2026-01-02T00:00:00Z" }],
]);

// ─── Server ───────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "mcp-tool-advanced",
  version: "1.0.0",
});

// ─── Tool 1: list_files ───────────────────────────────────────────────────────
//
// Annotations used:
//   readOnlyHint: true   — only reads the Map; no writes occur
//   idempotentHint: true — calling it 10 times returns the same list as once
//
// This tool also demonstrates `resource_link` content blocks. Resource links are
// lighter-weight than embedding a full resource body in the tool result. They
// tell the client "here is a URI worth reading next" without forcing the server
// to inline the file contents into the tool call response itself.
server.registerTool(
  "list_files",
  {
    description: "List all files in the in-memory file system and return resource links for each one.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async () => ({
    content: [
      { type: "text" as const, text: [...fileSystem.keys()].join("\n") },
      ...[...fileSystem.keys()].map((filename) => ({
        type: "resource_link" as const,
        uri: `memfs://${filename}`,
        name: filename,
        mimeType: "text/plain",
        description: `Virtual file link for ${filename}`,
      })),
    ],
  })
);

// ─── Tool 2: read_file ────────────────────────────────────────────────────────
//
// Annotations used:
//   readOnlyHint: true   — reads a file; does not modify any state
//   idempotentHint: true — same filename always returns the same file data
//
// outputSchema declared: the tool returns BOTH:
//   content         — human-readable text block (for the LLM / UI display)
//   structuredContent — a JSON object matching the schema (for programmatic use)
//
// The difference:
//   content[0].text  →  "File: readme.txt\nSize: 36 bytes\n\nWelcome..."
//   structuredContent →  { filename: "readme.txt", content: "Welcome...", size: 36, createdAt: "..." }
//
// A client that needs to display a file viewer would parse structuredContent
// rather than trying to regex-parse the human-readable text.
server.registerTool(
  "read_file",
  {
    description: "Read a file and return its metadata and content as structured JSON.",
    inputSchema: z.object({ filename: z.string() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    outputSchema: z.object({
      filename: z.string(),
      content: z.string(),
      size: z.number(),
      createdAt: z.string(),
    }),
  },
  async ({ filename }) => {
    const file = fileSystem.get(filename);
    if (!file) throw new Error(`File not found: ${filename}`);
    const structured = { filename, ...file };
    return {
      // content: human-readable text for display in a chat UI or LLM context
      content: [{ type: "text" as const, text: `File: ${filename}\nSize: ${file.size} bytes\n\n${file.content}` }],
      // structuredContent: machine-parseable JSON matching outputSchema above
      structuredContent: structured,
    };
  }
);

// ─── Tool 3: write_file ───────────────────────────────────────────────────────
//
// Annotations used:
//   destructiveHint: true    — overwrites an existing file if it already exists
//   idempotentHint: false    — calling write_file twice with different content
//                              values produces different results; not safe to
//                              blindly retry (the second call overwrites the first)
server.registerTool(
  "write_file",
  {
    description: "Write content to a file. Creates if not exists, overwrites if exists.",
    inputSchema: z.object({ filename: z.string(), content: z.string() }),
    annotations: { destructiveHint: true, idempotentHint: false },
  },
  async ({ filename, content }) => {
    fileSystem.set(filename, { content, size: content.length, createdAt: new Date().toISOString() });
    return { content: [{ type: "text" as const, text: `Written ${content.length} bytes to ${filename}` }] };
  }
);

// ─── Tool 4: delete_file ──────────────────────────────────────────────────────
//
// Annotations used:
//   destructiveHint: true    — permanently removes the file; cannot be undone
//   idempotentHint: false    — calling delete twice on the same file will throw
//                              an error on the second call (file already gone)
server.registerTool(
  "delete_file",
  {
    description: "Permanently delete a file. This cannot be undone.",
    inputSchema: z.object({ filename: z.string() }),
    annotations: { destructiveHint: true, idempotentHint: false },
  },
  async ({ filename }) => {
    if (!fileSystem.has(filename)) throw new Error(`File not found: ${filename}`);
    fileSystem.delete(filename);
    return { content: [{ type: "text" as const, text: `Deleted ${filename}` }] };
  }
);

// ─── Tool 5: fetch_external ───────────────────────────────────────────────────
//
// Annotations used:
//   openWorldHint: true  — this tool reaches outside the server boundary to an
//                          external URL; clients should surface this to users so
//                          they understand data is leaving the local environment
//   readOnlyHint: true   — only fetches (reads) data; does not write anything
//
// In this demo the fetch is simulated, but the annotations are correct for a
// real implementation that actually calls an external HTTP endpoint.
server.registerTool(
  "fetch_external",
  {
    description: "Simulate fetching data from an external API (open world — interacts outside the server).",
    inputSchema: z.object({ url: z.string().url() }),
    annotations: { openWorldHint: true, readOnlyHint: true },
  },
  async ({ url }) => ({
    content: [{ type: "text" as const, text: `[Simulated] Fetched from ${url}: { "status": "ok", "data": "mock response" }` }],
  })
);

// ─── Transport & Connection ───────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
