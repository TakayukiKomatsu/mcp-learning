# MCP Production Checklist

This repository is primarily educational, but these are the things you should
check before promoting a learning demo into a real service.

## Transport and deployment

- choose the simplest transport that fits
- prefer `Streamable HTTP` for shared/remote deployment
- avoid stateful HTTP unless session semantics are truly needed
- avoid custom transports unless you control both sides

## Auth and security

- expose correct protected-resource metadata
- expose authorization-server metadata if discovery-based clients need it
- validate scopes explicitly
- use least-privilege scopes
- separate authentication from tool logic
- never treat educational auth approximations as full production auth

## Validation

- validate all tool inputs
- validate structured outputs if using `outputSchema`
- reject malformed requests consistently
- distinguish input errors from runtime failures clearly

## Observability

- use MCP logging where appropriate
- add normal service logs/metrics/traces too
- include request correlation where possible
- make task lifecycle observable if using tasks

## Timeouts and retries

- define timeout policy for upstream calls
- classify failures into transient vs permanent
- use jitter in retries
- do not retry invalid input or invalid credentials

## State and cleanup

- define session cleanup rules
- define task/result TTL rules
- avoid unbounded in-memory growth
- clean up stale subscriptions and stale sessions

## Data shape and protocol semantics

- use resources for readable data
- use tools for actions
- use prompts for reusable prompt templates
- degrade gracefully when optional capabilities are absent
- do not assume client support for roots, sampling, elicitation, or extensions

## Scalability

- use pagination for large lists
- prefer stateless patterns when possible
- understand backpressure and long-running request behavior
- do not overuse tasks when progress notifications would be enough

## Docs and DX

- document transport choice
- document auth shape
- document capability assumptions
- clearly label approximations vs production-grade implementations

## Final question

Before shipping, ask:

"If another team consumes this MCP server without reading our source code, will
the behavior still make sense from its capabilities, metadata, and runtime
semantics alone?"

If the answer is no, the API surface is not ready.
