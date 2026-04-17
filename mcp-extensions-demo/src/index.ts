/**
 * mcp-extensions-demo — MCP Extensions Framework
 * ================================================
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  WHAT ARE MCP EXTENSIONS?                                           │
 * │                                                                     │
 * │  Extensions are OPTIONAL additions layered on top of the core MCP  │
 * │  protocol. They follow a key principle:                             │
 * │                                                                     │
 * │    • Never break existing clients/servers that don't know about     │
 * │      them — graceful degradation is mandatory                       │
 * │    • Always negotiated explicitly during the initialize handshake   │
 * │    • Always DISABLED by default; require explicit opt-in            │
 * │    • Identified by  {vendor-prefix}/{extension-name}               │
 * │      e.g.  "io.modelcontextprotocol/ui"                             │
 * │            "com.example/greeting"                                   │
 * │            "com.acme/analytics"                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  WHY EXTENSIONS INSTEAD OF JUST ADDING TO THE SPEC?                │
 * │                                                                     │
 * │  The core spec is stable — production systems (IDEs, AI clients,   │
 * │  enterprise deployments) depend on its stability. Extensions let   │
 * │  the ecosystem EXPERIMENT without destabilizing those deployments. │
 * │                                                                     │
 * │  Think of it like HTTP headers: the core protocol is frozen, but   │
 * │  custom headers (X-My-Header) allow innovation without breaking     │
 * │  existing infrastructure.                                           │
 * │                                                                     │
 * │  Experimental ideas incubate in extensions → if widely adopted →   │
 * │  they may graduate into the core spec.                              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  WHEN SHOULD YOU BUILD AN EXTENSION?                                │
 * │                                                                     │
 * │  Good fits:                                                         │
 * │    • Capability too specialized for the core spec                   │
 * │    • Interoperability with specific clients/servers you control     │
 * │    • Industry-specific or vendor-specific additions                 │
 * │    • Experimental features you want to test before a SEP            │
 * │                                                                     │
 * │  Bad fits:                                                          │
 * │    • Features all MCP implementations should support (→ core PR)   │
 * │    • Workarounds for SDK bugs (→ fix the SDK)                       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THE EXTENSION LIFECYCLE                                            │
 * │                                                                     │
 * │  1. Experimental: live in experimental-ext-* repos, no SEP yet     │
 * │  2. SEP (Spec Enhancement Proposal): formal proposal with ref impl  │
 * │  3. Core maintainer review + community feedback                     │
 * │  4. Official: merged into the official extensions repository        │
 * │  5. Core graduation (rare): added to the core spec itself           │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  OFFICIAL EXTENSIONS AS OF 2026                                     │
 * │                                                                     │
 * │  io.modelcontextprotocol/ui                                         │
 * │    → MCP Apps: servers return interactive UI widgets (ui:// URIs)   │
 * │    → See the mcp-apps/ directory in this repo for a full demo       │
 * │                                                                     │
 * │  io.modelcontextprotocol/oauth-client-credentials                  │
 * │    → Machine-to-machine auth using OAuth 2.0 client credentials     │
 * │    → Lets servers authenticate to external APIs on behalf of tools  │
 * │                                                                     │
 * │  io.modelcontextprotocol/enterprise-managed-authorization          │
 * │    → SSO / IdP-managed authorization                                │
 * │    → Centralised auth policy for enterprise deployments             │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  GRACEFUL DEGRADATION (the golden rule)                             │
 * │                                                                     │
 * │  If one side doesn't list an extension in its capabilities the      │
 * │  other side MUST fall back to baseline behaviour. Never hard-require│
 * │  an extension unless you control both endpoints end-to-end.         │
 * │                                                                     │
 * │  Pattern:                                                           │
 * │    const negotiated = serverCaps?.extensions?.["com.example/x"];   │
 * │    if (negotiated) { // use extension features                      │
 * │    } else          { // use fallback behaviour                      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THE INITIALIZE HANDSHAKE (where negotiation happens)               │
 * │                                                                     │
 * │  Client → Server  (initialize request)                              │
 * │  {                                                                  │
 * │    "capabilities": {                                                │
 * │      "roots": { "listChanged": true },                              │
 * │      "extensions": {                                                │
 * │        "com.example/greeting": { "preferredLanguage": "ja" }       │
 * │      }                                                              │
 * │    }                                                                │
 * │  }                                                                  │
 * │                                                                     │
 * │  Server → Client  (initialize response)                             │
 * │  {                                                                  │
 * │    "capabilities": {                                                │
 * │      "tools": {},                                                   │
 * │      "extensions": {                                                │
 * │        "com.example/greeting": {}   ← server echoes back           │
 * │      }                                                              │
 * │    }                                                                │
 * │  }                                                                  │
 * │                                                                     │
 * │  Rule: the server ONLY echoes back extensions it actually supports. │
 * │  Absence from the response means "not supported".                   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * THIS FILE DEMONSTRATES THREE SCENARIOS:
 *  1. Both client and server support the extension → full feature
 *  2. Client does NOT advertise the extension → server falls back
 *  3. Server does NOT support the extension → client detects & falls back
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Extension name constant — use a string constant so there's one source of truth
// ─────────────────────────────────────────────────────────────────────────────
const GREETING_EXT = "com.example/greeting";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: inspect the raw capabilities object (which may include fields the
// TypeScript SDK types don't know about yet, hence the `unknown` cast).
// ─────────────────────────────────────────────────────────────────────────────
type ExtensionMap = Record<string, Record<string, unknown>>;

function getExtensions(caps: unknown): ExtensionMap | undefined {
  if (caps && typeof caps === "object" && "extensions" in caps) {
    return (caps as { extensions: ExtensionMap }).extensions;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a Server that MAY or MAY NOT advertise the greeting extension.
//
// serverSupportsExtension = true  → server declares it in its capabilities
// serverSupportsExtension = false → server omits it (pretends it doesn't exist)
//
// After connect(), the server reads what the client sent in the initialize
// request via server.getClientCapabilities(). That tells it:
//   - whether the client supports the extension
//   - and what parameters the client prefers (e.g. preferredLanguage)
// ─────────────────────────────────────────────────────────────────────────────
function buildServer(serverSupportsExtension: boolean): Server {
  // The `capabilities` passed to the Server constructor become the initialize
  // RESPONSE payload that the server sends back to the client.
  //
  // We use `as any` here because the TypeScript SDK types for ServerCapabilities
  // don't yet include the `extensions` field — it was added to the protocol spec
  // (SEP-2133) more recently than the current SDK type definitions.
  const serverCapabilities = serverSupportsExtension
    ? ({
        tools: {},
        // @ts-ignore — extensions field not yet in SDK types
        extensions: {
          [GREETING_EXT]: {}, // server echoes back the extension it supports
        },
      } as any)
    : { tools: {} };

  const server = new Server(
    { name: "ext-demo-server", version: "1.0.0" },
    { capabilities: serverCapabilities }
  );

  // ── List tools ─────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "greet",
        description: "Returns a greeting. Language depends on extension negotiation.",
        inputSchema: {
          type: "object" as const,
          properties: {
            name: { type: "string", description: "Name to greet" },
          },
          required: ["name"],
        },
      },
    ],
  }));

  // ── Call tool ──────────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== "greet") {
      throw new Error(`Unknown tool: ${req.params.name}`);
    }

    const nameArg = (req.params.arguments as { name?: string })?.name ?? "World";

    // Read what the CLIENT sent during initialize.
    // getClientCapabilities() returns the capabilities object from the
    // initialize REQUEST (client → server direction).
    const clientCaps = server.getClientCapabilities();
    const clientExtensions = getExtensions(clientCaps);
    const clientGreetingExt = clientExtensions?.[GREETING_EXT] as
      | { preferredLanguage?: string }
      | undefined;

    // Decide the greeting language:
    //   • If the server supports the extension AND the client requested it
    //     with a preferredLanguage, honour that language.
    //   • Otherwise fall back to English.
    let greeting: string;

    if (serverSupportsExtension && clientGreetingExt) {
      // Both sides negotiated the extension.
      const lang = clientGreetingExt.preferredLanguage ?? "en";
      greeting = lang === "ja" ? `こんにちは、${nameArg}！` : `Hello, ${nameArg}!`;
    } else {
      // Graceful degradation: extension not negotiated → English only.
      greeting = `Hello, ${nameArg}!`;
    }

    return {
      content: [{ type: "text" as const, text: greeting }],
    };
  });

  return server;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a Client that MAY or MAY NOT advertise the greeting extension.
//
// The `capabilities` passed to the Client constructor become the initialize
// REQUEST payload that the client sends to the server.
// ─────────────────────────────────────────────────────────────────────────────
function buildClient(
  clientSupportsExtension: boolean,
  preferredLanguage = "ja"
): Client {
  const clientCapabilities = clientSupportsExtension
    ? ({
        // @ts-ignore — extensions field not yet in SDK types
        extensions: {
          [GREETING_EXT]: { preferredLanguage },
        },
      } as any)
    : {};

  return new Client(
    { name: "ext-demo-client", version: "1.0.0" },
    { capabilities: clientCapabilities }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run one scenario end-to-end
// ─────────────────────────────────────────────────────────────────────────────
async function runScenario(
  label: string,
  server: Server,
  client: Client
): Promise<void> {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`SCENARIO: ${label}`);
  console.log("─".repeat(60));

  // InMemoryTransport creates a linked pair: anything written to one end is
  // immediately readable on the other. Perfect for in-process demos.
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  // Connect both sides. The SDK performs the initialize handshake internally:
  //   client → server: initialize request  (carries client capabilities)
  //   server → client: initialize response (carries server capabilities)
  //   client → server: initialized notification
  // After both connect() calls resolve, capabilities are fully negotiated.
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  // ── Inspect negotiated capabilities ──────────────────────────────────────

  // client.getServerCapabilities() returns what the SERVER sent back, i.e.
  // the extensions the server confirmed it supports.
  const serverCaps = client.getServerCapabilities();
  const serverExts = getExtensions(serverCaps);
  const serverNegotiated = serverExts?.[GREETING_EXT];

  // server.getClientCapabilities() returns what the CLIENT advertised, i.e.
  // the extensions the client said it supports.
  const clientCaps = server.getClientCapabilities();
  const clientExts = getExtensions(clientCaps);
  const clientNegotiated = clientExts?.[GREETING_EXT] as
    | { preferredLanguage?: string }
    | undefined;

  console.log(
    `  Client advertised extension : ${clientNegotiated ? JSON.stringify(clientNegotiated) : "not advertised"}`
  );
  console.log(
    `  Server confirmed extension  : ${serverNegotiated ? JSON.stringify(serverNegotiated) : "not confirmed"}`
  );

  // ── Call the greet tool ───────────────────────────────────────────────────
  const result = await client.callTool({ name: "greet", arguments: { name: "Alice" } });

  // Extract the text content from the tool result
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "(no text)";

  console.log(`  Tool result                 : "${text}"`);

  // ── Client-side degradation check ────────────────────────────────────────
  // If the client advertised the extension but the server didn't confirm it,
  // the client should note the degraded state and behave accordingly.
  if (clientNegotiated && !serverNegotiated) {
    console.log(
      `  [CLIENT] Extension not confirmed by server — falling back to baseline behaviour`
    );
  } else if (!clientNegotiated && !serverNegotiated) {
    console.log(`  [CLIENT] Extension not in play — using baseline behaviour`);
  } else {
    console.log(`  [CLIENT] Extension fully negotiated`);
  }

  // Clean up: close both connections
  await client.close();
  await server.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: run all three scenarios
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("MCP Extensions Framework Demo");
  console.log("=".repeat(60));
  console.log(
    "Extension under demo: com.example/greeting\n" +
    "  Adds a `preferredLanguage` hint to the initialize handshake.\n" +
    "  When negotiated, the `greet` tool returns a localised greeting.\n" +
    "  When not negotiated, it falls back to English."
  );

  // ── Scenario 1 ─────────────────────────────────────────────────────────────
  // Both sides support the extension. Client wants Japanese.
  // Expected: tool returns "こんにちは、Alice！"
  await runScenario(
    "Both sides support the extension (client wants Japanese)",
    buildServer(true),   // server supports com.example/greeting
    buildClient(true, "ja") // client advertises it with preferredLanguage: "ja"
  );

  // ── Scenario 2 ─────────────────────────────────────────────────────────────
  // Client does NOT advertise the extension. Server would support it but has
  // no signal from the client, so it falls back to English.
  // Expected: tool returns "Hello, Alice!"
  await runScenario(
    "Client does NOT advertise the extension (server gracefully falls back)",
    buildServer(true),   // server supports com.example/greeting
    buildClient(false)   // client sends no extensions capability
  );

  // ── Scenario 3 ─────────────────────────────────────────────────────────────
  // Client advertises the extension but the server does NOT support it.
  // The server's initialize response will omit the extension.
  // After connect(), the client detects it's absent and logs the fallback.
  // The tool still returns English because the server has no extension logic.
  // Expected: tool returns "Hello, Alice!" + client logs degradation notice
  await runScenario(
    "Server does NOT support the extension (client detects & falls back)",
    buildServer(false),  // server does NOT support com.example/greeting
    buildClient(true, "ja") // client advertises it but server won't echo it back
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log("Done. Key takeaways:");
  console.log("  1. Extensions are negotiated in the initialize handshake");
  console.log("  2. Check BOTH sides' capabilities after connect()");
  console.log("  3. Always provide a graceful fallback — never hard-require an extension");
  console.log("  4. Use @ts-ignore / `as any` until the SDK types catch up with the spec");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
