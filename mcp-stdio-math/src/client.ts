/**
 * MCP Calculator Client — stdio transport demo
 *
 * WHAT THIS CLIENT DOES:
 * This file demonstrates the full lifecycle of a stdio MCP client:
 *
 *   1. SPAWN  — StdioClientTransport forks `npx tsx src/server.ts` as a
 *               child process, connecting its stdin/stdout to ours.
 *   2. HANDSHAKE — client.connect() performs the MCP initialize exchange so
 *               both sides agree on protocol version and capabilities.
 *   3. DISCOVER — client.listTools() asks the server which tools are available.
 *   4. CALL    — client.callTool() invokes individual tools by name.
 *   5. CLOSE   — client.close() sends SIGTERM to the child process and waits
 *               for it to exit cleanly.
 *
 * Run with:  npm run client
 * (No need to start the server separately — this client spawns it.)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ─── Transport ────────────────────────────────────────────────────────────────
//
// Creating a StdioClientTransport does NOT yet spawn the child process.
// It just captures the configuration: which command to run and with what args.
// The process is forked only when client.connect() is called below.
const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/server.ts"],
});

const client = new Client({
  name: "mcp-stdio-math-client",
  version: "1.0.0",
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function printSectionHeader(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

async function callAndPrint(
  toolName: string,
  args: Record<string, unknown>
): Promise<void> {
  // client.callTool() sends a JSON-RPC `tools/call` request to the server.
  // The request format is: { name: string, arguments: Record<string, unknown> }
  // The response is: { content: Array<{ type, text | data | ... }> }
  const result = await client.callTool({ name: toolName, arguments: args });

  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  if (
    result.content &&
    Array.isArray(result.content) &&
    result.content.length > 0
  ) {
    const first = result.content[0];
    if (first && "text" in first) {
      console.log(`  ${toolName}(${argsStr}) → ${first.text}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // THIS is when the child process is spawned and the MCP handshake happens.
  //
  // Under the hood, client.connect():
  //   1. Forks the command (`npx tsx src/server.ts`) as a child process
  //   2. Sends `initialize` over the child's stdin
  //   3. Reads the server's `initialize` response from its stdout
  //   4. Sends `notifications/initialized` to complete the handshake
  //
  // After this line, the server is ready to accept tool calls.
  console.log("Connecting to server (spawning child process)...");
  await client.connect(transport);
  console.log("Connected.");

  // ── List available tools ───────────────────────────────────────────────────
  //
  // client.listTools() sends a `tools/list` JSON-RPC request to the server.
  // The server responds with every registered tool's name, description, and
  // input schema (derived from the Zod schema we defined in server.ts).
  //
  // WHY THIS IS USEFUL:
  // An LLM agent can call listTools() at startup to dynamically discover what
  // a server can do — without any hardcoded knowledge. This is the core of
  // MCP's extensibility: tools are self-describing.
  printSectionHeader("Available Tools");
  const { tools } = await client.listTools();
  for (const tool of tools) {
    console.log(`  • ${tool.name.padEnd(14)} — ${tool.description}`);
  }

  // ── Demo tool calls ────────────────────────────────────────────────────────
  printSectionHeader("Basic Arithmetic");
  await callAndPrint("add", { a: 15, b: 27 });
  await callAndPrint("subtract", { a: 100, b: 37 });
  await callAndPrint("multiply", { a: 6, b: 7 });
  await callAndPrint("divide", { a: 22, b: 7 });

  printSectionHeader("Advanced Math");
  await callAndPrint("power", { base: 2, exponent: 10 });
  await callAndPrint("factorial", { n: 10 });
  await callAndPrint("fibonacci", { n: 10 });

  printSectionHeader("Unit Conversions");
  await callAndPrint("unit_convert", { value: 100, from: "km", to: "miles" });
  await callAndPrint("unit_convert", {
    value: 0,
    from: "celsius",
    to: "fahrenheit",
  });
  await callAndPrint("unit_convert", { value: 70, from: "kg", to: "lbs" });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  //
  // client.close() performs a graceful shutdown:
  //   1. Closes the stdin stream of the child process
  //   2. Sends SIGTERM to the child process
  //   3. Waits for the child to exit
  //
  // The server process will receive the signal and terminate. Any cleanup logic
  // in the server (e.g., flushing state) should be done in a SIGTERM handler.
  await client.close();
  console.log("\nDisconnected. Demo complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
