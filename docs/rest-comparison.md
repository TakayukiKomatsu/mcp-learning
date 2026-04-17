# MCP vs Plain REST

MCP and REST solve overlapping problems, but they are not the same thing.

## When REST is enough

Use plain REST when:

- you only need a conventional API between conventional applications
- capability negotiation is unnecessary
- no MCP-aware host/client is involved
- you do not need tools/resources/prompts as distinct protocol concepts
- you just need CRUD over HTTP

If that is your problem, REST is often simpler.

## When MCP adds real value

Use MCP when:

- a model-aware host/client needs structured tool and data access
- the server should advertise capabilities at runtime
- the client may need to handle server-initiated requests like roots, sampling,
  or elicitation
- prompts, resources, and tools should be distinct first-class concepts
- you want a standard protocol across many hosts and MCP servers

## Mental mapping

### Tools vs REST endpoints

REST:

- `POST /jobs`
- `DELETE /file/123`

MCP:

- `tools/call { name: "submit_job" }`
- `tools/call { name: "delete_file" }`

Mapping:

- both represent action
- MCP adds tool metadata, annotations, output schemas, and negotiated
  capabilities

### Resources vs REST GET endpoints

REST:

- `GET /documents/123`

MCP:

- `resources/read { uri: "docs://123" }`

Mapping:

- both return readable data
- MCP emphasizes document/data consumption for model-aware clients

### Prompts have no clean REST equivalent

Prompts are closer to:

- server-side prompt templates
- reusable message generators

You can model them with REST, but MCP gives them a first-class protocol slot.

### Sampling and elicitation are where MCP becomes clearly different

REST is mostly request/response in one direction.

MCP additionally supports:

- server asking the client/model to generate content
- server asking the user for structured input
- client exposing roots to the server

That makes MCP more symmetric and more interactive than a plain REST API.

## Operational comparison

| Concern | REST | MCP |
| --- | --- | --- |
| Standard web infra | excellent | excellent with Streamable HTTP |
| Capability negotiation | usually custom | built in |
| First-class model tooling concepts | no | yes |
| Tools/resources/prompts distinction | no | yes |
| Server-initiated model/user interactions | uncommon / custom | built in patterns |
| Best for generic CRUD APIs | yes | maybe, but often unnecessary |
| Best for LLM-aware host/server integration | limited | yes |

## Rule of thumb

If you are building:

- a normal backend API for normal application consumers
  -> REST first

- an LLM-aware integration surface for tools, data, prompts, and interactive
  workflows
  -> MCP first

## Best demos in this repo for the comparison

- REST-like remote action surface:
  `mcp-http-todo`
- readable data surface:
  `mcp-resources-prompts`
- interactive workflow surface:
  `mcp-elicitation`
- model-requesting workflow:
  `mcp-sampling`
- capability negotiation and richer metadata:
  `mcp-tool-advanced`, `mcp-extensions-demo`
