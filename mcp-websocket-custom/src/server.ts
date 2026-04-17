/**
 * Non-standard WebSocket MCP server.
 *
 * Use this only when you control both client and server and specifically want a
 * WebSocket transport. For standards-based interoperability, prefer stdio or
 * Streamable HTTP.
 */

import { WebSocketServer } from "ws";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebSocketTransport } from "./transport.js";

const PORT = 3025;
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (socket) => {
  const server = new McpServer({ name: "mcp-websocket-custom", version: "1.0.0" });

  server.registerTool(
    "session_echo",
    {
      description: "Echo text over a persistent non-standard WebSocket MCP transport.",
      inputSchema: z.object({ text: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ text }) => ({
      content: [{ type: "text", text: `websocket echo: ${text}` }],
    })
  );

  const transport = new WebSocketTransport(socket);
  transport.onclose = () => {
    void server.close();
  };

  await server.connect(transport);
});

console.log(`WebSocket custom MCP demo listening on ws://localhost:${PORT}`);
