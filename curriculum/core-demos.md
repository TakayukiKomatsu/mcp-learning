# Core Demos

These are the primary demos to read in order if your goal is to understand MCP
 efficiently without the extra alternate examples.

## Recommended path

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
26. `mcp-websocket-custom`
27. `mcp-registry-demo`
28. `mcp-bundle-demo`

## Why these are the core set

These directories were chosen because each one introduces a concept cleanly
without depending on duplicate framing from another similar demo.

- `mcp-inmemory-demo` is the main same-process demo.
- `mcp-lowlevel-server` is the main low-level API demo.
- `mcp-resources-prompts` is the main resources/prompts demo.
- `mcp-stateful-http` is the main stateful HTTP demo.
- `mcp-auth` + `mcp-enterprise-managed-auth` + `mcp-oauth-*` together cover the
  auth space in a deliberate progression.
