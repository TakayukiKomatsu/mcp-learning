/**
 * MCP Elicitation Server
 *
 * Elicitation lets the server pause a workflow and ask the client for
 * structured user input. The key difference from a normal tool call is the
 * direction: during tool execution, the SERVER becomes the requester.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-elicitation", version: "1.0.0" });

server.registerTool(
  "plan_meeting",
  {
    description: "Collect meeting preferences from the user mid-tool via form elicitation.",
    inputSchema: z.object({
      topic: z.string().describe("What the meeting is about"),
    }),
  },
  async ({ topic }) => {
    const result = await server.server.elicitInput({
      mode: "form",
      message: `Please provide details for the "${topic}" meeting.`,
      requestedSchema: {
        type: "object",
        properties: {
          day: { type: "string", title: "Preferred day" },
          hour: { type: "string", title: "Preferred hour" },
          attendeesCsv: { type: "string", title: "Attendees (comma-separated)" },
        },
        required: ["day", "hour", "attendeesCsv"],
      },
    });

    if (result.action !== "accept" || !result.content) {
      return {
        content: [{ type: "text", text: "Meeting planning was declined by the client." }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Meeting planned.\nTopic: ${topic}\nDay: ${result.content.day}\nHour: ${result.content.hour}\nAttendees: ${result.content.attendeesCsv}`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
