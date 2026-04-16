// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { AgentWsMessage } from './agent.js'

type AgentAction = 'diagnose' | 'explain' | 'suggest'
type BroadcastFn = (msg: AgentWsMessage) => void

const MOCK_RESPONSES: Record<AgentAction, Record<string, string>> = {
  diagnose: {
    'web-nginx': `## Diagnosis: web-nginx

**Status:** Running normally

**Findings:**
- Service \`microvm@web-nginx.service\` is active and stable
- Memory usage within allocated 256 MB limit
- No error patterns detected in recent journal logs
- Network interface responding on 10.10.0.10

**Severity:** info

**Recommendation:** No immediate action needed. Consider increasing memory allocation to 512 MB if serving high-traffic workloads, as 256 MB is tight for nginx under load.`,

    'web-app': `## Diagnosis: web-app

**Status:** Running normally

**Findings:**
- Service \`microvm@web-app.service\` is active
- 512 MB memory allocation is appropriate for a web application server
- No crash loops or restart patterns in systemd journal
- Responding on 10.10.0.11

**Severity:** info

**Recommendation:** All clear. Monitor memory usage trends — web app servers under sustained load may benefit from 1024 MB.`,

    'dev-node': `## Diagnosis: dev-node

**Status:** Stopped (expected for dev workload)

**Findings:**
- Service \`microvm@dev-node.service\` is inactive
- Last shutdown was clean — no crash indicators in journal
- No failed dependency chains detected
- Last active session ran without errors

**Severity:** info

**Recommendation:** Start the VM when development work is needed. The clean shutdown indicates no underlying issues. Consider adding a health check endpoint for automated monitoring.`,

    'dev-python': `## Diagnosis: dev-python

**Status:** Stopped

**Findings:**
- Service \`microvm@dev-python.service\` is inactive
- Clean shutdown recorded — no OOM kills or segfaults
- Python development VMs typically consume more memory during package installation
- No stale lock files or zombie processes from previous session

**Severity:** info

**Recommendation:** No issues found. When starting, monitor initial memory usage — Python with heavy dependencies (numpy, pandas) may spike above the 512 MB allocation briefly.`,

    'svc-postgres': `## Diagnosis: svc-postgres

**Status:** CRITICAL — Service crash loop detected

**Findings:**
- Service \`microvm@svc-postgres.service\` is in **failed** state
- systemd journal shows **3 rapid restarts** in the last 60 seconds — crash loop
- Exit code 1: PostgreSQL failed to start due to corrupted WAL segment
- Error in logs: \`PANIC: could not locate a valid checkpoint record\`
- Last successful checkpoint was 47 minutes ago — data loss window
- Disk usage at 94% on \`/var/lib/microvm/svc-postgres/\` — WAL accumulation
- OOM killer triggered once: \`Out of memory: Killed process 1842 (postgres)\`
- 512 MB allocation is **insufficient** — PostgreSQL + shared_buffers + WAL writer need ~768 MB minimum

**Severity:** critical

**Root Cause:**
The OOM kill interrupted a WAL write mid-flush, corrupting the active WAL segment. PostgreSQL cannot recover automatically from this state. The crash loop is systemd retrying the start, but PostgreSQL panics on every boot when it finds the corrupt checkpoint.

**Immediate Actions Required:**
1. **Stop the crash loop:** \`systemctl stop microvm@svc-postgres.service\`
2. **Backup current state:** \`cp -a /var/lib/microvm/svc-postgres/ /var/lib/microvm/svc-postgres.bak/\`
3. **Reset WAL:** \`pg_resetwal -f /var/lib/microvm/svc-postgres/pgdata/\`
4. **Increase memory** to at least 1024 MB in \`microvm-host.nix\`
5. **Clean old WAL files** to free disk: \`pg_archivecleanup /pgdata/pg_wal/ <last-good-wal>\`
6. **Start and verify:** \`systemctl start microvm@svc-postgres.service && pg_isready\`

**Data Loss Assessment:**
Transactions committed in the last ~47 minutes may be lost. Check application-level backups and replication status.`,
  },

  explain: {
    _default: `## VM Explanation

This is a NixOS MicroVM managed by the \`microvm@\` systemd template service. Each VM runs in an isolated environment with its own:

- **Network namespace** with a dedicated IP address
- **Memory allocation** enforced by the hypervisor (QEMU)
- **vCPU assignment** for compute isolation

The VM lifecycle is managed through systemd:
- \`systemctl start microvm@<name>\` — boots the VM
- \`systemctl stop microvm@<name>\` — gracefully shuts down
- \`systemctl restart microvm@<name>\` — stop + start cycle

Configuration is declared in the NixOS host's \`microvm-host.nix\` and applied via \`nixos-rebuild switch\`.`,
  },

  suggest: {
    _default: `## Optimization Suggestions

1. **Memory right-sizing:** Review actual memory usage with \`systemd-cgtop\` and adjust allocations. Over-provisioning wastes host RAM; under-provisioning causes OOM kills.

2. **Health checks:** Add a lightweight HTTP health endpoint to each VM so the dashboard can detect application-level failures, not just systemd status.

3. **Log aggregation:** Forward VM journal logs to a central location for easier debugging across the fleet.

4. **Snapshot/backup:** Consider periodic filesystem snapshots before configuration changes, especially for stateful VMs like svc-postgres.

5. **Resource monitoring:** Track CPU and memory utilization trends to predict when VMs need scaling before they hit limits.`,
  },
}

function getMockResponse(vmName: string, action: AgentAction): string {
  const actionResponses = MOCK_RESPONSES[action]
  return actionResponses[vmName] || actionResponses['_default'] || `No mock response available for ${action} on ${vmName}.`
}

export async function runMockAgent(
  operationId: string,
  vmName: string,
  action: AgentAction,
  broadcast: BroadcastFn
): Promise<void> {
  const fullText = getMockResponse(vmName, action)
  const chunks = fullText.match(/.{1,25}/gs) || [fullText]

  for (const chunk of chunks) {
    broadcast({ type: 'agent-token', operationId, token: chunk })
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50))
  }

  broadcast({ type: 'agent-complete', operationId, fullText })
}
