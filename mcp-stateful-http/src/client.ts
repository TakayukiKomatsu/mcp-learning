/**
 * MCP Stateful Streamable HTTP Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function textFromResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: Array<{ type?: unknown; text?: unknown }> }).content;
  return Array.isArray(content) ? content.filter((item) => item.type === "text").map((item) => String(item.text ?? "")).join("\n") : "";
}

async function runSession(label: string, noteText: string) {
  const client = new Client({ name: `stateful-${label}`, version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3014/mcp"));
  await client.connect(transport);

  console.log(`${label}: sessionId=${transport.sessionId}`);
  console.log(textFromResult(await client.callTool({ name: "add_note", arguments: { text: noteText } })));
  console.log(textFromResult(await client.callTool({ name: "list_notes", arguments: {} })));

  await transport.terminateSession();
}

await runSession("session-a", "note only visible to session A");
console.log("");
await runSession("session-b", "note only visible to session B");
