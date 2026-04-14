/**
 * MCP Auth Client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const metadata = await fetch("http://localhost:3015/.well-known/oauth-protected-resource").then((res) => res.json());
console.log("Protected resource metadata:");
console.log(JSON.stringify(metadata, null, 2));

const tokenResponse = await fetch("http://localhost:3015/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ client_id: "learning-client", client_secret: "learning-secret" }),
}).then((res) => res.json() as Promise<{ access_token: string }>);

const client = new Client({ name: "mcp-auth-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3015/mcp"), {
  requestInit: {
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  },
});

await client.connect(transport);

const result = await client.callTool({ name: "whoami", arguments: {} });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log("\nTool result:");
    console.log(item.text);
  }
}

await client.close();
