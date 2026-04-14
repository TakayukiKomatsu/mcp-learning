import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-bundle-demo", version: "1.0.0" });

server.registerTool(
  "bundle_hello",
  {
    description: "Simple tool exposed by the bundled server.",
    inputSchema: z.object({ name: z.string() }),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello ${name}. This server is packaged like an MCP Bundle.` }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
