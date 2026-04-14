import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const client = new Client({ name: "mcp-multi-turn-sse-client", version: "1.0.0" });
const transport = new SSEClientTransport(new URL("http://localhost:3020/sse"));
await client.connect(transport);

await client.callTool({ name: "remember", arguments: { text: "first turn" } });
await client.callTool({ name: "remember", arguments: { text: "second turn" } });
const result = await client.callTool({ name: "recall", arguments: {} });

for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") console.log(item.text);
}

await client.close();
