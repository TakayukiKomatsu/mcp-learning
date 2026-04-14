/**
 * MCP Server Instructions Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "mcp-server-instructions-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

console.log("Server instructions:");
console.log(client.getInstructions() ?? "(none)");

const result = await client.callTool({ name: "recommend_next_demo", arguments: { focus: "I want more HTTP examples" } });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log("\nTool result:");
    console.log(item.text);
  }
}

await client.close();
