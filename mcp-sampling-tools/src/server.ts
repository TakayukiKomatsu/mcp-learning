/**
 * MCP Sampling With Tools Server
 *
 * This project extends plain sampling by attaching tool definitions to the
 * sampling request. The client-side model can use those tool definitions as
 * part of its reasoning loop.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-sampling-tools", version: "1.0.0" });

function sampledText(content: unknown): string {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const block = content as { type?: unknown; text?: unknown };
    if (block.type === "text") {
      return typeof block.text === "string" ? block.text : "Sampling returned a text block without text.";
    }
  }

  return "Sampling-with-tools returned non-text content.";
}

server.registerTool(
  "draft_outfit_advice",
  {
    description: "Ask the client-side model to draft advice while giving it tool definitions.",
    inputSchema: z.object({
      city: z.string(),
      celsius: z.number(),
    }),
  },
  async ({ city, celsius }) => {
    const sampled = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Give practical outfit advice for ${city}. The forecast is ${celsius}°C.`,
          },
        },
      ],
      maxTokens: 250,
      toolChoice: { mode: "required" },
      tools: [
        {
          name: "convert_temperature",
          description: "Convert Celsius to Fahrenheit.",
          inputSchema: {
            type: "object",
            properties: { celsius: { type: "number" } },
            required: ["celsius"],
          },
          annotations: { readOnlyHint: true, idempotentHint: true },
        },
        {
          name: "packing_categories",
          description: "Map weather ranges to practical packing categories.",
          inputSchema: {
            type: "object",
            properties: { celsius: { type: "number" } },
            required: ["celsius"],
          },
          annotations: { readOnlyHint: true, idempotentHint: true },
        },
      ],
    });

    return {
      content: [
        {
          type: "text",
          text: sampledText(sampled.content),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
