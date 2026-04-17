/**
 * MCP OAuth Discovery Demo Client
 *
 * The client walks the exact discovery chain:
 *
 * 1. GET /.well-known/oauth-protected-resource
 * 2. Follow authorization_servers[0]
 * 3. GET /.well-known/oauth-authorization-server
 * 4. Read token_endpoint
 * 5. POST to the discovered token_endpoint
 * 6. Use the token for MCP
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = "http://localhost:3022";

console.log("--- protected resource metadata ---");
const protectedResource = await fetch(`${BASE}/.well-known/oauth-protected-resource`).then((r) => r.json() as Promise<{
  authorization_servers: string[];
}>);
console.log(JSON.stringify(protectedResource, null, 2));

const authorizationServer = protectedResource.authorization_servers[0];
console.log("\n--- authorization server metadata ---");
const authorizationMetadata = await fetch(`${authorizationServer}/.well-known/oauth-authorization-server`).then(
  (r) => r.json() as Promise<{ token_endpoint: string }>
);
console.log(JSON.stringify(authorizationMetadata, null, 2));

console.log("\n--- token exchange ---");
const tokenResponse = await fetch(authorizationMetadata.token_endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    grant_type: "client_credentials",
    client_id: "discovery-client",
    client_secret: "discovery-secret",
  }),
}).then((r) => r.json() as Promise<{ access_token: string }>);
console.log(JSON.stringify(tokenResponse, null, 2));

const client = new Client({ name: "mcp-oauth-discovery-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } },
});
await client.connect(transport);

const result = await client.callTool({ name: "who_discovered_me", arguments: {} });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") console.log(`\n${item.text}`);
}

await client.close();
