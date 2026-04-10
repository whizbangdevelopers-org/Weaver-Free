<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Appliance & Trial Strategy — Review Analysis

**Date:** 2026-03-04
**Reviewed document:** [APPLIANCE-TRIAL-STRATEGY.md](APPLIANCE-TRIAL-STRATEGY.md)
**Status:** Open — decisions needed before implementation

---

## Summary

The appliance strategy is research-backed and structurally sound. The 3-layer trial stack (watermark → usage-cap → time-bomb) is correctly ordered with usage-cap as the primary conversion driver. However, the doc was written 2026-02-25, before several architectural decisions that create gaps.

---

## Findings

### 1. Trial Tier vs Extension Model Tension (Decision Required)

**Issue:** Decision #22 (2026-03-03) established that all future feature domains use the plugin model with `requirePlugin()` middleware at v1.1.0. The trial strategy defines trial as "all premium features unlocked" — but post-v1.1, premium features include purchasable plugins (DNS, Firewall, etc.).

**Unresolved questions:**
- Does a trial user get all extensions unlocked, or just core premium?
- If extensions are à la carte at tier minimums, what does the trial actually include?

**Options:**
- **Trial = all extensions unlocked** — Maximum "wow" factor. User sees everything. Risk: sets expectation that premium includes all extensions (it doesn't — they're purchased separately).
- **Trial = core premium only** — Accurate representation of what Weaver costs. User sees the upgrade path honestly. Risk: less impressive first impression, user might not discover extension value.
- **Trial = core premium + one showcase extension (DNS)** — Middle ground. Demonstrates the extension system without implying all extensions are included.

**Recommendation:** All extensions unlocked. The trial's job is conversion, not accuracy. A watermark already signals "this is temporary." After conversion, the user discovers extension pricing naturally. The 73% conversion lift from usage-caps means the user has already invested effort when they hit the wall — at that point, extension pricing is a minor objection compared to losing their work.

### 2. No Version Target for Appliance VM

**Issue:** The Docker image has a clear target (v1.0.0). The appliance VM says "post-v1.0" with no specific release.

**Impact:** Without a version target:
- No release gate criteria defined
- No agent definition or task breakdown
- Can't coordinate with container visibility (v1.1) or the closer release (v1.2)
- Build infrastructure (`nixos-generators`, OVA pipeline) has no deadline

**Recommendation:** v1.1.0. The appliance VM's purpose is showing real provisioning — containers arriving in v1.1 make the appliance significantly more impressive (real VMs + real Apptainer containers). Shipping the appliance with v1.0 would mean updating it immediately for v1.1 anyway.

### 3. Container Story Missing

**Issue:** The doc was written before the container strategy was finalized (Decision #7, 2026-02-13). Neither the Docker image nor the appliance VM description accounts for container runtimes.

**Gaps:**
- Docker image: says users see "mock VMs" — but post-v1.1, the product also manages containers. Should mock data include container cards?
- Appliance VM: doesn't mention pre-installing Apptainer. If someone downloads the appliance after v1.1, should they see container visibility working out of the box?

**Recommendation:** Update both descriptions:
- Docker image: add mock container data to demo mode (Apptainer instances + Docker containers with runtime badges)
- Appliance VM: pre-install Apptainer, include 1-2 sample SIF containers alongside CirOS VMs. This is the "single pane of glass" pitch in action.

### 4. "60 Seconds" Claim vs Appliance Reality

**Issue:** The problem statement says "Let anyone on any OS experience the full product in under 60 seconds."

**Reality by distribution option:**
- **Docker image:** Yes, 60 seconds. `docker run` → browser → dashboard. Delivers on the promise.
- **Appliance VM:** Download 800MB → import into VirtualBox/VMware/QEMU → boot → wait for NixOS init (~30-60s) → navigate to URL. Realistically 5-10 minutes for someone who knows what they're doing, longer for someone unfamiliar with VM imports.
- **Nix flake:** `nix run` → build from source → several minutes minimum.

**Impact:** The "60 seconds" framing is accurate for Docker but oversells the appliance path. Marketing copy based on this doc would set incorrect expectations.

**Recommendation:** Reframe: Docker = "60 seconds to dashboard" (quick look). Appliance = "10 minutes to real provisioning" (full experience). Each path has a distinct value proposition — don't conflate them under a single time claim.

### 5. No Pricing/Distribution Gate Mentioned

**Issue:** The trial is free, but the doc doesn't specify the acquisition flow:
- Is the appliance OVA publicly downloadable from the GitHub Release?
- Does downloading require an email gate? (email capture for sales pipeline)
- Is the trial auto-activated on first boot, or does the user enter a trial key?

**Impact:** This affects:
- GitHub Release workflow (public asset vs gated download)
- License key infrastructure (does trial need a key, or is it keyless?)
- Sales pipeline (can you track who's trialing?)

**Recommendation:** Decide based on conversion funnel goals. The doc's own research shows frictionless trials convert better. But zero-gate means zero lead capture. A lightweight email gate (GitHub OAuth or simple form) provides lead data without significant friction. The `trialExpiry` ISO date in the license already implies a key — so the trial key generation flow needs design.

### 6. Tier Order Gap

**Issue:** The doc defines `TIER_ORDER: demo < free < trial < premium < enterprise`. This means:
- `requireTier(config, 'premium')` passes for trial — correct, that's the point.
- But `requireTier(config, 'trial')` would also pass for weaver and fabrick — is that intentional?
- What about `requirePlugin()` checks? The plugin middleware (Decision #22) is separate from tier checks. Trial tier might pass `requireTier('premium')` but fail `requirePlugin('firewall')` unless plugins are explicitly unlocked for trial.

**Impact:** The tier ordering is correct for the pre-plugin world. Post-v1.1 with `requirePlugin()`, the interaction between `requireTier()` and `requirePlugin()` for trial users needs explicit design.

**Recommendation:** Define trial extension behavior in code architecture:
```
trial tier:
  requireTier('weaver') → PASS (trial >= weaver)
  requirePlugin('dns')   → PASS if trial_includes_all_plugins
                         → FAIL if trial_is_core_only
```
This is a code architecture decision, not just a business decision — it affects middleware implementation.

---

## Action Items

All tracked in [USER-ACTION-ITEMS.md](../USER-ACTION-ITEMS.md) § Decisions Needed:
1. Define trial extension scope (Finding #1)
2. Assign appliance VM to a release version (Finding #2)
3. Design mock container data for demo mode (Finding #3)

Additional items to add when the above are resolved:
4. Update appliance strategy doc with container runtime inclusions (Finding #3)
5. Reframe time-to-value claims per distribution option (Finding #4)
6. Design trial acquisition flow — email gate vs public download (Finding #5)
7. Define `requirePlugin()` behavior for trial tier in code architecture (Finding #6)

---

*Cross-reference: [APPLIANCE-TRIAL-STRATEGY.md](APPLIANCE-TRIAL-STRATEGY.md) | [USER-ACTION-ITEMS.md](../USER-ACTION-ITEMS.md) | [MASTER-PLAN.md](../../../MASTER-PLAN.md)*
