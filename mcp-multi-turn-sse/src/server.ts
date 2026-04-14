/**
 * Multi-Turn SSE Demo
 *
 * This is intentionally labeled as a proposal-style learning demo. It uses the
 * legacy SSE transport to show a long-lived session with multiple sequential
 * turns sharing per-session state.
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();
app.use(express.json());
const transports = new Map<string, SSEServerTransport>();
const notesBySession = new Map<string, string[]>();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/message", res);
  const server = new McpServer({ name: "mcp-multi-turn-sse", version: "1.0.0" });

  server.registerTool(
    "remember",
    {
      description: "Store a note inside the long-lived SSE session.",
      inputSchema: z.object({ text: z.string() }),
    },
    async ({ text }, extra) => {
      const sessionId = extra.sessionId ?? transport.sessionId;
      const notes = notesBySession.get(sessionId) ?? [];
      notes.push(text);
      notesBySession.set(sessionId, notes);
      return { content: [{ type: "text", text: `stored: ${text}` }] };
    }
  );

  server.registerTool(
    "recall",
    {
      description: "Read back notes from the same SSE session.",
      inputSchema: z.object({}),
    },
    async (_args, extra) => {
      const sessionId = extra.sessionId ?? transport.sessionId;
      const notes = notesBySession.get(sessionId) ?? [];
      return { content: [{ type: "text", text: notes.join("\n") || "(empty)" }] };
    }
  );

  transports.set(transport.sessionId, transport);
  transport.onclose = () => {
    transports.delete(transport.sessionId);
    notesBySession.delete(transport.sessionId);
  };
  await server.connect(transport);
});

app.post("/message", async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string") {
    res.status(400).json({ error: "missing sessionId" });
    return;
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "unknown session" });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

app.listen(3020, () => {
  console.log("Multi-turn SSE demo listening on http://localhost:3020/sse");
});
