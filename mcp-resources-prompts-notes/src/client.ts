/**
 * Resources + prompts client demo
 *
 * This walks through the MCP operations that are NOT tool calls:
 *   - listResources
 *   - listResourceTemplates
 *   - readResource
 *   - listPrompts
 *   - getPrompt
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const client = new Client({
    name: 'mcp-resources-prompts-notes-client',
    version: '1.0.0',
  });

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/server.ts'],
  });

  await client.connect(transport);

  console.log('Connected to resources/prompts server.\n');

  const resources = await client.listResources();
  console.log('Static/discoverable resources:');
  for (const resource of resources.resources) {
    console.log(`- ${resource.uri} (${resource.name})`);
  }

  const templates = await client.listResourceTemplates();
  console.log('\nResource templates:');
  for (const template of templates.resourceTemplates) {
    console.log(`- ${template.uriTemplate}`);
  }

  const index = await client.readResource({ uri: 'notes://index' });
  console.log('\nReading notes://index');
  console.log(index.contents.map((item) => ('text' in item ? item.text : '[binary]')).join('\n'));

  const note = await client.readResource({ uri: 'notes://1' });
  console.log('\nReading notes://1');
  console.log(note.contents.map((item) => ('text' in item ? item.text : '[binary]')).join('\n'));

  const prompts = await client.listPrompts();
  console.log('\nPrompts:');
  for (const prompt of prompts.prompts) {
    console.log(`- ${prompt.name}`);
  }

  const prompt = await client.getPrompt({
    name: 'summarize-note',
    arguments: {
      noteTitle: 'MCP basics',
      noteBody: 'Tools act. Resources provide data. Prompts provide reusable messages.',
    },
  });

  console.log('\nPrompt messages returned by the server:');
  for (const message of prompt.messages) {
    if (message.content.type === 'text') {
      console.log(`- ${message.role}:\n${message.content.text}`);
    }
  }

  await client.close();
}

main().catch((error) => {
  console.error('Resources/prompts client failed:', error);
  process.exit(1);
});
