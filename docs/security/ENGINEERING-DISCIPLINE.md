<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Engineering Discipline

**How Weaver's internal CI compares to Enterprise-grade CI practices.**

Weaver ships with engineering discipline you can verify, not just claim. Every commit passes 40 static auditors. Every release passes a pre-flight simulation of downstream build contexts. Every public artifact carries provenance you can audit.

This page describes the *coverage shape* of our CI. The exact list of auditors is kept machine-readable in [`package.json`](../../package.json) (`test:compliance` chain) — readers who want to verify the inventory can do so there. This page communicates what the coverage protects against, not the script-by-script plumbing.

---

## At a glance

| Practice | Enterprise-CI norm (industry baseline) | Weaver internal CI |
|---|---|---|
| Static analyzers per push | 1–2 generic tools (ESLint, tsc) | **40** domain-specific auditors across 4 coverage categories |
| Release-build pre-flight | None (release failures surface in user reports) | **Simulated downstream build contexts** before tag push |
| Compliance framework mapping | Maintained manually, drifts between releases | **Single-source data + generator + parity auditor** across 13 verticals |
| Supply-chain pinning | Latest major tags (`@v4`) | **All GitHub Actions SHA-pinned**, verified on every push |
| Vulnerability scanning | Dependabot PRs only | **npm audit in test:prepush** (every push) + Dependabot |
| OpenSSF Scorecard | Published once, rarely re-checked | **Pre-OpenSSF baseline auditor** catches regressions before the weekly scan |
| Documentation link integrity | Manual | **audit:docs-links** on every push — cross-doc + anchor + snapshot validation |
| E2E test parity | Run ad-hoc before release | **E2E via Docker, audit:e2e-coverage** gap checker on every push |
| Release-pipeline handshake | Trust by convention | **Static auditors verify sender/receiver payload shape** for every dispatch the release produces |

The industry baseline numbers come from the Google Research *Accelerate* engineering-performance studies and the [OpenSSF](https://openssf.org) tier rubric. Weaver's internal CI is benchmarked at an **A** rating in the enterprise engineering-discipline band.

**Third-party attestations:**
- [**CII Best Practices — Passing**](https://www.bestpractices.dev/projects/12592) (earned 2026-04-20, 100% of Passing criteria). Silver and Gold blocked by solo-maintainer structural constraints — see [COMPENSATING-CONTROLS.md § Gap 2](COMPENSATING-CONTROLS.md).
- [**OpenSSF Scorecard**](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free) — weekly public scan.
- **Sigstore-signed releases + SLSA Level 3 provenance** — every release asset carries a Fulcio-issued signature logged to Rekor, plus `actions/attest-build-provenance` attestations. See Release provenance section below.

---

## Coverage categories

Every push exercises the full set — failure anywhere blocks the merge. The 40 auditors group into four coverage categories:

### Source-code discipline

Every file is scanned on every push for license-header compliance, vocabulary drift from retired tier or feature names, tier-gate parity across backend + frontend + TUI, E2E coverage of every validated form, Zod round-trip validation between API and UI, WCAG AA color-contrast ratios, WebSocket close-code alignment with the developer-facing protocol doc, and an OWASP-aligned SAST rulebook that scans for command injection, SQL injection, path traversal, XSS, SSRF, and race conditions. Coverage extends beyond generic lint/type-check because these are product-domain invariants, not language-level defaults.

### Supply-chain & dependency discipline

Lockfile integrity, every transitive dependency's license checked against an allowlist, bundle-size ceilings enforced per tier, NixOS version strings kept consistent across derivations, and a pre-OpenSSF-Scorecard baseline check that validates seven Scorecard concerns locally on every push — so a regression fails the merge instead of waiting for the weekly public scan to surface it. See the Pre-OpenSSF Scorecard baseline section below for the specific checks covered.

### Release & distribution discipline

Every release mechanism that touches the public Free mirror or downstream registries is gated at compile time. Parity checks verify that MASTER-PLAN decisions carry ascending numbers, compliance-framework mappings stay in sync with shipped code, 13 vertical sales documents stay in sync with a single-source data module, license claims match the canonical tier matrix, and attribution reflects actual dependencies. Two auditors added after v1.0.2 harden the release pipeline specifically: one verifies every rsync in the release + sync workflows sources only from the intended subtree (never the whole Dev repo), closing the content-leak class that was caught and contained before public indexing. The other verifies that every repository-dispatch the release produces carries the full payload shape its receiver expects, closing the silent-stale-field class where a receiver tolerates a missing field indefinitely.

### Documentation discipline

Docs claims are cross-checked against code: feature rosters match shipped code, no stale "Planned" entries for features that shipped, cross-document and anchor-level link integrity on every push, deprecated-term migration completeness (one missed rename blocks the push), runbook section completeness, backend source-to-test file parity, eager-evaluation composables caught at compile time, institutional-knowledge manifests (LESSONS-LEARNED, KNOWN-GOTCHAS) kept registered in the code MCP server, and Nix build-hash freshness against the lockfile. Doc drift is a trust problem, not a cosmetic one — public docs are how enterprise prospects calibrate engineering rigor, so they're held to the same compile-time guardrails as code.

### Parity with reality

Each category's coverage claim above is verified by a machine check. The `audit:doc-parity` auditor cross-references every numeric claim on this page (auditor count, vertical count, CII project ID, etc.) against code state. The `audit:engineering-discipline-parity` auditor (this page's own checker) ensures internal consistency — every occurrence of the auditor count throughout this document agrees, and matches the actual `test:compliance` chain in [`package.json`](../../package.json).

---

## Pre-release build simulation

Before a release tag is pushed, `audit:release-builds` simulates every downstream build context that will see the release. Runs during `test:prerelease` — the last gate before tag push.

**Current context: free-tarball.** Simulates the `sync-to-free` flattening (code/ → root, applying sync-exclude.yml), then runs the full `npm ci && npm run build:all` in a sandbox. Catches path-escape bugs, missing-file references, and sync-exclusion errors that would break the Free tarball build — the exact bug class that shipped in v1.0.0 and was fixed by the v1.0.1 refactor.

**Planned contexts:** public-demo (VITE_DEMO_MODE + VITE_DEMO_PUBLIC build), private-demo (VITE_DEMO_MODE build), NUR build sandbox.

---

## Pre-OpenSSF Scorecard baseline

The public OpenSSF Scorecard for Weaver Free is at [scorecard.dev/viewer](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free). Scorecard rescans weekly; between scans, a regression on the badge isn't visible.

To prevent this, `audit:openssf-baseline` runs on every push and validates seven of the Scorecard checks locally (no network). Any regression from the baseline fails the push, so the badge stays green without waiting for the weekly scan.

**Checks covered locally:**
1. Token-Permissions — every workflow YAML declares top-level `permissions:`
2. Pinned-Dependencies — all GitHub Actions `uses:` are SHA-pinned
3. Dependency-Update-Tool — `.github/dependabot.yml` exists
4. Security-Policy — SECURITY.md has email + disclosure URL
5. SAST — CodeQL triggers on push (not just PR/schedule)
6. License — LICENSE file ships with the Free tarball
7. Signed-Releases — release workflow signs every asset with Sigstore cosign keyless AND publishes build-provenance attestations

**Not covered locally (require the actual scan):** Branch-Protection (GitHub Settings API), Fuzzing, Code-Review (historical PR data), Contributors, Maintained, CII-Best-Practices.

---

## Supply-chain pinning

Every GitHub Action referenced in the `.github/workflows/` directory is SHA-pinned to a specific commit — never a floating tag like `@v4`. The pinned-dependencies check (part of `audit:openssf-baseline`) verifies this on every push.

Example:
```yaml
# Correct — SHA-pinned
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4

# Rejected by the auditor
- uses: actions/checkout@v4
```

Why this matters: a supply-chain attacker who compromises a popular Action repository can publish a malicious tag that inherits the old tag name. SHA-pinning eliminates that attack vector for everything referenced in our workflows.

---

## Release provenance

Every release tag triggers:
1. **Keyless Sigstore signing** (via `cosign sign-blob`) — every release asset (tarball, SBOMs) gets a `.sig` + `.pem` published alongside it. Signatures are issued by Sigstore's Fulcio CA against the workflow's GitHub OIDC token and logged to the Rekor transparency log — no long-lived keys, no secrets to rotate.
2. **Build provenance attestation** (via `actions/attest-build-provenance`) — cryptographic proof that a given artifact was built from the stated source commit, signed with Sigstore.
3. **SBOM generation** (via `@cyclonedx/cyclonedx-npm`) — CycloneDX-formatted software bill of materials for frontend + backend, attached to the release and signed.
4. **Source archive sync** to the public Free repo — the tag on Weaver-Free points to the exact source that produced the artifacts.

Two independent verification paths:

```sh
# Verify via Sigstore cosign (signature + Rekor log)
cosign verify-blob \
  --certificate weaver-v1.2.3-pwa.tar.gz.pem \
  --signature  weaver-v1.2.3-pwa.tar.gz.sig \
  --certificate-identity-regexp 'https://github.com/whizbangdevelopers-org/Weaver-Dev/.github/workflows/release.yml@.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  weaver-v1.2.3-pwa.tar.gz

# Verify via GitHub build provenance attestation
gh attestation verify weaver-v1.2.3-pwa.tar.gz --repo whizbangdevelopers-org/Weaver-Free
```

Either path confirms the artifact was built by the declared workflow on the declared commit — no tampering in transit.

---

## Coming next — load testing

The A-rating baseline reflects static analysis, unit, and functional E2E coverage. The next frontier of the CI pipeline is **sustained-load testing**: concurrent-request soak runs against the backend API, WebSocket-channel saturation, and VM provisioning throughput under queue pressure.

**Planned integration.** `audit:load-baseline` runs on a nightly cadence (per-push is too slow to be useful). Baseline numbers are published alongside each release. A p95 latency regression beyond a 10% ceiling fails the next release's pre-flight. Likely toolchain: k6 or autocannon for HTTP, Playwright harness for WebSocket soak, shell harness for the provisioning queue.

**Horizon:** v1.2 (after pricing infrastructure lands).

Why this earns the next rating notch: load testing closes the performance-regression blind spot that static and functional tests cannot catch by construction. A user-visible latency regression is functionally a bug; it should fail in CI, not in a customer report.

---

## What this page is and isn't

**Is:** a statement of our engineering practices with specific, enumerable checks. Every claim here corresponds to an auditor or workflow that runs in public CI. You can verify each one in [github.com/whizbangdevelopers-org/Weaver-Free/actions](https://github.com/whizbangdevelopers-org/Weaver-Free/actions) or by inspecting the `test:compliance` chain in [package.json](../../package.json).

**Isn't:** a compliance certification. SOC 2 Type II, ISO 27001, CMMC assessments are process-maturity audits performed by external assessors. This page tells you what our *engineering discipline* looks like — the technical artifacts that *would* be evaluated in such an audit.

For compliance framework mappings (NIST 800-171, HIPAA, PCI-DSS, ISO 27001, etc.), see the [compliance/ directory](compliance/) — those documents map specific framework controls to Weaver's technical capabilities.

---

## Verify what this page claims

| Claim | How to verify |
|---|---|
| 40 auditors on every push | [.github/workflows/test.yml](../../.github/workflows/test.yml) compliance-suite job, or grep `audit:` in [package.json](../../package.json) `test:compliance` script |
| SHA-pinned GitHub Actions | `grep "uses:" .github/workflows/*.yml` — every line ends with a 40-char SHA |
| OpenSSF Scorecard score | [scorecard.dev/viewer](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free) |
| SBOM present on each release | [github.com/whizbangdevelopers-org/Weaver-Free/releases](https://github.com/whizbangdevelopers-org/Weaver-Free/releases) — `sbom.cdx.json` + `sbom-backend.cdx.json` |
| Free tarball builds from source | `nix-build -A weaver-free` against [nur-packages](https://github.com/whizbangdevelopers-org/nur-packages) |
| Public release provenance | `gh attestation verify <artifact> --repo whizbangdevelopers-org/Weaver-Free` |
| Sigstore cosign signature | `cosign verify-blob` (see Release provenance section for the full invocation) |

Nothing here is aspirational. If you can't verify a claim from the links above, the claim is incorrect — file an issue.
