/**
 * MCP Server Cards Demo Server
 *
 * Server cards are discovery metadata exposed over HTTP so a client can inspect
 * a server before performing the full MCP initialize handshake.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = createMcpExpressApp();

const card = {
  name: "mcp-server-cards",
  version: "1.0.0",
  description: "Discovery metadata for an MCP server card demo.",
  endpoints: { mcp: "http://localhost:3017/mcp" },
  transports: ["streamable-http"],
  capabilities: { tools: {}, resources: {} },
};

app.get("/.well-known/mcp.json", (_req, res) => res.json(card));
app.get("/.well-known/mcp/server-card.json", (_req, res) => res.json(card));

app.post("/mcp", async (req, res) => {
  const server = new McpServer({ name: "mcp-server-cards", version: "1.0.0" });
  server.registerTool(
    "echo",
    {
      description: "Simple tool for post-discovery connection checks.",
      inputSchema: z.object({ text: z.string() }),
    },
    async ({ text }) => ({ content: [{ type: "text", text: `echo: ${text}` }] })
  );

  server.registerResource(
    "server-card-resource",
    "mcp://server-card",
    { description: "The same server card, exposed as an MCP resource", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(card, null, 2) }],
    })
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3017, () => {
  console.log("Server-card demo listening on http://localhost:3017");
});
