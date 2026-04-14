/**
 * Low-level Server client demo
 *
 * The client experience looks normal because the low-level complexity is all on
 * the server side. From the client's point of view, it is still just MCP.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function getText(result: unknown): string {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    return '';
  }

  const lines: string[] = [];
  const content = (result as { content?: Array<{ type?: unknown; text?: unknown }> }).content;

  for (const block of content ?? []) {
    if (block.type === 'text') {
      lines.push(typeof block.text === 'string' ? block.text : '');
    }
  }

  return lines.join('\n');
}

async function main() {
  const client = new Client({
    name: 'mcp-lowlevel-notes-client',
    version: '1.0.0',
  });

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/server.ts'],
  });

  await client.connect(transport);

  console.log('Connected to low-level server over stdio.\n');

  const tools = await client.listTools();
  console.log('Tools exposed by the low-level server:');
  for (const tool of tools.tools) {
    console.log(`- ${tool.name}`);
  }

  console.log('\nCalling echo_note...');
  console.log(
    getText(await client.callTool({ name: 'echo_note', arguments: { text: 'Learning the raw protocol layer' } }))
  );

  console.log('\nCalling note_length...');
  console.log(
    getText(await client.callTool({ name: 'note_length', arguments: { text: 'How much boilerplate did we remove with McpServer?' } }))
  );

  await client.close();
}

main().catch((error) => {
  console.error('Low-level client failed:', error);
  process.exit(1);
});
