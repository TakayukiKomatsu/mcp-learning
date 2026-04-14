/**
 * MCP Tasks Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const client = new Client({ name: "mcp-tasks-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3016/mcp"));
await client.connect(transport);

const stream = client.experimental.tasks.callToolStream(
  { name: "delay", arguments: { duration: 1200 } },
  CallToolResultSchema,
  { task: { ttl: 60_000 } }
);

for await (const message of stream) {
  if (message.type === "taskCreated") {
    console.log(`Task created: ${message.task.taskId}`);
  } else if (message.type === "taskStatus") {
    console.log(`Status: ${message.task.status}${message.task.statusMessage ? ` - ${message.task.statusMessage}` : ""}`);
  } else if (message.type === "result") {
    const text = message.result.content.find((item) => item.type === "text")?.text ?? "(no text)";
    console.log("\nFinal result:");
    console.log(text);
  } else if (message.type === "error") {
    console.log(`Task error: ${message.error}`);
  }
}

await client.close();
