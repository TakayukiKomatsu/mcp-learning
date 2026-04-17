# MCP: Spec vs Extensions vs Ecosystem

One of the easiest ways to get confused while learning MCP is to mix together:

- what is in the core protocol spec
- what is in official extensions
- what is a useful ecosystem convention
- what is just an educational approximation

This document separates those layers.

## 1. Core spec

These are the things that define baseline MCP behavior.

Examples:

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
- pagination
- lifecycle

If you build a serious MCP system, this layer is the foundation.

## 2. Official extensions

These are not the core protocol, but they are structured, named additions with
negotiation semantics.

Examples:

- MCP Apps / `ui://`
- OAuth Client Credentials extension
- Enterprise-Managed Authorization

Extensions are appropriate when:

- the concept is real and useful
- it should not yet be forced on all MCP implementations
- graceful degradation matters

## 3. Ecosystem / tooling conventions

These are often important in practice but are not identical to the protocol.

Examples:

- registry discovery
- bundle packaging
- server cards / metadata distribution patterns
- local project conventions around packaging or deployment

These may be highly useful without being “core protocol primitives.”

## 4. Educational approximations

These are teaching tools.

Examples in this repo:

- `mcp-dpop-demo`
- `mcp-multi-turn-sse`

They are useful because they teach the architecture and design direction, but
they should not be mistaken for a final standards-complete implementation.

## 5. Active working-group / future ideas

These are important to watch, but should not be taught as if they are already
finished and universal.

Examples:

- triggers and events
- skills over MCP
- future transport/session experiments

## Rule of thumb

When you read or build MCP material, always ask:

1. Is this core spec?
2. Is this an official extension?
3. Is this an ecosystem/distribution convention?
4. Is this only an educational approximation?
5. Is this still a future / working-group area?

That one habit prevents a lot of confusion.
