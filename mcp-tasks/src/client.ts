/**
 * MCP Tasks Client
 *
 * Demonstrates three scenarios:
 *
 *   1. delay       -- the baseline happy path (unchanged)
 *   2. flaky_job   -- retry semantics: the client retries until the task
 *                     completes, printing each failed attempt along the way
 *   3. short_lived -- TTL/expiry: the client deliberately waits past the TTL
 *                     and shows that the result is gone; then contrasts with
 *                     a normal-TTL task that still succeeds
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const client = new Client({ name: "mcp-tasks-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3016/mcp"));
await client.connect(transport);

// ============================================================
// Section 1: delay (happy path, unchanged)
// ============================================================
console.log("=== delay (happy path) ===");

const delayStream = client.experimental.tasks.callToolStream(
  { name: "delay", arguments: { duration: 1200 } },
  CallToolResultSchema,
  { task: { ttl: 60_000 } }
);

for await (const message of delayStream) {
  if (message.type === "taskCreated") {
    console.log(`Task created: ${message.task.taskId}`);
  } else if (message.type === "taskStatus") {
    console.log(`Status: ${message.task.status}${message.task.statusMessage ? ` - ${message.task.statusMessage}` : ""}`);
  } else if (message.type === "result") {
    const text = message.result.content.find((item) => item.type === "text")?.text ?? "(no text)";
    console.log("\nFinal result:");
    console.log(text);
  } else if (message.type === "error") {
    console.log(`Task error: ${message.error}`);
  }
}

// ============================================================
// Section 2: flaky_job -- retry semantics
//
// The server will fail this job twice before succeeding.
// The client loops, creating a new task on each attempt, until
// it receives a "completed" status. Each failed attempt prints
// the failure reason so the lifecycle states are visible.
// ============================================================
console.log("\n=== flaky_job (retry semantics) ===");
console.log("Server is configured to fail 2 times before succeeding.");

const FAIL_COUNT = 2;
const MAX_RETRIES = 5;
let attempt = 0;
let jobDone = false;

while (!jobDone && attempt < MAX_RETRIES) {
  attempt++;
  console.log(`\n-- Attempt ${attempt} --`);

  const flakyStream = client.experimental.tasks.callToolStream(
    { name: "flaky_job", arguments: { failCount: FAIL_COUNT } },
    CallToolResultSchema,
    { task: { ttl: 30_000 } }
  );

  for await (const message of flakyStream) {
    if (message.type === "taskCreated") {
      console.log(`  Task created: ${message.task.taskId}`);
    } else if (message.type === "taskStatus") {
      const status = message.task.status;
      const extra = message.task.statusMessage ? ` - ${message.task.statusMessage}` : "";
      console.log(`  Status: ${status}${extra}`);

      if (status === "completed") {
        jobDone = true;
      }
    } else if (message.type === "result") {
      const text = message.result.content.find((item) => item.type === "text")?.text ?? "(no text)";
      if (message.result.isError) {
        console.log(`  Task failed (transient): ${text}`);
        // "failed" is a terminal status for this task instance; we break
        // out of the stream and the while-loop will retry with a new task.
        break;
      } else {
        console.log(`\n  Final result: ${text}`);
        jobDone = true;
      }
    } else if (message.type === "error") {
      console.log(`  Stream error: ${message.error}`);
      break;
    }
  }
}

if (!jobDone) {
  console.log(`flaky_job did not complete after ${MAX_RETRIES} attempts.`);
}

// ============================================================
// Section 3: short_lived -- TTL/expiry
//
// 3a. Expired path: start the task, wait longer than the TTL,
//     then try to retrieve -- the result is gone.
// 3b. Normal path: use a long TTL and retrieve immediately to
//     show that the same tool works fine when timing is right.
// ============================================================
console.log("\n=== short_lived (TTL/expiry) ===");

const SHORT_TTL_MS = 400;
const WAIT_PAST_TTL_MS = SHORT_TTL_MS + 200;

// 3a -- expired path
console.log(`\n-- 3a: TTL=${SHORT_TTL_MS}ms, client waits ${WAIT_PAST_TTL_MS}ms (past TTL) --`);

const expiredStream = client.experimental.tasks.callToolStream(
  { name: "short_lived", arguments: { ttlMs: SHORT_TTL_MS } },
  CallToolResultSchema,
  { task: { ttl: 60_000 } }
);

let expiredTaskId: string | undefined;

for await (const message of expiredStream) {
  if (message.type === "taskCreated") {
    expiredTaskId = message.task.taskId;
    console.log(`  Task created: ${expiredTaskId}`);
    console.log(`  Waiting ${WAIT_PAST_TTL_MS}ms (TTL is only ${SHORT_TTL_MS}ms)...`);
    // Deliberate delay inside the stream loop to simulate a slow client.
    await new Promise((resolve) => setTimeout(resolve, WAIT_PAST_TTL_MS));
  } else if (message.type === "taskStatus") {
    console.log(`  Status: ${message.task.status}`);
  } else if (message.type === "result") {
    if (message.result === null || message.result === undefined) {
      console.log("  Result: null -- task result has expired (TTL elapsed).");
    } else {
      const text = message.result.content.find((item) => item.type === "text")?.text ?? "(no text)";
      console.log(`  Result (unexpected -- should have expired): ${text}`);
    }
  } else if (message.type === "error") {
    // A null/missing result may surface as an error message depending on
    // how the SDK handles a missing task result at poll time.
    console.log(`  Error (expected -- result expired): ${message.error}`);
  }
}

// 3b -- normal path (long TTL, retrieve immediately)
console.log(`\n-- 3b: TTL=30000ms, client retrieves immediately (contrast) --`);

const normalStream = client.experimental.tasks.callToolStream(
  { name: "short_lived", arguments: { ttlMs: 2000 } },
  CallToolResultSchema,
  { task: { ttl: 30_000 } }
);

for await (const message of normalStream) {
  if (message.type === "taskCreated") {
    console.log(`  Task created: ${message.task.taskId}`);
  } else if (message.type === "taskStatus") {
    console.log(`  Status: ${message.task.status}`);
  } else if (message.type === "result") {
    const text = message.result.content.find((item) => item.type === "text")?.text ?? "(no text)";
    console.log(`  Result: ${text}`);
  } else if (message.type === "error") {
    console.log(`  Error: ${message.error}`);
  }
}

await client.close();
