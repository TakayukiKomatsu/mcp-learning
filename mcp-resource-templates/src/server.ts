/**
 * MCP Resource Templates + Subscriptions Server
 *
 * Resource templates parameterize URIs. Subscriptions let the client ask to be
 * notified when a specific resource changes.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ResourceUpdatedNotificationSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const tickets = new Map<string, string>([
  ["MCP-101", "Investigate completion UX in prompt forms."],
  ["MCP-102", "Add task support to a report-generation workflow."],
  ["MCP-103", "Prototype a richer resource picker."],
]);

const subscribers = new Set<string>();

const server = new McpServer(
  { name: "mcp-resource-templates", version: "1.0.0" },
  { capabilities: { resources: { subscribe: true, listChanged: true } } }
);

server.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  subscribers.add(request.params.uri);
  return {};
});

server.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  subscribers.delete(request.params.uri);
  return {};
});

const ticketTemplate = new ResourceTemplate("tickets://{ticketId}", {
  list: async () => ({
    resources: [...tickets.keys()].map((ticketId) => ({
      uri: `tickets://${ticketId}`,
      name: ticketId,
      mimeType: "text/plain",
      description: `Ticket ${ticketId}`,
    })),
  }),
  complete: {
    ticketId: async (value) => [...tickets.keys()].filter((ticketId) => ticketId.startsWith(value.toUpperCase())),
  },
});

server.registerResource(
  "ticket-by-id",
  ticketTemplate,
  { description: "Parameterized ticket resource", mimeType: "text/plain" },
  async (uri, variables) => {
    const ticketId = String(variables.ticketId ?? "");
    const text = tickets.get(ticketId);
    if (!text) {
      throw new Error(`Unknown ticket: ${ticketId}`);
    }

    return {
      contents: [{ uri: uri.href, mimeType: "text/plain", text: `${ticketId}: ${text}` }],
    };
  }
);

server.registerTool(
  "update_ticket",
  {
    description: "Mutate a templated resource and notify subscribers.",
    inputSchema: z.object({
      ticketId: z.string(),
      text: z.string(),
    }),
  },
  async ({ ticketId, text }) => {
    const uri = `tickets://${ticketId}`;
    tickets.set(ticketId, text);

    if (subscribers.has(uri)) {
      await server.server.sendResourceUpdated({ uri });
    }

    return {
      content: [{ type: "text", text: `Updated ${ticketId}. Subscribers${subscribers.has(uri) ? "" : " not"} notified.` }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
