/**
 * MCP Sampling Server
 *
 * Sampling is the mirror image of tools: instead of the client asking the
 * server to do work, the server asks the client to run a model completion.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-sampling", version: "1.0.0" });

server.registerTool(
  "brainstorm_titles",
  {
    description: "Ask the client-side model to brainstorm article titles.",
    inputSchema: z.object({
      topic: z.string().describe("Topic to brainstorm titles for"),
    }),
  },
  async ({ topic }) => {
    const sampled = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate three short blog post titles about "${topic}".`,
          },
        },
      ],
      maxTokens: 200,
    });

    return {
      content: [
        {
          type: "text",
          text: sampled.content.type === "text" ? sampled.content.text : "Sampling returned non-text content.",
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
