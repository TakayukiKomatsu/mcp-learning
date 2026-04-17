# MCP Troubleshooting Guide

This guide is for the most common MCP failures you will hit while building or
debugging servers and clients.

## 1. "Method not found" or capability-related failures

### Symptom

- a client calls something and gets `Method not found`
- a feature appears to exist in code but not at runtime

### Common cause

The relevant capability was not advertised during `initialize`.

Examples:

- logging used without `logging` capability
- roots used without client `roots` capability
- completions used without completions support
- sampling or elicitation attempted when the client did not advertise support

### Fix

- inspect both sides’ initialize capabilities
- do not assume support; negotiate it
- degrade gracefully when capability is absent

## 2. "Missing or unknown Mcp-Session-Id"

### Symptom

- stateful HTTP requests fail after initialize
- follow-up calls return "unknown session"

### Common cause

- stateful mode is enabled, but the client did not send the returned
  `Mcp-Session-Id`
- the server discarded the session
- the client tried to call before a valid initialize handshake

### Fix

- use stateful HTTP only when session semantics are needed
- verify the client stores and reuses `Mcp-Session-Id`
- verify server-side cleanup is not too aggressive

## 3. Auth works locally but fails in discovery-based clients

### Symptom

- token acquisition works in a hardcoded client
- discovery-based clients fail

### Common cause

- missing `/.well-known/oauth-protected-resource`
- missing `/.well-known/oauth-authorization-server`
- hardcoded token endpoint assumptions
- wrong scopes or wrong auth method at token endpoint

### Fix

- verify the full discovery chain
- keep resource metadata and authorization-server metadata consistent
- test with the isolated discovery demos:
  - `mcp-oauth-discovery`
  - `mcp-oauth-client-credentials`

## 4. Progress notifications never appear

### Symptom

- tool finishes successfully
- no progress is visible

### Common cause

- client did not include a `progressToken`
- server never sent `notifications/progress`
- progress is being sent but the client has no handler

### Fix

- confirm the request includes `_meta.progressToken`
- confirm the server guards on `progressToken !== undefined`
- confirm the client handles the progress notification schema

## 5. Tasks behave strangely

### Symptom

- tasks complete but results cannot be fetched
- results disappear
- retries are confusing

### Common cause

- TTL expired
- task store lifecycle is unclear
- client is treating permanent and transient failures the same way

### Fix

- inspect task status and result retrieval separately
- verify TTL and expiry behavior
- classify failures before retrying

Read:

- `mcp-tasks`
- `mcp-tasks-lifecycle`
- `mcp-retry-jitter`

## 6. Resources should have been tools, or tools should have been resources

### Symptom

- clients behave awkwardly
- behavior feels semantically wrong

### Common cause

The abstraction is wrong:

- a resource is doing work
- a tool is only serving a document

### Fix

- if it is data to read: prefer a resource
- if it is action or side effect: prefer a tool

Read:

- `docs/anti-patterns.md`
- `mcp-resources-prompts`

## 7. SSE confusion

### Symptom

- messages route incorrectly
- multiple requests require shared server-side connection state
- behavior feels harder than expected

### Common cause

SSE is a legacy long-lived transport pattern and requires careful session
association across endpoints.

### Fix

- prefer `Streamable HTTP` unless you explicitly need SSE learning/compatibility
- use SSE mostly as a conceptual or compatibility demo in 2026

## 8. Custom transport works in one environment but not another

### Symptom

- custom transport demo works locally
- integration with other clients is poor or nonexistent

### Common cause

Custom transports are by definition non-standard. Interoperability is lower than
with `stdio` or `Streamable HTTP`.

### Fix

- use custom transports only when you control both ends
- label them clearly as non-standard
- prefer standard transports for public/shared interoperability

## Debugging checklist

When stuck, check these in order:

1. Did `initialize` succeed?
2. Are the expected capabilities actually advertised?
3. Are you using the right abstraction: tool vs resource vs prompt?
4. Is the transport standard or custom?
5. If HTTP is stateful, is the session ID being reused?
6. If auth is involved, does the discovery chain match the token endpoint?
7. If retries are involved, are you distinguishing transient vs permanent failure?
