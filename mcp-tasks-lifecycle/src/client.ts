/**
 * MCP Tasks Lifecycle Demo Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const client = new Client({ name: "mcp-tasks-lifecycle-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3023/mcp"));
await client.connect(transport);

async function runTask(name: string, args: Record<string, unknown>, pauseAfterCreate = 0) {
  console.log(`\n=== ${name} ===`);
  const stream = client.experimental.tasks.callToolStream({ name, arguments: args }, CallToolResultSchema, {
    task: { ttl: 20_000 },
  });

  for await (const message of stream) {
    if (message.type === "taskCreated") {
      console.log(`taskCreated: ${message.task.taskId}`);
      if (pauseAfterCreate > 0) {
        console.log(`sleeping ${pauseAfterCreate}ms before continuing to read result...`);
        await new Promise((resolve) => setTimeout(resolve, pauseAfterCreate));
      }
    } else if (message.type === "taskStatus") {
      console.log(`taskStatus: ${message.task.status}${message.task.statusMessage ? ` - ${message.task.statusMessage}` : ""}`);
    } else if (message.type === "result") {
      const text = message.result.content.find((item) => item.type === "text")?.text ?? "(no text)";
      console.log(`result: ${text}`);
    } else if (message.type === "error") {
      console.log(`error: ${message.error}`);
    }
  }
}

await runTask("complete_after_delay", { duration: 400 });
await runTask("fail_transiently", { reason: "temporary database failover" });
await runTask("expire_quickly", { ttlMs: 250 }, 500);

await client.close();
