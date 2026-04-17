/**
 * MCP Tasks Server
 *
 * This is the asynchronous task model: the initial tool invocation creates a
 * task, and the client follows task status/result updates over a stream instead
 * of waiting for one blocking response.
 *
 * ============================================================
 * WHAT ARE TASK LIFECYCLE STATES?
 * ============================================================
 *
 *   pending   -- task created, work not yet started or in progress
 *   completed -- work finished, result available
 *   failed    -- work failed; client may retry (transient) or give up (permanent)
 *   expired   -- TTL elapsed before the client retrieved the result
 *
 * ============================================================
 * WHY RETRY SEMANTICS MATTER
 * ============================================================
 *
 * Long-running distributed work fails transiently all the time: network
 * hiccups, overloaded dependencies, preempted workers. MCP tasks give
 * clients a stable taskId to check status and a clear "failed" signal to
 * act on -- unlike a tool call that just throws, which gives the client no
 * structured way to distinguish "failed, try again" from "failed, give up".
 *
 * See the "flaky_job" tool below for a concrete demonstration.
 *
 * ============================================================
 * WHY TTL/EXPIRY MATTERS
 * ============================================================
 *
 * Results stored in memory (or a cache) cannot be kept forever. The TTL
 * lets the server bound its memory usage. Clients that take too long to
 * retrieve a result get an expiry signal instead of silently stale data.
 * The taskRequestedTtl in the create call lets clients negotiate how long
 * they need.
 *
 * See the "short_lived" tool below for a concrete demonstration.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryTaskMessageQueue, InMemoryTaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js";
import { z } from "zod";

const app = createMcpExpressApp();
const taskStore = new InMemoryTaskStore();
const taskMessageQueue = new InMemoryTaskMessageQueue();

// Per-task attempt counter for the flaky_job tool.
// Maps taskId -> number of invocations attempted so far.
const flakyAttempts = new Map<string, number>();

function buildServer() {
  const server = new McpServer(
    { name: "mcp-tasks", version: "1.0.0" },
    {
      capabilities: { tasks: { requests: { tools: { call: {} } } } },
      taskStore,
      taskMessageQueue,
    }
  );

  server.experimental.tasks.registerToolTask(
    "delay",
    {
      description: "A simple delayed task using the experimental MCP tasks API.",
      inputSchema: {
        duration: z.number().describe("Duration in milliseconds").default(1000),
      },
    },
    {
      async createTask({ duration }, { taskStore, taskRequestedTtl }) {
        const task = await taskStore.createTask({ ttl: taskRequestedTtl });

        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, duration));
          await taskStore.storeTaskResult(task.taskId, "completed", {
            content: [
              {
                type: "text",
                text: `Completed ${duration}ms delay using MCP tasks.`,
              },
            ],
          });
        })();

        return { task };
      },
      async getTask(_args, { taskId, taskStore }) {
        return await taskStore.getTask(taskId);
      },
      async getTaskResult(_args, { taskId, taskStore }) {
        return (await taskStore.getTaskResult(taskId)) as {
          content: Array<{ type: "text"; text: string }>;
        };
      },
    }
  );

  // ------------------------------------------------------------------
  // flaky_job: demonstrates retry semantics
  //
  // The task fails transiently for the first `failCount` invocations,
  // then succeeds. The client is expected to keep retrying (creating new
  // tasks) until it sees a "completed" status. The stable taskId on each
  // attempt lets an orchestrator track and decide whether to keep going.
  // ------------------------------------------------------------------
  server.experimental.tasks.registerToolTask(
    "flaky_job",
    {
      description: "A job that fails transiently N times before succeeding, to demonstrate retry semantics.",
      inputSchema: {
        failCount: z
          .number()
          .int()
          .min(0)
          .max(3)
          .default(1)
          .describe("How many times the task should fail before succeeding."),
      },
    },
    {
      async createTask({ failCount }, { taskStore, taskRequestedTtl }) {
        const task = await taskStore.createTask({ ttl: taskRequestedTtl });
        const attempts = flakyAttempts.get(task.taskId) ?? 0;

        void (async () => {
          if (attempts < failCount) {
            flakyAttempts.set(task.taskId, attempts + 1);
            await taskStore.storeTaskResult(task.taskId, "failed", {
              content: [
                {
                  type: "text",
                  text: `transient failure, attempt ${attempts + 1} of ${failCount}`,
                },
              ],
            });
          } else {
            flakyAttempts.delete(task.taskId);
            await taskStore.storeTaskResult(task.taskId, "completed", {
              content: [
                {
                  type: "text",
                  text: `flaky_job succeeded after ${failCount} transient failure(s).`,
                },
              ],
            });
          }
        })();

        return { task };
      },
      async getTask(_args, { taskId, taskStore }) {
        return await taskStore.getTask(taskId);
      },
      async getTaskResult(_args, { taskId, taskStore }) {
        return (await taskStore.getTaskResult(taskId)) as {
          content: Array<{ type: "text"; text: string }>;
        };
      },
    }
  );

  // ------------------------------------------------------------------
  // short_lived: demonstrates TTL/expiry
  //
  // The task completes immediately but is stored with a very short TTL.
  // If the client waits longer than the TTL before polling, the task
  // store will no longer have the result -- the client receives null
  // instead of a result object, which represents the "expired" outcome.
  // ------------------------------------------------------------------
  server.experimental.tasks.registerToolTask(
    "short_lived",
    {
      description: "A task that completes immediately but expires quickly, to demonstrate TTL/expiry.",
      inputSchema: {
        ttlMs: z
          .number()
          .int()
          .min(100)
          .max(2000)
          .default(500)
          .describe("TTL in milliseconds. The result will be gone after this window."),
      },
    },
    {
      async createTask({ ttlMs }, { taskStore }) {
        // Override taskRequestedTtl with the explicitly short TTL so the
        // expiry window is predictable regardless of what the client asked for.
        const task = await taskStore.createTask({ ttl: ttlMs });

        void (async () => {
          // Complete immediately -- the TTL is what makes the result disappear,
          // not a delay in producing it.
          await taskStore.storeTaskResult(task.taskId, "completed", {
            content: [
              {
                type: "text",
                text: `short_lived task completed. Result expires ${ttlMs}ms after task creation.`,
              },
            ],
          });
        })();

        return { task };
      },
      async getTask(_args, { taskId, taskStore }) {
        return await taskStore.getTask(taskId);
      },
      async getTaskResult(_args, { taskId, taskStore }) {
        const result = await taskStore.getTaskResult(taskId);
        // null means the TTL elapsed and the store discarded the result.
        // Return a structured expiry message so the client gets a clear
        // signal rather than an untyped null or an unhandled throw.
        if (result === null) {
          return {
            content: [{ type: "text" as const, text: "Task result expired: TTL elapsed before retrieval." }],
          };
        }
        return result as { content: Array<{ type: "text"; text: string }> };
      },
    }
  );

  return server;
}

app.all("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3016, () => {
  console.log("Tasks MCP server listening on http://localhost:3016/mcp");
});
