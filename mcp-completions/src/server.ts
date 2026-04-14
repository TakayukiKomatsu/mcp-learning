/**
 * MCP Completions Server
 *
 * This project demonstrates the `completion/complete` request. Completion is a
 * small but useful MCP feature: the client can ask the server for suggestions
 * while the user is filling in prompt arguments or URI-template variables.
 *
 * In this demo we expose completions for:
 * - prompt arguments via `completable(...)`
 * - resource-template variables via `ResourceTemplate.complete`
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const guides = {
  "getting-started": "Start with transports, then resources, then tools.",
  "debugging-tools": "Prefer explicit schemas and return structured content when possible.",
  "auth-patterns": "Separate bearer-token validation from your tool logic.",
  "tasks-overview": "Tasks help long-running or interactive operations survive across polling.",
};

const topics = ["transports", "resources", "prompts", "tools", "sampling", "tasks"];
const tones = ["beginner", "pragmatic", "deep-dive", "checklist"];

const server = new McpServer({ name: "mcp-completions", version: "1.0.0" });

server.registerPrompt(
  "explain_topic",
  {
    description: "Render a reusable explanation prompt with auto-completed arguments.",
    argsSchema: {
      topic: completable(
        z.string().describe("The MCP topic to explain"),
        (value) => topics.filter((topic) => topic.startsWith(value.toLowerCase()))
      ),
      tone: completable(
        z.string().describe("The teaching style to use"),
        (value) => tones.filter((tone) => tone.startsWith(value.toLowerCase()))
      ),
    },
  },
  async ({ topic, tone }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Explain the MCP topic "${topic}" in a ${tone} style with one concrete example.`,
        },
      },
    ],
  })
);

const guideTemplate = new ResourceTemplate("docs://guides/{slug}", {
  list: async () => ({
    resources: Object.keys(guides).map((slug) => ({
      uri: `docs://guides/${slug}`,
      name: slug,
      mimeType: "text/plain",
      description: `Guide article for ${slug}`,
    })),
  }),
  complete: {
    slug: async (value) =>
      Object.keys(guides).filter((slug) => slug.startsWith(value.toLowerCase())),
  },
});

server.registerResource(
  "guide-by-slug",
  guideTemplate,
  {
    description: "Parameterized docs guide resource with slug completion.",
    mimeType: "text/plain",
  },
  async (uri, variables) => {
    const slug = String(variables.slug ?? "");
    const body = guides[slug as keyof typeof guides];
    if (!body) {
      throw new Error(`Unknown guide slug: ${slug}`);
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: `# ${slug}\n\n${body}`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
