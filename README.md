# MCP Learning Repo

Last validated in this repo: `2026-04-15`

This repository is a concept-by-concept MCP curriculum for `2026`. It is meant
to answer four practical questions:

1. What is MCP, structurally?
2. Which transport or feature should I choose for a given problem?
3. Which demos are local subprocesses, which are HTTP services, and which are
   same-process learning tools?
4. Which parts are stable, and which parts are intentionally simplified for
   education?

All `mcp-*` directories in this repository currently typecheck. The projects
marked `verified` below were also smoke-tested end-to-end in this repo. The
projects marked `educational approximation` are still useful learning demos, but
they intentionally simplify evolving or more complex patterns.

## MCP in One Page

MCP, the Model Context Protocol, is a protocol for connecting an LLM host/client
to tools, data, prompts, and interactive workflows exposed by a server.

The core mental model is:

- `host application`
  An IDE, desktop app, agent runner, CLI, or web client that wants to use MCP.
- `client`
  The protocol participant owned by the host. It connects to MCP servers,
  advertises client capabilities, and handles server-initiated requests such as
  sampling, elicitation, or roots.
- `server`
  The protocol participant that exposes tools, resources, prompts, or remote UI.
- `transport`
  How JSON-RPC messages move between the client and the server. MCP is not tied
  to one transport.

The most important conceptual split in MCP is:

- `tools`
  Actions. They do work, may change state, and may call external systems.
- `resources`
  Readable data. They are for exposing information, not performing actions.
- `prompts`
  Reusable prompt templates. They generate message bundles the client can feed
  to a model.

On top of that, the client can optionally support:

- `roots`
  The client tells the server what directories or workspaces are in scope.
- `sampling`
  The server asks the client/model to generate text or structured output.
- `elicitation`
  The server asks the user for structured input during a workflow.
- `tasks`
  The client and server coordinate long-running async work instead of blocking on
  one immediate tool response.

## 2026 MCP Landscape

For practical learning in `2026`, it helps to separate MCP into three layers.

### 1. Stable protocol base

This is the foundation you should understand first:

- `stdio`
- `Streamable HTTP`
- tools
- resources
- prompts
- roots
- logging
- progress
- completions
- elicitation
- sampling
- list-changed notifications
- pagination
- stateful vs stateless HTTP
- auth / protected resource metadata
- lifecycle

### 2. 2025-11-25 era advanced features

These are part of the modern MCP toolbelt but not always needed on day one:

- `tasks` (still experimental in the TypeScript SDK)
- richer tool metadata such as annotations and `outputSchema`
- resource subscriptions and update notifications
- resource templates
- server instructions

### 3. 2026 ecosystem / extension layer

This is where MCP becomes a platform rather than just a wire protocol:

- `MCP Apps` and `ui://` resources
- `Server Cards` / pre-connection discovery metadata
- `Registry` discovery
- `Bundle` packaging and distribution
- stronger auth patterns such as DPoP-style proof-of-possession
- formal extensions framework (SEP-2133): `extensions` capability negotiation, vendor-prefixed identifiers, graceful degradation
- OAuth Client Credentials extension for machine-to-machine auth
- Enterprise-Managed Authorization extension for SSO/IdP environments
- transport and session experiments such as long-lived SSE variants

### Active Working Groups (not yet in spec)

These are active MCP Working Groups as of 2026. They are developing ideas that
may become extensions or spec additions in the future. They are not yet
demonstrated in this repo because they have no finalized spec yet.

- `Triggers and Events`
  Event-driven MCP: servers push notifications or trigger client workflows based
  on external events, rather than only responding to client requests.

- `Skills Over MCP`
  Standardized skill/instruction sets exposed via MCP, allowing agents to
  discover and consume portable, structured guidance from servers.

- `Inspector V2`
  Next-generation tooling for testing, inspecting, and debugging MCP servers
  interactively.

## Status Labels

- `verified`
  Typechecked and smoke-tested end-to-end in this repo.
- `educational approximation`
  Intentionally simplified for learning. Useful and correct at the concept
  level, but not claiming full production/spec completeness.

## Runtime Shapes

Not all MCP servers should be deployed the same way.

### Local subprocess servers

These are usually launched by a host app as a child process over `stdio`.

Use this shape when:

- the server is local to one machine
- the host launches and owns the server process
- you do not need shared multi-client network access
- you want the simplest operational model

Typical examples in this repo:

- `mcp-stdio-math`
- `mcp-lowlevel-server`
- `mcp-resources-prompts`
- `mcp-logging`
- `mcp-progress`
- `mcp-lifecycle`

### External HTTP services

These run like remote applications or microservices and expose MCP over HTTP.

Use this shape when:

- multiple clients may connect
- the server is remote or shared
- you need standard HTTP infrastructure, proxies, load balancers, auth, or
  browser-oriented flows

Typical examples in this repo:

- `mcp-http-todo`
- `mcp-stateful-http`
- `mcp-auth`
- `mcp-enterprise-managed-auth`
- `mcp-oauth-browser`
- `mcp-oauth-discovery`
- `mcp-server-cards`
- `mcp-tasks`
- `mcp-tasks-lifecycle`

### Same-process demos

These are primarily for learning or testing. They do not need a separate server
process at all.

Use this shape when:

- you want to understand MCP mechanics without process or network setup
- you are building tests or examples

Typical examples in this repo:

- `mcp-inmemory-demo`
- `mcp-inmemory-notes`
- `mcp-custom-transport`
- `mcp-websocket-custom`
- `mcp-extensions-demo`

### Ecosystem / tooling demos

These are not “servers” in the usual runtime sense. They demonstrate discovery
and distribution patterns around MCP.

Typical examples in this repo:

- `mcp-registry-demo`
- `mcp-bundle-demo`

## Transport Selection Guide

### `stdio`

Use `stdio` when:

- the host launches the MCP server as a subprocess
- the server is local and tightly coupled to one host
- you want minimal operational complexity

Best examples here:

- `mcp-stdio-math`
- `mcp-lowlevel-server`

### `Streamable HTTP`

Use stateless `Streamable HTTP` when:

- the server is remote
- you want easy horizontal scaling
- you want one endpoint and standard HTTP infrastructure

Best examples here:

- `mcp-http-todo`
- `mcp-auth`
- `mcp-oauth-client-credentials`

Use stateful `Streamable HTTP` when:

- the server needs session-scoped state
- the workflow benefits from `Mcp-Session-Id`
- the same client should keep a stable session across requests

Best examples here:

- `mcp-stateful-http`
- `mcp-stateful-auth-notes`

### `SSE`

Use SSE today mostly for:

- learning older MCP patterns
- compatibility with legacy deployments

In `2026`, it is still worth understanding, but it is no longer the preferred
default.

Best example here:

- `mcp-sse-weather`

### Custom transports

Use a custom transport only when:

- you truly need a nonstandard channel
- you understand that MCP is transport-agnostic and can implement the transport
  contract yourself

Best example here:

- `mcp-custom-transport`

### Non-standard WebSocket transport

Use this only when you control both ends and intentionally want a persistent
WebSocket channel. It is useful for learning or private deployments, but it is
not one of the standard MCP transports.

Best example here:

- `mcp-websocket-custom`

## Feature Families

### Tools and execution

- `mcp-stdio-math`
- `mcp-lowlevel-server`
- `mcp-tool-advanced`
- `mcp-list-changed`
- `mcp-pagination`
- `mcp-retry-jitter`
- `mcp-websocket-custom`

### Readable data and reusable templates

- `mcp-resources-prompts`
- `mcp-resources-prompts-notes`
- `mcp-resource-templates`
- `mcp-completions`

### Client-provided context and client-driven interactions

- `mcp-roots`
- `mcp-sampling`
- `mcp-sampling-tools`
- `mcp-elicitation`

### Observability and lifecycle

- `mcp-logging`
- `mcp-progress`
- `mcp-lifecycle`

### Async workflows

- `mcp-tasks`
- `mcp-tasks-lifecycle`

### Auth, discovery, distribution, UI

- `mcp-auth`
- `mcp-enterprise-managed-auth`
- `mcp-oauth-browser`
- `mcp-oauth-client-credentials`
- `mcp-oauth-discovery`
- `mcp-dpop-demo`
- `mcp-server-cards`
- `mcp-apps`
- `mcp-extensions-demo`
- `mcp-registry-demo`
- `mcp-bundle-demo`

## Full Project Catalog

| Directory | Main concept | Transport / runtime | Separate server process? | Microservice-friendly? | Status | When to apply it |
| --- | --- | --- | --- | --- | --- | --- |
| `mcp-apps` | `ui://` app resources | stdio client/server demo | no | no | verified | when an app-capable client should render remote UI resources |
| `mcp-auth` | bearer auth + protected resource metadata | Streamable HTTP | yes | yes | verified | secured remote MCP endpoints |
| `mcp-bundle-demo` | bundle packaging | tooling / local bundle | no | n/a | verified | packaging local MCP servers with a manifest |
| `mcp-completions` | prompt/resource argument autocomplete | stdio | no | no | verified | autocompletion in MCP-aware UIs |
| `mcp-custom-transport` | hand-rolled transport | same-process custom transport | no | no | verified | learning that MCP is transport-agnostic |
| `mcp-dpop-demo` | DPoP-style proof extension | Streamable HTTP | yes | yes | educational approximation | proof-of-possession ideas layered on auth |
| `mcp-elicitation` | structured user input mid-call | stdio | no | no | verified | server asks the user for non-sensitive structured input |
| `mcp-enterprise-managed-auth` | enterprise-managed authorization | Streamable HTTP | yes | yes | verified | learning gateway/IdP-managed policy enforcement without interactive auth on the MCP server |
| `mcp-extensions-demo` | MCP extensions capability negotiation | same-process | no | no | verified | demonstrating how extension identifiers are negotiated in initialize |
| `mcp-http-todo` | stateless Streamable HTTP | Streamable HTTP | yes | yes | verified | default remote MCP service shape |
| `mcp-inmemory-demo` | `InMemoryTransport` | same-process | no | no | verified | tests, same-process learning, no infrastructure |
| `mcp-inmemory-notes` | second `InMemoryTransport` example | same-process | no | no | verified | alternate in-memory example |
| `mcp-lifecycle` | initialize / ping / cancel / close | stdio | no | no | verified | learning the connection lifecycle and cancellation |
| `mcp-list-changed` | dynamic tool/resource/prompt updates | stdio | no | no | verified | servers that change their manifests at runtime |
| `mcp-logging` | MCP logging | stdio | no | no | verified | server-side logs routed through MCP instead of stdout |
| `mcp-lowlevel-notes` | low-level notes example | stdio | no | no | verified | simpler raw `Server` example |
| `mcp-lowlevel-server` | raw `Server` API | stdio | no | no | verified | understanding MCP below `McpServer` |
| `mcp-multi-turn-sse` | sessionful SSE turns | SSE | yes | limited | educational approximation | learning long-lived SSE session behavior |
| `mcp-oauth-browser` | browser-style auth-code flow | Streamable HTTP | yes | yes | verified | redirect/code/token exchange around MCP |
| `mcp-oauth-client-credentials` | OAuth 2.0 Client Credentials (M2M auth) | Streamable HTTP | yes | yes | verified | service-to-service auth with no human user involved |
| `mcp-oauth-discovery` | OAuth discovery chain | Streamable HTTP | yes | yes | verified | learning `oauth-protected-resource` -> `oauth-authorization-server` -> `token_endpoint` discovery |
| `mcp-pagination` | paginated resource listing | stdio | no | no | verified | list endpoints with cursors |
| `mcp-progress` | progress notifications | stdio | no | no | verified | long-running tools that report progress |
| `mcp-registry-demo` | registry discovery | ecosystem script | no | n/a | verified | finding public servers in the MCP registry |
| `mcp-retry-jitter` | retry, jitter, and failure classification | stdio | no | no | verified | teaching client-side retry policy for transient vs permanent failures |
| `mcp-resource-templates` | templated resources + subscriptions | stdio | no | no | verified | dynamic URI families and per-resource updates |
| `mcp-resources-prompts` | resources + prompts | stdio | no | no | verified | exposing data and reusable prompt templates |
| `mcp-resources-prompts-notes` | smaller resources/prompts example | stdio | no | no | verified | lighter alternate example |
| `mcp-roots` | client-provided workspace roots | stdio | no | no | verified | when the server needs workspace scope from the client |
| `mcp-sampling` | server asks client/model to generate | stdio | no | no | verified | model generation owned by the client side |
| `mcp-sampling-tools` | sampling with tool definitions | stdio | no | no | verified | client-side model loops with server-provided tool metadata |
| `mcp-server-cards` | pre-connection discovery metadata | Streamable HTTP | yes | yes | verified | discovery before a full MCP connection |
| `mcp-server-instructions` | initialize-time instructions | stdio | no | no | verified | publishing guidance to clients at connect time |
| `mcp-sse-weather` | legacy SSE transport | SSE | yes | limited | verified | learning older HTTP MCP patterns |
| `mcp-stateful-auth-notes` | combined stateful HTTP + auth | Streamable HTTP | yes | yes | verified | learning session state and auth in one app |
| `mcp-stateful-http` | stateful Streamable HTTP | Streamable HTTP | yes | yes | verified | session-oriented remote MCP |
| `mcp-stdio-math` | canonical stdio demo | stdio | no | no | verified | the starting point for local subprocess MCP |
| `mcp-tasks` | async task execution | Streamable HTTP | yes | yes | verified | long-running workflows with task polling/status |
| `mcp-tasks-lifecycle` | isolated task lifecycle states | Streamable HTTP | yes | yes | verified | teaching completed / failed / expired task outcomes cleanly |
| `mcp-tool-advanced` | annotations, structured output, resource links | stdio | no | no | verified | richer tool metadata and machine-readable results |
| `mcp-websocket-custom` | non-standard websocket transport | custom websocket | yes | limited | verified | when you control both endpoints and explicitly want a persistent websocket channel |

## Choose by Use Case

Use these tables when the repo feels too broad and you need the shortest path
to the right demo.

### Which transport should I choose?

| Situation | Prefer | Why | Best demos |
| --- | --- | --- | --- |
| local host launches local MCP subprocess | `stdio` | lowest operational overhead, no network | `mcp-stdio-math`, `mcp-lowlevel-server` |
| remote service behind normal HTTP infrastructure | stateless `Streamable HTTP` | one endpoint, easy deployment and scaling | `mcp-http-todo`, `mcp-auth`, `mcp-oauth-client-credentials` |
| remote service with per-session state | stateful `Streamable HTTP` | explicit session handling with `Mcp-Session-Id` | `mcp-stateful-http`, `mcp-stateful-auth-notes` |
| learning the older HTTP pattern | `SSE` | useful historical/background understanding | `mcp-sse-weather` |
| same-process tests or demos | `InMemoryTransport` | no server process or sockets needed | `mcp-inmemory-demo` |
| custom non-standard persistent socket | custom transport / websocket | only when you control both client and server | `mcp-custom-transport`, `mcp-websocket-custom` |

### Which auth pattern should I choose?

| Situation | Prefer | Why | Best demos |
| --- | --- | --- | --- |
| simple protected MCP endpoint | bearer auth | smallest useful protected setup | `mcp-auth` |
| user signs in via browser | auth-code flow | delegated user access with redirect/code exchange | `mcp-oauth-browser` |
| backend service authenticates itself | client credentials | no browser, no user, machine-to-machine | `mcp-oauth-client-credentials` |
| understanding discovery chain itself | OAuth discovery chain | isolates resource metadata -> AS metadata -> token endpoint | `mcp-oauth-discovery` |
| enterprise SSO / gateway-enforced policy | enterprise-managed auth | authorization comes from upstream enterprise context | `mcp-enterprise-managed-auth` |
| proof-of-possession concepts | DPoP-style pattern | teaches a stronger-than-bearer direction, still simplified here | `mcp-dpop-demo` |

### Which async / failure pattern should I choose?

| Situation | Prefer | Why | Best demos |
| --- | --- | --- | --- |
| one call with progress updates | progress notifications | keep a single request alive while showing work | `mcp-progress` |
| long-running async work with task ids | tasks API | explicit lifecycle rather than one blocking response | `mcp-tasks` |
| understand completed/failed/expired task outcomes | isolated task lifecycle demo | narrower focus than the full tasks demo | `mcp-tasks-lifecycle` |
| classify transient vs permanent failures and apply jitter | retry/jitter demo | teaches retry policy outside the tasks API too | `mcp-retry-jitter` |
| server asks model to generate | sampling | generation remains client/model-owned | `mcp-sampling`, `mcp-sampling-tools` |
| server asks user for structured input | elicitation | user input is part of the workflow | `mcp-elicitation` |

## Recommended Learning Path

If you want the cleanest progression through MCP as a learner, use this order:

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
14. `mcp-enterprise-managed-auth`
15. `mcp-oauth-client-credentials`
16. `mcp-oauth-discovery`
17. `mcp-tool-advanced`
18. `mcp-retry-jitter`
19. `mcp-resource-templates`
20. `mcp-list-changed`
21. `mcp-tasks`
22. `mcp-tasks-lifecycle`
23. `mcp-server-cards`
24. `mcp-apps`
25. `mcp-extensions-demo`
26. `mcp-registry-demo`
27. `mcp-bundle-demo`

Use the “notes” variants as secondary examples, not as the primary path.

## Verified vs Educational Approximations

Most of the repo is intended to be a directly runnable teaching implementation.
Two projects are intentionally categorized as approximations:

- `mcp-dpop-demo`
  It teaches the idea of proof-of-possession, but it is not a full standards
  implementation of DPoP.
- `mcp-multi-turn-sse`
  It teaches a useful session pattern on top of SSE, but it is better read as a
  learning demo than as the final word on future SSE/session semantics.

Those approximations are acceptable for learning. They exist to teach the
concepts without pretending that every evolving or enterprise pattern is fully
standardized and production-complete in this repo.

## How to Run the Repo

There are three common ways to run the demos.

### A. Single-command demos

These demos are either same-process or the client spawns the server itself:

- `npm run start`
- or `npm run client`

Examples:

- `mcp-stdio-math`
- `mcp-lowlevel-server`
- `mcp-inmemory-demo`
- `mcp-completions`
- `mcp-sampling`

### B. HTTP / SSE service demos

These typically require one terminal for the server and one for the client:

1. `npm run server`
2. `npm run client`

Examples:

- `mcp-http-todo`
- `mcp-auth`
- `mcp-stateful-http`
- `mcp-sse-weather`
- `mcp-server-cards`

### C. Ecosystem scripts

These are not normal client/server pairs:

- `mcp-registry-demo` uses `npm run start`
- `mcp-bundle-demo` uses `npm run inspect`

## When Not to Use MCP

MCP is useful when you want a host/client and a server to negotiate capabilities
in a standard way. It is not automatically the right answer for every
integration.

Do not reach for MCP first when:

- you only need a normal internal function call in one codebase
- you do not need capability discovery or tool/resource separation
- a plain HTTP API is enough and no MCP-aware host/client will consume it
- the overhead of session/transport/auth negotiation adds complexity with no
  real benefit

## Official Reading for 2026

Use this repo together with the official references:

- MCP specification base:
  [modelcontextprotocol.io/specification/2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- 2026 roadmap:
  [blog.modelcontextprotocol.io/posts/2026-mcp-roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- MCP Apps:
  [blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- Core maintainer update:
  [blog.modelcontextprotocol.io/posts/2026-01-22-core-maintainer-update](https://blog.modelcontextprotocol.io/posts/2026-01-22-core-maintainer-update/)
- MCP Registry preview:
  [blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
- MCP Bundles:
  [blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb](https://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/)
- Server Instructions:
  [blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/)
- Tool Annotations as Risk Vocabulary:
  [blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)
- Understanding MCP Extensions:
  [blog.modelcontextprotocol.io/posts/2026-03-11-understanding-mcp-extensions](https://blog.modelcontextprotocol.io/posts/2026-03-11-understanding-mcp-extensions/)
- Expanding the MCP Maintainer Team:
  [blog.modelcontextprotocol.io/posts/2026-04-08-maintainer-update](https://blog.modelcontextprotocol.io/posts/2026-04-08-maintainer-update/)

## Bottom Line

If you read this repo in order, you will learn:

- what MCP is
- how its transports differ
- what should be local vs remote
- how tools/resources/prompts differ
- how client-driven features like roots, sampling, and elicitation work
- how auth, tasks, discovery, UI, registry, and packaging fit into the 2026 MCP
  ecosystem

That is the purpose of this repository: not just a pile of examples, but a
single place to understand MCP as a complete system in `2026`.
