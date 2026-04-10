<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v2-maintenance-manager — Host Maintenance Manager

**Plan:** [v2.1.0 Execution Roadmap](../../plans/v2.1.0/EXECUTION-ROADMAP.md)
**Parallelizable:** Yes (independent of snapshot engine and template-editor within v2.1.0)
**Blocks:** Nothing in v2.1.0; lays operational foundation for Fabrick fleet maintenance (v2.3.0+)

---

## Scope

Build the Host Maintenance Manager: a UI + backend workflow that makes unavoidable NixOS rebuilds safe. The core primitive is `test → health check → confirm → switch` — apply a config change without committing it, AI-validate that all workloads survived, then let the operator decide. Also ships: generation list and GC, flake update workflow, and maintenance window scheduling.

**Product story:** Live Provisioning removes routine rebuilds (workload ops never touch the host). Maintenance Manager makes unavoidable rebuilds safe. Together: "You'll rarely need to rebuild. When you do, it's safe." Lead with this in UX copy — it's a genuine NixOS moat. No Proxmox, no Ansible, no other tool offers staged-apply with AI health check and one-click auto-revert.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `NOTES.md` (2026-03-27 entries) | Core product story: LP + MM combination, bridge convergence analogy, `test → confirm → switch` as product identity |
| `backend/src/services/microvm.ts` | systemctl integration patterns, VM status derivation |
| `backend/src/routes/vms.ts` | Route pattern to follow |
| `src/pages/SettingsPage.vue` | Settings page section pattern |
| `src/composables/useAgent.ts` | AI health check will use the same agent stream infrastructure |
| `backend/src/services/agent.ts` | AI agent invocation pattern |

---

## Inputs

- Decision #111 (Host Maintenance Manager — GC, generations, flake updates, maintenance windows)
- Decision #112 (bridge active routing — weight control, available at Weaver tier from v1.4.0)
- NixOS native primitives: `nixos-rebuild test`, `nixos-rebuild switch`, `nix-collect-garbage`, `nix flake update`, `nixos-rebuild list-generations`
- VM clone capability (ships v2.1.0 — same release as this agent)
- Existing bridge weight API (v1.4.0 — available by the time v2.1.0 ships)
- Existing microvm systemctl integration in `microvm.ts`
- Existing AI agent streaming infrastructure

---

## Two Maintenance Paths

Live Provisioning and bridge active routing (Decision #112) enable a fundamentally different path for Weaver-tier users. Two paths ship:

### Path A — Simple (Free tier)

`nixos-rebuild test` is applied directly to the live system. Workloads are disrupted during the test phase. Health check is reactive — it runs after the disruption to see whether VMs recovered.

```
Operator initiates rebuild
          │
          ▼
  nixos-rebuild test          ← applies config to live system, microvm@* restart
          │                     workloads are briefly disrupted
          ▼
  AI health check             ← did VMs recover? systemctl + resource check
  ┌──────────────────────────────────────────────────────────────┐
  │  ✓ microvm@web-nginx   running  │  CPU 2%  │  net reachable  │
  │  ✓ microvm@web-app     running  │  CPU 4%  │  net reachable  │
  │  5/5 healthy — no anomalies detected                         │
  └──────────────────────────────────────────────────────────────┘
          │
          ▼
  [Confirm & Switch]  [Revert]      ← 15-min auto-revert countdown
          │                │
          ▼                ▼
  nixos-rebuild switch    nixos-rebuild switch --rollback
  (commits to boot)       (restores prior generation)
```

**Auto-revert (Path A):** If health check detects failures AND operator does not respond within 15 min, backend runs `nixos-rebuild switch --rollback` and records event in audit log.

---

### Path B — Zero-Downtime (Weaver tier — requires clone + bridge routing)

Standby clones absorb traffic before the host rebuild touches anything. The production VMs restart on the new config with traffic already rerouted. Health check runs on the rebuilt VMs while they are still out of rotation — workloads never go dark. Revert means simply not shifting the bridge back.

```
Operator initiates rebuild
          │
          ▼
  Clone active VMs → standby state
  Bridge weight shifts to standby clones   ← traffic rerouted, zero downtime
          │
          ▼
  nixos-rebuild test                        ← production VMs restart on new config
          │                                    standby clones absorb traffic throughout
          ▼
  AI health check on rebuilt VMs            ← proactive: VMs are healthy BEFORE
  (still out of rotation)                      traffic is shifted back
  ┌──────────────────────────────────────────────────────────────┐
  │  ✓ microvm@web-nginx   running  │  CPU 2%  │  net reachable  │
  │  ✓ microvm@web-app     running  │  CPU 4%  │  net reachable  │
  │  Standby clones: serving traffic, no anomalies               │
  └──────────────────────────────────────────────────────────────┘
          │
          ▼
  [Confirm & Switch]  [Revert]
          │                │
          ▼                ▼
  Bridge shifts back      Bridge stays with standby clones
  to rebuilt VMs          (traffic never interrupted)
  nixos-rebuild switch    nixos-rebuild switch --rollback
  Destroy standby clones  Destroy rebuilt VMs (unhealthy)
```

**Auto-revert (Path B):** On health check failure or timeout, leave bridge with standby clones — workloads have zero downtime. Revert host gen and destroy the rebuilt VMs. Standby clones continue serving until operator destroys them manually or triggers a new maintenance window.

**Why this is better:** Path A's health check is reactive — it measures whether workloads survived disruption. Path B's health check is proactive — workloads are never disrupted, and the check validates the new config before traffic ever touches it. The bridge is the safety valve, not the NixOS generation rollback.

---

### Path Selection

The UI detects available capabilities and selects the path automatically:

| Condition | Path |
|-----------|------|
| Free tier | A (always) |
| Weaver tier, no active bridges | A (bridge routing unavailable) |
| Weaver tier, bridge active routing available | B (zero-downtime, default) |

Operator can manually select Path A even at Weaver tier (e.g., single-VM host with no bridges, or deliberate preference).

---

## Outputs

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/pages/MaintenancePage.vue` | New | Full maintenance dashboard: generation list, GC controls, flake update trigger, rebuild status |
| `src/components/maintenance/RebuildConfirmPanel.vue` | New | Health check results + Confirm/Revert buttons + auto-revert countdown |
| `src/components/maintenance/GenerationList.vue` | New | Table of NixOS generations: number, date, description, size, current/previous badges, pin/delete actions |
| `src/components/maintenance/GcControls.vue` | New | Delete old generations (keep N most recent), run GC, show space freed |
| `src/components/maintenance/FlakeUpdatePanel.vue` | New | Show current flake.lock state, trigger `nix flake update`, preview changed inputs before rebuild |
| `src/components/maintenance/MaintenanceWindowConfig.vue` | New | Day-of-week + time-of-day allowed rebuild windows; block all rebuild triggers outside window |
| `src/composables/useMaintenanceStatus.ts` | New | Poll `/api/maintenance/status`, surface active rebuild phase, health check state, countdown |
| `src/stores/maintenance-store.ts` | New | Pinia store for maintenance state: phase, generation list, health check results |
| `src/router/routes.ts` | Modify | Add `/maintenance` route (Weaver-gated) |
| `src/layouts/MainLayout.vue` | Modify | Add Maintenance nav item (Weaver+, below Settings) |

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/maintenance.ts` | New | All maintenance endpoints (see API below) |
| `backend/src/services/maintenance.ts` | New | Core service: nixos-rebuild orchestration, generation management, GC, health check |
| `backend/src/services/maintenance-health.ts` | New | AI-powered health check: systemctl queries + AI analysis of results |
| `backend/src/schemas/maintenance.ts` | New | Zod schemas for maintenance inputs |
| `backend/src/index.ts` | Modify | Register maintenance routes |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/maintenance.spec.ts` | New | All endpoints: generation list, GC, rebuild trigger, confirm, revert |
| `backend/tests/services/maintenance.spec.ts` | New | Phase state machine, auto-revert timeout, health check aggregation |
| `testing/e2e/maintenance.spec.ts` | New | UI flow: trigger rebuild → mock health check → confirm → verify generation advances |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/maintenance/status` | operator+ | Current phase, path (A/B), health check state, AI loop iteration, countdown |
| GET | `/api/maintenance/generations` | operator+ | List all NixOS generations (number, date, description, current flag) |
| DELETE | `/api/maintenance/generations/:n` | admin | Delete a specific generation (not current or previous) |
| POST | `/api/maintenance/gc` | admin | Run `nix-collect-garbage`, optionally keep N generations |
| POST | `/api/maintenance/flake-update` | admin | Run `nix flake update`, return changed inputs preview |
| POST | `/api/maintenance/rebuild/test` | admin | Run `nixos-rebuild test` (Path A) or start clone+shift sequence (Path B) |
| POST | `/api/maintenance/rebuild/confirm` | admin | Run `nixos-rebuild switch` + bridge shift back (Path B) |
| POST | `/api/maintenance/rebuild/revert` | admin | Revert host gen; destroy standby (Path A) or enter standby-serving (Path B) |
| POST | `/api/maintenance/ai/approve` | admin | Approve a pending AI fix action |
| POST | `/api/maintenance/ai/skip` | admin | Skip current AI fix action, proceed to next iteration or revert |
| POST | `/api/maintenance/ai/cancel` | admin | Cancel AI remediation loop, proceed directly to confirm/revert panel |
| GET | `/api/maintenance/window` | admin | Get maintenance window config |
| PUT | `/api/maintenance/window` | admin | Set maintenance window |

All rebuild endpoints are **Weaver-gated**. Generation list and GC are **Free** (basic host hygiene).

---

## Health Check + AI Remediation Loop

Health check is not a one-shot read — it drives an AI remediation loop that attempts to resolve failures before handing control back to the operator.

### Layer 1 — systemctl (immediate)
```
systemctl status microvm@*   → parse ActiveState + SubState for each VM
systemctl status weaver       → verify the app itself is still running
journalctl -u microvm@*       → recent log lines for failed units (context for AI)
```

### Layer 2 — AI remediation loop

If Layer 1 finds all healthy → skip to confirm panel.

If Layer 1 finds failures → enter the AI remediation loop:

```
Health check detects failure(s)
          │
          ▼
  AI diagnoses root cause
  (systemctl output + journal logs → what went wrong and why)
          │
          ▼
  AI proposes fix action(s)          ← shown in UI as a pending action card
  e.g. "web-nginx failed to bind port 80 after rebuild.
        Cause: nginx config references old interface name.
        Fix: restart microvm@web-nginx with updated interface binding."
          │
          ▼
  [Auto-apply]  or  [Approve fix]  [Skip]
  (configurable — autonomous mode auto-applies; default requires approval)
          │
          ▼
  AI executes fix (restart service, adjust config, etc.)
  → recorded in audit log with action taken
          │
          ▼
  Re-run health check (Layer 1)
          │
          ├── all healthy → confirm panel
          ├── still failing → loop (max iterations, configurable, default 3)
          └── max iterations reached → "AI exhausted remediation" → revert panel
```

**Path A — auto-revert countdown pauses** while the AI loop is actively executing. Countdown resumes when the loop exits (healthy or exhausted). Operator can cancel the AI loop at any time and proceed to manual confirm/revert.

**Path B — no time pressure.** Standby clones are serving traffic. The AI has unlimited time to remediate. Loop iterations are still capped (default 5 for Path B) to prevent runaway execution.

### AI fix action set (scoped to what is safe during a maintenance window)

| Action | Safe | Notes |
|--------|------|-------|
| Restart individual `microvm@<name>` | Yes | Core remediation action |
| Adjust VM resource limits (memory, CPU) via LP API | Yes | No rebuild required |
| Reload a specific NixOS service (`systemctl reload`) | Yes | Non-disruptive |
| Apply a targeted config patch and partial rebuild | Operator approval required | Shown as a pending action, never auto-applied |
| Roll back a specific flake input | Operator approval required | Changes flake.lock |
| Destroy and re-provision a VM from template | Operator approval required | Last resort — shown only if restart exhausted |

The AI does not take arbitrary shell actions. The fix action set is a defined enum in `maintenance-health.ts` — the AI selects from it, not from freeform commands.

### Streaming vs single-shot

Use streaming for the diagnosis and fix narrative (same `useAgentStream` composable as AgentDialog) — operator sees the AI reasoning in real time. The fix execution itself is a discrete backend action, not streamed. The re-check result arrives as a structured health check response.

---

## Phase State Machine

**Path A (simple):**
```
idle → testing → health-check
                     │ all healthy
                     ├──────────────────────────────→ awaiting-confirm → confirmed (→ idle)
                     │                                                 → reverted (→ idle)
                     │ failures detected                               → auto-reverted (timeout)
                     └──→ ai-diagnosing → ai-fix-pending → ai-fixing → health-check (loop)
                                                                            │ exhausted
                                                                            └──→ awaiting-revert → reverted (→ idle)
```

Countdown pauses during `ai-diagnosing / ai-fix-pending / ai-fixing`. Resumes on loop exit.

**Path B (zero-downtime):**
```
idle → cloning-standby → bridge-shifted → testing → health-check
                                                         │ all healthy
                                                         ├──→ awaiting-confirm → confirmed: bridge-back → cleanup → idle
                                                         │                                → reverted: host-rollback → standby-serving
                                                         │ failures detected
                                                         └──→ ai-diagnosing → ai-fix-pending → ai-fixing → health-check (loop)
                                                                                                               │ exhausted
                                                                                                               └──→ awaiting-revert → host-rollback → standby-serving
```

`standby-serving` — stable state: standby clones are active and serving traffic. A new maintenance attempt is blocked until operator clears standby. No time pressure.

State persisted in `{dataDir}/maintenance-state.json`: path (A/B), standby VM names, bridge weight snapshot, current phase, AI loop iteration count, action history.

---

## Tier Gating

| Feature | Weaver Free | Weaver |
|---------|:-----------:|:------:|
| Generation list (view only) | Yes | Yes |
| GC (delete old generations, run garbage collect) | Yes | Yes |
| Path A rebuild workflow (`test → check → confirm`) | — | Yes |
| Path B zero-downtime rebuild (clone + bridge routing) | — | Yes |
| AI health check + auto-revert | — | Yes |
| Maintenance window scheduling | — | Yes |
| Flake update UI | — | Yes |

**UX for free tier:** Generation list and GC are shown; rebuild workflow section shows an UpgradeNag pointing to Weaver. "Upgrading to Weaver makes every rebuild safe — apply, check, then decide."

**Path B availability:** Shown only when Weaver tier AND at least one managed bridge with active routing is detected. If no bridges are active, Path B option is greyed out with tooltip: "Requires a managed bridge — add one in Strands."

---

## UX Copy Guidance

Lead with the moat. This is not an "advanced settings" feature — it is a primary operational surface.

| Location | Copy |
|----------|------|
| Maintenance page header | "Every rebuild is safe. Apply it, check it, then commit it." |
| `test` trigger button | "Test Rebuild" (not "Rebuild" — the word "test" communicates the safety) |
| Health check panel | Show VM names, status, and AI summary — not a wall of text |
| Confirm button | "Confirm & Switch" — the "Switch" communicates the NixOS primitive |
| Revert button | "Revert to Previous" — not "Cancel" (it's an active operation, not an abort) |
| Auto-revert countdown | "Auto-revert in 14:23 — confirm to keep the new config" |
| UpgradeNag | "Upgrading to Weaver makes every rebuild safe." |

Do not bury this in Settings. Maintenance is a first-class page in the nav.

---

## Safety Rules

1. Only one rebuild operation active at a time — `POST /api/maintenance/rebuild/test` rejects with 409 if phase ≠ idle
2. Auto-revert fires if `awaiting-confirm` phase exceeds the configured timeout (default 15 min, configurable)
3. Auto-revert also fires immediately if AI health check detects any `microvm@*` unit in `failed` state
4. GC never deletes the current or previous generation — enforced in `maintenance.ts`, not just UI
5. Maintenance window enforcement: rebuild endpoints return 403 with "outside maintenance window" if a window is configured and current time is outside it (admin can override with explicit flag)
6. All rebuild operations are written to the audit log with operator identity, timestamp, generation numbers, and health check summary

---

## Acceptance Criteria

1. Generation list shows all NixOS generations with current/previous badges
2. GC deletes old generations, shows space freed, never touches current/previous
3. Flake update shows changed inputs before triggering rebuild
4. **Path A:** `Test Rebuild` triggers `nixos-rebuild test`, transitions to health-check phase
5. **Path A:** Health check queries all `microvm@*` units post-rebuild and feeds results to AI
6. **Path A:** Revert runs `nixos-rebuild switch --rollback`; generation list reflects change
7. **Path A:** Auto-revert fires at timeout or on AI-detected failed microVM
8. **Path B:** Clone step creates standby copies of all active VMs before any host change
9. **Path B:** Bridge weight shifts to standby clones before `nixos-rebuild test` runs
10. **Path B:** Health check runs on rebuilt VMs while they are still out of rotation
11. **Path B:** Confirm shifts bridge back to rebuilt VMs and destroys standby clones
12. **Path B:** Revert leaves bridge with standby clones; host gen rolls back; enters `standby-serving` state
13. **Path B:** `standby-serving` state blocks new maintenance attempts until standby clones are destroyed
14. AI health check summary appears in confirm panel (plain language, not raw JSON)
15. When health check detects failures, AI remediation loop starts automatically
16. AI streams diagnosis and fix narrative in real time (using `useAgentStream`)
17. Pending AI fix actions require operator approval before execution (default mode)
18. Autonomous mode (configurable) auto-applies AI fixes without approval prompt
19. Each AI fix action is recorded in the audit log with action type, target VM, and outcome
20. AI loop respects max iteration cap (3 for Path A, 5 for Path B); exits to revert panel when exhausted
21. Path A countdown pauses during AI loop; resumes on exit
22. Path B has no countdown — AI loop runs until healthy or exhausted
23. Operator can cancel AI loop at any time via `POST /api/maintenance/ai/cancel`
24. `nixos-rebuild switch` commits to boot default; generation advances in list
25. Free-tier users see generation list + GC; rebuild section shows UpgradeNag
26. Path B option is greyed out when no managed bridge with active routing exists
27. All rebuild operations appear in audit log (path used, VM names, bridge state, AI actions, final outcome)
28. `npm run test:precommit` passes

---

## Estimated Effort

Generation list + GC + page scaffold: 1–2 days
Path A phase machine (`test → check → confirm`): 2 days
Path B phase machine (clone + bridge + zero-downtime): 2–3 days
AI remediation loop (diagnose → fix → re-check, action enum, approval flow): 2–3 days
AI streaming integration (`useAgentStream` + fix action execution): 1 day
Flake update panel: 1 day
Maintenance window config: 1 day
Path selection logic + bridge detection: 0.5 days
Tests + E2E (both paths, AI loop, approval flow): 2–3 days
Total: **13–17 days**

---

## Documentation

| Target | Updates |
|--------|---------|
| `docs/DEVELOPER-GUIDE.md` | Add maintenance architecture: phase state machine, health check layers, NixOS rebuild integration |
| `src/pages/HelpPage.vue` | Add "Host Maintenance" section: how rebuilds work, what `test → confirm → switch` means, auto-revert |
| `CLAUDE.md` | Add `/api/maintenance/*` endpoints to API table |
| `docs/development/LESSONS-LEARNED.md` | NixOS rebuild integration, phase persistence across restarts |
