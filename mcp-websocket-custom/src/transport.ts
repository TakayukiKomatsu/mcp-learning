import WebSocket from "ws";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * Non-standard WebSocket transport.
 *
 * MCP does not standardize WebSockets as an official transport, but the
 * protocol itself is transport-agnostic. This transport simply forwards JSON-RPC
 * messages over a single persistent WebSocket.
 */
export class WebSocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T) => void;
  sessionId?: string;

  constructor(private readonly socket: WebSocket) {}

  async start(): Promise<void> {
    this.socket.on("message", (raw) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as JSONRPCMessage;
        this.onmessage?.(parsed);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    });

    this.socket.on("close", () => {
      this.onclose?.();
    });

    this.socket.on("error", (error) => {
      this.onerror?.(error);
    });

    if (this.socket.readyState === WebSocket.CONNECTING) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.socket.off("open", onOpen);
          this.socket.off("error", onError);
        };
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        this.socket.on("open", onOpen);
        this.socket.on("error", onError);
      });
    }
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    const payload = JSON.stringify(message);
    await new Promise<void>((resolve, reject) => {
      this.socket.send(payload, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSING || this.socket.readyState === WebSocket.CLOSED) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.socket.once("close", () => resolve());
      this.socket.close();
    });
  }
}
