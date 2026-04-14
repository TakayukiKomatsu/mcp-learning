// =============================================================================
// MCP Todo Client — Streamable HTTP Transport
// =============================================================================
//
// STREAMABLE HTTP CLIENT LIFECYCLE
// ----------------------------------
// Unlike SSE, the Streamable HTTP client does NOT maintain a persistent
// connection to the server. In SSE mode:
//   - client.connect() opened a long-lived GET /sse stream
//   - that stream stayed open for the entire session
//   - every tool call sent a POST /message over a SEPARATE channel
//
// In Streamable HTTP mode:
//   - client.connect() does a single POST to negotiate capabilities
//   - each subsequent callTool() / listTools() is its own independent POST
//   - no socket is held open between calls
//   - the server processes each request in isolation (stateless)
//
// The practical upside: the client doesn't need to manage a connection
// lifecycle. If the server restarts between calls, the next call simply
// reconnects. There's no "stream dropped" error to handle.
//
// =============================================================================

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// =============================================================================
// TRANSPORT SETUP
// =============================================================================
//
// StreamableHTTPClientTransport wraps a single URL. Unlike SSE's
// SSEClientTransport which opened and held a GET /sse socket, this transport
// keeps NO persistent socket open. Each MCP operation (initialize, listTools,
// callTool, etc.) is a self-contained POST request to the URL below.
//
// This makes it trivial to point the client at a load-balanced cluster — every
// POST can land on a different server instance and it still works correctly,
// because no per-client state lives on the server side.
const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:3002/mcp')
);

const client = new Client({ name: 'todo-client', version: '1.0.0' });

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  // ---------------------------------------------------------------------------
  // client.connect(transport)
  // ---------------------------------------------------------------------------
  // In SSE mode, connect() opened a persistent stream and kept it open.
  // In Streamable HTTP (stateless) mode, connect() sends a single POST
  // containing the MCP `initialize` request. The server responds with its
  // capabilities (available tools, resources, etc.) and the handshake is done.
  //
  // After this returns, the "connection" is logically established — but no
  // socket stays open. The transport is ready to send individual requests
  // on demand, each as its own POST.
  await client.connect(transport);
  console.log('Connected to MCP Streamable HTTP Todo Server\n');

  // ---------------------------------------------------------------------------
  // DYNAMIC TOOL DISCOVERY
  // ---------------------------------------------------------------------------
  // listTools() asks the server which tools are available and what their
  // input schemas look like. This is a runtime capability — the client
  // doesn't need to know the tool list at compile time. An LLM client
  // would use this to decide which tools to call and how to call them.
  const { tools } = await client.listTools();
  console.log('Available tools:');
  tools.forEach((t) => console.log(`  - ${t.name}: ${t.description}`));
  console.log();

  // ==========================================================================
  // PHASE 0: RESET
  // Clear any state left from a previous run so the demo starts clean.
  // ==========================================================================
  const clearResult = await client.callTool({ name: 'clear_all', arguments: {} });
  console.log('Reset:', getText(clearResult));
  console.log();

  // ==========================================================================
  // PHASE 1: CREATE
  // Add three todos with different priorities.
  // ==========================================================================
  console.log('--- CREATE PHASE ---');

  const groceriesResult = await client.callTool({
    name: 'create_todo',
    arguments: { title: 'Buy groceries', priority: 'high' },
  });
  const groceriesText = getText(groceriesResult);
  console.log(groceriesText);
  const groceriesId = parseCreatedId(groceriesText);

  const docsResult = await client.callTool({
    name: 'create_todo',
    arguments: { title: 'Read MCP docs', priority: 'medium' },
  });
  console.log(getText(docsResult));

  const plantsResult = await client.callTool({
    name: 'create_todo',
    arguments: { title: 'Water the plants', priority: 'low' },
  });
  const plantsText = getText(plantsResult);
  console.log(plantsText);
  const plantsId = parseCreatedId(plantsText);

  console.log();

  // ==========================================================================
  // PHASE 2: READ (all)
  // List all three todos we just created.
  // ==========================================================================
  console.log('--- READ PHASE (all todos) ---');
  const allTodos = await client.callTool({
    name: 'list_todos',
    arguments: { filter: 'all' },
  });
  console.log(getText(allTodos));
  console.log();

  // ==========================================================================
  // PHASE 3: UPDATE
  // Mark "Buy groceries" as done, then inspect done vs pending lists.
  // ==========================================================================
  console.log('--- UPDATE PHASE ---');

  const completeResult = await client.callTool({
    name: 'complete_todo',
    arguments: { id: groceriesId },
  });
  console.log(getText(completeResult));
  console.log();

  console.log('Done todos:');
  const doneTodos = await client.callTool({
    name: 'list_todos',
    arguments: { filter: 'done' },
  });
  console.log(getText(doneTodos));
  console.log();

  console.log('Pending todos:');
  const pendingTodos = await client.callTool({
    name: 'list_todos',
    arguments: { filter: 'pending' },
  });
  console.log(getText(pendingTodos));
  console.log();

  // ==========================================================================
  // PHASE 4: DELETE
  // Remove "Water the plants", then confirm final state.
  // ==========================================================================
  console.log('--- DELETE PHASE ---');

  const deleteResult = await client.callTool({
    name: 'delete_todo',
    arguments: { id: plantsId },
  });
  console.log(getText(deleteResult));
  console.log();

  console.log('Final state (all todos):');
  const finalTodos = await client.callTool({
    name: 'list_todos',
    arguments: { filter: 'all' },
  });
  console.log(getText(finalTodos));
  console.log();

  // Cleanly close the client. In Streamable HTTP stateless mode this is
  // largely a no-op (no persistent socket to tear down), but it's good
  // practice and required if you're using stateful session mode.
  await client.close();
  console.log('Disconnected.');
}

// =============================================================================
// HELPERS
// =============================================================================

/** Extract the text string from a callTool result's content array. */
function getText(result: Awaited<ReturnType<typeof client.callTool>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  const block = content[0];
  if (block.type === 'text') return block.text ?? '';
  return JSON.stringify(block);
}

/**
 * Parse the todo ID out of a create_todo response.
 * The response format is: "Created todo {uuid}: {title} (priority: {priority})"
 */
function parseCreatedId(text: string): string {
  const match = text.match(/Created todo ([a-f0-9-]{36}):/);
  if (!match) throw new Error(`Could not parse ID from: ${text}`);
  return match[1];
}

main().catch((err) => {
  console.error('Client error:', err);
  process.exit(1);
});
