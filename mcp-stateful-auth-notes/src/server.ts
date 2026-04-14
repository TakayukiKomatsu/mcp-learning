/**
 * MCP Notes Server — stateful + authenticated Streamable HTTP
 *
 * WHAT THIS PROJECT TEACHES
 * -------------------------
 * Your earlier HTTP example was deliberately stateless.
 *
 * This project shows the opposite design:
 *   1. the server CREATES a session ID during initialize
 *   2. the client sends that `Mcp-Session-Id` on later requests
 *   3. the server keeps transport/session state in memory
 *   4. a bearer token middleware protects the endpoint
 *
 * That makes this example much closer to a "real" session-oriented HTTP setup.
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

type SessionNote = {
  id: string;
  text: string;
  createdBy: string;
};

const app = createMcpExpressApp();

// One transport per session ID.
const transports = new Map<string, StreamableHTTPServerTransport>();

// Session-scoped application state.
const notesBySession = new Map<string, SessionNote[]>();

// Tiny demo auth verifier. In production, this would call your auth provider or
// token service. Here, one static token keeps the example easy to understand.
const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (token !== 'learning-secret-token') {
      throw new Error('Invalid bearer token');
    }

    return {
      token,
      clientId: 'learning-client',
      scopes: ['notes:read', 'notes:write'],
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      extra: {
        username: 'demo-user',
      },
    };
  },
};

const authMiddleware = requireBearerAuth({
  verifier,
  requiredScopes: ['notes:read'],
  resourceMetadataUrl: 'http://localhost:3000/.well-known/oauth-protected-resource',
});

function getOrCreateSessionNotes(sessionId: string): SessionNote[] {
  const existing = notesBySession.get(sessionId);
  if (existing) {
    return existing;
  }

  const created: SessionNote[] = [];
  notesBySession.set(sessionId, created);
  return created;
}

function createServer() {
  const server = new McpServer({
    name: 'mcp-stateful-auth-notes',
    version: '1.0.0',
  });

  server.registerTool(
    'add_session_note',
    {
      description: 'Add a note that is stored inside the current HTTP session.',
      inputSchema: z.object({
        text: z.string().min(1).describe('The note text to store in this session'),
      }),
    },
    async ({ text }, extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) {
        throw new Error('Expected a session ID in stateful mode');
      }

      const authUser = String(extra.authInfo?.extra?.username ?? 'unknown-user');
      const notes = getOrCreateSessionNotes(sessionId);
      const note: SessionNote = {
        id: randomUUID(),
        text,
        createdBy: authUser,
      };

      notes.push(note);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Stored note for session ${sessionId}: ${text}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'list_session_notes',
    {
      description: 'List only the notes belonging to the current HTTP session.',
      inputSchema: z.object({}),
    },
    async (_args: {}, extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) {
        throw new Error('Expected a session ID in stateful mode');
      }

      const notes = getOrCreateSessionNotes(sessionId);
      if (notes.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No notes stored for session ${sessionId}.` }],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: notes
              .map((note, index) => `${index + 1}. ${note.text} (createdBy: ${note.createdBy})`)
              .join('\n'),
          },
        ],
      };
    }
  );

  return server;
}

app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: 'http://localhost:3000/mcp',
    authorization_servers: ['http://localhost:3000'],
  });
});

app.get('/auth-info', authMiddleware, (req, res) => {
  res.json({
    message: 'Bearer token accepted.',
    auth: req.auth,
  });
});

app.post('/mcp', authMiddleware, async (req, res) => {
  const sessionIdHeader = req.headers['mcp-session-id'];
  const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;

  try {
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Stateful mode requires initialize first or a valid session ID.',
          },
          id: null,
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports.set(newSessionId, transport!);
          getOrCreateSessionNotes(newSessionId);
          console.log(`Created session ${newSessionId}`);
        },
      });

      transport.onclose = () => {
        const closedSessionId = transport?.sessionId;
        if (!closedSessionId) {
          return;
        }

        transports.delete(closedSessionId);
        notesBySession.delete(closedSessionId);
        console.log(`Closed session ${closedSessionId}`);
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Stateful MCP POST failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', authMiddleware, async (req, res) => {
  const sessionIdHeader = req.headers['mcp-session-id'];
  const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    res.status(400).send('Missing or unknown Mcp-Session-Id header.');
    return;
  }

  await transport.handleRequest(req, res);
});

app.delete('/mcp', authMiddleware, async (req, res) => {
  const sessionIdHeader = req.headers['mcp-session-id'];
  const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    res.status(400).send('Missing or unknown Mcp-Session-Id header.');
    return;
  }

  await transport.handleRequest(req, res);
});

const PORT = 3000;
app.listen(PORT, (error?: Error) => {
  if (error) {
    console.error('Failed to start stateful auth server:', error);
    process.exit(1);
  }

  console.log(`Stateful authenticated MCP server listening on http://localhost:${PORT}/mcp`);
  console.log('Use bearer token: learning-secret-token');
});
