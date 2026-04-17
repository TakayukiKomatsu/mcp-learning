/**
 * MCP OAuth Discovery Demo Server
 *
 * This project isolates the OAuth discovery chain itself:
 *
 * 1. The resource server publishes `/.well-known/oauth-protected-resource`
 * 2. The authorization server publishes `/.well-known/oauth-authorization-server`
 * 3. The client discovers the token endpoint instead of hardcoding it
 * 4. The client exchanges credentials for a bearer token
 * 5. The client calls a protected MCP endpoint
 *
 * This is narrower than `mcp-oauth-client-credentials`, which teaches the full
 * machine-to-machine flow. Here the focus is specifically on discovery.
 */

import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { z } from "zod";

const PORT = 3022;
const BASE = `http://localhost:${PORT}`;
const app = createMcpExpressApp();
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
    resource: `${BASE}/mcp`,
    authorization_servers: [BASE],
    scopes_supported: ["discover:read"],
  });
});

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: BASE,
    token_endpoint: `${BASE}/oauth/token`,
    grant_types_supported: ["client_credentials"],
    scopes_supported: ["discover:read"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
});

app.post("/oauth/token", (req, res) => {
  const { grant_type, client_id, client_secret } = req.body as {
    grant_type?: string;
    client_id?: string;
    client_secret?: string;
  };

  if (grant_type !== "client_credentials") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  if (client_id !== "discovery-client" || client_secret !== "discovery-secret") {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const token = `discovery-token-${randomUUID()}`;
  tokens.set(token, {
    token,
    clientId: client_id,
    scopes: ["discover:read"],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { clientKind: "discovery-demo" },
  });

  res.json({
    access_token: token,
    token_type: "Bearer",
    scope: "discover:read",
    expires_in: 3600,
  });
});

const authMiddleware = requireBearerAuth({
  verifier,
  requiredScopes: ["discover:read"],
  resourceMetadataUrl: `${BASE}/.well-known/oauth-protected-resource`,
});

app.post("/mcp", authMiddleware, async (req, res) => {
  const server = new McpServer({ name: "mcp-oauth-discovery", version: "1.0.0" });

  server.registerTool(
    "who_discovered_me",
    {
      description: "Show that the client reached the MCP endpoint through the OAuth discovery chain.",
      inputSchema: z.object({}),
    },
    async (_args, extra) => ({
      content: [
        {
          type: "text",
          text: `Authenticated clientId=${extra.authInfo?.clientId} via discovered token endpoint ${BASE}/oauth/token`,
        },
      ],
    })
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`OAuth discovery demo listening on ${BASE}`);
});
