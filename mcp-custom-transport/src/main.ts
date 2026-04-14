/**
 * MCP Custom Transport Demo
 *
 * This shows the minimum `Transport` contract. The transport below is not tied
 * to stdio, HTTP, or sockets. It just forwards JSON-RPC messages through two
 * linked in-memory queues with explicit delay so you can see that MCP itself is
 * transport-agnostic.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";

class DelayedLoopbackTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T) => void;
  sessionId?: string;
  private peer?: DelayedLoopbackTransport;
  private closed = false;

  connectPeer(peer: DelayedLoopbackTransport) {
    this.peer = peer;
  }

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed || !this.peer?.onmessage) return;
    setTimeout(() => {
      try {
        this.peer?.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }, 15);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.onclose?.();
  }
}

const a = new DelayedLoopbackTransport();
const b = new DelayedLoopbackTransport();
a.connectPeer(b);
b.connectPeer(a);

const server = new McpServer({ name: "mcp-custom-transport", version: "1.0.0" });
server.registerTool(
  "reverse_words",
  {
    description: "Reverse the word order in a sentence.",
    inputSchema: z.object({ text: z.string() }),
  },
  async ({ text }) => ({
    content: [{ type: "text", text: text.split(/\s+/).reverse().join(" ") }],
  })
);

const client = new Client({ name: "mcp-custom-transport-client", version: "1.0.0" });

await Promise.all([server.connect(a), client.connect(b)]);

const result = await client.callTool({ name: "reverse_words", arguments: { text: "custom transports carry MCP just fine" } });
for (const item of Array.isArray(result.content) ? result.content : []) {
  if (item.type === "text") {
    console.log(item.text);
  }
}

await client.close();
await server.close();
