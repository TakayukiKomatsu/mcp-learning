/**
 * MCP Tasks Lifecycle Demo Server
 *
 * This isolates task lifecycle semantics from the broader `mcp-tasks` project.
 * It focuses on:
 *
 * - `completed` after async work
 * - `failed` with a transient signal
 * - `expired` after TTL elapses
 *
 * The goal is to teach lifecycle states and client behavior, not every task
 * feature in one directory.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryTaskMessageQueue, InMemoryTaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js";
import { z } from "zod";

const PORT = 3023;
const app = createMcpExpressApp();
const taskStore = new InMemoryTaskStore();
const taskMessageQueue = new InMemoryTaskMessageQueue();

function buildServer() {
  const server = new McpServer(
    { name: "mcp-tasks-lifecycle", version: "1.0.0" },
    {
      capabilities: { tasks: { requests: { tools: { call: {} } } } },
      taskStore,
      taskMessageQueue,
    }
  );

  server.experimental.tasks.registerToolTask(
    "complete_after_delay",
    {
      description: "Completes after a short delay.",
      inputSchema: {
        duration: z.number().min(100).max(2000).default(500),
      },
    },
    {
      async createTask({ duration }, { taskStore, taskRequestedTtl }) {
        const task = await taskStore.createTask({ ttl: taskRequestedTtl });
        void (async () => {
          await taskStore.updateTaskStatus(task.taskId, "working", "Running delayed task");
          await new Promise((resolve) => setTimeout(resolve, duration));
          await taskStore.storeTaskResult(task.taskId, "completed", {
            content: [{ type: "text", text: `Completed after ${duration}ms` }],
          });
        })();
        return { task };
      },
      async getTask(_args, { taskId, taskStore }) {
        return await taskStore.getTask(taskId);
      },
      async getTaskResult(_args, { taskId, taskStore }) {
        return (await taskStore.getTaskResult(taskId)) as { content: Array<{ type: "text"; text: string }> };
      },
    }
  );

  server.experimental.tasks.registerToolTask(
    "fail_transiently",
    {
      description: "Fails immediately with a transient-style failure reason.",
      inputSchema: {
        reason: z.string().default("temporary upstream outage"),
      },
    },
    {
      async createTask({ reason }, { taskStore, taskRequestedTtl }) {
        const task = await taskStore.createTask({ ttl: taskRequestedTtl });
        void taskStore.storeTaskResult(task.taskId, "failed", {
          content: [{ type: "text", text: `Transient failure: ${reason}` }],
          isError: true,
        });
        return { task };
      },
      async getTask(_args, { taskId, taskStore }) {
        return await taskStore.getTask(taskId);
      },
      async getTaskResult(_args, { taskId, taskStore }) {
        return (await taskStore.getTaskResult(taskId)) as { content: Array<{ type: "text"; text: string }>; isError?: boolean };
      },
    }
  );

  server.experimental.tasks.registerToolTask(
    "expire_quickly",
    {
      description: "Completes immediately but with a very short TTL so the result expires.",
      inputSchema: {
        ttlMs: z.number().int().min(100).max(1500).default(300),
      },
    },
    {
      async createTask({ ttlMs }, { taskStore }) {
        const task = await taskStore.createTask({ ttl: ttlMs });
        void taskStore.storeTaskResult(task.taskId, "completed", {
          content: [{ type: "text", text: `This result will expire after ${ttlMs}ms` }],
        });
        return { task };
      },
      async getTask(_args, { taskId, taskStore }) {
        return await taskStore.getTask(taskId);
      },
      async getTaskResult(_args, { taskId, taskStore }) {
        const result = await taskStore.getTaskResult(taskId);
        if (result === null) {
          return {
            content: [{ type: "text" as const, text: "Task result expired before retrieval." }],
            isError: true,
          };
        }
        return result as { content: Array<{ type: "text"; text: string }>; isError?: boolean };
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

app.listen(PORT, () => {
  console.log(`Tasks lifecycle demo listening on http://localhost:${PORT}/mcp`);
});
