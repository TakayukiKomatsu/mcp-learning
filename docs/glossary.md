# MCP Glossary

This glossary is intentionally practical. It is written for someone building
and debugging MCP systems, not for formal specification language.

## Core roles

### Host Application

The real product that wants MCP capabilities.

Examples:

- an IDE
- a desktop AI app
- a CLI agent runner
- a backend orchestration service

The host usually embeds an MCP client implementation.

### Client

The protocol participant that connects to MCP servers.

A client:

- opens the transport
- sends `initialize`
- advertises client capabilities
- calls tools / reads resources / gets prompts
- handles server-initiated requests such as roots, sampling, and elicitation

### Server

The protocol participant that exposes capabilities to clients.

A server may expose:

- tools
- resources
- prompts
- logging
- task support
- list-changed notifications
- UI resources such as `ui://...`

## Transport and connection terms

### Transport

How JSON-RPC messages move between client and server.

Standard MCP transports:

- `stdio`
- `Streamable HTTP`

Legacy / historical:

- `SSE`

Custom / non-standard:

- WebSocket-based transports
- in-memory transports
- any channel that can carry request/response messages

### Session

A logical ongoing relationship between a client and a server.

In MCP, a session may be:

- implicit and short-lived
- long-lived across requests
- stateful with a session identifier

### `Mcp-Session-Id`

The HTTP header used in stateful Streamable HTTP mode so later requests can be
associated with the same session.

### Lifecycle

The connection phases around:

- `initialize`
- `initialized`
- normal requests
- `ping`
- `notifications/cancelled`
- `close`

## Capability families

### Capability

A declared feature supported by one side of the connection.

Capabilities matter because MCP is negotiated. A feature is not assumed; it is
advertised.

### Tool

An action the server can perform.

Use a tool when:

- something may change state
- code must run
- an external system must be contacted
- the operation should be framed as an invocation rather than a document read

### Resource

Readable data exposed by a server.

Use a resource when:

- the model should read information
- the content is document-like or record-like
- no action needs to happen

### Resource Template

A parameterized family of resources, usually expressed as a URI template.

Example:

- `tickets://{ticketId}`

### Prompt

A reusable prompt template that returns MCP message content ready to send to a
model.

### Roots

Client-provided workspace or filesystem scope.

Roots let the server ask:

- “what directories are in scope?”

without hardcoding local paths.

### Sampling

A server-initiated request asking the client/model side to generate content.

This reverses the usual direction: the server becomes the requester.

### Elicitation

A server-initiated request asking the user for structured input during an
ongoing workflow.

### Completion

Autocomplete suggestions for prompt arguments or resource-template variables.

### Logging

MCP-native structured logging messages that travel through the protocol instead
of raw stdout/stderr.

### Progress Notifications

Incremental status updates during a long-running request.

### Tasks

The async model for long-running work where the client tracks lifecycle and
result retrieval instead of waiting for one blocking tool response.

## Auth and discovery terms

### Protected Resource Metadata

The discovery document usually exposed at:

- `/.well-known/oauth-protected-resource`

It tells the client:

- what resource is protected
- which authorization servers are trusted
- which scopes are relevant

### Authorization Server Metadata

The OAuth discovery document usually exposed at:

- `/.well-known/oauth-authorization-server`

It tells the client:

- where the token endpoint is
- which grant types are supported
- how clients authenticate to the token endpoint

### Client Credentials

OAuth machine-to-machine flow.

Use it when:

- there is no human user
- one service authenticates as itself

### Authorization Code Flow

OAuth browser/user flow.

Use it when:

- a human user signs in and grants access

### Enterprise-Managed Authorization

A pattern where identity and policy are managed by enterprise infrastructure
such as SSO, gateways, or reverse proxies, and the MCP server enforces those
claims instead of driving user-facing login itself.

### DPoP

Proof-of-possession style auth. Stronger than plain bearer in concept because a
request includes proof tied to the caller and request details.

## Discovery and ecosystem terms

### Server Card

Pre-connection discovery metadata for an MCP server, typically exposed over
HTTP.

### Registry

A directory of MCP servers or packages that can be discovered by users or tools.

### Bundle

A packaged local MCP server plus metadata/manifest, intended to make local
distribution and installation easier.

### App Resource / `ui://`

A resource intended to be rendered by an app-capable MCP client, usually as UI
instead of plain text.

### Extension

An optional protocol addition negotiated explicitly via capabilities.

Extensions should:

- be vendor-prefixed
- degrade gracefully when unsupported
- not break baseline MCP clients/servers
