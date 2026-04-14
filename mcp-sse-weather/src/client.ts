// =============================================================================
// MCP Weather Client — SSE Transport
// =============================================================================
//
// SSE CLIENT LIFECYCLE
// --------------------
// From the client's perspective, connecting over SSE works like this:
//
//   1. SSEClientTransport opens a GET /sse request to the server and keeps
//      the connection alive to receive server-sent events.
//
//   2. The server's initialize event arrives over the SSE stream. The SDK
//      reads it and completes the capability negotiation handshake by sending
//      its own capabilities back via POST /message?sessionId=<id>.
//
//   3. Once the handshake is done, client.connect() resolves and the client
//      can start listing tools and making tool calls.
//
//   4. Every tool call the client makes is sent as a POST /message request.
//      The server processes it and pushes the response as an SSE event back
//      through the open GET /sse stream.
//
// IMPORTANT: The client code doesn't need to know about the two-endpoint
// split. The SSEClientTransport handles GET /sse and POST /message internally.
// From here, it looks like any other MCP transport.
//
// =============================================================================

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function main() {
  // SSEClientTransport only needs the SSE endpoint URL. Internally it:
  //   - Opens GET /sse to receive events
  //   - Reads the sessionId from the server's endpoint event
  //   - Sends all subsequent requests to POST /message?sessionId=<id>
  //
  // The two-endpoint complexity is fully encapsulated here.
  const transport = new SSEClientTransport(new URL('http://localhost:3001/sse'));

  const client = new Client({ name: 'weather-client', version: '1.0.0' });

  // client.connect() makes the GET /sse request, waits for the server's
  // initialize event over the stream, then completes the MCP handshake.
  // After this resolves, the session is fully established.
  await client.connect(transport);
  console.log('Connected to MCP SSE Weather Server\n');

  // ---------------------------------------------------------------------------
  // Dynamic tool discovery
  // ---------------------------------------------------------------------------
  // MCP clients don't need to know tool names at compile time. listTools()
  // sends a tools/list request and returns whatever the server currently
  // exposes. This is how AI assistants discover what they can call.
  const { tools } = await client.listTools();
  console.log('Available tools:');
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description}`);
  }
  console.log();

  // ---------------------------------------------------------------------------
  // get_current_weather — coordinates-based lookup
  // ---------------------------------------------------------------------------
  console.log('--- get_current_weather (London) ---');
  const currentWeather = await client.callTool({
    name: 'get_current_weather',
    arguments: { latitude: 51.5074, longitude: -0.1278 },
  });
  if (currentWeather.isError) {
    console.log('Tool error:', currentWeather.content);
    return;
  }
  const currentText = (currentWeather.content as Array<{ type: string; text: string }>)
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  console.log(currentText);
  console.log();

  // ---------------------------------------------------------------------------
  // get_forecast — multi-day forecast with explicit day count
  // ---------------------------------------------------------------------------
  console.log('--- get_forecast (New York, 3 days) ---');
  const forecast = await client.callTool({
    name: 'get_forecast',
    arguments: { latitude: 40.7128, longitude: -74.0060, days: 3 },
  });
  if (forecast.isError) {
    console.log('Tool error:', forecast.content);
    return;
  }
  const forecastText = (forecast.content as Array<{ type: string; text: string }>)
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  console.log(forecastText);
  console.log();

  // ---------------------------------------------------------------------------
  // get_weather_by_city — geocoding + weather in one call
  // ---------------------------------------------------------------------------
  console.log('--- get_weather_by_city (Tokyo) ---');
  const tokyoWeather = await client.callTool({
    name: 'get_weather_by_city',
    arguments: { city: 'Tokyo' },
  });
  if (tokyoWeather.isError) {
    console.log('Tool error:', tokyoWeather.content);
    return;
  }
  const tokyoText = (tokyoWeather.content as Array<{ type: string; text: string }>)
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  console.log(tokyoText);
  console.log();

  // get_weather_by_city with a non-ASCII city name — verifies encodeURIComponent works
  console.log('--- get_weather_by_city (São Paulo) ---');
  const spWeather = await client.callTool({
    name: 'get_weather_by_city',
    arguments: { city: 'São Paulo' },
  });
  if (spWeather.isError) {
    console.log('Tool error:', spWeather.content);
    return;
  }
  const spText = (spWeather.content as Array<{ type: string; text: string }>)
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  console.log(spText);
  console.log();

  // Clean up: closes the SSE connection and the POST channel.
  await client.close();
  console.log('Disconnected.');
}

main().catch(err => {
  console.error('Client error:', err);
  process.exit(1);
});
