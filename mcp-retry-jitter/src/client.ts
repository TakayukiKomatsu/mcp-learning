/**
 * Retry, jitter, and failure classification client demo.
 *
 * The policy here is:
 * - retry transient failures
 * - never retry permanent failures
 * - apply exponential backoff with jitter
 */

import { randomInt } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type Structured = { classification?: "success" | "transient" | "permanent"; attemptsSeen?: number };

function textFromResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: Array<{ type?: unknown; text?: unknown }> }).content;
  return Array.isArray(content) ? content.filter((item) => item.type === "text").map((item) => String(item.text ?? "")).join("\n") : "";
}

function structuredFromResult(result: unknown): Structured {
  if (!result || typeof result !== "object") return {};
  return ((result as { structuredContent?: Structured }).structuredContent ?? {}) as Structured;
}

async function retryWithJitter(client: Client, jobId: string, mode: "transient_then_success" | "permanent_failure") {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await client.callTool({
      name: "call_unstable_api",
      arguments: { jobId, mode, transientFailures: 2 },
    });

    const text = textFromResult(result);
    const structured = structuredFromResult(result);
    console.log(`[${jobId}] attempt ${attempt}: ${text}`);

    if (structured.classification === "success") {
      console.log(`[${jobId}] done`);
      return;
    }

    if (structured.classification === "permanent") {
      console.log(`[${jobId}] stop immediately: permanent failure`);
      return;
    }

    const baseDelay = 150 * 2 ** (attempt - 1);
    const jitter = randomInt(0, 90);
    const delay = baseDelay + jitter;
    console.log(`[${jobId}] transient failure -> backoff ${delay}ms (base=${baseDelay}, jitter=${jitter})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.log(`[${jobId}] gave up after max attempts`);
}

const client = new Client({ name: "mcp-retry-jitter-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
await client.connect(transport);

console.log("=== transient_then_success ===");
await retryWithJitter(client, "job-transient", "transient_then_success");

console.log("\n=== permanent_failure ===");
await retryWithJitter(client, "job-permanent", "permanent_failure");

await client.close();
