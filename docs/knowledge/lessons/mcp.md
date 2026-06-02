<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — mcp

Lessons learned in the **mcp** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-mcp-2026-06-02-001 -->
---
id: L-mcp-2026-06-02-001
type: lesson
domain: mcp
tags: [http-transport, client-reachability, air-gap, stdio, nginx, nixos]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-mcp-2026-06-02-001, G-mcp-2026-06-02-002]
graduated_to: ""
---

## Design MCP HTTP transport for the target client first, not the transport protocol — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-29)

**Root cause:** HTTP transport was initially framed as "for claude.ai Integrations" — but claude.ai is a cloud service that makes outbound callbacks, so any localhost or LAN address is unreachable from Anthropic's infrastructure. A browser hitting the endpoint and getting "Not Acceptable: Client must accept text/event-stream" looks like an error but is the protocol working correctly — and it immediately surfaces the real question: *which clients can actually reach this server?* The correct framing is "for local MCP clients that need HTTP," and once framed that way the right architecture (nginx + `networking.hosts` on NixOS) is obvious from the start.

| Client | Reachability | Air-gap safe |
|--------|-------------|-------------|
| Claude Code (stdio) | local child process | yes (always) |
| Claude Desktop (HTTP) | localhost reachable | yes |
| LAN MCP client via nginx | LAN-internal | yes (declarative NixOS config) |
| claude.ai web | must be publicly routable | no (requires tunnel) |

**Rule:** Before implementing an MCP HTTP transport, name the specific client and ask: *can that client reach this host?* Cloud-hosted client (claude.ai web) → public URL required. Local client (Claude Desktop, LAN tools) → localhost or LAN is fine. Never conflate "HTTP transport works" with "the target client can connect."

**Why this shape wins:** Naming the client up front makes the reachability constraint a design input rather than a post-hoc discovery. On NixOS hosts, the nginx gateway uses `networking.hosts` (not `/etc/hosts`, which is overwritten on rebuild) and the existing mkcert cert — matching existing proxy vhosts. Choosing stdio for air-gapped hosts eliminates the tunnel dependency class entirely instead of working around it.

<!-- /entry -->

<!-- entry:L-mcp-2026-06-02-002 -->
---
id: L-mcp-2026-06-02-002
type: lesson
domain: mcp
tags: [parser, getlessonslearned, getknowngotchas, regression-guard, silent-failure, markdown]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## MCP parser safety: don't refactor LESSONS-LEARNED / KNOWN-GOTCHAS without a regression guard — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-22)

**Root cause:** The MCP server tools `getLessonsLearned` and `getKnownGotchas` parse the legacy markdown files by specific conventions: section headers (`### Title`) plus tagged-block regex (`**Problem:** … **Fix:** … **Rule:**`). A restructure that changes header depth, renames a tag, or inlines previously-tagged content **silently drops entries** from tool output — the MCP consumer (agents, AI reviewer) loses access with no error. A prior session broke this silently; the `audit:mcp-coverage` reader-pattern check didn't catch it because the tool still "reads" the file, it just parses fewer entries.

**Rule:** Size reduction is **safe** only when it is pure dedup, dead-feature pruning, or stylistic tightening *inside* existing tagged blocks (tag structure intact). It is **unsafe** — requires parser updates in tandem — when it renames section headers, changes tag conventions, promotes/demotes header depth, or moves entries across sections. For the unsafe kind: (1) baseline-snapshot per-section counts + content hashes, (2) refactor, (3) re-run and diff — any count drop or unexpected hash change means the parser broke, (4) keep a persistent Vitest in `codebase-mcp/src/tools/__tests__/` asserting "≥ N sections, ≥ M entries in section X." Write the test *before* the first restructure.

**Why this shape wins:** The failure mode is invisible — output shrinks but nothing errors — so prose discipline alone can't catch it. A counts-and-hashes regression test converts a silent drop into a loud CI failure, and it is cheap to maintain. (Note: with the migration to structured `docs/knowledge/` entries, the parser risk shifts to schema/index auditors, but the legacy files remain MCP-parsed until fully retired.)

<!-- /entry -->

<!-- entry:L-mcp-2026-06-02-003 -->
---
id: L-mcp-2026-06-02-003
type: lesson
domain: mcp
tags: [mcpserver, stateless-http, factory, transport, sdk, per-request]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-mcp-2026-06-02-006]
graduated_to: ""
---

## McpServer factory pattern is required for stateless HTTP — per-request transport alone is insufficient — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-02)

**Root cause:** The `@modelcontextprotocol/sdk` `McpServer` stores `_transport` as a field. Even with a fresh `StreamableHTTPServerTransport` per request, reusing the same `McpServer` instance throws `"Already connected to a transport"` on the second request — the `onclose` callback that resets `_transport` is async, so there is a race window where the next request sees a non-null `_transport` before the prior close completes.

**Rule:** For stateless HTTP MCP servers, use a factory function: create both a fresh `McpServer` AND a fresh `StreamableHTTPServerTransport` inside every HTTP request handler. The server's lifespan is exactly one request, and `server.close()` runs in `finally`.

```typescript
function createServer() {
  const server = new McpServer({ name: 'codebase', version: '0.1.0' })
  // ... register tools on server ...
  return server
}

httpServer.on('request', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res)
  } finally {
    await server.close().catch(() => {})
  }
})
```

**Why this shape wins:** This is the SDK's own guidance ("use a separate Protocol instance per connection"). A one-request server lifespan removes shared mutable transport state, so there is no cross-request race to reason about — the correctness comes from the architecture, not from getting async cleanup timing right.

<!-- /entry -->

<!-- entry:L-mcp-2026-06-02-004 -->
---
id: L-mcp-2026-06-02-004
type: lesson
domain: mcp
tags: [rename, mcpserver, directory, claude-desktop, nginx, surfaces]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## MCP server identity and directory name are four independent rename surfaces — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-02)

**Root cause:** Renaming an MCP server (e.g. "weaver" → "codebase") touches four independent surfaces — a directory rename updates only one of them, and the others fail silently:

| Surface | Location | Effect if stale |
|---------|----------|-----------------|
| Directory name | `code/codebase-mcp/` | Wrong import paths, npm workspace refs |
| `name:` field in `McpServer({ name: '...' })` | `src/index.ts` constructor | Claude Desktop log file named after the old name |
| Config key in Claude Desktop | `claude_desktop_config.json` | Old server still in MCP panel; new key adds a duplicate |
| nginx vhost / external URL | `/etc/nixos/modules/...` | mkcert SAN miss; client hits wrong endpoint |

**Rule:** When renaming an MCP server, grep for all four surfaces separately. The directory rename is the most visible but the least disruptive — the `name:` constructor field is invisible until you check Claude Desktop logs and notice `mcp-server-weaver.log` still exists after the rename.

**Why this shape wins:** Enumerating the surfaces as a checklist converts an open-ended "did I get everything?" into a closed verification. Each surface has a distinct stale-symptom, so the table doubles as a diagnostic when something still references the old name.

<!-- /entry -->

<!-- entry:L-mcp-2026-06-02-005 -->
---
id: L-mcp-2026-06-02-005
type: lesson
domain: mcp
tags: [nginx, vhost, dev-tooling, product-mcp, isolation, template-reuse, mkcert]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-mcp-2026-06-02-004]
graduated_to: ""
---

## Separate nginx vhosts for dev-tooling MCP vs product MCP — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-02)

**Root cause:** `codebase-mcp` (developer tooling — code navigation, Engram memory) and `weaver-mcp` (the product server — VM management API) serve different audiences and have different deployment lifetimes. Sharing a single nginx vhost couples them unnecessarily — product MCP development can break the dev-tooling session, and the generic dev-tooling server can't be reused across projects.

**Rule:** Declare separate nginx vhosts (`codebase-mcp.local`, `weaver-mcp.local`) from day one, even if one is a stub. Any project that ships its own MCP server should have a `<project>-mcp.local` vhost separate from any generic `codebase-mcp.local` dev-tooling vhost.

**Why this shape wins:** Separation buys isolated testing (product work doesn't disturb dev tools), template reuse (`codebase-mcp.local` is generic, instantiable identically in Gantry and Qepton), and independent Claude Desktop profiles. mkcert-bootstrap auto-discovers each vhost and adds its SAN on rebuild, so the per-vhost cost is near zero.

<!-- /entry -->
