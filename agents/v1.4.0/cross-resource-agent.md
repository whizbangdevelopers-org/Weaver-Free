<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v7-cross-resource-agent — Cross-Resource AI Agent

**Priority:** High #3
**Tier:** Weaver (cross-resource diagnostics, container agent, unified search) / Fabrick (topology, dependency mapping)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.3.0/EXECUTION-ROADMAP.md) (Phase 7c)
**Parallelizable:** No (depends on v1.2.0/sub-governance-testing)
**Blocks:** None

---

## Scope

Extend the existing AI agent to understand both VMs and containers. Inject combined resource state into agent context, enable cross-resource diagnostics ("why can't container X reach VM Y?"), add agent actions on containers, and build a network topology visualization showing VMs, containers, bridges, and their relationships.

> **Strategic context:** This is the fabrick differentiator. Cross-resource intelligence is the feature no single-resource dashboard can offer. The topology view and dependency mapping justify fabrick pricing.

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->
<!-- Note: container-store.ts and container-registry.ts listed below may not exist — v1.1/v1.2 used a different architecture. Verify. -->

- Phase 7a + 7b complete: full container runtime infrastructure, actions, creation, RBAC, stores
- AI agent with streaming, BYOK/BYOV, mock mode (`agent.ts`, `mock-agent.ts`)
- Network manager with bridge/interface data (`network-manager.ts`)
- VM state via WebSocket (`vm-store.ts`, `microvm.ts`)
- Container state via WebSocket (`container-store.ts`, `container-registry.ts`)
- Agent dialog with streaming responses (`AgentDialog.vue`)
- AI Analysis tab on VM detail page (`VmDetailPage.vue`)

### What's Missing

- Cross-resource context builder (combined VM + container + bridge state for LLM prompt)
- Agent actions on containers (inspect, logs, restart via agent)
- Mock agent container-aware canned responses
- Topology data endpoint with relationship mapping
- Topology view component (interactive graph)
- Topology page + routing + sidebar nav
- Combined resource stats on dashboard header
- Unified search across VMs and containers
- Container AI Analysis tab on container detail page
- **Bridge active routing** — weight attribute on bridge, `PUT /api/bridges/:name/weights`, proportional traffic distribution (Decision #112)
- **Bridges-not-as-nodes** — lock `weaverRole=bridge` cert marker; Fabrick must not count bridges in node licensing (Decision #112)
- **AI bridge awareness** — agent reads bridge routing state; can suggest and execute weight shifts on request (Decision #112)

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/services/agent.ts` | Existing agent service to extend with container context |
| `backend/src/services/llm-provider.ts` | LLM provider interface — context injection point |
| `backend/src/services/mock-agent.ts` | Mock agent to update with container-aware responses |
| `backend/src/routes/agent.ts` | Agent route to extend |
| `backend/src/services/container-runtime.ts` | Container state to inject into agent context |
| `backend/src/services/container-registry.ts` | Registry for aggregating container state |
| `backend/src/services/microvm.ts` | VM state to combine with container state |
| `backend/src/services/network-manager.ts` | Network state for topology |
| `src/composables/useAgent.ts` | Agent composable to extend |
| `src/composables/useAgentStream.ts` | Streaming composable |
| `src/stores/agent-store.ts` | Agent store to extend |
| `src/stores/container-store.ts` | Container store (from 7a) for topology data |
| `src/stores/vm-store.ts` | VM store for topology data |
| `src/components/AgentDialog.vue` | Agent dialog to update |
| `src/pages/VmDetailPage.vue` | AI Analysis tab pattern |

---

## Outputs

### Backend

| Deliverable | Path |
|------------|------|
| Cross-resource context builder | `backend/src/services/agent-context.ts` |
| Container agent actions (inspect, logs, restart) | Update `backend/src/services/agent.ts` |
| Topology data endpoint | `backend/src/routes/topology.ts` |
| Mock agent: container-aware responses | Update `backend/src/services/mock-agent.ts` |

### Frontend

| Deliverable | Path |
|------------|------|
| Network topology view component | `src/components/TopologyView.vue` |
| Topology page | `src/pages/TopologyPage.vue` |
| Combined resource stats (dashboard header) | Update `src/pages/WorkbenchPage.vue` |
| Agent dialog: cross-resource context indicator | Update `src/components/AgentDialog.vue` |
| Container AI Analysis tab | Update container detail page |
| Unified search (VMs + containers) | `src/components/UnifiedSearch.vue` |
| Topology route | Update `src/router/routes.ts` |
| Sidebar: topology nav item | Update `src/layouts/MainLayout.vue` |

### Testing

| Deliverable | Path |
|------------|------|
| Backend unit tests for cross-resource context | `testing/unit/agent-context.test.ts` |
| E2E specs for cross-resource agent + topology | `testing/e2e/cross-resource.spec.ts` |

### Documentation

| Deliverable | Path |
|------------|------|
| Developer guide (cross-resource architecture) | `docs/DEVELOPER-GUIDE.md` |
| Help page (topology + cross-resource diagnostics) | `src/pages/HelpPage.vue` |
| LESSONS-LEARNED (cross-resource patterns) | `docs/development/LESSONS-LEARNED.md` |

---

## CRUD Completeness Check

| Operation | Needed? | Covered by |
|-----------|---------|------------|
| **Create** | No — agent recommends, doesn't create resources | — |
| **Read** (context) | Yes | `agent-context.ts` builds combined state for LLM prompt |
| **Read** (topology) | Yes | `GET /api/topology` + `TopologyPage` |
| **Read** (search) | Yes | `GET /api/search?q=` + `UnifiedSearch` component |
| **Update** | No — agent can execute actions (restart) but doesn't modify resource configs | — |
| **Delete** | No — agent never deletes resources | — |
| **Execute** (agent actions) | Yes | Agent dispatches container actions (restart, inspect, logs) via existing 7b endpoints |

---

## All Endpoints Affected

| Endpoint | Impact |
|----------|--------|
| `GET /api/topology` | **New** — combined resource topology with relationships (Weaver) |
| `GET /api/search?q=` | **New** — unified search across VMs and containers (Weaver) |
| `POST /api/vms/:name/agent` | **Modify** — inject cross-resource context into agent prompt; add container action dispatch |
| `WS /ws/status` | **No change** — topology builds from existing vm-status + container-status messages |

**Not affected:** All container CRUD endpoints (7a/7b), VM CRUD endpoints, user/audit/health endpoints. Agent route is modified (context injection) but its API contract doesn't change.

---

## Cross-Resource Context Builder

The agent context builder assembles a combined view of all resources for the LLM prompt:

```typescript
export interface AgentContext {
  vms: VmInfo[]
  containers: ContainerInfo[]
  bridges: BridgeDefinition[]
  relationships: ResourceRelationship[]
}

export interface ResourceRelationship {
  source: { type: 'vm' | 'container'; id: string }
  target: { type: 'vm' | 'container' | 'bridge'; id: string }
  relationship: 'network' | 'depends-on' | 'colocated'
}
```

Context is injected as a structured system prompt section:

```
## Current Infrastructure State

### VMs (5 total: 3 running, 1 stopped, 1 failed)
- web-nginx (running, 10.10.0.10, bridge: br0)
- web-app (running, 10.10.0.11, bridge: br0)
...

### Containers (3 total: 2 running, 1 stopped)
- redis-cache (docker, running, 172.17.0.2)
- ml-pipeline (apptainer, running, GPU: nvidia)
...

### Network Topology
- br0: web-nginx, web-app, redis-cache
- br1: dev-node, ml-pipeline
```

---

## Topology View

Interactive network graph visualization showing:

- VM nodes (with status color)
- Container nodes (with runtime badge)
- Bridge connections
- Network relationships
- Click-to-navigate to detail pages

Technology options (decide during implementation):
- D3.js force-directed graph (most flexible)
- vis-network (simpler API)
- Cytoscape.js (best for network graphs)

---

## API Endpoints (New in Phase 7c)

| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/api/topology` | Weaver | Combined resource topology with relationships |
| GET | `/api/search?q=` | Weaver | Unified search across VMs and containers |

---

## Tier Gating

| Feature | Weaver Free | Weaver | Fabrick |
|---------|------|---------|------------|
| VM agent diagnostics (existing) | Mock | Full | Full |
| Container agent diagnostics | - | Full | Full |
| Cross-resource diagnostics | - | Full | Full |
| Agent actions on containers | - | Full | Full |
| Combined resource stats | Counts only | Full | Full |
| Unified search | - | Full | Full |
| Network topology view | - | - | Full |
| Resource dependency mapping | - | - | Full |
| Agent-suggested placement | - | - | Full |

---

## Phase Chain

| Phase | Agent | Delivers | Status |
|-------|-------|----------|--------|
| 7a | v7-container-visibility | Read-only container awareness, adapter interface, types, cards, detail page | TODO |
| 7b | v7-container-management | Full CRUD, actions, creation dialog, RBAC, bulk ops | TODO |
| 7c | v7-cross-resource-agent (this) | Cross-resource AI, topology view, unified search | TODO |

---

## Flow Notes

Agent context: agent-context.ts builds combined VmInfo[] + ContainerInfo[] + BridgeDefinition[] + relationships → injected as structured system prompt section before user query.
Agent action on container: Agent decides "restart redis-cache" → agent.ts dispatches to container registry → adapter.restart(id) → audit logged → result streamed back to user.
Topology: GET /api/topology → backend builds graph from VM interfaces, container networks, bridge associations → frontend renders interactive D3/Cytoscape graph.
Unified search: GET /api/search?q= → backend searches VMs by name/IP + containers by name/image/IP → returns merged results.

---

## Safety Rules

1. Agent actions on containers must go through the same RBAC checks as direct API calls — agent cannot bypass permissions
2. Cross-resource context must not expose container data to free-tier users (free sees VMs only, no container context in agent prompt)
3. Topology endpoint must filter by user's ACL if per-VM ACL is active (enterprise)
4. Agent-suggested placement ("move this container to node X") must be a recommendation, never auto-executed — require human confirmation
5. Unified search must respect tier gates — free users see only VMs in search results

---

## Tier Blind Spot Mitigation

**Features span Weaver and Fabrick tiers.** Standard dev/E2E runs at weaver.

**Mitigation:**
- Weaver features (container agent diagnostics, cross-resource context, agent actions on containers, unified search): testable in E2E
- Fabrick features (topology view, dependency mapping, agent-suggested placement): unit tests for tier gates. E2E verifies topology nav item hidden at weaver
- Agent context correctness: unit tests verify context builder includes correct resources per tier
- Before release: temporarily switch to enterprise for topology view and dependency mapping verification

---

## E2E Notes

- **Agent mocking:** E2E runs without ANTHROPIC_API_KEY — mock agent must return container-aware canned responses
- **Topology:** E2E can test that topology page renders (or is gated) — graph content depends on available resources
- **Unified search:** E2E can test search UI and result rendering with mock/existing data
- **Temp resources:** Cross-resource tests may need both temp VMs and temp containers — clean up both in afterAll
- **Environment gaps:** Topology accuracy depends on real network data (bridges, IPs). E2E Docker may not have meaningful network topology — test UI rendering, not graph correctness

---

## Acceptance Criteria

1. Agent context includes both VM and container state in prompts
2. Agent can diagnose cross-resource issues ("why can't container X reach VM Y?")
3. Agent can execute actions on containers (restart, inspect, read logs)
4. Mock agent returns container-aware canned responses in demo/no-key mode
5. Topology view renders VMs, containers, and bridges as an interactive graph
6. Clicking nodes in topology navigates to detail pages
7. Weaver header shows combined stats (total VMs, total containers, by runtime)
8. Unified search finds both VMs and containers by name, image, IP, status
9. Topology view is fabrick-gated; returns 403 on lower tiers
10. E2E specs pass for cross-resource agent and topology flows
11. All documentation updated

---

## Estimated Effort

| Area | Duration |
|------|----------|
| Cross-resource context builder | 1 day |
| Agent service: container actions | 1 day |
| Mock agent: container-aware responses | 0.5 days |
| Topology data endpoint + relationship mapping | 1 day |
| Topology view component (graph library) | 2 days |
| Topology page + routing + nav | 0.5 days |
| Combined resource stats (dashboard) | 0.5 days |
| Unified search component | 1 day |
| Agent dialog updates | 0.5 days |
| Container AI Analysis tab | 0.5 days |
| E2E specs + unit tests | 1.5 days |
| Documentation | 0.5 days |
| **Total** | **~10-11 days** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Cross-resource architecture: context builder, topology endpoint, unified search, agent action dispatch |
| `src/pages/HelpPage.vue` | Topology view usage, cross-resource diagnostics, unified search |
| `docs/development/LESSONS-LEARNED.md` | LLM context building patterns, graph visualization library choice, cross-store composition |
| `CLAUDE.md` | Add topology + search API endpoints to API table |
