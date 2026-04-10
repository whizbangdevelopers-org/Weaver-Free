<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: {VERSION-ID} — {Infrastructure Feature Name}

**Plan:** [EXECUTION-ROADMAP Phase N — {section}](../plans/v1.0.0/EXECUTION-ROADMAP.md)
**Parallelizable:** {Yes (independent) / No (depends on {dependency-agent})}
**Blocks:** {agent(s) that depend on this}

---

## Scope

{What infrastructure is being built and why. 1-3 paragraphs. Include strategic context.}

> **Market positioning:** After this release, the product page reads: *"{one-liner that captures what this enables}"*

---

## Phase Chain

<!-- Where does this agent sit in a multi-phase pipeline? -->
<!-- Infrastructure work typically spans 2-4 phases with explicit handoffs. -->

| Phase | Agent | Delivers | Status |
|-------|-------|----------|--------|
| {Na} | {visibility/foundation agent} | {read-only layer, adapter interface, types} | {DONE / THIS / TODO} |
| {Nb} | {management agent} | {full CRUD, actions, creation dialogs} | {DONE / THIS / TODO} |
| {Nc} | {integration agent} | {cross-resource, AI, topology} | {DONE / THIS / TODO} |

---

## Context to Read Before Starting

<!-- Every file the agent needs before writing code. -->
<!-- Infrastructure agents need BOTH the existing patterns AND the interfaces from prior phases. -->

| File | Why |
|------|-----|
| {existing adapter interface} | Pattern to mirror or extend |
| {existing factory/registry} | Registration pattern |
| {existing routes} | Route plugin pattern to follow |
| {prior phase outputs} | Interfaces, types, stores from earlier phase |
| {config.ts} | Tier gating pattern |

---

## Inputs

<!-- What must exist before this agent starts. Prior phase outputs, existing infrastructure. -->

- {Phase Na complete: interfaces, adapters, routes, stores}
- {Existing RBAC system from Phase 6}
- {Existing audit logging}
- {Existing creation dialog pattern}

---

## Interface Design

<!-- MANDATORY for foundation/visibility phases. Optional for later phases that extend existing interfaces. -->
<!-- Define the adapter interface, registry, and data types. -->
<!-- Infrastructure agents introduce patterns that multiple implementations follow. -->

### {Primary Interface}

```typescript
export interface {InterfaceName} {
  // core methods
}
```

### {Registry / Factory}

```typescript
export class {RegistryName} {
  register(impl: {InterfaceName}): void
  async detectAvailable(): Promise<{InterfaceName}[]>
}
```

### {Data Types}

```typescript
export interface {InfoType} {
  id: string
  name: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  // ...
}
```

### WebSocket Extension

<!-- If this feature adds new broadcast message types. -->

```json
{
  "type": "{resource}-status",
  "data": [{ "..." }],
  "timestamp": "..."
}
```

---

## Outputs

<!-- Infrastructure agents group outputs by implementation/adapter, not just by layer. -->

### Backend — {Adapter/Runtime 1}

| Deliverable | Description |
|------------|-------------|
| {action 1} | {how it works} |
| {action 2} | {how it works} |

### Backend — {Adapter/Runtime 2}

| Deliverable | Description |
|------------|-------------|
| {action 1} | {how it works} |

### Backend — Infrastructure

| Deliverable | Path |
|------------|------|
| {routes} | `backend/src/routes/{resource}.ts` |
| {schemas} | `backend/src/schemas/{resource}.ts` |
| {RBAC updates} | {path} |
| {audit updates} | {path} |

### Frontend

| Deliverable | Path |
|------------|------|
| {Card component} | `src/components/{Resource}Card.vue` |
| {Detail page} | `src/pages/{Resource}DetailPage.vue` |
| {Store} | `src/stores/{resource}-store.ts` |
| {Types} | `src/types/{resource}.ts` |
| {Creation dialog} | `src/components/Create{Resource}Dialog.vue` |
| {Weaver integration} | Update `src/pages/WorkbenchPage.vue` |

### NixOS

| Deliverable | Path |
|------------|------|
| {new module options} | Update `nixos/default.nix` |

### Tests

| Deliverable | Path |
|------------|------|
| {backend unit tests} | `backend/tests/...` |
| {E2E specs} | `testing/e2e/...` |

### Documentation

| Deliverable | Path |
|------------|------|
| Developer guide | `docs/DEVELOPER-GUIDE.md` |
| Help page | `src/pages/HelpPage.vue` |
| LESSONS-LEARNED | `docs/development/LESSONS-LEARNED.md` |

---

## API Endpoints

<!-- Full endpoint table with per-endpoint tier gating. -->

| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/api/{resources}` | {Weaver Free/Weaver} | List all |
| GET | `/api/{resources}/:id` | {Weaver Free/Weaver} | Get single |
| POST | `/api/{resources}` | {Weaver} | Create |
| POST | `/api/{resources}/:id/{action}` | {Weaver} | Action |
| DELETE | `/api/{resources}/:id` | {Weaver} | Remove |

---

## CRUD Completeness Check

<!-- Same as feature template. Infrastructure agents need this too. -->
<!-- v7-container-management Phase 7a is read-only; 7b adds full CRUD. -->
<!-- State which phase delivers each operation. -->

| Operation | Needed? | Delivered by | Phase |
|-----------|---------|-------------|-------|
| **Create** | {Yes/No} | {route + dialog} | {this / later phase} |
| **Read** (list) | {Yes/No} | {route + cards} | {this / prior phase} |
| **Read** (single) | {Yes/No} | {route + detail page} | {this / prior phase} |
| **Update** | {Yes/No} | {route + UI} | {this / later phase} |
| **Delete** | {Yes/No} | {route + confirmation} | {this / later phase} |
| **Bulk actions** | {Yes/No} | {route + toolbar} | {this / later phase} |

---

## Tier Gating Matrix

<!-- MANDATORY: Full matrix of sub-features across tiers. -->
<!-- Infrastructure agents often gate different sub-features at different tiers. -->

| Feature | Demo | Weaver Free | Weaver | Fabrick |
|---------|------|------|---------|------------|
| {sub-feature 1} | {Mock data} | {Read-only / -} | {Full / Read-only} | {Full} |
| {sub-feature 2} | {Mock data} | {-} | {Full} | {Full} |
| {sub-feature 3} | {-} | {-} | {-} | {Full} |

---

## Flow Notes

<!-- MANDATORY: 3-5 lines describing the request path. -->
<!-- Infrastructure agents typically have an adapter dispatch layer. -->

{Request hits auth → rbac → tier check → route handler → registry.get(runtime) → adapter.action() → response.}
{WebSocket broadcast picks up new {resource}-status via polling loop in ws.ts.}
{Frontend store receives WebSocket message → reactive update → cards re-render.}
{Demo mode: mock adapter returns canned data, same code paths.}

---

## Safety Rules

<!-- What operations must be prevented? What invariants must hold? -->
<!-- Infrastructure agents often have adapter-specific safety concerns. -->

1. {Destructive action requires confirmation (e.g., container remove)}
2. {Resource limits must be validated before creation}
3. {Adapter failures must not crash the main service (isolate per-runtime errors)}
4. {Demo mode must never execute real actions on host}

---

## Acceptance Criteria

1. {Adapter interface implemented with all planned adapters}
2. {Auto-detection correctly identifies installed runtimes/services}
3. {API endpoints return correct data with tier gating}
4. {WebSocket broadcasts new resource status}
5. {Weaver shows new resource cards alongside existing cards}
6. {Detail page shows full resource information}
7. {Demo mode shows mock data}
8. {Tier violations return 403}
9. {NixOS module updated}
10. {E2E specs pass}
11. {All documentation updated}

---

## Tier Blind Spot Mitigation

<!-- MANDATORY: Infrastructure agents span multiple tiers — each tier needs verification. -->

**Features gated at multiple tiers.** Standard dev/E2E runs at weaver.

**Mitigation:**
- {Free-gated features: verify in E2E (E2E runs weaver, so free features should work)}
- {Weaver-gated features: verify in E2E (standard tier)}
- {Fabrick-gated features: unit tests for gate enforcement + manual pre-release verification}
- {Demo mode: separate test with mock adapters}

---

## E2E Notes

- **Temp resources:** {MUST use createTemp*() helpers if tests create/mutate resources}
- **Runtime availability:** {E2E Docker image needs {runtime} installed, or tests must handle "runtime not available" gracefully}
- **Mock mode:** {If real runtimes aren't in E2E Docker, mock adapter tests cover logic; E2E verifies API surface and tier gates}
- **Cleanup:** {afterAll must stop/remove any test-created resources}

---

## Estimated Effort

| Area | Duration |
|------|----------|
| {Adapter 1} | {time} |
| {Adapter 2} | {time} |
| {Backend infrastructure (routes, schemas, registry)} | {time} |
| {Frontend (store, cards, detail page, dialog)} | {time} |
| {NixOS module} | {time} |
| {Tests} | {time} |
| {Documentation} | {time} |
| **Total** | **{time}** |
