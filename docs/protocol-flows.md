# MCP Protocol Flow Diagrams

These are simplified, practical flow diagrams for the protocol interactions you
see across the demos in this repository.

## 1. Initialize / Initialized

```mermaid
sequenceDiagram
    participant Host as "Host App"
    participant Client as "MCP Client"
    participant Server as "MCP Server"

    Host->>Client: Open transport
    Client->>Server: initialize {protocolVersion, capabilities, clientInfo}
    Server-->>Client: initialize result {capabilities, serverInfo, instructions?}
    Client->>Server: notifications/initialized
    Note over Client,Server: Session is now live
```

Use this flow in every transport. The transport changes how messages move, not
the logical handshake itself.

## 2. Tool Call

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Server as "MCP Server"

    Client->>Server: tools/call {name, arguments}
    Server->>Server: Validate input
    Server->>Server: Run tool logic
    Server-->>Client: CallToolResult {content, structuredContent?, isError?}
```

Use tools when you need action, side effects, or code execution.

## 3. Resource Read

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Server as "MCP Server"

    Client->>Server: resources/read {uri}
    Server->>Server: Resolve resource or template variables
    Server-->>Client: ReadResourceResult {contents}
```

Use resources when the model should read data rather than invoke behavior.

## 4. Prompt Get

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Server as "MCP Server"

    Client->>Server: prompts/get {name, arguments}
    Server->>Server: Render prompt template
    Server-->>Client: GetPromptResult {messages}
```

Use prompts when you want reusable, named prompt templates rather than raw tool
behavior.

## 5. Roots

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Server as "MCP Server"

    Note over Client,Server: Client advertised roots capability during initialize
    Server->>Client: roots/list
    Client-->>Server: roots/list result {roots}
    Client->>Server: notifications/roots/list_changed
    Server->>Client: roots/list
    Client-->>Server: updated roots
```

Roots are one of the key “direction reversal” features in MCP: the server asks
the client for data.

## 6. Sampling

```mermaid
sequenceDiagram
    participant Server as "MCP Server"
    participant Client as "MCP Client"
    participant Model as "Model / LLM"

    Server->>Client: sampling/createMessage
    Client->>Model: Run model inference
    Model-->>Client: Generated response
    Client-->>Server: CreateMessageResult
```

Sampling is the server asking the client/model side to generate.

## 7. Elicitation

```mermaid
sequenceDiagram
    participant Server as "MCP Server"
    participant Client as "MCP Client"
    participant User as "End User"

    Server->>Client: elicitation/create
    Client->>User: Render form / request input
    User-->>Client: Structured response
    Client-->>Server: ElicitResult
```

Elicitation is the server asking the user for structured input in the middle of
an operation.

## 8. Progress Notifications

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Server as "MCP Server"

    Client->>Server: tools/call with progressToken
    loop During execution
        Server-->>Client: notifications/progress
    end
    Server-->>Client: final CallToolResult
```

Use progress when a single request remains active and the user needs
intermediate status.

## 9. Tasks Lifecycle

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Server as "MCP Server"
    participant Store as "Task Store"

    Client->>Server: callToolStream / task-enabled request
    Server->>Store: createTask()
    Server-->>Client: taskCreated
    Server->>Store: updateTaskStatus(working)
    Server-->>Client: taskStatus(working)
    alt success
        Server->>Store: storeTaskResult(completed)
        Server-->>Client: taskStatus(completed)
        Server-->>Client: result
    else failure
        Server->>Store: storeTaskResult(failed)
        Server-->>Client: taskStatus(failed)
        Server-->>Client: error or failed result
    else expiry
        Note over Store: TTL elapses before retrieval
        Server-->>Client: expired / missing result handling
    end
```

Use tasks when the lifecycle matters more than one immediate blocking response.

## 10. OAuth Discovery Chain

```mermaid
sequenceDiagram
    participant Client as "MCP Client"
    participant Resource as "Resource Server"
    participant Auth as "Authorization Server"

    Client->>Resource: GET /.well-known/oauth-protected-resource
    Resource-->>Client: authorization_servers[]
    Client->>Auth: GET /.well-known/oauth-authorization-server
    Auth-->>Client: token_endpoint
    Client->>Auth: POST token request
    Auth-->>Client: access_token
    Client->>Resource: MCP request with Authorization: Bearer ...
```

This is the discovery-first auth model that prevents clients from hardcoding
token endpoints.
