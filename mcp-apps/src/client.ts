/**
 * MCP Apps Demo Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "mcp-apps-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

const result = await client.callTool({ name: "show_release_dashboard", arguments: {} });
const uiLink = (Array.isArray(result.content) ? result.content : []).find(
  (item): item is { type: "resource_link"; uri: string; name?: string } => item.type === "resource_link"
);

console.log("Tool structured content:");
console.log(JSON.stringify(result.structuredContent, null, 2));

if (uiLink) {
  console.log(`\nReading UI resource ${uiLink.uri}`);
  const resource = await client.readResource({ uri: uiLink.uri });
  const html = resource.contents.find((item) => "text" in item && typeof item.text === "string");
  console.log(String(html && "text" in html ? html.text : "").split("\n").slice(0, 10).join("\n"));
}

await client.close();
