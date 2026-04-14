/**
 * MCP In-Memory Client Demo
 *
 * This file shows the FULL wiring for InMemoryTransport:
 *   1. create the MCP server object
 *   2. create the MCP client object
 *   3. create a linked in-memory transport pair
 *   4. connect each side to one half of the pair
 *   5. call tools normally
 *
 * Conceptually, it behaves like a network connection. The difference is that
 * both ends are just JavaScript objects living in this same Node.js process.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './server.js';

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
  const server = createServer();

  const client = new Client({
    name: 'mcp-inmemory-notes-client',
    version: '1.0.0',
  });

  // The most important line in this project.
  //
  // The SDK gives us TWO transports that already know how to talk to each other.
  // One goes to the client, the other goes to the server.
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // Either side can connect first, but connecting both with Promise.all makes
  // it obvious that both endpoints become active together.
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  console.log('Connected client and server through InMemoryTransport.\n');

  const tools = await client.listTools();
  console.log('Available tools:');
  for (const tool of tools.tools) {
    console.log(`- ${tool.name}: ${tool.description ?? 'No description'}`);
  }

  console.log('\nCalling add_note twice...');
  console.log(
    getText(await client.callTool({ name: 'add_note', arguments: { text: 'Learned how linked transports work' } }))
  );
  console.log(
    getText(await client.callTool({ name: 'add_note', arguments: { text: 'No ports or child processes involved' } }))
  );

  console.log('\nCalling list_notes...');
  console.log(getText(await client.callTool({ name: 'list_notes', arguments: {} })));

  await client.close();
  await server.close();

  console.log('\nClosed client and server cleanly.');
}

main().catch((error) => {
  console.error('InMemory demo failed:', error);
  process.exit(1);
});
