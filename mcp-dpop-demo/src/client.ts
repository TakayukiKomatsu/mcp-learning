import { createHmac } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ACCESS_TOKEN = "demo-dpop-token";
const PROOF_SECRET = "demo-dpop-secret";
const url = "http://localhost:3019/mcp";
const dpop = createHmac("sha256", PROOF_SECRET).update(`POST ${url}`).digest("hex");

const client = new Client({ name: "mcp-dpop-demo-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      DPoP: dpop,
    },
  },
});

await client.connect(transport);
const result = await client.callTool({ name: "protected_echo", arguments: { text: "secure-ish request" } });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") console.log(item.text);
}
await client.close();
