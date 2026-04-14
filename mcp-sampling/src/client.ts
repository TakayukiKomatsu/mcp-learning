/**
 * MCP Sampling Client
 *
 * The client advertises `sampling` capability and acts like a tiny mock LLM.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const client = new Client(
  { name: "mcp-sampling-client", version: "1.0.0" },
  { capabilities: { sampling: {} } }
);

client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
  const promptBlock = request.params.messages[0]?.content;
  const prompt =
    promptBlock && !Array.isArray(promptBlock) && promptBlock.type === "text" ? promptBlock.text : "(unknown prompt)";

  console.log("Sampling request received from server:");
  console.log(`  ${prompt}`);

  return {
    model: "mock-idea-model",
    role: "assistant",
    content: {
      type: "text",
      text: [
        "1. MCP Without the Mystery",
        "2. Why Sampling Changes MCP Workflows",
        "3. Server-Asks-Client: The Sampling Pattern",
      ].join("\n"),
    },
  };
});

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

const result = await client.callTool({
  name: "brainstorm_titles",
  arguments: { topic: "MCP sampling" },
});

for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log("\nTool result:");
    console.log(item.text);
  }
}

await client.close();
