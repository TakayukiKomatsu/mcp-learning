/**
 * MCP Pagination Demo Server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const resources = Array.from({ length: 8 }, (_, index) => ({
  uri: `paged://doc/${index + 1}`,
  name: `Doc ${index + 1}`,
  mimeType: "text/plain",
  description: `Paged demo document ${index + 1}`,
  text: `This is the content for document ${index + 1}.`,
}));

const server = new Server({ name: "mcp-pagination", version: "1.0.0" }, { capabilities: { resources: {} } });

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const pageSize = 3;
  const start = Number(request.params?.cursor ?? "0");
  const page = resources.slice(start, start + pageSize).map(({ text, ...resource }) => resource);
  const nextCursor = start + pageSize < resources.length ? String(start + pageSize) : undefined;
  return { resources: page, nextCursor };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = resources.find((item) => item.uri === request.params.uri);
  if (!resource) {
    throw new Error(`Unknown resource ${request.params.uri}`);
  }

  return {
    contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.text }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
