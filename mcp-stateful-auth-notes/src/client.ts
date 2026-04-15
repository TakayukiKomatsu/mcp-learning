/**
 * Stateful authenticated Streamable HTTP client demo
 *
 * Important things to watch for when reading this file:
 *   - we attach an Authorization header on every request
 *   - the server assigns a session ID during initialize
 *   - the transport stores that session ID for later calls
 *   - repeated tool calls hit the same server-side session state
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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
    name: 'mcp-stateful-auth-notes-client',
    version: '1.0.0',
  });

  const transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'), {
    requestInit: {
      headers: {
        Authorization: 'Bearer learning-secret-token',
      },
    },
  });

  await client.connect(transport);

  console.log('Connected to stateful authenticated HTTP server.');
  console.log(`Session ID assigned by server: ${transport.sessionId ?? '(none)'}`);

  console.log('\nAdding session note #1...');
  console.log(
    getText(await client.callTool({ name: 'add_session_note', arguments: { text: 'This note lives only in my session' } }))
  );

  console.log('\nAdding session note #2...');
  console.log(
    getText(await client.callTool({ name: 'add_session_note', arguments: { text: 'Bearer auth succeeded, so the request was accepted' } }))
  );

  console.log('\nListing notes stored in this session...');
  console.log(getText(await client.callTool({ name: 'list_session_notes', arguments: {} })));

  console.log('\nTerminating session...');
  await transport.terminateSession();
}

main().catch((error) => {
  console.error('Stateful HTTP client failed:', error);
  process.exit(1);
});
