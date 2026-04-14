import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const metadata = await fetch("http://localhost:3018/.well-known/oauth-protected-resource").then((r) => r.json());
console.log("Metadata:", JSON.stringify(metadata));

const state = "demo-state";
const redirectUri = "http://localhost:3999/callback";
const authResponse = await fetch(
  `http://localhost:3018/authorize?client_id=browser-client&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
  { redirect: "manual" }
);
const location = authResponse.headers.get("location");
if (!location) throw new Error("No redirect location from /authorize");
const redirected = new URL(location);
const code = redirected.searchParams.get("code");
if (!code) throw new Error("No code in redirect");

const token = await fetch("http://localhost:3018/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code, client_id: "browser-client" }),
}).then((r) => r.json() as Promise<{ access_token: string }>);

const client = new Client({ name: "mcp-oauth-browser-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3018/mcp"), {
  requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } },
});
await client.connect(transport);
const result = await client.callTool({ name: "whoami", arguments: {} });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") console.log(item.text);
}
await client.close();
