<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Security Policy

## Supported Versions

| Version | Supported |
| ------- | ------------------ |
| 1.0.x | :white_check_mark: |
| < 1.0.0 | :x: |

Only the latest release receives security updates. We recommend always running the most recent version.

## Reporting a Vulnerability

We take security seriously, especially given that Weaver manages virtual machine lifecycle operations (start, stop, restart) on NixOS hosts.

### How to Report

1. **Do NOT** open a public issue for security vulnerabilities.
2. Use GitHub's private vulnerability reporting feature:
   - Go to the repository's **Security** tab
   - Click **Report a vulnerability**
3. Alternatively, email the maintainers directly with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Include

- Affected component (frontend, backend API, NixOS module, WebSocket)
- Attack vector (network, local, authenticated, unauthenticated)
- Proof of concept or reproduction steps
- Severity assessment (your estimate)
- Environment details (NixOS version, Node.js version, browser)

### Response Timeline

| Stage | Timeline |
| ----- | -------- |
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Status update | Every 7 days until resolved |
| Critical fix | Target: 7 days |
| High severity fix | Target: 30 days |
| Medium severity fix | Target: 60 days |
| Low severity fix | Target: 90 days |

### After Reporting

- We will investigate and validate the report.
- We will work on a fix and coordinate disclosure timing with you.
- You will be credited in the security advisory (unless you prefer anonymity).
- We follow responsible disclosure practices.

## Security Considerations for VM Management

Weaver interacts with systemd services on the NixOS host. The following security measures are in place:

### Principle of Least Privilege

- The dashboard runs as a dedicated `weaver` system user.
- Sudo access is restricted to specific `microvm@*.service` systemctl commands only:
  - `systemctl start microvm@*`
  - `systemctl stop microvm@*`
  - `systemctl restart microvm@*`
  - `systemctl is-active microvm@*`
  - `systemctl show microvm@*`
  - `systemctl status microvm@*`
- No shell access or arbitrary command execution is permitted.

### Input Validation

- VM names are validated against the pattern `^[a-z][a-z0-9-]*$` using Zod schemas.
- All API route parameters are validated before reaching service logic.
- Only VMs defined in the `VM_DEFINITIONS` map can be managed (no arbitrary service names).

### Network Security

- The backend binds to `127.0.0.1` by default (localhost only).
- The `openFirewall` NixOS option must be explicitly enabled for remote access.
- WebSocket connections follow the same origin policy.
- HTTPS should be configured via a reverse proxy (nginx, Caddy) for production deployments.

### Demo Mode

- Demo mode uses mock services and never touches real systemd units.
- The demo login is gated behind hCaptcha to prevent abuse.
- Demo mode is determined at build/deploy time and cannot be toggled at runtime.

## Security Best Practices for Contributors

When contributing, follow these practices:

- **Never commit secrets, tokens, or credentials** to the repository.
- **Use environment variables** for all sensitive configuration.
- **Validate and sanitize all user input** on both frontend and backend.
- **Keep dependencies updated** and review Dependabot PRs promptly.
- **Follow the principle of least privilege** when adding new system interactions.
- **Test security boundaries** when adding new API endpoints.
- **Review sudo rules** carefully when modifying the NixOS module.

## Dependencies

We use Dependabot to keep dependencies updated. Security updates are prioritized:

- **Critical/High** -- Merged within 7 days.
- **Medium** -- Merged within the next release cycle.
- **Low** -- Reviewed and merged as part of regular maintenance.

## Security Audit

Regular security audits are documented in `docs/security/`. Run a local audit:

```bash
# npm audit for known vulnerabilities
npm run test:security

# Full audit with report generation
./scripts/security-audit.sh
```

## Contact

For security concerns, use GitHub's private vulnerability reporting or contact the maintainers directly through the organization.
