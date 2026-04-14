/**
 * MCP OAuth Browser-Style Flow Demo
 *
 * This is a compact local authorization-code flow:
 * 1. Client fetches protected-resource metadata
 * 2. Client hits /authorize like a browser would
 * 3. Server redirects with an auth code
 * 4. Client exchanges the code at /oauth/token
 * 5. Client uses the bearer token for MCP requests
 */

import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { z } from "zod";

const app = createMcpExpressApp();
const codes = new Map<string, string>();
const tokens = new Map<string, AuthInfo>();

const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    const auth = tokens.get(token);
    if (!auth) throw new Error("Invalid token");
    return auth;
  },
};

app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: "http://localhost:3018/mcp",
    authorization_servers: ["http://localhost:3018"],
    scopes_supported: ["notes:read"],
  });
});

app.get("/authorize", (req, res) => {
  const redirectUri = String(req.query.redirect_uri ?? "");
  const state = String(req.query.state ?? "");
  const clientId = String(req.query.client_id ?? "");
  const code = randomUUID();
  codes.set(code, clientId);
  res.redirect(`${redirectUri}?code=${code}&state=${state}`);
});

app.post("/oauth/token", (req, res) => {
  const { code, client_id } = req.body as { code?: string; client_id?: string };
  if (!code || !client_id || codes.get(code) !== client_id) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }
  codes.delete(code);
  const token = `browser-token-${Date.now()}`;
  tokens.set(token, {
    token,
    clientId: client_id,
    scopes: ["notes:read"],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { username: "browser-user" },
  });
  res.json({ access_token: token, token_type: "Bearer", scope: "notes:read", expires_in: 3600 });
});

const authMiddleware = requireBearerAuth({
  verifier,
  requiredScopes: ["notes:read"],
  resourceMetadataUrl: "http://localhost:3018/.well-known/oauth-protected-resource",
});

app.post("/mcp", authMiddleware, async (req, res) => {
  const server = new McpServer({ name: "mcp-oauth-browser", version: "1.0.0" });
  server.registerTool(
    "whoami",
    {
      description: "Show the user identity obtained through the auth-code flow.",
      inputSchema: z.object({}),
    },
    async (_args, extra) => ({
      content: [{ type: "text", text: `Hello ${String(extra.authInfo?.extra?.username ?? "unknown")}` }],
    })
  );
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3018, () => {
  console.log("OAuth browser demo listening on http://localhost:3018");
});
