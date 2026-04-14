/**
 * MCP Resource Templates + Subscriptions Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

const client = new Client({ name: "mcp-resource-templates-client", version: "1.0.0" });

client.setNotificationHandler(ResourceUpdatedNotificationSchema, async (notification) => {
  console.log(`Notification: resource updated -> ${notification.params.uri}`);
});

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

console.log("Templates:");
const templates = await client.listResourceTemplates();
for (const template of templates.resourceTemplates) {
  console.log(`  - ${template.uriTemplate}`);
}

const completion = await client.complete({
  ref: { type: "ref/resource", uri: "tickets://{ticketId}" },
  argument: { name: "ticketId", value: "MCP-10" },
});

const ticketUri = `tickets://${completion.completion.values[0]}`;
console.log(`\nReading ${ticketUri}`);
const read = await client.readResource({ uri: ticketUri });
for (const item of read.contents) {
  if ("text" in item && item.text) {
    console.log(item.text);
  }
}

console.log(`\nSubscribing to ${ticketUri}`);
await client.subscribeResource({ uri: ticketUri });

await client.callTool({
  name: "update_ticket",
  arguments: {
    ticketId: completion.completion.values[0],
    text: "Updated ticket body after client subscription.",
  },
});

await client.unsubscribeResource({ uri: ticketUri });
await client.close();
