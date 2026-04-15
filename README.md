# MCP Learning Repo

This repository is a concept-by-concept MCP curriculum. Each directory is a
standalone demo focused on one transport, one protocol feature, or one
ecosystem/distribution pattern.

Status labels used below:

- `verified`: typechecked and smoke-tested end-to-end in this repo
- `educational approximation`: intentionally simplified for learning; useful,
  but not claiming full production/spec completeness

## Core transports

| Directory | Concept | When to use it | Status |
| --- | --- | --- | --- |
| `mcp-stdio-math` | stdio transport | local subprocess servers launched by a host app | verified |
| `mcp-sse-weather` | legacy SSE transport | learning older MCP HTTP patterns and compatibility | verified |
| `mcp-http-todo` | stateless Streamable HTTP | modern remote MCP over standard HTTP infrastructure | verified |
| `mcp-stateful-http` | stateful Streamable HTTP | session-oriented HTTP flows with `Mcp-Session-Id` | verified |
| `mcp-custom-transport` | custom transport | when you need MCP over a nonstandard channel | verified |

## Local and low-level patterns

| Directory | Concept | When to use it | Status |
| --- | --- | --- | --- |
| `mcp-inmemory-demo` | `InMemoryTransport` | tests and same-process learning/demo setups | verified |
| `mcp-inmemory-notes` | second `InMemoryTransport` example | extra same-process notes example | verified |
| `mcp-lowlevel-server` | raw `Server` API | when you need full control over MCP request handlers | verified |
| `mcp-lowlevel-notes` | second low-level example | simpler notes-oriented low-level example | verified |
| `mcp-lifecycle` | initialize/ping/cancel/close | understanding connection lifecycle and cancellation | verified |

## Tools, resources, prompts

| Directory | Concept | When to use it | Status |
| --- | --- | --- | --- |
| `mcp-resources-prompts` | resources + prompts | exposing readable data and reusable prompt templates | verified |
| `mcp-resources-prompts-notes` | smaller resources/prompts example | lighter-weight alternative/example | verified |
| `mcp-resource-templates` | URI templates + subscriptions | families of resources and per-resource updates | verified |
| `mcp-tool-advanced` | annotations, structured output, resource links | richer tool metadata and machine-readable tool results | verified |
| `mcp-completions` | argument completion | autocomplete for prompt/resource template arguments | verified |
| `mcp-list-changed` | dynamic manifest updates | when tools/resources/prompts appear or disappear at runtime | verified |
| `mcp-pagination` | paginated listing | when list responses are too large for one page | verified |
| `mcp-server-instructions` | server instructions | publishing guidance to clients at initialize time | verified |

## Client-driven / interactive features

| Directory | Concept | When to use it | Status |
| --- | --- | --- | --- |
| `mcp-roots` | roots | client provides workspace scope to the server | verified |
| `mcp-logging` | MCP logging | server-side observability routed through MCP | verified |
| `mcp-progress` | progress notifications | long-running tools with progress updates | verified |
| `mcp-sampling` | sampling | server asks client/model to generate content | verified |
| `mcp-sampling-tools` | sampling with tools | server asks client/model to reason with tool definitions | verified |
| `mcp-elicitation` | form elicitation | server requests structured user input mid-workflow | verified |
| `mcp-tasks` | tasks API | async/polling-friendly tool execution | verified |

## Auth, discovery, UI, ecosystem

| Directory | Concept | When to use it | Status |
| --- | --- | --- | --- |
| `mcp-auth` | bearer auth + protected resource metadata | secured remote MCP endpoints | verified |
| `mcp-stateful-auth-notes` | combined stateful + auth example | learning both concepts together in one HTTP app | verified |
| `mcp-oauth-browser` | browser-style auth-code flow | learning redirect/code/token exchange around MCP | verified |
| `mcp-dpop-demo` | DPoP-style proof extension | learning proof-of-possession ideas on top of bearer auth | educational approximation |
| `mcp-server-cards` | discovery metadata / server cards | pre-connection discovery of server capabilities/endpoints | verified |
| `mcp-apps` | `ui://` app resources | app-capable clients that can render UI resources | verified |
| `mcp-registry-demo` | registry discovery | discovering public MCP servers from the official registry | verified |
| `mcp-bundle-demo` | MCP Bundle-style packaging | packaging/shipping local servers with a manifest | verified |
| `mcp-multi-turn-sse` | long-lived multi-turn SSE session | learning proposal-style sessionful SSE flows | educational approximation |

## How to read the repo

Start here if you want the cleanest progression:

1. `mcp-stdio-math`
2. `mcp-http-todo`
3. `mcp-inmemory-demo`
4. `mcp-lowlevel-server`
5. `mcp-resources-prompts`
6. `mcp-roots`
7. `mcp-logging`
8. `mcp-progress`
9. `mcp-completions`
10. `mcp-sampling`
11. `mcp-elicitation`
12. `mcp-stateful-http`
13. `mcp-auth`
14. `mcp-tool-advanced`
15. `mcp-resource-templates`
16. `mcp-list-changed`
17. `mcp-tasks`
18. `mcp-server-cards`
19. `mcp-apps`

The duplicate “notes” variants remain in the repo because they are useful as
smaller alternate examples, but they are not the primary recommended path.
