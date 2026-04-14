/**
 * DPoP-Style Auth Extension Demo
 *
 * This is intentionally a learning approximation, not a standards-complete
 * DPoP implementation. It demonstrates the core idea: bearer access token plus
 * a per-request proof header bound to the request method and URL.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = createMcpExpressApp();
const ACCESS_TOKEN = "demo-dpop-token";
const PROOF_SECRET = "demo-dpop-secret";

function expectedProof(method: string, url: string): string {
  return createHmac("sha256", PROOF_SECRET).update(`${method.toUpperCase()} ${url}`).digest("hex");
}

app.post("/mcp", async (req, res, next) => {
  const auth = req.headers.authorization;
  const proof = typeof req.headers.dpop === "string" ? req.headers.dpop : "";
  const url = "http://localhost:3019/mcp";

  if (auth !== `Bearer ${ACCESS_TOKEN}`) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  const expected = expectedProof(req.method, url);
  const ok =
    proof.length === expected.length &&
    timingSafeEqual(Buffer.from(proof, "utf8"), Buffer.from(expected, "utf8"));

  if (!ok) {
    res.status(401).json({ error: "invalid_dpop_proof" });
    return;
  }

  next();
});

app.post("/mcp", async (req, res) => {
  const server = new McpServer({ name: "mcp-dpop-demo", version: "1.0.0" });
  server.registerTool(
    "protected_echo",
    {
      description: "Protected endpoint requiring a DPoP-style proof header.",
      inputSchema: z.object({ text: z.string() }),
    },
    async ({ text }) => ({ content: [{ type: "text", text: `proof accepted: ${text}` }] })
  );
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3019, () => {
  console.log("DPoP-style demo listening on http://localhost:3019/mcp");
});
