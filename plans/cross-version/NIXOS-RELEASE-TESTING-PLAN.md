<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# NixOS Release Testing Plan

**Status:** Decided (Decision #37)
**Scope:** Cross-version — applies to every Weaver release
**Created:** 2026-03-06
**Depends On:** [PRODUCTION-DEPLOYMENT.md](../code/docs/PRODUCTION-DEPLOYMENT.md) (NixOS Channel Strategy)

---

## Problem

NixOS releases twice per year (YY.05 in May, YY.11 in November). Each release can change:

- Package versions (Node.js, QEMU, cdrkit, cloud-hypervisor)
- systemd/systemctl output formats
- NixOS module option interfaces
- microvm.nix upstream library behavior
- Nix language features and evaluation semantics

We support current stable (N) and previous stable (N-1) per the channel strategy in PRODUCTION-DEPLOYMENT.md. But the existing strategy only describes *policy* — it doesn't describe *how* we test.

---

## Support Matrix

| Channel | Support Level | Testing Level |
|---------|--------------|---------------|
| N (current stable) | Full support, primary target | Full CI + integration + fresh install |
| N-1 (previous stable) | Supported, 6-month overlap | Full CI + integration |
| N-2 and older | Unsupported | None |
| nixpkgs-unstable | Unsupported, best-effort | Nix eval only (catch breakage early) |

Example for November 2026: N = 26.11, N-1 = 26.05, dropped = 25.11.

---

## Testing Layers

### Layer 1: Nix Evaluation (every push)

**What:** Verify the NixOS module evaluates cleanly against N and N-1 nixpkgs.

**How:** `nix eval` with `--override-input nixpkgs` pointing to each channel.

**Cost:** Seconds. Free in CI.

**Catches:** Removed/renamed NixOS options, changed module interfaces, Nix language deprecations.

```bash
# Evaluate module against current stable
nix eval .#nixosConfigurations.test-N --override-input nixpkgs github:NixOS/nixpkgs/nixos-26.11

# Evaluate module against previous stable
nix eval .#nixosConfigurations.test-N-1 --override-input nixpkgs github:NixOS/nixpkgs/nixos-26.05
```

**Implementation:** Add a `test-nixos-eval` flake check that runs against both channels. Wire into pre-push or CI.

### Layer 2: NixOS VM Integration (pre-release)

**What:** Build a full NixOS VM with the dashboard module, boot it in QEMU, verify:
- systemd service starts
- Health endpoint responds
- WebSocket connects
- VM listing works (mock or real microvm.nix VMs)

**How:** `nixos-rebuild build-vm` produces a QEMU script. Boot it, wait for service, hit endpoints, shut down.

**Cost:** ~5 minutes per channel. Run on Foundry (already NixOS).

**Catches:** Runtime package incompatibilities, systemctl output format changes, service startup failures, port/permission issues.

```bash
# Build test VM for channel N
nix build .#nixosConfigurations.integration-test-N.config.system.build.vm

# Boot and run smoke tests
./result/bin/run-integration-test-N-vm &
sleep 30
curl -f http://localhost:3100/api/health
# ... more checks
kill %1
```

### Layer 3: microvm.nix Compatibility (pre-release)

**What:** Verify VM creation, listing, start/stop against the pinned microvm.nix version on both channels.

**How:** Part of the Layer 2 VM — include a test microvm definition, verify it appears in `systemctl list-units 'microvm@*'` output.

**Catches:** microvm.nix API changes, systemctl output format changes (flagged risk since project start), bridge/TAP interface differences.

### Layer 4: Fresh Install Smoke Test (release gate)

**What:** Full end-to-end new user experience on current stable (N).

**How:** `nix-fresh-install.sh` on a clean NixOS VM. Manual verification (already in release checklist).

**Catches:** First-run setup bugs, CirOS auto-provisioning, PWA loading, WebSocket real-time updates.

**Scope:** N only. N-1 is covered by Layer 2. If Layer 2 passes on N-1, the fresh install experience is functionally identical.

---

## Execution Strategy: Foundry

All automated NixOS testing runs on Foundry. Rationale:

- Already a NixOS machine — can `nixos-rebuild build-vm` natively
- Already runs Forge agent tasks — this is just another task type
- No GitHub Actions runner cost or Cachix dependency
- Results feed back into Forge STATUS.json as a release gate

### Forge Task Definition

```json
{
  "task": "nixos-release-compat",
  "trigger": "pre-release",
  "runner": "foundry",
  "steps": [
    "nix-eval-N",
    "nix-eval-N-1",
    "nix-eval-unstable",
    "vm-integration-N",
    "vm-integration-N-1"
  ],
  "gate": true,
  "failureAction": "block-release"
}
```

### Biannual Channel Bump Procedure

When a new NixOS stable drops (May or November):

1. **Week 1:** Update flake.lock to include new channel. Run Layer 1 eval.
2. **Week 2:** Run Layer 2 integration against new channel. Fix any breakage.
3. **Week 3:** Update docs (flake examples, PRODUCTION-DEPLOYMENT.md channel table).
4. **Week 4:** Ship dashboard release with updated support matrix. Bump minimum version (drop N-2).

This gives a 4-week window to absorb NixOS changes before shipping. The 6-month overlap policy means customers on N-1 still have 5 months of support after the bump.

---

## Fabrick Value

This process directly supports the Fabrick/Adopt tier value proposition:

- **Release briefings** (Adopt tier, $5k/yr) include NixOS compatibility status: "Tested against NixOS X.Y and X.Z"
- **Predictable upgrade path** — customers know exactly when their channel falls below minimum support
- **Zero-surprise policy** — no dashboard release ships without passing against both supported channels

---

## Decisions Log

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| 1 | 2026-03-06 | Run NixOS compat testing on Foundry, not GitHub Actions | Already NixOS, already Forge-managed, no external runner cost |
| 2 | 2026-03-06 | 4-layer testing (eval → integration → microvm compat → fresh install) | Cheapest tests run most often, expensive tests gate releases |
| 3 | 2026-03-06 | 4-week channel bump window | Enough time to fix breakage, short enough to stay current |
| 4 | 2026-03-06 | Include unstable eval as early warning, not gate | Catch breakage early without blocking releases on unstable churn |
