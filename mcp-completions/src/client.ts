/**
 * MCP Completions Client
 *
 * The client explicitly calls `completion/complete` for:
 * - a prompt argument reference
 * - a resource-template reference
 *
 * This mirrors how a rich UI could power autocomplete widgets while the user
 * fills in prompt parameters or URI-template variables.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "mcp-completions-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });

await client.connect(transport);

console.log("=== Prompt completion ===");
const promptCompletion = await client.complete({
  ref: { type: "ref/prompt", name: "explain_topic" },
  argument: { name: "topic", value: "t" },
});
console.log(promptCompletion.completion.values.join(", "));

console.log("\n=== Prompt completion (tone) ===");
const toneCompletion = await client.complete({
  ref: { type: "ref/prompt", name: "explain_topic" },
  argument: { name: "tone", value: "b" },
});
console.log(toneCompletion.completion.values.join(", "));

console.log("\n=== Resource-template completion ===");
const resourceCompletion = await client.complete({
  ref: { type: "ref/resource", uri: "docs://guides/{slug}" },
  argument: { name: "slug", value: "g" },
});
console.log(resourceCompletion.completion.values.join(", "));

console.log("\n=== Read completed resource ===");
const readResult = await client.readResource({ uri: `docs://guides/${resourceCompletion.completion.values[0]}` });
for (const item of readResult.contents) {
  if ("text" in item && item.text) {
    console.log(item.text);
  }
}

await client.close();
