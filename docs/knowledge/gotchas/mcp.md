<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — mcp

Known gotchas in the **mcp** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-mcp-2026-06-02-001 -->
---
id: G-mcp-2026-06-02-001
type: gotcha
domain: mcp
tags: [streamablehttp, transport, browser, accept-header, sse]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-mcp-2026-06-02-001]
graduated_to: ""
---

## StreamableHTTP MCP server returns "Not Acceptable" in a browser — expected behavior — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-29)

**Problem:** Opening a StreamableHTTP MCP server URL (e.g. `http://127.0.0.1:4110`) in a browser returns a JSON-RPC error: `"Not Acceptable: Client must accept text/event-stream"` (code -32000). It looks like a server error.

**Fix:** Nothing to fix — the server is working correctly. A browser sends `Accept: text/html,...`; the StreamableHTTP transport requires `Accept: text/event-stream`. The error is the protocol correctly rejecting a non-MCP client. Connect a real MCP client (Claude Desktop, Claude Code, or `npx @modelcontextprotocol/inspector`) to get a valid response.

**Rule:** When testing an MCP HTTP server, use an MCP inspector or a real MCP client — never a plain browser. The browser 406 response is not a bug signal; it is proof the server is up and rejecting non-MCP traffic correctly.

<!-- /entry -->

<!-- entry:G-mcp-2026-06-02-002 -->
---
id: G-mcp-2026-06-02-002
type: gotcha
domain: mcp
tags: [http-transport, air-gap, claude-ai-web, stdio, deployment]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-mcp-2026-06-02-001]
graduated_to: ""
---

## MCP HTTP transport is incompatible with air-gapped hosts when the client is claude.ai web — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-29)

**Problem:** `claude.ai` web is a cloud service — Anthropic's servers make an outbound request to your registered MCP URL. A locally-running MCP HTTP server at `http://127.0.0.1:4110` or behind a LAN nginx proxy is unreachable from Anthropic's infrastructure. Registering a localhost URL in claude.ai Settings → Integrations will never connect.

**Fix:** For air-gapped or LAN-only environments use Claude Code (stdio transport via `.mcp.json`) — it runs the MCP server as a local child process with no network requirement. For claude.ai web, the server must be reachable via a public HTTPS URL (ngrok, Cloudflare Tunnel, or a public IP).

**Rule:** Before designing an MCP HTTP deployment, classify the client: (1) Claude Code / Claude Desktop → localhost works, no tunnel; (2) claude.ai web → public HTTPS URL required, incompatible with air-gap posture. On air-gapped hosts, Claude Code stdio is the canonical path.

<!-- /entry -->

<!-- entry:G-mcp-2026-06-02-003 -->
---
id: G-mcp-2026-06-02-003
type: gotcha
domain: mcp
tags: [mcp-remote, mkcert, tls, node-extra-ca-certs, trust-store]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-mcp-2026-06-02-004]
graduated_to: ""
---

## mcp-remote rejects mkcert certificates — NODE_EXTRA_CA_CERTS required — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-29)

**Problem:** `mcp-remote` is a Node.js process. Node does not use the OS system trust store by default. Even though a browser trusts a `weaver-mcp.local` mkcert cert (mkcert root CA installed system-wide), `mcp-remote` rejects it with a TLS error and silently fails to connect.

**Fix:** Add `NODE_EXTRA_CA_CERTS` to the `env` block in `claude_desktop_config.json`:
```json
"env": {
  "NODE_EXTRA_CA_CERTS": "/home/mark/.local/share/mkcert/rootCA.pem"
}
```
The path is `$(mkcert -CAROOT)/rootCA.pem`. Alternatively, skip nginx and point `mcp-remote` at `http://127.0.0.1:4110/` — plain HTTP needs no cert trust.

**Rule:** Any Node.js process connecting to an mkcert HTTPS endpoint must have `NODE_EXTRA_CA_CERTS` set. "The browser trusts it" does not imply "Node trusts it."

<!-- /entry -->

<!-- entry:G-mcp-2026-06-02-004 -->
---
id: G-mcp-2026-06-02-004
type: gotcha
domain: mcp
tags: [mkcert, wildcard-san, tls, node, curl, nginx-vhost]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-mcp-2026-06-02-003]
graduated_to: ""
---

## `*.local` wildcard mkcert cert is not trusted by Node.js / curl — needs an explicit SAN — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-02)

**Problem:** mkcert generates a cert with SAN `*.local`. A browser trusts `codebase-mcp.local` via this wildcard, but `mcp-remote` (Node.js) and `curl` return `SSL certificate problem: certificate is not trusted` / exit code 60 — even with `NODE_EXTRA_CA_CERTS` set correctly.

**Root cause:** Node.js (and LibreSSL/OpenSSL as used by curl) do not honor wildcard SANs that are not subdomain-style. A bare-TLD wildcard like `*.local` is rejected by strict TLS implementations even when the root CA is trusted.

**Fix:** The hostname must appear as an explicit SAN. On this NixOS host, `mkcert-bootstrap.nix` auto-discovers all `nginx.virtualHosts` entries and regenerates the cert with explicit SANs on `nixos-rebuild switch` — so declaring a new MCP vhost in `webserver.nix` and rebuilding produces a trusted cert with no manual `mkcert` call.

**Rule:** Never rely on a `*.local` wildcard cert for Node.js MCP clients. Declare the nginx vhost first, then rebuild — the SAN must be explicit, not wildcard.

<!-- /entry -->

<!-- entry:G-mcp-2026-06-02-005 -->
---
id: G-mcp-2026-06-02-005
type: gotcha
domain: mcp
tags: [nginx, location-block, exact-match, trailing-slash, http-transport]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Trailing slash breaks an nginx exact-match MCP location block — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-02)

**Problem:** A Claude Desktop config URL `https://codebase-mcp.local/mcp/` (trailing slash) returns 404 even though the nginx location block and the MCP server both appear healthy.

**Root cause:** nginx `location = /mcp` is an exact-match block — it matches `/mcp` only, not `/mcp/`. The MCP client silently normalizes the URL to include a trailing slash in some code paths.

**Fix:** Remove the trailing slash from the URL in `claude_desktop_config.json`: `"url": "https://codebase-mcp.local/mcp"`. Alternatively, add a second exact-match block `location = /mcp/` proxying to the same upstream.

**Rule:** MCP HTTP location blocks use exact-match (`=`). The client URL must not include a trailing slash unless the server location block explicitly handles it.

<!-- /entry -->

<!-- entry:G-mcp-2026-06-02-006 -->
---
id: G-mcp-2026-06-02-006
type: gotcha
domain: mcp
tags: [mcpserver, stateless-http, transport, factory, sdk, race]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-mcp-2026-06-02-003]
graduated_to: ""
---

## McpServer "Already connected to a transport" even with a per-request transport — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-02)

**Problem:** A stateless HTTP MCP server creates a fresh `StreamableHTTPServerTransport` per request but reuses a single `McpServer` instance. The first request succeeds; the second returns a JSON-RPC -32603 error: `"Already connected to a transport"`.

**Root cause:** `McpServer` stores `_transport` as an instance field. The `onclose` callback that clears `_transport` is async — there is a race window between the prior request's close completing and the next request's `server.connect(transport)` call. The SDK enforces one-transport-per-server.

**Fix:** Use a factory function that creates both a fresh `McpServer` AND a fresh `StreamableHTTPServerTransport` inside every HTTP request handler. Call `server.close()` in `finally`. See [[L-mcp-2026-06-02-003]].

**Rule:** For stateless HTTP MCP, the factory pattern is required — fresh server + fresh transport per request. A fresh transport alone is insufficient.

<!-- /entry -->

<!-- entry:G-mcp-2026-06-03-001 -->
---
id: G-mcp-2026-06-03-001
type: gotcha
domain: mcp
tags: [mcp-json, json, claude-code, headless, codebase-mcp]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Two silent ways MCP servers fail to load — invalid .mcp.json, and headless -p — 2026-06-03 · Claude

**Problem:** (1) A trailing comma in `.mcp.json` makes it invalid JSON, and Claude Code then loads **zero** servers from it — `claude mcp list` reports *"No MCP servers configured"* rather than a parse error. One stray comma silently disables ALL project MCP servers (codebase-mcp included), on every machine that checks out the repo. An editor may tolerate it; `node -e 'JSON.parse(...)'` does not. (2) In headless `claude -p` mode, project-scoped `.mcp.json` servers are **not auto-loaded** — `claude mcp list` shows none even with valid config — because project MCP servers require trust/approval that `-p` does not grant.

**Fix:** Validate `.mcp.json` with a strict JSON parser in pre-commit/CI (don't trust the editor). For a headless agent, register the needed servers at **user scope** (`claude mcp add`) or pass `--mcp-config <file>` (curated to just the servers the agent needs), instead of relying on the project file.

**Rule:** "No MCP servers configured" or a silently-missing tool ⇒ suspect (a) invalid `.mcp.json` (verify with `node` JSON.parse) and (b) headless mode not auto-approving project servers. A present `.mcp.json` does NOT mean its servers loaded.

<!-- /entry -->
