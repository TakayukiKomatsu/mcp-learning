/**
 * MCP Bundle Demo Inspector
 *
 * MCP Bundles (`.mcpb`) are zip archives containing a local server plus a
 * manifest. This script shows the manifest and then runs the bundled server the
 * same way a host application would: by reading `server.mcp_config`.
 */

import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type Manifest = {
  server: {
    mcp_config: {
      command: string;
      args: string[];
    };
  };
};

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8")) as Manifest;

console.log("Bundle manifest:");
console.log(JSON.stringify(manifest, null, 2));

const client = new Client({ name: "mcp-bundle-demo-inspector", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: manifest.server.mcp_config.command,
  args: manifest.server.mcp_config.args.map((arg) =>
    arg.replace("${__dirname}", new URL("..", import.meta.url).pathname)
  ),
});

await client.connect(transport);
const result = await client.callTool({ name: "bundle_hello", arguments: { name: "bundle user" } });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log("\nBundled tool result:");
    console.log(item.text);
  }
}

await client.close();
