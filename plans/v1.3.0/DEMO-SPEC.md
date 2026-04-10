<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Demo Spec — v1.3.0 (Remote Access + Mobile)

**Status:** Spec Only — Not Yet Built
**Target:** v1.3.0
**Created:** 2026-03-25
**Related:** [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md)

---

## Overview

The v1.3.0 private demo mocks the networking wizard flow and the mobile app experience. The wizard cannot actually run `nixos-rebuild switch` in the demo — it simulates the full flow through config generation, rebuild instructions, and a "rebuild complete, tunnel active" confirmation screen. A phone frame then shows the mobile app connected via the appropriate tunnel type for the active tier.

---

## Wizard Mock Flow

All wizard steps are simulated. No NixOS config is applied. The flow is:

1. **Wizard launch** — user opens the networking wizard from Settings or Welcome screen
2. **Config generation** — wizard displays the generated `configuration.nix` fragment with syntax highlighting
3. **Rebuild instructions** — step-by-step instructions shown: copy config, run `nixos-rebuild switch`
4. **Simulated rebuild** — progress indicator plays out, ends with "Rebuild complete. Tunnel active."
5. **Confirmation screen** — tunnel type and connection details shown

The Replay button (demo toolbar) replays steps 1–5 without touching VM data or tier state.

---

## Phone Frame Mock

After the wizard completes (or when the demo is already in a post-wizard state), the phone frame renders the mobile app connected screen.

| Tier | Phone Frame Label |
|------|-------------------|
| Free | `Connected via Tailscale · 10.10.0.x` |
| Weaver | `Connected via WireGuard` |
| Fabrick | `Connected via WireGuard` |

---

## Welcome Screen — Per-Tier Sequences

The Welcome screen and its associated Replay sequence vary by tier. Each tier presents a different wizard + onboarding flow.

### Free

1. Tailscale wizard (config generation → simulated rebuild → tunnel active)
2. Play Store QR code for Android app download

### Weaver

1. WireGuard wizard (config generation → simulated rebuild → tunnel active)
2. Push notification opt-in prompt
3. Biometric auth setup screen
4. App download (Play Store / App Store)

### Fabrick

1. WireGuard wizard (config generation → simulated rebuild → tunnel active)
2. Fleet / multi-user config screen (Fabrick-specific: assign wizard output to multiple hosts)
3. Push routing rules setup (which hosts send alerts to which users)
4. App download (Play Store / App Store)

---

## Replay Button Behavior

The demo toolbar Replay button replays the wizard UI walkthrough only:

- Replays: wizard steps, config generation animation, simulated rebuild, confirmation screen, phone frame connection state
- Does NOT reset: VM data, tier mock state, version switcher position

This allows a presenter to re-run the wizard demo mid-session without disrupting the rest of the demo state.

---

## Notes

- Local network access works without the wizard — the wizard is only required for remote access from outside the LAN. The demo should reflect this: the dashboard is accessible without wizard completion; the phone frame "Connected" state requires it.
- The wizard generates a NixOS config fragment; the user applies it once via `nixos-rebuild switch`. No recurring operations. The demo's simulated rebuild reinforces this — one step, done forever.
