/**
 * MCP Server Cards Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const card = await fetch("http://localhost:3017/.well-known/mcp.json").then((res) => res.json());
console.log("Fetched server card:");
console.log(JSON.stringify(card, null, 2));

const client = new Client({ name: "mcp-server-cards-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3017/mcp"));
await client.connect(transport);

const resource = await client.readResource({ uri: "mcp://server-card" });
console.log("\nRead MCP resource version of the card:");
for (const item of resource.contents) {
  if ("text" in item && item.text) {
    console.log(item.text);
  }
}

const echo = await client.callTool({ name: "echo", arguments: { text: "discovery worked" } });
for (const item of Array.isArray(echo.content) ? echo.content : []) {
  if (item.type === "text") {
    console.log("\nTool result:");
    console.log(item.text);
  }
}

await client.close();
