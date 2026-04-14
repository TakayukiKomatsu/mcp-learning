/**
 * MCP Pagination Demo Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "mcp-pagination-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

let cursor: string | undefined;
let pageNumber = 1;

do {
  const result = await client.listResources(cursor ? { cursor } : {});
  console.log(`Page ${pageNumber}: ${result.resources.map((resource) => resource.uri).join(", ")}`);
  cursor = result.nextCursor;
  pageNumber += 1;
} while (cursor);

const read = await client.readResource({ uri: "paged://doc/4" });
for (const item of read.contents) {
  if ("text" in item && item.text) {
    console.log("\nRead specific resource:");
    console.log(item.text);
  }
}

await client.close();
