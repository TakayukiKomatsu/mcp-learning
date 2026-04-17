/**
 * Enterprise-managed authorization client demo.
 *
 * In a real deployment, an enterprise gateway or sidecar would attach these
 * headers after authenticating the user against an IdP. Here we attach them
 * manually so the server-side authorization model stays visible.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function runAs(headers: Record<string, string>) {
  const client = new Client({ name: "mcp-enterprise-managed-auth-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3024/mcp"), {
    requestInit: { headers },
  });

  await client.connect(transport);

  const identity = await client.callTool({ name: "who_am_i_enterprise", arguments: {} });
  const identityText = Array.isArray(identity.content)
    ? identity.content.find((item) => item.type === "text")?.text
    : "";
  console.log(identityText);

  const report = await client.callTool({ name: "view_finance_report", arguments: { quarter: "2026-Q1" } });
  const reportText = Array.isArray(report.content)
    ? report.content.find((item) => item.type === "text")?.text
    : "";
  console.log(reportText);

  await client.close();
}

console.log("=== Finance user ===");
await runAs({
  "x-employee-id": "emp-001",
  "x-department": "finance",
  "x-roles": "analyst",
});

console.log("\n=== Non-finance user ===");
await runAs({
  "x-employee-id": "emp-002",
  "x-department": "marketing",
  "x-roles": "editor",
});
