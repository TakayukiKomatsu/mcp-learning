/**
 * MCP Server Instructions Demo
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  { name: "mcp-server-instructions", version: "1.0.0" },
  {
    instructions: [
      "Use this server when the user wants a recommended next MCP concept to study.",
      "Prefer short, practical recommendations.",
      "If the user's focus mentions HTTP, prefer remote-transport topics before local-only topics.",
    ].join(" "),
  }
);

server.registerTool(
  "recommend_next_demo",
  {
    description: "Recommend the next MCP demo based on a learner's focus.",
    inputSchema: z.object({ focus: z.string() }),
  },
  async ({ focus }) => {
    const normalized = focus.toLowerCase();
    const recommendation = normalized.includes("http")
      ? "Study mcp-stateful-http next."
      : normalized.includes("prompt")
        ? "Study mcp-completions next."
        : "Study mcp-logging next.";

    return { content: [{ type: "text", text: recommendation }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
