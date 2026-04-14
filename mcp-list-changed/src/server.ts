/**
 * MCP List-Changed Notifications Server
 *
 * Dynamic servers can add or remove tools, resources, and prompts at runtime.
 * When that happens, clients should be notified so they can invalidate caches
 * and re-fetch the latest manifests.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-list-changed", version: "1.0.0" });

let unlocked = false;

server.registerResource(
  "base-guide",
  "dynamic://guides/base",
  { description: "The always-available guide", mimeType: "text/plain" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/plain", text: "Base guide: unlock the bonus pack to see dynamic additions." }],
  })
);

server.registerPrompt(
  "base_prompt",
  {
    description: "Prompt that always exists",
    argsSchema: { audience: z.string() },
  },
  async ({ audience }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Write a friendly hello for ${audience}.` } }],
  })
);

server.registerTool(
  "unlock_bonus_pack",
  {
    description: "Register a new tool, resource, and prompt at runtime.",
    inputSchema: z.object({}),
  },
  async () => {
    if (!unlocked) {
      unlocked = true;

      server.registerTool(
        "bonus_echo",
        {
          description: "A tool registered after the session starts.",
          inputSchema: z.object({ text: z.string() }),
        },
        async ({ text }) => ({ content: [{ type: "text", text: `Bonus tool says: ${text}` }] })
      );

      server.registerResource(
        "bonus-guide",
        "dynamic://guides/bonus",
        { description: "A resource added after startup", mimeType: "text/plain" },
        async (uri) => ({
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Bonus guide: this resource appeared after a list-changed notification." }],
        })
      );

      server.registerPrompt(
        "bonus_prompt",
        {
          description: "A prompt added after startup",
          argsSchema: { topic: z.string() },
        },
        async ({ topic }) => ({
          messages: [{ role: "user", content: { type: "text", text: `Summarize why ${topic} matters in MCP.` } }],
        })
      );
    }

    return {
      content: [{ type: "text", text: "Bonus pack unlocked. The client should receive list-changed notifications." }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
