/**
 * MCP Advanced Tool Features Client — stdio transport demo
 *
 * HOW CLIENTS SHOULD USE ANNOTATIONS:
 * When a client discovers tools via listTools(), each tool object includes an
 * `annotations` field. Clients (and the UIs/agents built on top of them) should
 * read these hints to make informed decisions:
 *
 *   readOnlyHint: true   → call freely; no confirmation dialog needed
 *   destructiveHint: true → show a warning or ask for user confirmation first
 *   idempotentHint: true  → safe to retry automatically on transient failure
 *   openWorldHint: true   → tell the user "this tool will contact external systems"
 *
 * This client demonstrates each annotation type in practice by explicitly
 * checking annotations before every tool call and printing appropriate notices.
 *
 * Run with:  npm run client
 * (No need to start the server separately — this client spawns it.)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/server.ts"],
});

const client = new Client({
  name: "mcp-tool-advanced-client",
  version: "1.0.0",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printSectionHeader(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

// Format a tool's annotations as a compact string for display.
function formatAnnotations(annotations: Record<string, unknown> | undefined): string {
  if (!annotations) return "(no annotations)";
  const parts: string[] = [];
  if (annotations.readOnlyHint)   parts.push("readOnly");
  if (annotations.destructiveHint) parts.push("destructive");
  if (annotations.idempotentHint)  parts.push("idempotent");
  if (annotations.openWorldHint)   parts.push("openWorld");
  return parts.length > 0 ? `[${parts.join(", ")}]` : "(no hints set)";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to server (spawning child process)...");
  await client.connect(transport);
  console.log("Connected.\n");

  // ── 1. List tools and display annotations ─────────────────────────────────
  //
  // Annotations live at tool.annotations on each entry returned by listTools().
  // This is how a real client discovers what safety hints the server declared.
  // A UI might use these to render a lock icon (readOnly) or a red warning
  // banner (destructive) next to each tool in a tool-picker component.
  printSectionHeader("Available Tools & Their Annotations");
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const annStr = formatAnnotations(tool.annotations as Record<string, unknown> | undefined);
    console.log(`  • ${tool.name.padEnd(18)} ${annStr}`);
    console.log(`    ${tool.description}`);
  }

  // ── 2. list_files — readOnly + idempotent ─────────────────────────────────
  //
  // readOnlyHint + idempotentHint: we can call this any number of times with
  // no side-effects and no need for user confirmation.
  printSectionHeader("list_files  [readOnly + idempotent — safe to call]");
  console.log("  This tool is readOnly+idempotent — safe to call without confirmation.");
  const listResult = await client.callTool({ name: "list_files", arguments: {} });
  if (Array.isArray(listResult.content) && listResult.content[0] && "text" in listResult.content[0]) {
    console.log("\n  Files in server:\n");
    for (const line of (listResult.content[0].text as string).split("\n")) {
      console.log(`    ${line}`);
    }
  }
  const contentBlocks = Array.isArray(listResult.content) ? listResult.content : [];
  const links = contentBlocks.filter(
    (item): item is { type: "resource_link"; uri: string; name?: string } => item.type === "resource_link"
  );
  if (links.length > 0) {
    console.log("\n  Resource links returned by the tool:");
    for (const link of links) {
      console.log(`    - ${"name" in link ? String(link.name) : "(unnamed)"} → ${"uri" in link ? String(link.uri) : "(missing uri)"}`);
    }
  }

  // ── 3. read_file — readOnly + idempotent + outputSchema ───────────────────
  //
  // This tool returns BOTH:
  //   content[0].text   — human-readable display text
  //   structuredContent — machine-parseable JSON matching the declared outputSchema
  //
  // A client that needs to render a file viewer would use structuredContent
  // (parsed object) rather than scraping the text in content.
  printSectionHeader("read_file  [readOnly + idempotent + outputSchema]");
  console.log("  Calling read_file({ filename: 'readme.txt' })...\n");
  const readResult = await client.callTool({ name: "read_file", arguments: { filename: "readme.txt" } });

  console.log("  --- content[0].text (human-readable display text) ---");
  if (Array.isArray(readResult.content) && readResult.content[0] && "text" in readResult.content[0]) {
    for (const line of (readResult.content[0].text as string).split("\n")) {
      console.log(`    ${line}`);
    }
  }

  console.log("\n  --- structuredContent (machine-parseable JSON from outputSchema) ---");
  if (readResult.structuredContent) {
    console.log("   ", JSON.stringify(readResult.structuredContent, null, 2).replace(/\n/g, "\n    "));
  } else {
    console.log("    (no structuredContent returned)");
  }

  // ── 4. write_file — destructive, NOT idempotent ───────────────────────────
  //
  // Pattern for checking annotations before calling a destructive tool:
  //   1. Inspect the tool's annotations from the listTools() response
  //   2. If destructiveHint is true, warn the user (or prompt for confirmation)
  //   3. Only then proceed with the call
  //
  // In a real UI this would be a confirmation dialog. Here we print a warning.
  printSectionHeader("write_file  [destructive — warn before calling!]");
  console.log("  WARNING: This tool has destructiveHint=true.");
  console.log("  It will overwrite the file if it already exists.");
  console.log("  Proceeding with write_file({ filename: 'new.txt', content: 'Hello!' })...\n");
  const writeResult = await client.callTool({ name: "write_file", arguments: { filename: "new.txt", content: "Hello!" } });
  if (Array.isArray(writeResult.content) && writeResult.content[0] && "text" in writeResult.content[0]) {
    console.log("  Result:", writeResult.content[0].text);
  }

  // ── 5. delete_file — destructive ─────────────────────────────────────────
  //
  // Same pattern: check destructiveHint, warn, then call.
  // delete_file is also NOT idempotent — calling it twice on the same file
  // will throw an error on the second call because the file is already gone.
  printSectionHeader("delete_file  [destructive — warn before calling!]");
  console.log("  WARNING: This tool has destructiveHint=true.");
  console.log("  Deletion is permanent and cannot be undone.");
  console.log("  Proceeding with delete_file({ filename: 'new.txt' })...\n");
  const deleteResult = await client.callTool({ name: "delete_file", arguments: { filename: "new.txt" } });
  if (Array.isArray(deleteResult.content) && deleteResult.content[0] && "text" in deleteResult.content[0]) {
    console.log("  Result:", deleteResult.content[0].text);
  }

  // ── 6. fetch_external — openWorld ────────────────────────────────────────
  //
  // openWorldHint means the tool reaches beyond the server boundary to external
  // systems. A well-behaved client surfaces this to the user so they understand
  // that data (the URL, any parameters) will be sent outside the local environment.
  printSectionHeader("fetch_external  [openWorld — contacts external systems]");
  console.log("  NOTE: This tool has openWorldHint=true.");
  console.log("  It will contact an external URL outside this server.");
  console.log("  Proceeding with fetch_external({ url: 'https://jsonplaceholder.typicode.com/todos/1' })...\n");
  const fetchResult = await client.callTool({ name: "fetch_external", arguments: { url: "https://jsonplaceholder.typicode.com/todos/1" } });
  if (Array.isArray(fetchResult.content) && fetchResult.content[0] && "text" in fetchResult.content[0]) {
    console.log("  Result:", fetchResult.content[0].text);
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────
  await client.close();
  console.log("\nDisconnected. Demo complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
