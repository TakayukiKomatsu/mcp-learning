/**
 * MCP OAuth 2.0 Client Credentials Demo Client
 *
 * This client demonstrates the full machine-to-machine (M2M) authentication
 * flow with no browser, no redirect, and no human involvement:
 *
 *   1. Fetch /.well-known/oauth-protected-resource to find trusted auth servers
 *   1b. Fetch /.well-known/oauth-authorization-server on that AS to find the
 *       token_endpoint (RFC 8414 auto-discovery — no hardcoded URLs)
 *   2. POST grant_type=client_credentials to obtain a bearer token
 *   3. Connect to /mcp with the token in the Authorization header
 *   4. Call get_system_status (read-only metrics)
 *   5. Call submit_job (write operation attributed to the service identity)
 *
 * Notice that steps 1–3 are entirely programmatic. Compare this to
 * mcp-oauth-browser/src/client.ts where the client has to simulate a browser
 * redirect and extract a code from a Location header. Here there is no
 * redirect at all — just a single token request followed by tool calls.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = "http://localhost:3021";

// ---------------------------------------------------------------------------
// Step 1: Discover the token endpoint from resource metadata.
// In production an MCP client that supports io.modelcontextprotocol/oauth-client-credentials
// performs this discovery automatically. We do it explicitly here so the
// learning value is visible.
// ---------------------------------------------------------------------------
console.log("--- Step 1: Fetching resource metadata ---");
const metadata = await fetch(`${BASE}/.well-known/oauth-protected-resource`).then(
  (r) => r.json()
);
console.log(JSON.stringify(metadata, null, 2));

// The resource metadata tells us which authorization server(s) are trusted.
// A fully spec-compliant client never hardcodes the token endpoint; it fetches
// the authorization server's own discovery document (RFC 8414) to find it.
const authServer: string = (metadata as { authorization_servers: string[] })
  .authorization_servers[0];

// ---------------------------------------------------------------------------
// Step 1b: Fetch authorization server metadata (RFC 8414).
// The AS publishes its capabilities at /.well-known/oauth-authorization-server.
// From that document we extract the token_endpoint rather than guessing it.
// ---------------------------------------------------------------------------
console.log(`\n--- Step 1b: Fetching authorization server metadata (RFC 8414) ---`);
const asMeta = await fetch(`${authServer}/.well-known/oauth-authorization-server`).then(
  (r) => r.json() as Promise<{ token_endpoint: string; grant_types_supported: string[] }>
);
console.log("Authorization server metadata:");
console.log(`  token_endpoint: ${asMeta.token_endpoint}`);
console.log(`  grant_types_supported: ${JSON.stringify(asMeta.grant_types_supported)}`);

const tokenEndpoint = asMeta.token_endpoint;
console.log(`\nToken endpoint (discovered): ${tokenEndpoint}`);

// ---------------------------------------------------------------------------
// Step 2: Obtain a token via the Client Credentials grant.
// No user, no redirect. Just client_id + client_secret + grant_type.
// ---------------------------------------------------------------------------
console.log("\n--- Step 2: Requesting access token (client_credentials) ---");
const tokenResponse = await fetch(tokenEndpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    grant_type: "client_credentials",
    client_id: "service-a",
    client_secret: "secret-a",
  }),
}).then((r) => r.json() as Promise<{ access_token: string; token_type: string; scope: string; expires_in: number }>);

console.log("Token response:");
console.log(JSON.stringify(tokenResponse, null, 2));

// ---------------------------------------------------------------------------
// Step 3: Connect to MCP with the bearer token.
// The token is attached to every HTTP request via the Authorization header.
// There is no MCP-level session — we use sessionIdGenerator: undefined to
// keep this stateless (same pattern as the other demos in this repo).
// ---------------------------------------------------------------------------
console.log("\n--- Step 3: Connecting to MCP endpoint ---");
const client = new Client({ name: "mcp-cc-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
  requestInit: {
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  },
});
await client.connect(transport);
console.log("Connected.");

// ---------------------------------------------------------------------------
// Step 4: Call get_system_status (read-only, no arguments)
// ---------------------------------------------------------------------------
console.log("\n--- Step 4: Calling get_system_status ---");
const statusResult = await client.callTool({ name: "get_system_status", arguments: {} });
for (const item of Array.isArray(statusResult.content) ? statusResult.content : []) {
  if (item.type === "text") console.log(item.text);
}

// ---------------------------------------------------------------------------
// Step 5: Call submit_job (attributed to the authenticated service identity)
// ---------------------------------------------------------------------------
console.log("\n--- Step 5: Calling submit_job ---");
const jobResult = await client.callTool({
  name: "submit_job",
  arguments: { jobType: "data-export", priority: 3 },
});
for (const item of Array.isArray(jobResult.content) ? jobResult.content : []) {
  if (item.type === "text") console.log(item.text);
}

await client.close();
console.log("\nDone. No browser was opened, no user was involved.");
