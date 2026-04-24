<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Compensating Controls

This is the honest-gaps companion to [ENGINEERING-DISCIPLINE.md](ENGINEERING-DISCIPLINE.md). That document enumerates what we *do*; this one enumerates where we *don't* satisfy a control structurally, what we use instead, and when the gap closes.

"Compensating control" is formal NIST 800-53 / PCI DSS / ISO 27001 language. When a prescribed control cannot be met directly, a compensating control provides an equivalent or greater level of defense for the same underlying risk. The test is not whether the control label matches — it is whether the risk is mitigated.

We publish this document for the same reason we publish ENGINEERING-DISCIPLINE.md: mature compliance buyers expect gaps and respect honest treatment of them far more than glossy claims.

## How to use this document

If an OpenSSF Scorecard check, a CII Best Practices question, a SOC 2 control, or an RFP line item flags Weaver on a specific gap, search this document for the gap by name. Each section lists: (1) why we fall short of the prescribed control, (2) the compensating controls we use instead, (3) the maturity path that closes the gap. If your interpretation of the framework still does not accept the compensation we describe, see the [Contracted human review for regulated buyers](#contracted-human-review-for-regulated-buyers) section at the bottom.

---

## Gap 1 — Code Review (OpenSSF Scorecard 0/10)

**Why we fall short.** Weaver is currently a solo-maintainer project. OpenSSF Scorecard's Code-Review check wants to see that every merge to the default branch has at least one approval from a reviewer other than the author. With one human maintainer, that signal is unobtainable by construction — any self-review-via-second-account pattern is explicitly detected and rejected by Scorecard, and we have no interest in gaming the metric.

**Compensating controls.**

1. **AI code review on every change.** Claude (via Claude Code) reviews every non-trivial diff before commit. AI review reliably catches: type errors, common-vulnerability patterns (command injection, path traversal, unsafe deserialization, hardcoded secrets, SSRF, SQL/NoSQL injection), dead-code drift, API/documentation parity gaps, test coverage gaps for new branches, and obvious logic flaws. It also catches *domain-specific* issues that a generic AI PR-reviewer would not flag — tier-gating violations, compliance-document drift, WebSocket message-shape mismatches, and license-matrix inconsistencies — because the review is calibrated to this codebase's conventions, not run from defaults. Reviews complete in seconds, are not subject to fatigue or social friendship pressure, and produce a reviewable log.
2. **33 static auditors on every push** — see [ENGINEERING-DISCIPLINE.md § Static auditors](ENGINEERING-DISCIPLINE.md). Tier parity, compliance-framework parity, test coverage, documentation parity, excluded-import detection, eager-eval TDZ detection, and more. Each auditor catches a specific bug class that escaped a prior release.
3. **SHA-pinned dependencies** — every `uses:` in a GitHub Actions workflow is pinned to a 40-character commit SHA, not a tag or branch. A supply-chain attacker who compromises a popular Action cannot publish a malicious version that inherits the old name.
4. **Dependabot weekly with reviewed merges** — dependency updates are proposed by Dependabot, validated by the full CI suite, and merged by the maintainer. No update lands without passing the same 33 auditors every other change passes.
5. **Sigstore keyless signing on every release** — release artifacts and SBOMs are signed via `cosign sign-blob` with GitHub OIDC + Fulcio + Rekor transparency log. An attacker who pushes a compromised commit cannot produce a matching Sigstore signature.
6. **24-hour cool-off on security-sensitive changes.** Changes to authentication, authorization, cryptography, or privileged system calls sit on a feature branch for at least 24 hours before merging, giving the maintainer a second sitting to re-review with fresh eyes.
7. **Public weekly OpenSSF Scorecard scan.** The posture is re-scored every Monday by a third party (OpenSSF). A regression is publicly visible on the badge — external accountability the maintainer cannot suppress.
8. **Complete git history as audit trail.** Every commit is signed, reviewable, and permanent. Unlike many regulated environments where reviewers approve verbally in meetings, every decision here is in a searchable transcript.

**What AI review does not substitute for.** We say this plainly so buyers can decide. AI review is strong on pattern-recognition but less strong on: novel attack classes a human researcher might notice, domain-specific correctness in unfamiliar sub-systems, and frameworks that explicitly require *human* sign-off on change approval (SOC 2 CC8.1 under strict interpretation, PCI DSS 6.3.2, NIST 800-171 §3.12 when interpreted as requiring named human personnel). For buyers in those categories, see [Contracted human review](#contracted-human-review-for-regulated-buyers) at the bottom of this document.

**Maturity path.** AI review remains the permanent first-layer control. Named human co-maintainers and/or contracted external reviewers join as an additional layer by v2.0 — not to replace AI, but to satisfy buyers whose frameworks require explicit human sign-off. This is a complement to AI review, not a promotion away from it.

---

## Gap 2 — CII Best Practices Silver / Gold Badge

**Why we fall short.** The Silver and Gold tiers of the Core Infrastructure Initiative Best Practices badge require a `two_person_review` criterion that is the same structural dependency as Gap 1. A solo maintainer cannot satisfy it.

**Compensating controls.** The same eight controls enumerated under Gap 1 apply. Additionally, Weaver **earned the CII Best Practices *Passing* badge on 2026-04-20** (100% of Passing-level criteria satisfied; project ID 12592 at [bestpractices.dev](https://www.bestpractices.dev/projects/12592)). Silver and Gold remain structurally blocked by the same two-person-review gap as Gap 1.

**Maturity path.** Silver and Gold pursued in lockstep with Gap 1's co-maintainer / contracted-reviewer landing by v2.0.

---

## Gap 3 — Separation of Duties (solo repo operator)

**Why we fall short.** Separation-of-duties controls (NIST 800-53 AC-5, SOC 2 CC6.1, PCI 7.1.2) prescribe that no single individual can perform all steps of a sensitive operation — for example, the same person should not both commit code and approve its deployment to production. With one maintainer, strict SoD is not achievable for the Dev repository.

**Compensating controls.**

1. **Infrastructure-as-code with full audit trail.** Every configuration change — workflows, permissions, branch protection, deployment rules — is committed to git. There is no action that happens outside the auditable record.
2. **Branch protection on `main` of Weaver-Free** — no force pushes, no deletions, linear history enforced, signed commits required, full CI must pass.
3. **Release-publish approval gate.** The release workflow has a manual approval step (`environment: release-publish`) before the draft GitHub Release becomes public. While the approver is currently the same maintainer, the gate enforces a forced re-review step between build and publish — artifacts are test-installed before approval.
4. **Reproducible builds.** Nix package builds are byte-reproducible. An auditor can rebuild any past release from source and compare to the published artifact bit-for-bit. Deviation is provable.
5. **Signed releases via Sigstore keyless** — the GitHub OIDC token, not a long-lived maintainer-held key, signs artifacts. A maintainer who loses account control cannot retroactively re-sign compromised builds.
6. **Two-person rule *inside the product itself*.** The product that Weaver ships *enforces* a two-person rule for privileged customer operations — specifically for binary-drop custom software ingestion (Decision #149, Shed Builder Lane 1 at Team tier and above). Our customers get separation of duties out-of-the-box; we eat that in our product's own dogfooding tier when the company scales.

**Maturity path.** Separation-of-duties at the repository operator level is a function of organizational size. Co-maintainer arrival (by v2.0) establishes separation between "who can merge" and "who can approve release." At Fabrick-tier commercial scale, repository operations move behind a named releases-operator role distinct from engineering.

---

## Gap 4 — Bus Factor / Access Continuity

**Why we fall short.** Bus factor is the minimum number of project members that have to suddenly disappear before the project cannot continue. Current posture:

- **Bus factor (access):** 2 — both the primary maintainer (Mark Wriver, GitHub: wriver4) and the secondary admin (Yuri Jacuk) hold independent repo admin and can execute releases, manage issues, and merge PRs.
- **Bus factor (active knowledge):** 1 until June 2026 — the secondary admin is dormant until then. If the primary maintainer disappeared today, active maintenance would stall pending secondary-admin onboarding. From June 2026 onward, active-knowledge bus factor becomes 2 as the secondary admin enters the shared-maintainer model.

**Compensating controls.**

1. **Secondary admin with independent access.** Yuri Jacuk holds repo admin rights today. Releases, issue triage, PR merges, and security actions can be executed by the secondary admin without primary-maintainer involvement. Active maintenance duties shift to shared model June 2026.
2. **Business entity is formed.** WhizBang Developers LLC is an incorporated entity with a bank account. If both admins were unavailable simultaneously, the entity persists and has legal standing to act — project assets belong to the entity, not to an individual.
3. **Operating agreement with IP assignment.** Attorney-drafted operating agreement covers ownership, IP assignment, buyout provisions, and voting. Covers succession scenarios.
4. **Encrypted offline backup of credentials.** GitHub account recovery codes, signing keys (for non-Sigstore-keyless uses), LLC formation documents, and deployment credentials are in an encrypted offline backup at a second physical location. Restore procedure is documented. Backup is accessible by both admins — not tied to a single person's device.
5. **Sigstore keyless signing minimizes key-loss risk.** Because release signing uses short-lived OIDC-issued certificates rather than a long-lived maintainer-held key, there is no signing key to lose that would prevent future releases. Either admin can execute a signed release.
6. **Infrastructure-as-code on public GitHub.** The entire state of the Dev repository — workflows, configurations, documentation, tests — is public on Weaver-Free for every released version. A new maintainer (including the secondary admin during onboarding) can pick up where the prior one left off without needing access to private knowledge.
7. **NUR and Nix reproducibility.** Past releases can be rebuilt from public source indefinitely. The Weaver-Free mirror and NUR Nix expression are sufficient to reproduce any shipped version.

**Maturity path.** Active-knowledge bus factor = 2 from June 2026 when the secondary admin enters the shared-maintainer model. At Fabrick-tier commercial scale, the project is staffed by a named team with documented on-call rotation and cross-training. Between now and June 2026, a written handoff runbook (covering both repo operations AND CII badge ownership transfer) should be drafted so the secondary admin can execute without delay if called up early.

---

## Gap 5 — 24×7 Incident Response Rotation

**Why we fall short.** SOC 2 CC7.3 and similar controls prescribe timely incident detection and response, which at enterprise scale typically implies a rotating on-call roster. A solo maintainer has no rotation.

**Compensating controls.**

1. **GitHub Private Vulnerability Reporting enabled** on Weaver-Free. Reports route to the maintainer directly with end-to-end encryption.
2. **Published security contact and commitment** in SECURITY.md at the repo root: `security@whizbangdevelopers.com`, 7-day acknowledgment SLA, 90-day fix-and-disclose target (30 days for critical/high).
3. **Automated monitoring.** GitHub Advanced Security (CodeQL) runs on every push and on weekly schedule. Dependabot raises PRs for vulnerable dependencies. Scorecard scans weekly. Automated detection catches a large class of issue without requiring a human on-call.
4. **Public transparency log.** CHANGELOG.md documents every security-relevant change with a `### Security` subsection when applicable. Customers can trace what changed and why.
5. **Founding Member program limits concurrent customer commitments.** The FM program has a capped member count (currently 5 seats) — concurrent enterprise support load is bounded to what one maintainer can realistically handle without degradation.

**Maturity path.** 24×7 on-call rotation becomes viable at Fabrick-tier commercial scale with paid support staff. Before that, Founding Member contracts explicitly scope response commitments to business hours with documented escalation procedures.

---

## Gap 6 — External Penetration Testing Cadence

**Why we fall short.** Many compliance frameworks (PCI DSS 11.3, HIPAA §164.308(a)(8), SOC 2 CC4.1) expect periodic external penetration testing by an independent party. Weaver does not yet have a recurring external pen-test contract on an annual cadence.

**Compensating controls.**

1. **Internal red-team audit performed pre-release** with dispositions tracked in `business/legal/SECURITY-AUDIT.md`. Summarized publicly in ENGINEERING-DISCIPLINE.md.
2. **Automated SAST on every push** via CodeQL security-and-quality query suite.
3. **Automated dynamic analysis** via Playwright E2E exercising real auth flows against a live backend, plus `npm audit` on every push against both root and backend workspaces.
4. **SBOM and signed releases** enable any third party — customer, auditor, or security researcher — to independently verify artifact provenance.
5. **Bounty-style disclosure culture.** GitHub Private Vulnerability Reporting is enabled; security researchers have a clear low-friction channel to report findings.

**Maturity path.** External pen-test engaged on annual cadence starting at Team-tier revenue threshold (pre-v2.0 estimated). Founding Member customers with contractual requirements for external pen-testing can commission one against their deployment; we will publicly disclose any material findings within the 90-day window.

---

## Gap 7 — Fuzzing Coverage

**Why we fall short.** OpenSSF Scorecard's Fuzzing check wants coverage via OSS-Fuzz, libFuzzer, go-fuzz, or similar. Weaver does not currently run fuzzing campaigns.

**Compensating controls.**

1. **Zod schema validation at every API boundary.** All request bodies, path parameters, and query strings are validated against strict Zod schemas. Malformed or unexpected input is rejected before any handler logic executes.
2. **Command-injection defense by construction.** All system commands use `execFileAsync` with argument arrays — never `shell: true`, never string concatenation. User-supplied names are validated against strict regex (`^[a-z][a-z0-9-]*$`) before any filesystem or system-call construction.
3. **Memory safety by platform.** Node.js and V8 are memory-safe by construction; Weaver has no first-party C/C++ code under authorship. The memory-corruption bug classes fuzzing is most effective against are largely inapplicable.
4. **Property-based test coverage via Vitest** for parsers, validators, and other input-handling paths where exhaustive input enumeration adds value.

**Maturity path.** Targeted fuzzing of the provisioning argument-generation path (which builds QEMU invocations and cloud-init data from user input) added as a post-v2.0 work item. Full OSS-Fuzz integration considered post-Fabrick-tier once a broader surface of C-language dependencies is in play.

---

## Contracted human review for regulated buyers

Some buyers operate under compliance interpretations that require *named human reviewer approval* on change management, and the compensating controls above do not satisfy their framework as written. This is not a gap in Weaver; it is a gap in what Weaver Free (AGPL-3.0 community tier) offers by default.

**For those buyers, a contracted external human reviewer can be provisioned as a Fabrick-tier bolt-on.** Named SecOps contractor reviews security-sensitive changes (defined in scope by the customer's framework — typically authentication, authorization, cryptography, privileged system calls, and data-handling paths) with documented sign-off before those changes enter the customer's deployed version. Review artifacts are retained and delivered on audit request.

This turns a structural limitation into a contractually-addressable compliance assurance for customers whose framework interpretation demands it. Details in `business/legal/CONTRACTED-REVIEW-OFFERING.md` (Dev-only; Fabrick-tier sales touchpoint).

---

## Revisit cadence

This document is reviewed at every major version release and whenever a compensating control changes. Last review: 2026-04-18 (concurrent with v1.0.1 patch release). Next scheduled review: v1.1.0 release.

If you are a customer, auditor, or researcher who believes a gap listed here is inadequately compensated for your use case, open a GitHub Discussion on [Weaver-Free](https://github.com/whizbangdevelopers-org/Weaver-Free/discussions) or contact `security@whizbangdevelopers.com`.
