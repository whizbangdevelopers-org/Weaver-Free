<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Security Audit Procedures

How to run security audits and address vulnerabilities in Weaver.

## Quick Audit

```bash
# Run npm audit for known vulnerabilities
npm audit

# Run npm audit for backend
cd backend && npm audit && cd ..

# Run the automated audit script (generates report)
./scripts/security-audit.sh
```

## Audit Types

### Dependency Audit (npm audit)

Checks for known vulnerabilities in npm packages.

```bash
# Root dependencies (frontend)
npm audit

# Backend dependencies
npm --prefix backend audit

# Both with high-severity filter
npm audit --audit-level=high
npm --prefix backend audit --audit-level=high
```

### Code Scanning (CodeQL)

Automated static analysis via GitHub Actions.

- Workflow: `.github/workflows/codeql.yml`
- Schedule: Weekly + on push to `main`
- Languages scanned: JavaScript, TypeScript
- Results: GitHub Security tab > Code scanning alerts

### Manual Security Review

Periodic manual review of:

- API endpoint input validation
- Sudo rule scope
- WebSocket message handling
- Authentication flows (demo mode)
- Dependency licenses
- Secret management practices

## Severity Classification

| Severity | Action Required | Timeline | CI Impact |
| -------- | --------------- | -------- | --------- |
| Critical | Immediate fix | Same day | Blocks release |
| High | Fix before release | 1 week | Blocks release |
| Moderate | Plan fix | 2-4 weeks | Warning only |
| Low | Monitor | Next major version | No impact |

## Automated Audit Report

The `./scripts/security-audit.sh` script generates a report at `docs/security/SECURITY-AUDIT-LATEST.md` containing:

- Vulnerability counts by severity
- Status indicator (PASS / WARNING / FAIL)
- Detailed vulnerability list with affected packages
- Recommended actions for each finding

### Running the Script

```bash
./scripts/security-audit.sh
```

### Report Format

The generated report follows this structure:

```markdown
# Security Audit Report
Date: YYYY-MM-DD
Status: PASS | WARNING | FAIL

## Summary
| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 0     |
| Moderate | 2     |
| Low      | 1     |

## Findings
### [Package Name] - Severity
- Advisory: URL
- Affected versions: x.y.z
- Fixed in: a.b.c
- Recommendation: Update to latest
```

## Fixing Vulnerabilities

### Automatic Fix

```bash
# Fix automatically fixable issues (root)
npm audit fix

# Preview changes that would require major updates
npm audit fix --dry-run --force

# Same for backend
cd backend && npm audit fix && cd ..
```

### Manual Fix

1. Check if a newer version exists:
   ```bash
   npm outdated
   npm --prefix backend outdated
   ```

2. Update the specific package:
   ```bash
   npm install package-name@latest
   ```

3. Test thoroughly after updating:
   ```bash
   npm run test:prepush
   ```

4. If no fix is available:
   - Assess the risk (is the vulnerable code path exercised?)
   - Document the exception in `docs/workflows/APPROVED-EXCEPTIONS.md`
   - Create a GitHub Issue to track resolution

### Override (Last Resort)

If a vulnerability is in a transitive dependency and cannot be directly fixed:

```json
// package.json
{
  "overrides": {
    "vulnerable-package": "^fixed-version"
  }
}
```

Document the override and why it was necessary.

## Dependabot Integration

Dependabot automatically creates PRs for security updates.

### Review Process

1. Review the security advisory link in the PR description.
2. Check for breaking changes in the updated package.
3. Run the test suite on the PR branch.
4. Merge if tests pass and changes are safe.
5. For critical/high: Merge within 7 days.
6. For moderate: Merge within the next release cycle.

### Auto-Merge

Dependabot patch updates can be auto-merged if:
- All CI checks pass
- The update is a patch version bump
- No breaking changes are detected

## CI Integration

### security-scan.yml

Runs `npm audit` on every push and PR:

```yaml
# Simplified workflow
jobs:
  security:
    steps:
      - Checkout
      - Setup Node.js
      - npm ci
      - npm audit --audit-level=high
```

### Pre-Push Hook

The pre-push git hook runs a security audit as part of `npm run test:prepush`.

## Scheduled Audits

| Frequency | Type | Action |
| --------- | ---- | ------ |
| Every push | npm audit (CI) | Automated, blocks on high/critical |
| Weekly | CodeQL scan | Automated, alerts on findings |
| Weekly | Manual review | Recommended but not enforced |
| Before release | Full audit | Required, documented in report |
| Quarterly | Comprehensive review | Manual, covers all areas |

## Security Review Areas

### API Security

- [ ] All routes validate input with Zod schemas
- [ ] VM names validated against `^[a-z][a-z0-9-]*$`
- [ ] Only defined VMs can be managed (no arbitrary service names)
- [ ] Error messages do not expose internal details
- [ ] No SQL/command injection vectors

### System Security

- [ ] Dashboard runs as a dedicated, low-privilege user
- [ ] Sudo rules are narrowly scoped to `microvm@*` commands
- [ ] `execFile` used instead of `exec` (no shell interpretation)
- [ ] No arbitrary command execution paths
- [ ] File system access is limited to `/var/lib/weaver`

### Network Security

- [ ] Default bind address is `127.0.0.1` (not `0.0.0.0`)
- [ ] Firewall opening requires explicit opt-in
- [ ] WebSocket connections validated
- [ ] No CORS misconfigurations
- [ ] HTTPS recommended for production (via reverse proxy)

### Client Security

- [ ] No secrets in frontend code
- [ ] hCaptcha verification happens server-side (demo mode)
- [ ] No sensitive data in local storage
- [ ] Content Security Policy headers set

## Reporting

If you discover a vulnerability, see [SECURITY.md](../../SECURITY.md) for responsible disclosure instructions.
