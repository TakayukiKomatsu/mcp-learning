/**
 * Non-standard WebSocket MCP client.
 *
 * This demonstrates that MCP can run over a persistent websocket-style channel,
 * but it is intentionally labeled as custom rather than official.
 */

import WebSocket from "ws";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { WebSocketTransport } from "./transport.js";

const socket = new WebSocket("ws://localhost:3025");
const transport = new WebSocketTransport(socket);

const client = new Client({ name: "mcp-websocket-custom-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(`Available tools: ${tools.tools.map((tool) => tool.name).join(", ")}`);

const result = await client.callTool({
  name: "session_echo",
  arguments: { text: "persistent websocket session" },
});

for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log(item.text);
  }
}

await client.close();
