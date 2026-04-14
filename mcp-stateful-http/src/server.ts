/**
 * MCP Stateful Streamable HTTP Server
 */

import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type Note = { id: string; text: string };

const app = createMcpExpressApp();
const transports = new Map<string, StreamableHTTPServerTransport>();
const notesBySession = new Map<string, Note[]>();

function serverForSession() {
  const server = new McpServer({ name: "mcp-stateful-http", version: "1.0.0" });

  server.registerTool(
    "add_note",
    {
      description: "Add a note to the current session only.",
      inputSchema: z.object({ text: z.string() }),
    },
    async ({ text }, extra) => {
      if (!extra.sessionId) throw new Error("Expected sessionId in stateful mode");
      const notes = notesBySession.get(extra.sessionId) ?? [];
      const note = { id: randomUUID(), text };
      notes.push(note);
      notesBySession.set(extra.sessionId, notes);
      return { content: [{ type: "text", text: `Added note ${note.id} to session ${extra.sessionId}` }] };
    }
  );

  server.registerTool(
    "list_notes",
    {
      description: "List notes stored in the current session.",
      inputSchema: z.object({}),
    },
    async (_args, extra) => {
      if (!extra.sessionId) throw new Error("Expected sessionId in stateful mode");
      const notes = notesBySession.get(extra.sessionId) ?? [];
      return {
        content: [
          {
            type: "text",
            text: notes.length === 0 ? "(no notes in this session)" : notes.map((note) => `- ${note.text}`).join("\n"),
          },
        ],
      };
    }
  );

  return server;
}

app.post("/mcp", async (req, res) => {
  const sessionIdHeader = req.headers["mcp-session-id"];
  const sessionId = typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Initialize first in stateful mode." }, id: null });
      return;
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        activeSessionId = newSessionId;
        transports.set(newSessionId, transport!);
        notesBySession.set(newSessionId, []);
      },
    });

    let activeSessionId: string | undefined;
    const server = serverForSession();
    transport.onclose = () => {
      if (activeSessionId) {
        transports.delete(activeSessionId);
        notesBySession.delete(activeSessionId);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) {
    res.status(400).send("Missing or unknown Mcp-Session-Id header.");
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) {
    res.status(400).send("Missing or unknown Mcp-Session-Id header.");
    return;
  }
  await transport.handleRequest(req, res);
});

app.listen(3014, () => {
  console.log("Stateful MCP server listening on http://localhost:3014/mcp");
});
