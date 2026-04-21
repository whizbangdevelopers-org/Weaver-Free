<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Open-Source Software Inventory

**Last updated:** 2026-04-02

Non-NixOS open-source dependencies used in this repository. For NixOS-specific integrations (sops-nix, Colmena, impermanence, etc.), see [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../../plans/cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md). For AI/GPU infrastructure integrations, see [AI-GPU-INFRASTRUCTURE-PLAN.md](../../plans/cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md). For license compliance evaluation, see [SOFTWARE-LICENSE-EVALUATION.md](../../business/legal/SOFTWARE-LICENSE-EVALUATION.md).

---

## Frontend Framework

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **Vue** | ^3.5 | Reactive UI framework | Composition API, TypeScript-first, lighter than React for SPA |
| **Quasar** | ^2.14 | Vue 3 component library + build system | Material Design, PWA/SPA/Capacitor from one codebase, 70+ components |
| **vue-router** | ^4.2 | SPA routing | Standard Vue ecosystem, async route loading |
| **pinia** | ^2.1 | State management | Replaces Vuex — simpler API, better TypeScript, composition-native |
| **pinia-plugin-persistedstate** | ^3.2 | Persist store to localStorage | Auto-save user preferences, auth tokens |

## UI Components & Visualization

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **v-network-graph** | ^0.9.22 | Interactive network topology diagrams | Vue 3 native, `edge-overlay` slot for route highlighting, `paths` prop |
| **xterm** | ^6.0 | Web terminal emulator | VM console access in browser — VT100 compatible |
| **@xterm/addon-fit** | ^0.11 | Auto-resize terminal to container | Required for responsive console layout |
| **@xterm/addon-web-links** | ^0.12 | Clickable URLs in terminal | UX improvement for console output |
| **sortablejs** | ^1.15 | Drag-and-drop reordering | VM list reordering, lightweight |

## Backend Framework

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **fastify** | ^5.8 | HTTP/WebSocket server | 2x faster than Express, plugin architecture, built-in async, schema validation |
| **@fastify/websocket** | ^11.2 | WebSocket support | Real-time VM status + agent token streaming on same server |
| **@fastify/cors** | ^11.2 | CORS middleware | Cross-origin PWA requests |
| **@fastify/helmet** | ^13.0 | Security headers | CSP, HSTS, X-Frame-Options — single configuration |
| **@fastify/compress** | ^8.3 | Response compression | Gzip for large VM lists and topology data |
| **@fastify/rate-limit** | ^10.3 | Per-route rate limiting | API abuse prevention, auth endpoint protection |
| **@fastify/static** | ^9.0 | Static file serving | Host built PWA from same port as API |

## Database

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **better-sqlite3** | ^12.6 | Embedded SQLite driver | Zero external dependencies, synchronous API, no DB server to manage |

## Auth & Security

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **jsonwebtoken** | ^9.0 | JWT creation and verification | Stateless auth, role-based access, refresh token flow |
| **bcryptjs** | ^3.0 | Password hashing | One-way hash with configurable cost factor |
| **web-push** | ^3.6 | Browser push notifications | PWA alert delivery for VM events |

## Validation

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **zod** | ^3.22 | Runtime schema validation | TypeScript-first, used on all API boundaries (backend + TUI) |
| **fastify-type-provider-zod** | ^4.0 | Zod ↔ Fastify type integration | Type-safe route handlers from Zod schemas |

## AI & Agent

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **@anthropic-ai/sdk** | ^0.81 | Claude API client | Streaming agent operations, tool use, BYOK support |
| **@modelcontextprotocol/sdk** | ^1.26 | MCP server SDK | Expose codebase to Claude Code agents |

## Networking

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **axios** | ^1.6 | HTTP client | Promise-based, interceptors for auth refresh, error extraction |
| **idb** | ^8.0 | IndexedDB wrapper | Browser-side storage for VM history and large datasets |

## TUI (Terminal User Interface)

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **ink** | ^5.2 | React for CLIs | Composable terminal UI with JSX, hooks, state management |
| **react** | ^18.3 | Component framework (for Ink) | Required by Ink — same mental model as web frontend |
| **ws** | ^8.18 | WebSocket client | Connect TUI to backend for real-time status |
| **conf** | ^13.0 | Config file persistence | TUI user settings (profile, theme, API endpoint) |

## Testing

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **vitest** | ^4.0 | Unit test runner | Vite-native, faster than Jest, same API |
| **@playwright/test** | ^1.52 | E2E test framework | Cross-browser (Chromium/Firefox/WebKit), auto-wait, tracing |
| **jsdom** | ^28.0 | DOM environment for unit tests | No real browser needed for component tests |
| **@vue/test-utils** | ^2.4 | Vue component testing | Mount, props, events, slots testing |
| **ink-testing-library** | ^4.0 | TUI component testing | Render and assert terminal component output |
| **@stryker-mutator/core** | ^9.6 | Mutation testing | Verify test quality by injecting faults |
| **k6** | CLI | Load testing | API and WebSocket scaling tests (`testing/load/`) |

## Build & Dev

| Package | Version | What It Does | Why This One |
|---------|---------|-------------|-------------|
| **vite** | ^5.0 | Bundler + dev server | Fast HMR, native ESM, Quasar integration |
| **typescript** | ^5.3 | Type checker + compiler | Static typing across frontend, backend, TUI |
| **vue-tsc** | ^3.2 | Vue SFC type checker | Validates `.vue` TypeScript without building |
| **tsx** | ^4.7 | TypeScript executor | Run `.ts` scripts directly (auditors, generators) |
| **sass** | ^1.97 | CSS preprocessor | Quasar theme customization |
| **workbox-build** | ^7.4 | PWA service worker tooling | Offline caching, precaching, push routing |
| **prettier** | ^3.8 | Code formatter | Consistent formatting across all file types |
| **eslint** | ^9.39 | Linter | Code quality, Vue template rules, TypeScript rules |

## NixOS System Packages

| Package | nixpkgs Attribute | License | What It Does | Why This One |
|---------|------------------|---------|-------------|-------------|
| **WeasyPrint** | `python3Packages.weasyprint` | BSD-3-Clause | HTML/CSS → PDF rendering | Compliance doc PDF export — crisp tables, `@page` CSS, real text (not rasterized). Subprocess via `execFileAsync`, no library linking. |
| **QEMU** | `pkgs.qemu` | GPL-2.0 | VM hypervisor (KVM) | Cloud VM provisioning — subprocess, process boundary |
| **cdrkit** | `pkgs.cdrkit` | GPL-2.0 | `genisoimage` — cloud-init ISOs | ISO generation for VM provisioning — subprocess |
| **Node.js** | `pkgs.nodejs_24` | MIT | JavaScript runtime | Backend server runtime |

> For the complete NixOS dependency table with license analysis, see [SOFTWARE-LICENSE-EVALUATION.md](../../business/legal/SOFTWARE-LICENSE-EVALUATION.md) § 5.

## E2E Infrastructure (Docker)

| Image/Tool | What It Does |
|-----------|-------------|
| **mcr.microsoft.com/playwright** | Docker base with all browsers pre-installed |
| **docker-compose** | Orchestrate frontend + backend + Playwright in isolated network |

---

## Architecture Notes

- **Frontend**: Vue 3 + Quasar PWA with real-time WebSocket + terminal emulation
- **Backend**: Fastify + SQLite + JWT — no ORM, direct SQL via better-sqlite3
- **TUI**: React + Ink for composable terminal UI (mirrors web UI feature set)
- **Validation**: Zod on all API boundaries (backend request/response + TUI)
- **Testing**: 3-tier pyramid — lint/unit (Vitest) → compliance (39 static auditors) → E2E (Playwright in Docker)
- **AI**: Claude SDK with BYOK/BYOV pattern — mock mode auto-activates when no API key configured

*This inventory covers runtime and development dependencies. For license compliance status of each package, see [SOFTWARE-LICENSE-EVALUATION.md](../../business/legal/SOFTWARE-LICENSE-EVALUATION.md).*
