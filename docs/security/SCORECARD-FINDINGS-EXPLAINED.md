<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# OpenSSF Scorecard Findings Explained

The **Security** tab on [Weaver-Free's GitHub repository](https://github.com/whizbangdevelopers-org/Weaver-Free/security/code-scanning) shows results from two code-scanning tools: CodeQL (language-level security analysis) and OpenSSF Scorecard (supply chain and process posture). These are distinct — and the Scorecard results are often misread by first-time visitors.

## What the "errors" actually are

Scorecard publishes its findings as SARIF files to GitHub's Code Scanning feature. GitHub renders them in the Security tab alongside CodeQL results. Because both tools use the same UI, it looks like Scorecard is reporting code bugs — it isn't.

**Scorecard findings are process-posture grades, not code defects.** Each finding describes a supply-chain or development-process dimension that has room to improve. A "high severity" Scorecard finding does not mean there is a vulnerability in Weaver's code.

## Current Scorecard findings and what they mean

The findings marked as "errors" in the Security tab are:

| Finding ID | What it measures | Our current state |
|---|---|---|
| **Code-ReviewID** | Percentage of commits reviewed before merge | Solo maintainer workflow — commits land directly on `main`. No peer review because there is no second maintainer to review. |
| **FuzzingID** | Whether the project integrates with a fuzzing infrastructure (OSS-Fuzz, ClusterFuzz, etc.) | Weaver does not currently have a fuzzing harness. This is a CII Silver posture gap. |
| **MaintainedID** | Recent commit activity and issue/PR response time | Weaver is actively maintained. Scorecard's heuristic looks at commit frequency and sometimes scores conservative; this does not reflect the actual maintenance status. |
| **SASTID** | Static analysis tool coverage and push integration | Weaver runs 48 static auditors on every push plus CodeQL. Scorecard's SAST check specifically looks for known tool integrations (CodeQL, Semgrep, Sonar); it may score below max when it doesn't recognize Weaver's custom audit toolchain. |
| **VulnerabilitiesID** | Known vulnerabilities in dependencies via OSV | This reflects the dependency vulnerability posture at scan time. Scorecard scans weekly; transient low-severity advisories in dev dependencies may appear here until patched or triaged. |

## Why does the score say "X out of 10"?

Scorecard's numeric score (visible in the badge and the [viewer](https://scorecard.dev/viewer/?uri=github.com/whizbangdevelopers-org/Weaver-Free)) aggregates all checks. The checks where Weaver scores high (Token-Permissions, Branch-Protection, Pinned-Dependencies, Signed-Releases, Dependency-Update-Tool, License, CI-Tests, Binary-Artifacts) outweigh the gaps above.

The gaps are real posture items we are working to close, not signs that Weaver is insecure.

## What we are doing about the gaps

| Gap | Roadmap |
|---|---|
| **Code-Review** | Addressed structurally when the team grows beyond solo maintainer. First external committer triggers a formal PR-required policy. |
| **Fuzzing** | Planned for a future release. Weaver's primary attack surface is its Fastify REST API and NixOS system calls — both are candidates for targeted fuzzing. See [CII Best Practices answers](CII-BEST-PRACTICES-ANSWERS.md) for the formal posture statement. |
| **Maintained** | No action needed — this is a heuristic false signal. Weaver ships regular releases. |
| **SAST** | Weaver's 48-auditor suite covers the pattern-level classes that recognized SAST tools catch, plus Weaver-specific invariants (tier parity, license parity, doc parity). CodeQL runs on every push and PR. Scorecard's SAST check may not fully recognize this toolchain yet. |
| **Vulnerabilities** | `npm audit` runs on every push (gated in `test:prepush`). Known transient advisories in dev dependencies are triaged in [SECURITY-AUDIT-LATEST.md](SECURITY-AUDIT-LATEST.md). |

## Where to verify Weaver's actual security posture

If you want to understand Weaver's security posture rather than its Scorecard score:

- **[ENGINEERING-DISCIPLINE.md](ENGINEERING-DISCIPLINE.md)** — verifiable engineering practices: auditor inventory, CI pipeline, signing, provenance
- **[SECURITY-BASELINES.md](SECURITY-BASELINES.md)** — NIST 800-63B and OWASP ASVS 4.0 hardening baselines for authentication, session management, and transport
- **[COMPENSATING-CONTROLS.md](COMPENSATING-CONTROLS.md)** — formal posture statement for CII Silver/Gold gaps and the controls that compensate for them
- **[SECURITY-AUDIT-LATEST.md](SECURITY-AUDIT-LATEST.md)** — most recent internal security audit: findings, dispositions, open items

The Scorecard badge is one signal. It doesn't capture the full picture of what Weaver does to ship secure software.
