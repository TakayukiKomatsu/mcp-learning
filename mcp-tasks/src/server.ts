/**
 * MCP Tasks Server
 *
 * This is the asynchronous task model: the initial tool invocation creates a
 * task, and the client follows task status/result updates over a stream instead
 * of waiting for one blocking response.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryTaskMessageQueue, InMemoryTaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js";
import { z } from "zod";

const app = createMcpExpressApp();
const taskStore = new InMemoryTaskStore();
const taskMessageQueue = new InMemoryTaskMessageQueue();

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
