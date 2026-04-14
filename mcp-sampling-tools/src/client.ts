/**
 * MCP Sampling With Tools Client
 *
 * The sampling request includes tool definitions, not executable tool
 * callbacks. In a real MCP client, the model/provider would use those
 * definitions. Here we emulate that reasoning loop with local helper logic.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";

function convertTemperature(celsius: number): number {
  return celsius * 1.8 + 32;
}

function packingCategories(celsius: number): string[] {
  if (celsius <= 10) return ["coat", "layers", "closed shoes"];
  if (celsius <= 22) return ["light jacket", "jeans", "comfortable shoes"];
  return ["t-shirt", "breathable layers", "water bottle"];
}

const client = new Client(
  { name: "mcp-sampling-tools-client", version: "1.0.0" },
  { capabilities: { sampling: { tools: {} } } }
);

client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
  const promptBlock = request.params.messages[0]?.content;
  const prompt =
    promptBlock && !Array.isArray(promptBlock) && promptBlock.type === "text" ? promptBlock.text : "(unknown prompt)";

  const toolNames = (request.params.tools ?? []).map((tool) => tool.name).join(", ");
  console.log("Sampling-with-tools request received:");
  console.log(`  Prompt: ${prompt}`);
  console.log(`  Tool definitions: ${toolNames}`);

  const celsiusMatch = prompt.match(/(-?\d+(?:\.\d+)?)°C/);
  const celsius = celsiusMatch ? Number(celsiusMatch[1]) : 20;
  const fahrenheit = convertTemperature(celsius);
  const packing = packingCategories(celsius);

  return {
    model: "mock-agent-loop",
    role: "assistant",
    content: {
      type: "text",
      text: `The provided tool definitions suggest ${celsius}°C is about ${fahrenheit.toFixed(
        1
      )}°F. I would recommend ${packing.join(", ")}.`,
    },
  };
});

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

const result = await client.callTool({
  name: "draft_outfit_advice",
  arguments: { city: "São Paulo", celsius: 27 },
});

for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log("\nTool result:");
    console.log(item.text);
  }
}

await client.close();
