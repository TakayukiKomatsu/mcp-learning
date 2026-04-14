// =============================================================================
// MCP Weather Server — SSE (Server-Sent Events) Transport
// =============================================================================
//
// SSE TRANSPORT OVERVIEW
// ----------------------
// SSE (Server-Sent Events) is an HTTP-based transport for MCP that uses TWO
// endpoints instead of the single bidirectional channel you get with stdio:
//
//   GET  /sse      — Client opens a long-lived connection. The server streams
//                    JSON-RPC responses back to the client as text/event-stream.
//
//   POST /message  — Client sends JSON-RPC requests here. The server processes
//                    them and pushes responses through the open SSE stream.
//
// WHEN TO USE SSE OVER STDIO
// --------------------------
// Use SSE when:
//   - Your MCP server runs as a standalone HTTP service (not a child process)
//   - You need multiple clients to connect concurrently
//   - You want network-accessible MCP (e.g., a remote weather service)
//
// Use stdio when the server is launched by the client as a subprocess (most
// desktop AI assistant integrations work this way).
//
// WHY SSE WAS DEPRECATED (in favour of Streamable HTTP)
// ------------------------------------------------------
// SSE has two structural problems that led to its deprecation:
//
// 1. TWO ENDPOINTS: You need GET /sse AND POST /message. Streamable HTTP
//    collapses this into a single POST endpoint that can optionally upgrade
//    to SSE streaming. Simpler to implement, document, and proxy.
//
// 2. STATEFUL CONNECTION REQUIRED: The SSE stream must stay open for the
//    session lifetime. This means the client must always connect to the SAME
//    server instance — standard stateless load balancers (round-robin) break
//    it because the POST /message might land on a different instance than the
//    one holding the SSE stream. Streamable HTTP doesn't require a persistent
//    connection, so it works with stateless horizontally-scaled deployments.
//
// =============================================================================

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const CurrentWeatherResponseSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    weather_code: z.number(),
  }),
});

const ForecastResponseSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
  }),
});

const GeocodingResponseSchema = z.object({
  results: z.array(z.object({
    name: z.string(),
    country: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  })).optional(),
});

// =============================================================================
// SESSION TRACKING
// =============================================================================
//
// Each SSE connection is a long-lived session. When the client later POSTs to
// /message it includes a ?sessionId= query parameter so we can find the right
// SSEServerTransport and route the message through that specific SSE stream.
//
// Without this map, a POST /message would have no way to know which open
// connection (and which McpServer instance) owns that session.
//
const transports = new Map<string, SSEServerTransport>();

// =============================================================================
// GET /sse — Client connection endpoint
// =============================================================================
//
// When a client hits this endpoint, SSEServerTransport does four things:
//   1. Sets Content-Type: text/event-stream and Cache-Control: no-cache
//   2. Keeps the HTTP response object open (no res.end() yet)
//   3. Assigns a unique sessionId to this connection
//   4. Waits for McpServer to call connect(), then sends the server's
//      initialize response through the stream
//
app.get('/sse', async (req, res) => {
  // The first argument '/message' tells the transport which URL the client
  // should POST its requests to. This gets embedded in the SSE session info.
  const transport = new SSEServerTransport('/message', res);

  // Each SSE connection gets its own McpServer instance. This keeps session
  // state isolated — one client's tool calls don't interfere with another's.
  const server = new McpServer({
    name: 'mcp-sse-weather',
    version: '1.0.0',
  });

  // Register all weather tools on this server instance.
  registerWeatherTools(server);

  // Track this transport so POST /message can route back to it.
  transports.set(transport.sessionId, transport);

  // Clean up when the client disconnects (browser tab closed, client.close(), etc.)
  transport.onclose = () => {
    transports.delete(transport.sessionId);
    console.log(`Session closed: ${transport.sessionId}`);
  };

  console.log(`New SSE connection: ${transport.sessionId}`);

  // =============================================================================
  // CAPABILITY NEGOTIATION
  // =============================================================================
  //
  // server.connect(transport) kicks off the MCP handshake over the SSE stream:
  //   1. Server sends its capabilities (tools list, protocol version, etc.)
  //      as an SSE event
  //   2. Client reads that event and responds via POST /message with its own
  //      capabilities (what protocol versions it supports)
  //   3. Both sides agree on a protocol version and the session is established
  //
  // After this completes, the client can start calling tools.
  //
  try {
    await server.connect(transport);
  } catch (err) {
    transports.delete(transport.sessionId);
    console.error('Failed to connect SSE transport:', err);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

// =============================================================================
// POST /message — Client-to-server message channel
// =============================================================================
//
// WHY A SEPARATE POST ENDPOINT?
// SSE is a ONE-WAY protocol: the server can push events to the client, but
// the client cannot write back through the same connection. HTTP/1.1 doesn't
// allow that. So we need a separate channel for client→server messages.
//
// The client includes ?sessionId=<id> in the query string. We look up the
// matching SSEServerTransport and call handlePostMessage(), which:
//   1. Parses the JSON-RPC request body
//   2. Routes it to the correct McpServer handler (e.g., tools/call)
//   3. Sends the JSON-RPC response back through the open SSE stream
//   4. Returns 202 Accepted on this POST response (the actual result is SSE)
//
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) {
    res.status(400).json({ error: 'Missing or invalid sessionId query parameter' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: `Unknown session: ${sessionId}` });
    return;
  }

  // Pass req.body as the third argument (parsedBody) because express.json()
  // already consumed the request stream. Without this, getRawBody() inside
  // the SDK would try to re-read an already-drained stream and fail.
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error('Failed to handle POST message:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// =============================================================================
// WEATHER TOOLS
// =============================================================================
//
// WHY DESCRIPTIONS MATTER
// -----------------------
// When an LLM (like Claude) needs to call a tool, it reads the tool's name
// and description to decide whether it's the right tool for the job. A vague
// description like "gets weather" is ambiguous — does it take a city name or
// coordinates? A precise description reduces hallucination and ensures the
// model passes the right arguments.
//
function registerWeatherTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Tool: get_current_weather
  // ---------------------------------------------------------------------------
  server.tool(
    'get_current_weather',
    'Get current weather conditions at a specific geographic location using latitude and longitude coordinates. Returns temperature (°C), relative humidity (%), and wind speed (km/h).',
    {
      latitude: z.number().min(-90).max(90).describe('Latitude in decimal degrees (e.g. 51.5074 for London)'),
      longitude: z.number().min(-180).max(180).describe('Longitude in decimal degrees (e.g. -0.1278 for London)'),
    },
    async ({ latitude, longitude }) => {
      // Open-Meteo is a free, no-auth weather API. The `current` parameter
      // requests specific variables for the current moment.
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&temperature_unit=celsius`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data = CurrentWeatherResponseSchema.parse(await response.json());

      const { temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code } = data.current;

      const text =
        `Current weather at (${latitude}, ${longitude}):\n` +
        `  Temperature: ${temperature_2m}°C\n` +
        `  Humidity:    ${relative_humidity_2m}%\n` +
        `  Wind speed:  ${wind_speed_10m} km/h\n` +
        `  Weather code: ${weather_code} (WMO code — 0=clear, 1-3=cloudy, 45/48=fog, 51-67=rain, 71-77=snow, 80-82=showers, 95=thunderstorm)`;

      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // ---------------------------------------------------------------------------
  // Tool: get_forecast
  // ---------------------------------------------------------------------------
  server.tool(
    'get_forecast',
    'Get a multi-day weather forecast (1–7 days) for a location specified by latitude and longitude. Returns daily max/min temperature (°C) and total precipitation (mm) for each day.',
    {
      latitude: z.number().min(-90).max(90).describe('Latitude in decimal degrees'),
      longitude: z.number().min(-180).max(180).describe('Longitude in decimal degrees'),
      days: z.number().int().min(1).max(7).describe('Number of forecast days (1–7)'),
    },
    async ({ latitude, longitude, days }) => {
      // The `daily` parameter requests day-level aggregates. `timezone=auto`
      // makes Open-Meteo infer the local timezone from the coordinates so
      // "day boundaries" align with local midnight rather than UTC midnight.
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&forecast_days=${days}` +
        `&temperature_unit=celsius` +
        `&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data = ForecastResponseSchema.parse(await response.json());

      const { time, temperature_2m_max, temperature_2m_min, precipitation_sum } = data.daily;

      const lines = [`${days}-day forecast for (${latitude}, ${longitude}):\n`];
      for (let i = 0; i < time.length; i++) {
        lines.push(
          `  ${time[i]}: High ${temperature_2m_max[i]}°C / Low ${temperature_2m_min[i]}°C` +
          `, Precipitation: ${precipitation_sum[i]} mm`
        );
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  // ---------------------------------------------------------------------------
  // Tool: get_weather_by_city
  // ---------------------------------------------------------------------------
  server.tool(
    'get_weather_by_city',
    'Get current weather conditions for a city by name. Geocodes the city name to coordinates first, then fetches current weather. Returns temperature (°C), humidity (%), wind speed (km/h), and the resolved city name and country.',
    {
      city: z.string().min(1).describe('City name (e.g. "Tokyo", "São Paulo", "New York")'),
    },
    async ({ city }) => {
      // Step 1: Geocode the city name to lat/lon using Open-Meteo's free
      // geocoding API. count=1 returns only the best match.
      const geocodeUrl =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(city)}&count=1`;

      const geocodeResponse = await fetch(geocodeUrl);
      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding API error: ${geocodeResponse.status} ${geocodeResponse.statusText}`);
      }

      const geocodeData = GeocodingResponseSchema.parse(await geocodeResponse.json());

      if (!geocodeData.results || geocodeData.results.length === 0) {
        throw new Error(`City not found: ${city}`);
      }

      const { name, country, latitude, longitude } = geocodeData.results[0];

      // Step 2: Fetch current weather using the resolved coordinates.
      // Same Open-Meteo forecast endpoint as get_current_weather.
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&temperature_unit=celsius`;

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        throw new Error(`Open-Meteo API error: ${weatherResponse.status} ${weatherResponse.statusText}`);
      }

      const weatherData = CurrentWeatherResponseSchema.parse(await weatherResponse.json());

      const { temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code } = weatherData.current;

      const text =
        `Current weather in ${name}, ${country}:\n` +
        `  Temperature: ${temperature_2m}°C\n` +
        `  Humidity:    ${relative_humidity_2m}%\n` +
        `  Wind speed:  ${wind_speed_10m} km/h\n` +
        `  Weather code: ${weather_code} (WMO code — 0=clear, 1-3=cloudy, 45/48=fog, 51-67=rain, 71-77=snow, 80-82=showers, 95=thunderstorm)\n` +
        `  Coordinates: (${latitude}, ${longitude})`;

      return { content: [{ type: 'text' as const, text }] };
    }
  );
}

// =============================================================================
// Start the HTTP server
// =============================================================================

app.listen(3001, () => {
  console.log('MCP SSE Weather Server running on http://localhost:3001');
  console.log('  SSE endpoint:     GET  http://localhost:3001/sse');
  console.log('  Message endpoint: POST http://localhost:3001/message?sessionId=<id>');
});
