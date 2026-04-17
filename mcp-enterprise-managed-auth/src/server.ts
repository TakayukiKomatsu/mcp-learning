/**
 * MCP Enterprise-Managed Authorization Demo
 *
 * This is an educational demo of the 2026 "enterprise-managed authorization"
 * style extension: the client arrives with identity and policy information
 * issued by enterprise infrastructure (SSO / IdP / gateway), and the MCP
 * server enforces policy without performing an interactive OAuth dance itself.
 *
 * The learning point is not a full enterprise standard implementation. The
 * point is understanding the architecture:
 *
 *   IdP / gateway / reverse proxy
 *       ↓ injects trusted identity + policy claims
 *   MCP server
 *       ↓ authorizes tools/resources based on those claims
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = createMcpExpressApp();
const PORT = 3024;

type EnterpriseContext = {
  userId: string;
  department: string;
  roles: string[];
};

function readEnterpriseHeaders(headers: Record<string, unknown>): EnterpriseContext | null {
  const userId = typeof headers["x-employee-id"] === "string" ? headers["x-employee-id"] : "";
  const department = typeof headers["x-department"] === "string" ? headers["x-department"] : "";
  const rolesHeader = typeof headers["x-roles"] === "string" ? headers["x-roles"] : "";

  if (!userId || !department) return null;
  return {
    userId,
    department,
    roles: rolesHeader.split(",").map((role) => role.trim()).filter(Boolean),
  };
}

app.post("/mcp", async (req, res) => {
  const ctx = readEnterpriseHeaders(req.headers as Record<string, unknown>);
  if (!ctx) {
    res.status(401).json({
      error: "enterprise_context_missing",
      message: "Expected enterprise identity headers from an upstream gateway.",
    });
    return;
  }

  const server = new McpServer({
    name: "mcp-enterprise-managed-auth",
    version: "1.0.0",
  });

  server.registerTool(
    "view_finance_report",
    {
      description: "Read a finance report. Only finance users or admins may access it.",
      inputSchema: z.object({ quarter: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ quarter }) => {
      const isFinance = ctx.department === "finance";
      const isAdmin = ctx.roles.includes("admin");

      if (!isFinance && !isAdmin) {
        return {
          content: [
            {
              type: "text",
              text: `Access denied for ${ctx.userId}. Finance report access requires finance department or admin role.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Finance report ${quarter} for ${ctx.userId}: revenue=1.2M, margin=18%, source=enterprise policy-approved access.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "who_am_i_enterprise",
    {
      description: "Show the enterprise identity context passed through the gateway.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      outputSchema: z.object({
        userId: z.string(),
        department: z.string(),
        roles: z.array(z.string()),
      }),
    },
    async () => ({
      content: [
        {
          type: "text",
          text: `Enterprise identity: ${ctx.userId} (${ctx.department}) roles=${ctx.roles.join(", ") || "(none)"}`,
        },
      ],
      structuredContent: ctx,
    })
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Enterprise-managed auth demo listening on http://localhost:${PORT}/mcp`);
});
