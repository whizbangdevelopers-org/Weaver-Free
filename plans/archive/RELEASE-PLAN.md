<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Release Plan

Planning document for upcoming Weaver releases.

## Release Schedule

| Version | Theme | Target Date | Status |
| ------- | ----- | ----------- | ------ |
| v0.1.0 | MVP / Foundation | Q1 2026 | In Progress |
| v0.2.0 | Enhanced Monitoring | Q2 2026 | Planning |
| v0.3.0 | Multi-Host Support | Q3 2026 | Backlog |
| v1.0.0 | Production Ready | Q4 2026 | Backlog |

## Current Release: v0.1.0 -- MVP / Foundation

**Target Date:** Q1 2026
**Theme:** Core dashboard functionality with VM lifecycle management.

### Goals

1. Functional dashboard showing all MicroVM status in real-time
2. Start/stop/restart VM actions from the browser
3. NixOS module for native deployment
4. Public demo site for showcase

### Features

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Dashboard page with VM status cards | High | Done | WorkbenchPage.vue + VmCard.vue |
| VM detail page with config tabs | High | Done | VmDetailPage.vue |
| REST API for VM management | High | Done | /api/vms routes |
| WebSocket live status broadcast | High | Done | /ws/status |
| NixOS service module | High | Done | nixos/default.nix |
| Demo mode with mock VMs | High | Done | mock-vm.ts |
| hCaptcha demo gating | Medium | Done | Demo login flow |
| Unit test suite | Medium | Done | Vitest setup |
| E2E test suite | Medium | Done | Playwright in Docker |
| GitHub Actions CI/CD | Medium | Done | test, release, sync workflows |
| Comprehensive documentation | Medium | In Progress | This documentation effort |

### Dependencies

- [x] quasar-template-pwa-api scaffolding
- [x] NixOS microvm module compatibility
- [x] hCaptcha account setup

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| NixOS microvm API changes | Low | High | Pin NixOS version in flake |
| hCaptcha rate limiting on demo | Low | Low | Test keys for development |
| WebSocket scalability | Medium | Medium | Configurable broadcast interval |

### Testing Requirements

- [x] Unit tests for stores, composables, services
- [x] E2E smoke tests in Docker
- [ ] Manual testing on NixOS host with real MicroVMs
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Release Checklist

- [ ] All features complete
- [ ] Tests passing (unit + E2E)
- [ ] Documentation complete
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] Demo site verified
- [ ] NixOS module tested on real hardware

## Next Release: v0.2.0 -- Enhanced Monitoring

**Target Date:** Q2 2026
**Theme:** Deeper VM monitoring and resource visualization.

### Planned Features

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Memory usage charts per VM | High | Backlog | Real-time chart component |
| CPU usage visualization | High | Backlog | Integrate with systemd metrics |
| VM log viewer | Medium | Backlog | journalctl integration |
| Dashboard filtering and search | Medium | Backlog | Filter by status, name |
| Notifications for status changes | Medium | Backlog | Toast/snackbar alerts |
| Dark mode toggle | Low | Backlog | Quasar theme switching |

### Dependencies

- [ ] Metrics collection strategy (systemd, cgroups, or custom)
- [ ] Chart library selection (Chart.js or similar)

## Future Release: v0.3.0 -- Multi-Host Support

**Target Date:** Q3 2026
**Theme:** Manage MicroVMs across multiple NixOS hosts.

### Planned Features

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Multi-host configuration | High | Backlog | Manage VMs on remote hosts |
| Host health monitoring | High | Backlog | Host-level system metrics |
| SSH-based remote management | Medium | Backlog | Secure remote systemctl |
| Host grouping and tagging | Low | Backlog | Organize hosts by role/env |

## Future Release: v1.0.0 -- Production Ready

**Target Date:** Q4 2026
**Theme:** Production hardening and enterprise features.

### Planned Features

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Authentication and authorization | High | Backlog | User login, role-based access |
| Audit logging | High | Backlog | Log all VM actions |
| API rate limiting | Medium | Backlog | Prevent abuse |
| Backup and snapshot management | Medium | Backlog | VM snapshot integration |
| Custom VM definitions | Medium | Backlog | Add/edit VMs from UI |
| Mobile-optimized layout | Low | Backlog | Capacitor or responsive |

## Backlog (Unscheduled)

Features not yet assigned to a release:

- [ ] VM template management
- [ ] Automated VM provisioning workflows
- [ ] Integration with NixOS flake configurations
- [ ] Prometheus/Grafana metrics export
- [ ] Webhook notifications (Slack, Discord, email)
- [ ] VM console access (noVNC or serial)
- [ ] NUR package publishing automation
- [ ] Internationalization (i18n) for multiple languages

## Release History

| Version | Date | Notes |
| ------- | ---- | ----- |
| v0.1.0 | TBD | Initial release |

---

*This document is updated as releases are planned and completed.*
