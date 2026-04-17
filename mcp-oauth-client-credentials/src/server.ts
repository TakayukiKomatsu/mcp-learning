/**
 * MCP OAuth 2.0 Client Credentials Demo Server
 *
 * WHAT IS THE CLIENT CREDENTIALS GRANT?
 * The OAuth 2.0 Client Credentials grant (RFC 6749 §4.4) is the simplest OAuth
 * flow. A client authenticates directly with the authorization server using its
 * own client_id and client_secret — no user, no browser, no redirect URI, no
 * authorization code. The server validates the credentials and immediately issues
 * an access token. That token represents the client (a service) itself, not any
 * human user.
 *
 * The token request looks like this:
 *
 *   POST /oauth/token
 *   Content-Type: application/json
 *
 *   {
 *     "grant_type": "client_credentials",
 *     "client_id": "service-a",
 *     "client_secret": "secret-a"
 *   }
 *
 * WHY USE IT?
 * Most real-world MCP deployments involve automated services calling other
 * services — no human sitting at a keyboard. Examples: an AI agent that runs
 * in a CI/CD pipeline, a backend microservice fetching data from an internal
 * MCP tool server, or a scheduled job that reports system metrics. In all these
 * cases you need auth, but there is no user to redirect to a login page. The
 * Client Credentials grant was designed exactly for this pattern.
 *
 * WHEN IS THIS THE RIGHT PATTERN?
 * - Automated agents / bots that act on their own behalf
 * - Backend service-to-service communication (M2M)
 * - CI/CD pipelines and daemon processes
 * - Scheduled tasks and cron jobs
 * - Any scenario where a human approval step is impossible or undesirable
 *
 * HOW IT DIFFERS FROM THE AUTH CODE FLOW (mcp-oauth-browser):
 * The authorization code flow (mcp-oauth-browser) is designed for delegated
 * access: a human user approves the client's request in a browser, and the
 * resulting token represents that user's delegated permission. There is a
 * redirect URI, a browser redirect, a short-lived code, and a code exchange
 * step. The token says "user Alice authorized service X to act on her behalf."
 * Client Credentials has none of that. The token says "service X is acting as
 * itself." There is no user identity in the token.
 *
 * HOW IT DIFFERS FROM SIMPLE BEARER AUTH (mcp-auth):
 * mcp-auth is a minimal demo that shows bearer token mechanics: issue a token
 * at /oauth/token, pass it as Authorization: Bearer. It works, but the token
 * endpoint accepts any client_id/client_secret without enforcing grant_type
 * semantics. It is not proper OAuth 2.0. Client Credentials adds:
 *   - Mandatory grant_type=client_credentials in every token request
 *   - Explicit rejection of other grant types (unsupported_grant_type error)
 *   - Per-client scope negotiation (service-a gets data:read only; service-b
 *     gets data:read + data:write)
 *   - The full RFC-compliant token response shape (token_type, scope, expires_in)
 * This matters in production because OAuth 2.0-aware libraries and API gateways
 * inspect grant_type to decide how to process a token request.
 *
 * THE OFFICIAL EXTENSION:
 * The MCP specification includes the `io.modelcontextprotocol/oauth-client-credentials`
 * extension, which standardizes exactly this pattern. Any MCP-aware M2M client
 * that supports the extension knows to:
 *   1. Fetch /.well-known/oauth-protected-resource to discover the token endpoint
 *   2. POST grant_type=client_credentials with its pre-issued credentials
 *   3. Attach the resulting bearer token to every /mcp request
 * Advertising the extension in your server's capability metadata signals to
 * clients that no browser flow is needed — they can authenticate fully
 * programmatically.
 */

import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Known clients — in production these would live in a database or secrets
// manager. Each client has a fixed set of scopes it is allowed to request.
// ---------------------------------------------------------------------------
const CLIENTS: Record<string, { secret: string; scopes: string[] }> = {
  "service-a": { secret: "secret-a", scopes: ["data:read"] },
  "service-b": { secret: "secret-b", scopes: ["data:read", "data:write"] },
};

// In-memory token store. Maps raw token string → AuthInfo so the verifier
// can look up who owns a given token on each request.
const issuedTokens = new Map<string, AuthInfo>();

// ---------------------------------------------------------------------------
// Token verifier — the SDK's requireBearerAuth middleware calls this on every
// protected request to turn a raw bearer string into structured AuthInfo.
// ---------------------------------------------------------------------------
const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    const auth = issuedTokens.get(token);
    if (!auth) throw new Error("Unknown access token");
    return auth;
  },
};

// Both MCP tools require data:read. service-a and service-b both have it, so
// either credential can call both tools. service-b additionally has data:write
// which would be needed for any write-scoped endpoint (not shown here, but the
// scope is present on the token so you could add such a check trivially).
const authMiddleware = requireBearerAuth({
  verifier,
  requiredScopes: ["data:read"],
  resourceMetadataUrl:
    "http://localhost:3021/.well-known/oauth-protected-resource",
});

const app = createMcpExpressApp();

// ---------------------------------------------------------------------------
// Resource metadata — advertises this server as a protected resource and
// tells clients where to obtain tokens. The MCP client-credentials extension
// looks for this document first to discover the token endpoint.
// ---------------------------------------------------------------------------
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: "http://localhost:3021/mcp",
    authorization_servers: ["http://localhost:3021"],
    scopes_supported: ["data:read", "data:write"],
    // Advertise the official M2M extension so compliant clients know they
    // can authenticate programmatically without a browser.
    bearer_methods_supported: ["header"],
    grant_types_supported: ["client_credentials"],
  });
});

// ---------------------------------------------------------------------------
// Authorization server metadata (RFC 8414).
//
// RFC 8414 defines a discovery document that an OAuth 2.0 authorization
// server publishes at /.well-known/oauth-authorization-server. It is the
// authorization server's self-description: where the token endpoint is, which
// grant types are supported, which scopes can be issued, and how clients must
// authenticate at the token endpoint.
//
// Contrast with /.well-known/oauth-protected-resource (above):
//   oauth-protected-resource  -- published by the resource server (the MCP
//                                 server). Tells clients where to get tokens
//                                 and which authorization servers are trusted.
//   oauth-authorization-server -- published by the authorization server (the
//                                 token issuer). Tells clients how to use the
//                                 token endpoint once they have found it.
//
// In this demo the resource server and authorization server run in the same
// process on the same origin, so both well-known documents live at
// http://localhost:3021. In production they are often different services at
// different origins, and the client must walk the chain:
//   1. Fetch oauth-protected-resource  --> authorization_servers[0]
//   2. Fetch oauth-authorization-server on that AS  --> token_endpoint
//   3. POST to the discovered token_endpoint
//
// A fully spec-compliant M2M client never hardcodes the token endpoint URL;
// it always derives it from this document.
// ---------------------------------------------------------------------------
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: "http://localhost:3021",
    token_endpoint: "http://localhost:3021/oauth/token",
    grant_types_supported: ["client_credentials"],
    scopes_supported: ["data:read", "data:write"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
});

// ---------------------------------------------------------------------------
// Token endpoint — implements the Client Credentials grant.
//
// Key behaviours enforced here:
//   1. grant_type MUST be "client_credentials" — any other value gets
//      unsupported_grant_type per RFC 6749 §5.2.
//   2. Credentials are validated against the CLIENTS registry.
//   3. The granted scope is taken from the client's pre-configured set, not
//      from what the client asked for. Real implementations intersect the
//      requested scope with the allowed scope.
// ---------------------------------------------------------------------------
app.post("/oauth/token", (req, res) => {
  const { grant_type, client_id, client_secret } = req.body as {
    grant_type?: string;
    client_id?: string;
    client_secret?: string;
  };

  // Step 1: enforce grant type
  if (grant_type !== "client_credentials") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  // Step 2: validate client identity
  const clientRecord = client_id ? CLIENTS[client_id] : undefined;
  if (!clientRecord || clientRecord.secret !== client_secret) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  // Step 3: issue token
  const token = `cc-token-${randomUUID()}`;
  const scope = clientRecord.scopes.join(" ");
  issuedTokens.set(token, {
    token,
    clientId: client_id!,
    scopes: clientRecord.scopes,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    // No "username" here — there is no user. The extra field carries the
    // service identity for logging purposes in the MCP tools below.
    extra: { serviceId: client_id },
  });

  res.json({
    access_token: token,
    token_type: "Bearer",
    scope,
    expires_in: 3600,
  });
});

// ---------------------------------------------------------------------------
// Protected MCP endpoint
// ---------------------------------------------------------------------------
app.post("/mcp", authMiddleware, async (req, res) => {
  const server = new McpServer({
    name: "mcp-oauth-client-credentials",
    version: "1.0.0",
  });

  // Tool 1: get_system_status
  // A read-only tool that returns fake system metrics. Any service with
  // data:read scope can call this. readOnlyHint tells MCP clients this tool
  // has no side-effects and is safe to call freely.
  server.registerTool(
    "get_system_status",
    {
      description: "Return fake system metrics for this demo server.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              cpu_usage_pct: Math.floor(Math.random() * 40) + 10,
              memory_used_mb: Math.floor(Math.random() * 512) + 256,
              uptime_seconds: Math.floor(Date.now() / 1000) % 86400,
              active_connections: Math.floor(Math.random() * 20) + 1,
              status: "healthy",
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // Tool 2: submit_job
  // Accepts a job description and returns a generated job ID. The authInfo
  // is used to record which service submitted the job — useful for audit
  // trails in M2M scenarios where there is no human user to attribute work to.
  server.registerTool(
    "submit_job",
    {
      description: "Submit a background job and receive a job ID.",
      inputSchema: z.object({
        jobType: z.string().describe("The type of job to run"),
        priority: z
          .number()
          .int()
          .min(1)
          .max(5)
          .describe("Job priority from 1 (low) to 5 (critical)"),
      }),
    },
    async ({ jobType, priority }, extra) => {
      const serviceId = String(extra.authInfo?.extra?.serviceId ?? "unknown");
      const jobId = `job-${randomUUID().slice(0, 8)}`;
      console.log(
        `[server] Job submitted by ${serviceId}: id=${jobId} type=${jobType} priority=${priority}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                job_id: jobId,
                submitted_by: serviceId,
                job_type: jobType,
                priority,
                queued_at: new Date().toISOString(),
                status: "queued",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3021, () => {
  console.log(
    "Client Credentials MCP server listening on http://localhost:3021"
  );
  console.log("  POST /oauth/token                              — token endpoint (grant_type=client_credentials)");
  console.log("  POST /mcp                                      — protected MCP endpoint");
  console.log("  GET  /.well-known/oauth-protected-resource     — resource server metadata (RFC 8707)");
  console.log("  GET  /.well-known/oauth-authorization-server   — authorization server metadata (RFC 8414)");
});
