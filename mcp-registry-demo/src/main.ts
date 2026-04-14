/**
 * MCP Registry Demo
 *
 * This is an ecosystem demo rather than a protocol primitive. It shows how a
 * developer might discover public MCP servers from the official registry.
 */

const query = process.argv[2] ?? "github";
const url = `https://registry.modelcontextprotocol.io/v0.1/servers?q=${encodeURIComponent(query)}&limit=5`;

const data = await fetch(url).then(
  (res) =>
    res.json() as Promise<{
      servers?: Array<{
        server?: { name?: string; title?: string; version?: string; repository?: { url?: string } };
      }>;
    }>
);

console.log(`Registry API URL: ${url}`);

if (!data.servers || data.servers.length === 0) {
  console.log("No registry matches returned for that query.");
} else {
  console.log("Top discovered servers:");
  for (const entry of data.servers) {
    const server = entry.server ?? {};
    console.log(`  - ${server.title ?? server.name ?? "(unnamed)"} @ ${server.version ?? "unknown version"}`);
    if (server.repository?.url) {
      console.log(`    repo: ${server.repository.url}`);
    }
  }
}
