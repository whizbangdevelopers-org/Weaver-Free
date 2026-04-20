<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Engineering Discipline

**How Weaver's internal CI compares to Enterprise-grade CI practices.**

Weaver ships with engineering discipline you can verify, not just claim. Every commit passes 32 static auditors. Every release passes a pre-flight simulation of downstream build contexts. Every public artifact carries provenance you can audit.

This page documents the specific checks, what they cover, and how to compare them against your current Enterprise CI baseline.

---

## At a glance

| Practice | Enterprise-CI norm (industry baseline) | Weaver internal CI |
|---|---|---|
| Static analyzers per push | 1–2 generic tools (ESLint, tsc) | **35** domain-specific auditors |
| Release-build pre-flight | None (release failures surface in user reports) | **Simulated downstream build contexts** before tag push |
| Compliance framework mapping | Maintained manually, drifts between releases | **Single-source data + generator + parity auditor** across 13 verticals |
| Supply-chain pinning | Latest major tags (`@v4`) | **All GitHub Actions SHA-pinned**, verified on every push |
| Vulnerability scanning | Dependabot PRs only | **npm audit in test:prepush** (every push) + Dependabot |
| OpenSSF Scorecard | Published once, rarely re-checked | **Pre-OpenSSF baseline auditor** catches regressions before the weekly scan |
| Documentation link integrity | Manual | **audit:docs-links** on every push — cross-doc + anchor + snapshot validation |
| E2E test parity | Run ad-hoc before release | **E2E via Docker, audit:e2e-coverage** gap checker on every push |

The industry baseline numbers come from the Google Research *Accelerate* engineering-performance studies and the [OpenSSF](https://openssf.org) tier rubric. Weaver's internal CI is benchmarked at an **A** rating in the enterprise engineering-discipline band.

**Third-party attestations:**
- [**CII Best Practices — Passing**](https://www.bestpractices.dev/projects/12592) (earned 2026-04-20, 100% of Passing criteria). Silver and Gold blocked by solo-maintainer structural constraints — see [COMPENSATING-CONTROLS.md § Gap 2](COMPENSATING-CONTROLS.md).
- [**OpenSSF Scorecard**](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free) — weekly public scan.
- **Sigstore-signed releases + SLSA Level 3 provenance** — every release asset carries a Fulcio-issued signature logged to Rekor, plus `actions/attest-build-provenance` attestations. See Release provenance section below.

---

## The 35 compliance auditors

Each auditor runs in the `test:compliance` chain on every push. Failures block the push. They live in `code/scripts/verify-*.ts` and `code/scripts/audit-*.ts`.

### Source-code discipline

- **verify-vocabulary-sync** — string-literal vocabulary drift (renamed tiers, retired terms)
- **verify-form-rules** — Zod validation parity between API and UI forms
- **verify-route-auth** — every backend route declares `requireTier` / `requireAuth`
- **verify-form-e2e-coverage** — every validated form has matching E2E test coverage
- **verify-e2e-selectors** — E2E selectors resolve to actual DOM elements
- **verify-legal-ip** — license headers on every code file, AI-training restriction language
- **verify-tier-parity** — backend tier gates match frontend guards match tier-matrix.json
- **verify-tui-parity** — TUI features match web UI features by tier
- **verify-cli-args** — npm scripts correctly pass args through the shell layers
- **verify-contrast** — WCAG AA contrast ratios on every color pair
- **verify-ws-codes** — WebSocket close codes match DEVELOPER-GUIDE table
- **audit-sast** — OWASP Top 10 pattern scan on every file

### Supply-chain & dependency discipline

- **verify-lockfile** — `package-lock.json` integrity, no unexpected dep hoisting
- **audit-licenses** — every transitive dep's license is on the allowlist
- **check-bundle-size** — bundle doesn't grow beyond defined ceiling per tier
- **verify-nixos-version** — NixOS version string consistent across derivations
- **verify-openssf-baseline** *(new, this release)* — pre-flight check for 7 OpenSSF Scorecard concerns

### Release & distribution discipline

- **verify-excluded-imports** *(new, this release)* — no unguarded imports of sync-excluded paths (prevents Free tarball build failures)
- **verify-demo-parity** — public demo content matches production Dev content
- **verify-demo-guards** — demo-mode code paths don't leak into production builds
- **verify-decision-parity** — MASTER-PLAN decisions have ascending numbers; no gaps
- **verify-compliance-parity** — compliance framework docs match shipped code
- **verify-compliance-matrix-parity** — 13 vertical sales docs stay in sync with single-source data module
- **verify-attribution-parity** — open-source attribution list reflects actual deps
- **verify-compatibility-sync** — browser/platform compatibility table matches tested set
- **verify-license-parity** — tier license claims match license-matrix.json

### Documentation discipline

- **verify-doc-parity** — docs claims (features, tiers, auditor count) match actual code state
- **verify-doc-freshness** — no stale "Planned" entries for shipped features
- **verify-docs-links** — cross-doc links, anchors, and snapshot completeness
- **verify-project-parity** — deprecated term migration (one renamed term caught = push blocked)
- **verify-runbooks** — runbook and policy docs have required sections
- **verify-test-coverage** — every backend source file has a matching test file
- **verify-eager-eval-tdz** — composables that eagerly evaluate getters (useMeta, watchEffect) catch TDZ at compile time
- **verify-mcp-coverage** — institutional-knowledge sources (`.claude/rules/`, `docs/development/LESSONS-LEARNED.md`, `KNOWN-GOTCHAS.md`) stay acknowledged in the development-tooling coverage manifest; enforces the reader pattern on all MCP tool files so source docs remain single source of truth
- **verify-nix-deps-hash** — `nixos/package.nix` npmDepsHash stays in sync with `package-lock.json`; catches the "Dependabot bumped lockfile, Nix hash not refreshed" failure mode that breaks every Nix-built install

---

## Pre-release build simulation

Before a release tag is pushed, `audit:release-builds` simulates every downstream build context that will see the release. Runs during `test:prerelease` — the last gate before tag push.

**Current context: free-tarball.** Simulates the `sync-to-free` flattening (code/ → root, applying sync-exclude.yml), then runs the full `npm ci && npm run build:all` in a sandbox. Catches path-escape bugs, missing-file references, and sync-exclusion errors that would break the Free tarball build — the exact bug class that shipped in v1.0.0 and was fixed by the v1.0.1 refactor.

**Planned contexts:** docker (Dockerfile build from flattened layout), public-demo (VITE_DEMO_MODE + VITE_DEMO_PUBLIC build), private-demo (VITE_DEMO_MODE build).

---

## Pre-OpenSSF Scorecard baseline

The public OpenSSF Scorecard for Weaver Free is at [scorecard.dev/viewer](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free). Scorecard rescans weekly; between scans, a regression on the badge isn't visible.

To prevent this, `audit:openssf-baseline` runs on every push and validates 7 of the Scorecard checks locally (no network). Any regression from the baseline fails the push, so the badge stays green without waiting for the weekly scan.

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

Every GitHub Action referenced in the `.github/workflows/` directory is SHA-pinned to a specific commit — never a floating tag like `@v4`. The `audit:pinned-dependencies` check (part of `audit:openssf-baseline`) verifies this on every push.

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

**Is:** a statement of our engineering practices with specific, enumerable checks. Every claim here corresponds to an auditor or workflow that runs in public CI. You can verify each one in [github.com/whizbangdevelopers-org/Weaver-Free/actions](https://github.com/whizbangdevelopers-org/Weaver-Free/actions).

**Isn't:** a compliance certification. SOC 2 Type II, ISO 27001, CMMC assessments are process-maturity audits performed by external assessors. This page tells you what our *engineering discipline* looks like — the technical artifacts that *would* be evaluated in such an audit.

For compliance framework mappings (NIST 800-171, HIPAA, PCI-DSS, ISO 27001, etc.), see the [compliance/ directory](compliance/) — those documents map specific framework controls to Weaver's technical capabilities.

---

## Verify what this page claims

| Claim | How to verify |
|---|---|
| 35 auditors on every push | [.github/workflows/test.yml](../../.github/workflows/test.yml) compliance-suite job |
| SHA-pinned GitHub Actions | `grep "uses:" .github/workflows/*.yml` — every line ends with a 40-char SHA |
| OpenSSF Scorecard score | [scorecard.dev/viewer](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free) |
| SBOM present on each release | [github.com/whizbangdevelopers-org/Weaver-Free/releases](https://github.com/whizbangdevelopers-org/Weaver-Free/releases) — `sbom.cdx.json` + `sbom-backend.cdx.json` |
| Free tarball builds from source | `nix-build -A weaver-free` against [nur-packages](https://github.com/whizbangdevelopers-org/nur-packages) |
| Public release provenance | `gh attestation verify <artifact> --repo whizbangdevelopers-org/Weaver-Free` |
| Sigstore cosign signature | `cosign verify-blob` (see Release provenance section for the full invocation) |

Nothing here is aspirational. If you can't verify a claim from the links above, the claim is incorrect — file an issue.
