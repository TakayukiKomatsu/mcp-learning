/**
 * MCP Apps Demo Server
 *
 * MCP Apps use `ui://` resources as UI payloads. App-aware clients render those
 * resources directly; this repo's client just reads the HTML to demonstrate the
 * resource flow.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-apps", version: "1.0.0" });

const dashboardHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Release Dashboard</title>
    <style>
      body { font-family: Georgia, serif; background: linear-gradient(120deg, #fff4df, #e8f5ef); padding: 24px; }
      .card { background: white; border-radius: 18px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
      h1 { margin-top: 0; color: #134e4a; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .stat { padding: 12px; border-radius: 12px; background: #f5faf8; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Release Dashboard</h1>
      <div class="stats">
        <div class="stat"><strong>Open Tasks</strong><div>12</div></div>
        <div class="stat"><strong>Risk Level</strong><div>Medium</div></div>
        <div class="stat"><strong>Next Milestone</strong><div>May 2</div></div>
      </div>
    </div>
  </body>
</html>`;

server.registerResource(
  "release-dashboard-ui",
  "ui://release-dashboard/main",
  { description: "Interactive dashboard UI resource", mimeType: "text/html" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/html", text: dashboardHtml }],
  })
);

server.registerTool(
  "show_release_dashboard",
  {
    description: "Return a UI resource link that an Apps-capable client could render.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      title: z.string(),
      primaryMetric: z.string(),
    }),
  },
  async () => ({
    content: [
      { type: "text", text: "Open the linked UI resource in an Apps-capable MCP client." },
      {
        type: "resource_link",
        uri: "ui://release-dashboard/main",
        name: "Release Dashboard",
        mimeType: "text/html",
        description: "Interactive UI payload for release planning",
      },
    ],
    structuredContent: {
      title: "Release Dashboard",
      primaryMetric: "12 open tasks",
    },
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
