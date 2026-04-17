# MCP Design Decision Tree

Use this when you know what problem you have but not which MCP shape to choose.

## Step 1: Local or remote?

### Local

Questions:

- Will the host app launch the server directly?
- Is the server only for one local host?

If yes:

- prefer `stdio`
- or `InMemoryTransport` if this is same-process or test-oriented

Best starting points:

- `mcp-stdio-math`
- `mcp-inmemory-demo`

### Remote

Questions:

- Will multiple clients connect?
- Will this run behind HTTP infrastructure?

If yes:

- prefer `Streamable HTTP`

Best starting points:

- `mcp-http-todo`
- `mcp-stateful-http`

## Step 2: Action or data?

### Action

Need to run code, mutate state, or call external services?

- use a `tool`

Read:

- `mcp-stdio-math`
- `mcp-tool-advanced`

### Data

Need the model to read content without invoking behavior?

- use a `resource`

Read:

- `mcp-resources-prompts`
- `mcp-resource-templates`

### Reusable prompt logic

Need reusable templated model input?

- use a `prompt`

Read:

- `mcp-resources-prompts`

## Step 3: Immediate or long-running?

### Immediate

If the user can wait for one result:

- normal tool call is enough

### Long-running but still one live request

Need intermediate status but still one request?

- use `progress notifications`

Read:

- `mcp-progress`

### Long-running with explicit lifecycle

Need a task id, status tracking, or expiry/retry semantics?

- use `tasks`

Read:

- `mcp-tasks`
- `mcp-tasks-lifecycle`

## Step 4: Does the server need context from the client?

### Workspace / filesystem scope

- use `roots`

Read:

- `mcp-roots`

### Model generation from client side

- use `sampling`

Read:

- `mcp-sampling`
- `mcp-sampling-tools`

### Structured user input during a workflow

- use `elicitation`

Read:

- `mcp-elicitation`

## Step 5: Which auth shape?

### No auth

Internal/local learning/demo:

- `mcp-http-todo`

### Simple protected remote endpoint

- bearer auth + protected resource metadata

Read:

- `mcp-auth`

### Browser/user login

- auth-code flow

Read:

- `mcp-oauth-browser`

### Machine-to-machine

- client credentials

Read:

- `mcp-oauth-client-credentials`
- `mcp-oauth-discovery`

### Enterprise gateway / SSO environment

- enterprise-managed auth pattern

Read:

- `mcp-enterprise-managed-auth`

## Step 6: Standard or custom transport?

### Standard

Choose:

- `stdio`
- `Streamable HTTP`

These maximize interoperability.

### Custom

Only choose a custom transport when:

- you control both endpoints
- standard transports do not fit
- you accept reduced interoperability

Read:

- `mcp-custom-transport`
- `mcp-websocket-custom`

## Step 7: Do you need discovery, UI, or packaging?

### Discovery before connection

- server cards

Read:

- `mcp-server-cards`

### App-capable UI

- `ui://` resources / MCP Apps

Read:

- `mcp-apps`

### Public discovery

- registry

Read:

- `mcp-registry-demo`

### Local distribution / packaging

- bundles

Read:

- `mcp-bundle-demo`

## Default recommendations

If you are unsure:

- local integration → `stdio`
- remote integration → stateless `Streamable HTTP`
- session state → stateful `Streamable HTTP`
- user auth → auth-code flow
- service auth → client credentials
- long-running work → tasks
- read-only data → resources
- reusable prompt logic → prompts
