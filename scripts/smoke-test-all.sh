#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

run_typecheck() {
  local dir="$1"
  echo
  echo "== Typecheck: $dir =="
  (cd "$dir" && npx tsc --noEmit)
}

run_single() {
  local dir="$1"
  local script="$2"
  echo
  echo "== Smoke: $dir ($script) =="
  (cd "$dir" && npm run "$script")
}

run_pair() {
  local dir="$1"
  local delay="${2:-2}"
  echo
  echo "== Smoke: $dir (server + client) =="
  (
    cd "$dir"
    npm run server > "/tmp/${dir//\//_}.server.log" 2>&1 &
    local server_pid=$!
    PIDS+=("$server_pid")
    sleep "$delay"
    npm run client
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  )
}

TYPECHECK_DIRS=(
  mcp-apps
  mcp-auth
  mcp-bundle-demo
  mcp-completions
  mcp-custom-transport
  mcp-dpop-demo
  mcp-elicitation
  mcp-enterprise-managed-auth
  mcp-extensions-demo
  mcp-http-todo
  mcp-inmemory-demo
  mcp-inmemory-notes
  mcp-lifecycle
  mcp-list-changed
  mcp-logging
  mcp-lowlevel-notes
  mcp-lowlevel-server
  mcp-multi-turn-sse
  mcp-oauth-browser
  mcp-oauth-client-credentials
  mcp-oauth-discovery
  mcp-pagination
  mcp-progress
  mcp-registry-demo
  mcp-resource-templates
  mcp-resources-prompts
  mcp-resources-prompts-notes
  mcp-retry-jitter
  mcp-roots
  mcp-sampling
  mcp-sampling-tools
  mcp-server-cards
  mcp-server-instructions
  mcp-sse-weather
  mcp-stateful-auth-notes
  mcp-stateful-http
  mcp-stdio-math
  mcp-tasks
  mcp-tasks-lifecycle
  mcp-tool-advanced
  mcp-websocket-custom
)

for dir in "${TYPECHECK_DIRS[@]}"; do
  run_typecheck "$dir"
done

run_single mcp-bundle-demo inspect
run_single mcp-completions client
run_single mcp-custom-transport start
run_single mcp-elicitation client
run_single mcp-extensions-demo start
run_single mcp-inmemory-demo start
run_single mcp-inmemory-notes client
run_single mcp-lifecycle client
run_single mcp-list-changed client
run_single mcp-logging client
run_single mcp-lowlevel-notes client
run_single mcp-lowlevel-server client
run_single mcp-pagination client
run_single mcp-progress client
run_single mcp-registry-demo start
run_single mcp-resources-prompts client
run_single mcp-resources-prompts-notes client
run_single mcp-retry-jitter client
run_single mcp-roots client
run_single mcp-sampling client
run_single mcp-sampling-tools client
run_single mcp-server-instructions client
run_single mcp-stdio-math client
run_single mcp-tool-advanced client

run_pair mcp-apps 1
run_pair mcp-auth 1
run_pair mcp-dpop-demo 1
run_pair mcp-enterprise-managed-auth 1
run_pair mcp-http-todo 1
run_pair mcp-multi-turn-sse 1
run_pair mcp-oauth-browser 1
run_pair mcp-oauth-client-credentials 1
run_pair mcp-oauth-discovery 1
run_pair mcp-server-cards 1
run_pair mcp-sse-weather 1
run_pair mcp-stateful-auth-notes 1
run_pair mcp-stateful-http 1
run_pair mcp-tasks 1
run_pair mcp-tasks-lifecycle 1
run_pair mcp-websocket-custom 1

echo
echo "All MCP demo smoke tests completed."
