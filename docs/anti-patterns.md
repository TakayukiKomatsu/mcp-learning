# MCP Anti-Patterns

These are common mistakes when learning or designing MCP systems.

## 1. Using a tool when a resource should be used

Bad:

- `get_project_readme` as a tool that only returns text

Better:

- expose the README as a resource

Why:

- resources are the correct abstraction for readable data
- tools should represent actions

## 2. Hiding side effects behind resources

Bad:

- reading a resource triggers mutation or outbound calls

Better:

- keep resources read-only in behavior
- move the action into a tool

Why:

- clients and models expect resources to be safe to read

## 3. Choosing stateful HTTP when stateless is enough

Bad:

- introducing sessions for simple request/response tools

Better:

- start with stateless `Streamable HTTP`
- add stateful sessions only when session semantics actually matter

Why:

- state introduces more cleanup, more coupling, and more operational complexity

## 4. Hardcoding the token endpoint

Bad:

- client code directly assumes `/oauth/token`

Better:

- discover via:
  - `/.well-known/oauth-protected-resource`
  - `/.well-known/oauth-authorization-server`

Why:

- discovery is part of the value of modern MCP auth

## 5. Treating all failures as retryable

Bad:

- retrying invalid credentials or malformed input

Better:

- classify failures into:
  - transient
  - permanent

Why:

- retries should be policy-driven, not reflexive

See:

- `mcp-retry-jitter`

## 6. Retrying without jitter

Bad:

- every client retries at exactly 100ms, 200ms, 400ms

Better:

- add randomized jitter to backoff

Why:

- synchronized retries can create retry storms

## 7. Using tasks for everything

Bad:

- every tool becomes a task even when the work is trivial

Better:

- use tasks only when lifecycle/status/expiry/retrieval semantics are valuable

Why:

- tasks add complexity; they are not a universal default

## 8. Ignoring capability negotiation

Bad:

- assuming the other side supports roots, sampling, or extensions

Better:

- check capabilities first
- degrade gracefully

Why:

- MCP is negotiated, not assumed

## 9. Building custom transports too early

Bad:

- jumping straight to custom WebSocket or proprietary transports

Better:

- start with `stdio` or `Streamable HTTP`

Why:

- standard transports maximize interoperability and reduce maintenance burden

## 10. Treating educational approximations as production specs

Bad:

- copying a learning demo directly into production without understanding what is
  simplified

Better:

- use the repo’s status labels
- distinguish `verified` from `educational approximation`

Why:

- not every useful teaching demo is intended to be production-complete

## 11. Forgetting cleanup in stateful designs

Bad:

- no session cleanup
- no TTL
- no result expiry strategy

Better:

- explicitly manage lifecycle, cleanup, and expiry

Why:

- long-running servers accumulate state unless you design for cleanup
