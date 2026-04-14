/**
 * MCP Elicitation Client
 *
 * The client advertises `elicitation.form` capability and handles the server's
 * `elicitation/create` request. For a learning repo we return a deterministic
 * response instead of prompting interactively, so the demo stays reproducible.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const client = new Client(
  { name: "mcp-elicitation-client", version: "1.0.0" },
  { capabilities: { elicitation: { form: {} } } }
);

client.setRequestHandler(ElicitRequestSchema, async (request) => {
  if (request.params.mode && request.params.mode !== "form") {
    throw new McpError(ErrorCode.InvalidParams, `Unsupported elicitation mode: ${request.params.mode}`);
  }

  console.log("Server requested elicitation:");
  console.log(`  Message: ${request.params.message}`);

  return {
    action: "accept",
    content: {
      day: "Tuesday",
      hour: "14:00",
      attendeesCsv: "takayuki, design-review-bot",
    },
  };
});

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

const result = await client.callTool({
  name: "plan_meeting",
  arguments: { topic: "API review" },
});

for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log("\nTool result:");
    console.log(item.text);
  }
}

await client.close();
