/**
 * MCP Retry, Jitter, and Failure Classification Server
 *
 * This demo is intentionally isolated from the tasks API. It teaches the
 * client-side retry policy you still need even when you are not using tasks:
 *
 * - classify failures as transient vs permanent
 * - retry only transient failures
 * - use jitter to avoid synchronized retries
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const transientAttempts = new Map<string, number>();
const server = new McpServer({ name: "mcp-retry-jitter", version: "1.0.0" });

server.registerTool(
  "call_unstable_api",
  {
    description: "Simulate an unstable dependency that may fail transiently or permanently.",
    inputSchema: z.object({
      jobId: z.string(),
      mode: z.enum(["transient_then_success", "permanent_failure"]),
      transientFailures: z.number().int().min(1).max(5).default(2),
    }),
    outputSchema: z.object({
      classification: z.enum(["success", "transient", "permanent"]),
      attemptsSeen: z.number(),
    }),
  },
  async ({ jobId, mode, transientFailures }) => {
    const attemptsSeen = (transientAttempts.get(jobId) ?? 0) + 1;
    transientAttempts.set(jobId, attemptsSeen);

    if (mode === "permanent_failure") {
      return {
        content: [
          {
            type: "text",
            text: `Permanent failure for ${jobId}: invalid API key. Do not retry automatically.`,
          },
        ],
        structuredContent: {
          classification: "permanent",
          attemptsSeen,
        },
        isError: true,
      };
    }

    if (attemptsSeen <= transientFailures) {
      return {
        content: [
          {
            type: "text",
            text: `Transient failure for ${jobId}: upstream timeout on attempt ${attemptsSeen}. Safe to retry with backoff.`,
          },
        ],
        structuredContent: {
          classification: "transient",
          attemptsSeen,
        },
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Success for ${jobId} after ${attemptsSeen} attempt(s).`,
        },
      ],
      structuredContent: {
        classification: "success",
        attemptsSeen,
      },
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
