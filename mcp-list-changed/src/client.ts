/**
 * MCP List-Changed Notifications Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

const client = new Client({ name: "mcp-list-changed-client", version: "1.0.0" });

client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
  console.log("Notification: tools list changed");
});
client.setNotificationHandler(ResourceListChangedNotificationSchema, async () => {
  console.log("Notification: resources list changed");
});
client.setNotificationHandler(PromptListChangedNotificationSchema, async () => {
  console.log("Notification: prompts list changed");
});

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

console.log("=== Before unlock ===");
console.log("Tools:", (await client.listTools()).tools.map((tool) => tool.name).join(", "));
console.log("Resources:", (await client.listResources()).resources.map((resource) => resource.uri).join(", "));
console.log("Prompts:", (await client.listPrompts()).prompts.map((prompt) => prompt.name).join(", "));

await client.callTool({ name: "unlock_bonus_pack", arguments: {} });

console.log("\n=== After unlock ===");
console.log("Tools:", (await client.listTools()).tools.map((tool) => tool.name).join(", "));
console.log("Resources:", (await client.listResources()).resources.map((resource) => resource.uri).join(", "));
console.log("Prompts:", (await client.listPrompts()).prompts.map((prompt) => prompt.name).join(", "));

await client.close();
