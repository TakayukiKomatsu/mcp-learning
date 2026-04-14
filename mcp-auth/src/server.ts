/**
 * MCP Auth / OAuth-ish Demo Server
 *
 * This is a compact local learning demo:
 * - `/.well-known/oauth-protected-resource` advertises the protected resource
 * - `/oauth/token` issues a bearer token for known client credentials
 * - `/mcp` is protected by bearer auth middleware
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { z } from "zod";

const app = createMcpExpressApp();
const issuedTokens = new Map<string, AuthInfo>();

const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    const auth = issuedTokens.get(token);
    if (!auth) throw new Error("Unknown access token");
    return auth;
  },
};

const authMiddleware = requireBearerAuth({
  verifier,
  requiredScopes: ["profile:read"],
  resourceMetadataUrl: "http://localhost:3015/.well-known/oauth-protected-resource",
});

app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: "http://localhost:3015/mcp",
    authorization_servers: ["http://localhost:3015"],
    scopes_supported: ["profile:read"],
  });
});

app.post("/oauth/token", (req, res) => {
  const { client_id, client_secret } = req.body as { client_id?: string; client_secret?: string };
  if (client_id !== "learning-client" || client_secret !== "learning-secret") {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const token = `demo-token-${Date.now()}`;
  issuedTokens.set(token, {
    token,
    clientId: client_id,
    scopes: ["profile:read"],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { username: "takayuki" },
  });

  res.json({ access_token: token, token_type: "Bearer", scope: "profile:read", expires_in: 3600 });
});

app.post("/mcp", authMiddleware, async (req, res) => {
  const server = new McpServer({ name: "mcp-auth", version: "1.0.0" });
  server.registerTool(
    "whoami",
    {
      description: "Return information extracted from the verified bearer token.",
      inputSchema: z.object({}),
    },
    async (_args, extra) => ({
      content: [
        {
          type: "text",
          text: `Authenticated as ${String(extra.authInfo?.extra?.username ?? "unknown")} with scopes ${(extra.authInfo?.scopes ?? []).join(", ")}`,
        },
      ],
    })
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3015, () => {
  console.log("Auth MCP server listening on http://localhost:3015/mcp");
});
