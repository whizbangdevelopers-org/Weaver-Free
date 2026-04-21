<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Demo-mode version feature previews. Renders version-gated mock UI sections
  for versions v1.2 through v3.3. Each section appears when the demo version
  reaches that milestone, giving investors a visible change at every version step.

  Usage: Place in a page template with a `section` prop to filter which features
  appear (e.g., 'settings', 'workload-detail', 'weaver', 'network').
-->
<template>
  <!-- Hidden entirely in public demo — no roadmap leaks (Decision #135) -->
  <div v-if="!isPublicDemo()" class="demo-version-features">

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SETTINGS PAGE SECTIONS                                             -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'settings'">

      <!-- v1.3 — Remote Access -->
      <q-card v-if="atLeast('1.3')" flat bordered>
        <q-expansion-item icon="mdi-remote-desktop" label="Remote Access" caption="v1.3.0 — Tailscale / WireGuard tunnels" header-class="text-h6">
        <q-card-section>
          <div class="row items-center q-gutter-md q-mb-md">
            <q-icon name="mdi-check-circle" color="positive" size="20px" />
            <span class="text-body2">{{ appStore.isWeaver ? 'WireGuard tunnel active' : 'Tailscale tunnel active' }}</span>
            <q-badge color="positive" label="Connected" />
          </div>
          <q-markup-table flat dense bordered>
            <tbody>
              <tr><td class="text-weight-medium" style="width:160px">Tunnel type</td><td>{{ appStore.isWeaver ? 'WireGuard (self-hosted)' : 'Tailscale (free)' }}</td></tr>
              <tr><td class="text-weight-medium">Endpoint</td><td>{{ appStore.isWeaver ? '203.0.113.42:51820' : 'weaver-home.tail1a2b3.ts.net' }}</td></tr>
              <tr><td class="text-weight-medium">Latency</td><td>12 ms</td></tr>
              <tr><td class="text-weight-medium">Last handshake</td><td>38 seconds ago</td></tr>
            </tbody>
          </q-markup-table>
          <div class="row q-gutter-sm q-mt-md">
            <q-btn flat dense size="sm" icon="mdi-refresh" label="Re-run wizard" color="primary" />
            <q-toggle :model-value="false" label="Network Isolation Mode" />
          </div>
        </q-card-section>
        </q-expansion-item>
      </q-card>
      <VersionNag v-else-if="showNag('1.3')" version="1.3" title="Remote Access" description="Tailscale (Free) and WireGuard (Weaver) tunnels for mobile + remote access" />

      <!-- v1.4 — AI Credential Vault (Weaver+) -->
      <q-card v-if="atLeast('1.4') && appStore.isWeaver" flat bordered>
        <q-expansion-item icon="mdi-shield-key" label="AI Credential Vault" caption="v1.4.0 — Admin-managed AI credentials (Weaver Solo)" header-class="text-h6">
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-md">
            Admin-managed AI credentials shared with the team. Users don't need their own API keys.
          </div>
          <q-markup-table flat dense bordered>
            <thead>
              <tr><th class="text-left">Name</th><th class="text-left">Provider</th><th class="text-left">Added</th><th class="text-left">Last rotated</th></tr>
            </thead>
            <tbody>
              <tr><td>prod-claude</td><td><q-badge color="deep-purple" label="Anthropic" /></td><td>2026-02-15</td><td>2026-03-10</td></tr>
              <tr><td>dev-ollama</td><td><q-badge color="grey-7" label="Ollama" /></td><td>2026-03-01</td><td>—</td></tr>
              <tr v-if="appStore.isFabrick"><td>compliance-local</td><td><q-badge color="teal" label="Local LLM" /></td><td>2026-03-20</td><td>—</td></tr>
            </tbody>
          </q-markup-table>
          <div class="row q-gutter-sm q-mt-md">
            <q-btn flat dense size="sm" icon="mdi-plus" label="Add credential" color="primary" />
            <q-btn flat dense size="sm" icon="mdi-rotate-right" label="Rotate selected" color="grey-7" />
          </div>
        </q-card-section>
        </q-expansion-item>
      </q-card>
      <VersionNag v-else-if="showNag('1.4')" version="1.4" title="AI Credential Vault" description="Admin-managed AI credentials — team members don't need their own API keys (Weaver+)" />

      <!-- v1.5 — Secrets Management -->
      <q-card v-if="atLeast('1.5')" flat bordered>
        <q-expansion-item icon="mdi-key-chain" label="Secrets Vault" caption="v1.5.0 — Encrypted credentials injected into workloads" header-class="text-h6">
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-md">
            Encrypted credentials injected into workloads as environment variables or mounted files. No external secret manager needed.
          </div>
          <q-markup-table flat dense bordered>
            <thead>
              <tr><th class="text-left">Name</th><th class="text-left">Type</th><th class="text-left">Used by</th><th class="text-left">Rotated</th></tr>
            </thead>
            <tbody>
              <tr><td>db-password</td><td><q-badge outline color="blue" label="env" /></td><td>db-postgres, svc-orders</td><td>2026-03-15</td></tr>
              <tr><td>tls-cert</td><td><q-badge outline color="teal" label="file" /></td><td>web-nginx, lb-haproxy-01</td><td>2026-02-28</td></tr>
              <tr><td>stripe-key</td><td><q-badge outline color="blue" label="env" /></td><td>svc-payments</td><td>2026-03-22</td></tr>
              <tr v-if="appStore.isFabrick"><td>ldap-bind</td><td><q-badge outline color="blue" label="env" /></td><td>auth-proxy (fleet-wide)</td><td>2026-03-18</td></tr>
            </tbody>
          </q-markup-table>
          <div class="row q-gutter-sm q-mt-md">
            <q-btn flat dense size="sm" icon="mdi-plus" label="Add secret" color="primary" />
            <q-btn flat dense size="sm" icon="mdi-rotate-right" label="Rotate" color="grey-7" />
            <q-btn v-if="appStore.isFabrick" flat dense size="sm" icon="mdi-content-copy" label="Bulk assign by tag" color="grey-7" />
          </div>
          <div v-if="appStore.isFabrick" class="text-caption text-grey-8 q-mt-sm">
            <q-icon name="mdi-shield-check" size="14px" class="q-mr-xs" />
            FabricK: full audit trail of secret access and rotation events
          </div>
        </q-card-section>
        </q-expansion-item>
      </q-card>
      <VersionNag v-else-if="showNag('1.5')" version="1.5" title="Secrets Vault" description="Encrypted credentials injected into workloads — no external secret manager needed" />

      <!-- v2.1 — Host Maintenance Manager -->
      <q-card v-if="atLeast('2.1') && appStore.isWeaver" flat bordered>
        <q-expansion-item icon="mdi-wrench-cog" label="Host Maintenance" caption="v2.1.0 — NixOS store, generations, flake updates (Weaver Solo)" header-class="text-h6">
        <q-card-section>

          <!-- Nix Store GC -->
          <div class="text-subtitle2 q-mb-xs">Nix Store</div>
          <div class="row items-center q-gutter-sm q-mb-md">
            <span class="text-body2">28.4 GB total</span>
            <q-badge outline color="warning" label="4.2 GB reclaimable" />
            <span class="text-caption text-grey-8">Last GC: 2026-03-28</span>
            <q-space />
            <q-btn flat dense size="sm" icon="mdi-delete-sweep" label="Run GC" color="warning" />
          </div>

          <q-separator class="q-mb-md" />

          <!-- NixOS Generations -->
          <div class="text-subtitle2 q-mb-xs">NixOS Generations</div>
          <q-markup-table flat dense bordered class="q-mb-sm">
            <thead>
              <tr><th class="text-left">Gen</th><th class="text-left">Date</th><th class="text-left">Size</th><th class="text-left">Kernel</th><th class="text-left">Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="gen in nixosGenerations" :key="gen.id">
                <td>#{{ gen.id }}</td>
                <td class="text-caption">{{ gen.date }}</td>
                <td>{{ gen.size }}</td>
                <td class="text-caption">{{ gen.kernel }}</td>
                <td><q-badge v-if="gen.current" color="positive" label="current" /><q-btn v-else flat dense size="xs" icon="mdi-undo" label="Rollback" color="grey-7" /></td>
              </tr>
            </tbody>
          </q-markup-table>
          <q-btn flat dense size="sm" icon="mdi-delete-clock" label="Prune Old" color="grey-7" class="q-mb-md" />

          <q-separator class="q-mb-md" />

          <!-- Flake Updates -->
          <div class="text-subtitle2 q-mb-xs">Flake Updates</div>
          <div class="row items-center q-gutter-sm q-mb-md">
            <span class="text-caption text-grey-8">Lock date: 2026-03-25</span>
            <q-badge color="info" label="2 updates available" />
            <q-space />
            <q-btn flat dense size="sm" icon="mdi-refresh" label="Check for Updates" color="primary" />
          </div>

          <q-separator class="q-mb-md" />

          <!-- Maintenance Window -->
          <div class="text-subtitle2 q-mb-xs">Maintenance Window</div>
          <div class="row items-center q-gutter-sm">
            <q-icon name="mdi-clock-outline" size="18px" color="grey" />
            <span class="text-body2">Sunday 02:00 – 06:00 UTC</span>
            <q-space />
            <q-toggle :model-value="true" label="Auto-updates" dense />
          </div>
        </q-card-section>
        </q-expansion-item>
      </q-card>
      <VersionNag v-else-if="showNag('2.1') && appStore.isWeaver" version="2.1" title="Host Maintenance" description="NixOS store GC, generation management, flake updates, and maintenance windows" />

    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- WEAVER PAGE SECTIONS                                               -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'weaver'">

      <!-- v1.2 — Container Lifecycle Management -->
      <VersionNag v-if="showNag('1.2')" version="1.2" title="Container Management" description="Full lifecycle management for Docker, Podman, and Apptainer containers — v1.1 was read-only" class="q-mt-lg" />

      <template v-if="atLeast('1.2')">
        <q-card v-if="appStore.isWeaver" flat bordered class="q-mt-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-docker" size="24px" class="q-mr-sm" />
              <span class="text-h6">Container Lifecycle</span>
              <q-badge outline color="grey-6" label="v1.2.0" class="q-ml-sm" />
              <q-badge color="amber-9" label="Weaver Solo" class="q-ml-xs" />
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-plus" label="Create Container" color="primary" />
            </div>
            <div class="text-caption text-grey-8 q-mb-sm">Full lifecycle management — v1.1 was read-only visibility</div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Name</th><th class="text-left">Image</th><th class="text-left">Runtime</th><th class="text-left">Status</th><th class="text-left">Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in containerLifecycleMocks" :key="c.name">
                  <td class="text-weight-medium">{{ c.name }}</td>
                  <td class="text-caption">{{ c.image }}</td>
                  <td><q-badge outline :color="c.runtime === 'Docker' ? 'blue' : c.runtime === 'Podman' ? 'deep-purple' : 'teal'" :label="c.runtime" size="sm" /></td>
                  <td><q-badge :color="c.status === STATUSES.RUNNING ? 'positive' : 'grey'" :label="c.status" /></td>
                  <td>
                    <q-btn flat dense size="xs" :icon="c.status === STATUSES.RUNNING ? 'mdi-stop' : 'mdi-play'" :color="c.status === STATUSES.RUNNING ? 'negative' : 'positive'" class="q-mr-xs" />
                    <q-btn flat dense size="xs" icon="mdi-restart" color="warning" />
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>

        <!-- Security Hardening -->
        <q-card v-if="appStore.isWeaver" flat bordered class="q-mt-md">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-shield-lock" size="24px" class="q-mr-sm" />
              <span class="text-h6">Security Hardening</span>
              <q-badge outline color="grey-6" label="v1.2.0" class="q-ml-sm" />
            </div>
            <div class="row q-gutter-md">
              <div class="col">
                <div class="text-subtitle2 q-mb-xs">AppArmor Profile</div>
                <q-select :model-value="'enforce'" :options="['enforce', 'complain', 'disabled']" outlined dense style="max-width: 200px" />
              </div>
              <div class="col">
                <div class="text-subtitle2 q-mb-xs">Seccomp</div>
                <q-badge color="positive" label="Active — default profile" class="q-mt-xs" />
              </div>
              <div class="col">
                <div class="text-subtitle2 q-mb-xs">Kernel Hardening</div>
                <q-badge color="positive" label="3/3 checks passed" class="q-mt-xs" />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- SSH Key Management -->
        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-key" size="24px" class="q-mr-sm" />
              <span class="text-h6">SSH Keys</span>
              <q-badge outline color="grey-6" label="v1.2.0" class="q-ml-sm" />
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-plus" label="Add Key" color="primary" />
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Name</th><th class="text-left">Fingerprint</th><th class="text-left">Added</th><th class="text-left">Last Used</th><th class="text-left">Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="k in sshKeyMocks" :key="k.name">
                  <td class="text-weight-medium">{{ k.name }}</td>
                  <td class="text-caption" style="font-family: monospace">{{ k.fingerprint }}</td>
                  <td class="text-caption">{{ k.added }}</td>
                  <td class="text-caption">{{ k.lastUsed }}</td>
                  <td><q-btn flat dense size="xs" icon="mdi-delete" label="Revoke" color="negative" /></td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </template>

      <!-- v1.6 — Migration Tooling -->
      <VersionNag v-if="showNag('1.6')" version="1.6" title="Migration Tooling" description="Import from Proxmox, Docker Compose, libvirt XML — auto-detected format with NixOS preview" class="q-mt-lg" />

      <q-card v-if="atLeast('1.6')" flat bordered class="q-mt-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="mdi-import" size="24px" class="q-mr-sm" />
            <span class="text-h6">Import / Export</span>
            <q-badge outline color="grey-6" label="v1.6.0" class="q-ml-sm" />
          </div>
          <div class="row q-gutter-md">
            <q-card flat bordered class="col" style="min-width:200px">
              <q-card-section class="text-center q-pa-md">
                <q-icon name="mdi-application-import" size="36px" color="primary" />
                <div class="text-subtitle2 q-mt-sm">Import</div>
                <div class="text-caption text-grey-8">Proxmox · Docker Compose · libvirt XML · Dockerfile</div>
                <q-btn flat size="sm" color="primary" label="Choose file..." class="q-mt-sm" />
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col" style="min-width:200px">
              <q-card-section class="text-center q-pa-md">
                <q-icon name="mdi-application-export" size="36px" color="teal" />
                <div class="text-subtitle2 q-mt-sm">Export</div>
                <div class="text-caption text-grey-8">NixOS config · JSON manifest · tar.gz bundle</div>
                <q-btn flat size="sm" color="teal" label="Select workloads..." class="q-mt-sm" />
              </q-card-section>
            </q-card>
          </div>
          <!-- Parser preview mock -->
          <div class="q-mt-md">
            <div class="text-caption text-grey-7">Last import preview:</div>
            <q-card flat bordered class="q-mt-xs bg-grey-1">
              <q-card-section class="q-pa-sm">
                <code class="text-caption" style="white-space:pre">Format: docker-compose.yml (auto-detected)
Services: 3 (web, api, db)
Output: 3 MicroVMs on br-prod
Confidence: 98%</code>
              </q-card-section>
            </q-card>
          </div>
        </q-card-section>
      </q-card>

      <!-- v2.4 — Backup (Weaver) -->
      <VersionNag v-if="showNag('2.4')" version="2.4" title="Backup" description="Scheduled disk snapshots with configurable retention and one-click restore" class="q-mt-lg" />

      <q-card v-if="atLeast('2.4') && appStore.isWeaver" flat bordered class="q-mt-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="mdi-backup-restore" size="24px" class="q-mr-sm" />
            <span class="text-h6">Backup Jobs</span>
            <q-badge outline color="grey-6" label="v2.4.0" class="q-ml-sm" />
          </div>
          <q-markup-table flat dense bordered>
            <thead>
              <tr><th class="text-left">Job</th><th class="text-left">Schedule</th><th class="text-left">Target</th><th class="text-left">Retention</th><th class="text-left">Last run</th><th class="text-left">Status</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>prod-nightly</td><td>Daily 02:00</td><td>NFS /backup/prod</td><td>7 daily, 4 weekly</td>
                <td>2026-03-30 02:03</td><td><q-badge color="positive" label="OK" /></td>
              </tr>
              <tr>
                <td>db-hourly</td><td>Hourly :15</td><td>Local /var/backup</td><td>24 hourly, 7 daily</td>
                <td>2026-03-31 09:15</td><td><q-badge color="positive" label="OK" /></td>
              </tr>
            </tbody>
          </q-markup-table>
          <div class="row q-gutter-sm q-mt-md">
            <q-btn flat dense size="sm" icon="mdi-plus" label="New backup job" color="primary" />
            <q-btn flat dense size="sm" icon="mdi-restore" label="Browse snapshots" color="grey-7" />
          </div>

          <!-- v2.6 — Extended backup targets (Fabrick) -->
          <template v-if="atLeast('2.6') && appStore.isFabrick">
            <q-separator class="q-my-md" />
            <div class="row items-center q-mb-sm">
              <span class="text-subtitle2">FabricK Backup Targets</span>
              <q-badge outline color="grey-6" label="v2.6.0" class="q-ml-sm" />
              <q-badge color="amber-9" label="FabricK" class="q-ml-xs" />
            </div>
            <div class="row q-gutter-sm">
              <q-chip icon="mdi-aws" label="S3 (s3://weaver-backup-prod)" color="orange-3" />
              <q-chip icon="mdi-lock" label="Restic (restic-repo.internal)" color="teal-3" />
              <q-chip icon="mdi-archive" label="Borg (borg@vault:/repo)" color="blue-3" />
            </div>
            <div class="row q-gutter-sm q-mt-sm">
              <q-btn flat dense size="sm" icon="mdi-file-restore" label="File-level restore" color="primary" />
              <q-btn flat dense size="sm" icon="mdi-key" label="Encryption settings" color="grey-7" />
            </div>
          </template>
        </q-card-section>
      </q-card>

    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- WORKLOAD DETAIL PAGE SECTIONS                                      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'workload-detail'">

      <!-- v1.2 — AI Threat Landscape (Glasswing validation) -->
      <q-card v-if="atLeast('1.2')" flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-mb-sm">
            <q-icon name="mdi-shield-alert" size="20px" color="red-7" class="q-mr-sm" />
            <span class="text-subtitle1 text-weight-medium">AI Threat Landscape</span>
            <q-badge outline color="red-7" label="Defense Posture" class="q-ml-sm" />
          </div>
          <div class="text-body2 text-grey-8 q-mb-md">
            AI agents (Project Glasswing) now discover thousands of zero-day vulnerabilities in weeks.
            Traditional container namespaces offer no defense when exploits are found faster than patches ship.
            This workload runs behind a hardware isolation boundary.
          </div>
          <div class="row q-gutter-sm">
            <q-chip outline color="positive" icon="mdi-chip" label="Hardware-isolated (hypervisor boundary)" size="sm" />
            <q-chip outline color="positive" icon="mdi-shield-check" label="AppArmor + Seccomp enforced" size="sm" />
            <q-chip outline color="positive" icon="mdi-refresh-auto" label="NixOS deterministic patching" size="sm" />
            <q-chip v-if="appStore.isFabrick" outline color="blue" icon="mdi-sitemap" label="Hypervisor diversity across fleet" size="sm" />
          </div>
        </q-card-section>
      </q-card>

      <!-- v1.5 — Per-workload secrets injection -->
      <q-card v-if="atLeast('1.5')" flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-mb-sm">
            <q-icon name="mdi-key-chain" size="20px" class="q-mr-sm" />
            <span class="text-subtitle1 text-weight-medium">Secrets</span>
            <q-badge outline color="grey-6" label="v1.5.0" class="q-ml-sm" />
          </div>
          <div class="row q-gutter-sm">
            <q-chip outline color="blue" icon="mdi-variable" label="DB_PASSWORD → $secret:db-password" size="sm" />
            <q-chip outline color="teal" icon="mdi-file-key" label="/etc/ssl/cert.pem → $secret:tls-cert" size="sm" />
          </div>
          <q-btn flat dense size="sm" icon="mdi-plus" label="Inject secret" color="primary" class="q-mt-sm" />
        </q-card-section>
      </q-card>

      <!-- v2.0 — Disk Management -->
      <q-card v-if="atLeast('2.0')" flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-mb-sm">
            <q-icon name="mdi-harddisk" size="20px" class="q-mr-sm" />
            <span class="text-subtitle1 text-weight-medium">Disks</span>
            <q-badge outline color="grey-6" label="v2.0.0" class="q-ml-sm" />
          </div>
          <q-markup-table flat dense bordered>
            <thead><tr><th class="text-left">Device</th><th class="text-left">Size</th><th class="text-left">Format</th><th class="text-left">IOPS</th><th class="text-left">Hotplug</th></tr></thead>
            <tbody>
              <tr><td>vda</td><td>20 GB</td><td>qcow2</td><td>3000 / 1500</td><td><q-icon name="mdi-check" color="positive" /></td></tr>
              <tr><td>vdb</td><td>100 GB</td><td>raw</td><td>5000 / 3000</td><td><q-icon name="mdi-check" color="positive" /></td></tr>
            </tbody>
          </q-markup-table>
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn flat dense size="sm" icon="mdi-plus" label="Attach disk" color="primary" />
            <q-btn flat dense size="sm" icon="mdi-eject" label="Detach" color="grey-7" />
          </div>
        </q-card-section>
      </q-card>
      <VersionNag v-else-if="showNag('2.0')" version="2.0" title="Disk Management" description="Attach, detach, and hotplug disks with I/O limits per workload" class="q-mb-md" />

      <!-- v2.1 — Snapshots -->
      <q-card v-if="atLeast('2.1')" flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-mb-sm">
            <q-icon name="mdi-camera" size="20px" class="q-mr-sm" />
            <span class="text-subtitle1 text-weight-medium">Snapshots</span>
            <q-badge outline color="grey-6" label="v2.1.0" class="q-ml-sm" />
          </div>
          <q-list dense separator>
            <q-item v-for="snap in mockSnapshots" :key="snap.id">
              <q-item-section avatar><q-icon name="mdi-history" color="grey" /></q-item-section>
              <q-item-section>
                <q-item-label>{{ snap.label }}</q-item-label>
                <q-item-label caption>{{ snap.date }} · {{ snap.size }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-btn flat dense size="xs" icon="mdi-restore" label="Restore" color="primary" />
                  <q-btn flat dense size="xs" icon="mdi-delete" color="grey" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn flat dense size="sm" icon="mdi-camera-plus" label="Create snapshot" color="primary" />
            <q-btn flat dense size="sm" icon="mdi-content-copy" label="Clone as template" color="grey-7" />
          </div>
        </q-card-section>
      </q-card>
      <VersionNag v-else-if="showNag('2.1')" version="2.1" title="Snapshots" description="Point-in-time snapshots with instant restore and clone-to-template" class="q-mb-md" />

    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- NETWORK PAGE SECTIONS                                              -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'network'">

      <!-- v1.2 — Firewall Presets -->
      <q-card v-if="atLeast('1.2') && appStore.isWeaver" flat bordered class="q-mt-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="mdi-shield-lock" size="24px" class="q-mr-sm" />
            <span class="text-h6">Firewall Presets</span>
            <q-badge outline color="grey-6" label="v1.2.0" class="q-ml-sm" />
            <q-badge color="amber-9" label="Weaver Solo" class="q-ml-xs" />
          </div>
          <div class="row q-gutter-sm">
            <q-chip v-for="preset in firewallPresets" :key="preset.name" :icon="preset.icon" :label="preset.name" :color="preset.active ? 'primary' : 'grey-4'" :text-color="preset.active ? 'white' : 'grey-8'" clickable />
          </div>
          <div v-if="appStore.isFabrick" class="q-mt-md">
            <div class="text-subtitle2 text-grey-8 q-mb-xs">FabricK Security</div>
            <div class="row q-gutter-sm">
              <q-chip icon="mdi-shield-alert" label="Security zones" color="amber-2" />
              <q-chip icon="mdi-file-document-check" label="Drift detection" color="amber-2" />
              <q-chip icon="mdi-clipboard-text-clock" label="Firewall audit log" color="amber-2" />
            </div>
          </div>
        </q-card-section>
      </q-card>

    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- FABRICK PAGE SECTIONS (v2.3+)                                      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'fabrick'">

      <!-- v2.3 — Migration History Log (operational view — the action itself lives on workload detail) -->
      <q-card v-if="atLeast('2.3') && appStore.isFabrick" flat bordered class="q-mb-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="mdi-truck-fast" size="24px" class="q-mr-sm" />
            <span class="text-h6">Migration History</span>
            <q-badge outline color="grey-6" :label="atLeast('3.0') ? 'v3.0.0 · Live + Cold' : 'v2.3.0 · Cold'" class="q-ml-sm" />
          </div>
          <q-list dense separator>
            <q-item>
              <q-item-section avatar><q-icon name="mdi-check-circle" color="positive" size="18px" /></q-item-section>
              <q-item-section>
                <q-item-label>ci-runner: crucible → nexus</q-item-label>
                <q-item-label caption>Cold · 28s downtime · 2026-03-29 14:22</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="atLeast('3.0')">
              <q-item-section avatar><q-icon name="mdi-check-circle" color="positive" size="18px" /></q-item-section>
              <q-item-section>
                <q-item-label>svc-orders: king → titan</q-item-label>
                <q-item-label caption>Live · 0s downtime · 2026-03-30 09:15</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar><q-icon name="mdi-alert-circle" color="warning" size="18px" /></q-item-section>
              <q-item-section>
                <q-item-label>db-primary: king → vault</q-item-label>
                <q-item-label caption>Blocked — GPU 0000:01:00.0 not available on vault</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div class="text-caption text-grey-8 q-mt-sm q-ml-md">
            <q-icon name="mdi-information-outline" size="14px" class="q-mr-xs" />
            Migrate workloads from their detail page. Eligibility shown on workload cards.
          </div>
        </q-card-section>
      </q-card>

      <!-- v2.5 — Storage & Template Fabrick -->
      <VersionNag v-if="showNag('2.5')" version="2.5" title="Storage & Template Fabrick" description="Copy-on-write storage pools, per-group quotas, and fleet-wide template distribution" class="q-mb-lg" />

      <template v-if="atLeast('2.5') && appStore.isFabrick">
        <!-- Storage Pools -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-harddisk" size="24px" class="q-mr-sm" />
              <span class="text-h6">Storage Pools</span>
              <q-badge outline color="grey-6" label="v2.5.0" class="q-ml-sm" />
              <q-badge color="amber-9" label="FabricK" class="q-ml-xs" />
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-plus" label="Add Pool" color="primary" />
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Pool</th><th class="text-left">Type</th><th class="text-left">Total</th><th class="text-left">Used</th><th class="text-left">Snapshots</th><th class="text-left">Usage</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in storagePools" :key="p.name">
                  <td class="text-weight-medium">{{ p.name }}</td>
                  <td>{{ p.type }}</td>
                  <td>{{ (p.totalGb / 1000).toFixed(1) }} TB</td>
                  <td>{{ (p.usedGb / 1000).toFixed(1) }} TB</td>
                  <td>{{ p.snapshotOverheadGb }} GB</td>
                  <td style="width: 120px"><q-linear-progress :value="p.usedGb / p.totalGb" :color="p.usedGb / p.totalGb > 0.8 ? 'negative' : 'primary'" size="8px" rounded /></td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>

        <!-- Storage Quotas -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-gauge" size="24px" class="q-mr-sm" />
              <span class="text-h6">Storage Quotas</span>
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-pencil" label="Edit Quotas" color="grey-7" />
            </div>
            <div v-for="q in storageQuotas" :key="q.group" class="q-mb-sm">
              <div class="row items-center justify-between q-mb-xs">
                <span class="text-body2 text-weight-medium">{{ q.group }}</span>
                <span class="text-caption text-grey-8">{{ q.usedGb }} / {{ q.limitGb }} GB</span>
              </div>
              <q-linear-progress :value="q.usedGb / q.limitGb" :color="q.usedGb / q.limitGb > 0.8 ? 'warning' : 'primary'" size="6px" rounded />
            </div>
          </q-card-section>
        </q-card>

        <!-- Fleet Template Registry -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-package-variant-closed" size="24px" class="q-mr-sm" />
              <span class="text-h6">Fleet Template Registry</span>
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-upload" label="Push Update" color="primary" />
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Template</th><th class="text-left">Version</th><th class="text-left">Base</th><th class="text-left">Hosts</th><th class="text-left">Last Push</th><th class="text-left">Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="t in templateRegistry" :key="t.name">
                  <td class="text-weight-medium">{{ t.name }}</td>
                  <td><q-badge outline color="primary" :label="t.version" /></td>
                  <td>{{ t.baseDistro }}</td>
                  <td>
                    <q-badge :color="t.deployedHosts === t.totalHosts ? 'positive' : 'warning'" :label="`${t.deployedHosts}/${t.totalHosts}`" />
                  </td>
                  <td class="text-caption">{{ t.lastPush }}</td>
                  <td><q-btn flat dense size="xs" icon="mdi-undo" label="Rollback" color="grey-7" /></td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </template>

      <!-- v3.1 — Edge Fleet + Cloud Burst -->
      <VersionNag v-if="showNag('3.1')" version="3.1" title="Edge Fleet + Cloud Burst" description="IoT/edge node management, cloud burst enrollment, and fleet-wide GPU inventory" class="q-mb-lg" />

      <template v-if="atLeast('3.1') && appStore.isFabrick">
        <!-- Edge Node Registry -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-access-point" size="24px" class="q-mr-sm" />
              <span class="text-h6">Edge Node Registry</span>
              <q-badge outline color="grey-6" label="v3.1.0" class="q-ml-sm" />
              <q-badge color="amber-9" label="FabricK" class="q-ml-xs" />
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-plus" label="Register Node" color="primary" class="q-mr-sm" />
              <q-btn flat dense size="sm" icon="mdi-file-document" label="Fleet Manifest" color="grey-7" />
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Hostname</th><th class="text-left">Arch</th><th class="text-left">Kind</th><th class="text-left">Heartbeat</th><th class="text-left">Status</th><th class="text-left">Workloads</th></tr>
              </thead>
              <tbody>
                <tr v-for="n in edgeNodes" :key="n.hostname">
                  <td class="text-weight-medium">{{ n.hostname }}</td>
                  <td><q-badge outline color="grey-7" :label="n.arch" size="sm" /></td>
                  <td><q-badge outline :color="n.kind === 'iot' ? 'teal' : 'orange'" :label="n.kind" size="sm" /></td>
                  <td class="text-caption">{{ n.lastHeartbeat }}</td>
                  <td><q-badge :color="n.status === 'healthy' ? 'positive' : n.status === 'degraded' ? 'warning' : 'negative'" :label="n.status" /></td>
                  <td>{{ n.workloads }}</td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>

        <!-- Cloud Burst Nodes -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-cloud-upload" size="24px" class="q-mr-sm" />
              <span class="text-h6">Cloud Burst Nodes</span>
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-plus" label="Enroll Node" color="primary" />
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Hostname</th><th class="text-left">Provider</th><th class="text-left">Region</th><th class="text-left">Lifecycle</th><th class="text-left">Node-Days</th><th class="text-left">GPUs</th></tr>
              </thead>
              <tbody>
                <tr v-for="b in cloudBurstNodes" :key="b.hostname">
                  <td class="text-weight-medium">{{ b.hostname }}</td>
                  <td><q-badge outline color="blue-7" :label="b.provider" size="sm" /></td>
                  <td class="text-caption">{{ b.region }}</td>
                  <td><q-badge :color="b.lifecycle === 'active' ? 'positive' : b.lifecycle === 'draining' ? 'warning' : 'grey'" :label="b.lifecycle" /></td>
                  <td>{{ b.nodeDays.toFixed(1) }}</td>
                  <td>{{ b.gpus }}</td>
                </tr>
              </tbody>
            </q-markup-table>
            <div class="text-caption text-grey-8 q-mt-sm">
              <q-icon name="mdi-sigma" size="14px" class="q-mr-xs" />
              Total consumption: {{ cloudBurstNodes.reduce((sum, n) => sum + n.nodeDays, 0).toFixed(1) }} node-days this period
            </div>
          </q-card-section>
        </q-card>

        <!-- Fleet GPU Inventory -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-expansion-card" size="24px" class="q-mr-sm" />
              <span class="text-h6">Fleet GPU Inventory</span>
              <q-space />
              <q-badge color="primary" :label="`${fleetGpuInventory.reduce((s, g) => s + g.count, 0)} GPUs across ${fleetGpuInventory.length} hosts`" />
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Host</th><th class="text-left">Vendor</th><th class="text-left">Model</th><th class="text-left">Count</th><th class="text-left">Utilization</th></tr>
              </thead>
              <tbody>
                <tr v-for="g in fleetGpuInventory" :key="`${g.host}-${g.model}`">
                  <td class="text-weight-medium">{{ g.host }}</td>
                  <td>{{ g.vendor }}</td>
                  <td>{{ g.model }}</td>
                  <td>{{ g.count }}</td>
                  <td style="width: 120px">
                    <div class="row items-center q-gutter-xs">
                      <q-linear-progress :value="g.utilization / 100" :color="g.utilization > 85 ? 'negative' : g.utilization > 60 ? 'warning' : 'positive'" size="8px" rounded style="width: 80px" />
                      <span class="text-caption">{{ g.utilization }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </template>

      <!-- v3.2 — Cloud Burst Self-Serve Billing -->
      <VersionNag v-if="showNag('3.2')" version="3.2" title="Self-Serve Billing" description="Pre-purchase node-day pools, metered billing via Stripe, and usage reports" class="q-mb-lg" />

      <template v-if="atLeast('3.2') && appStore.isFabrick">
        <!-- Pool Balance -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-credit-card-clock" size="24px" class="q-mr-sm" />
              <span class="text-h6">Node-Day Pools</span>
              <q-badge outline color="grey-6" label="v3.2.0" class="q-ml-sm" />
              <q-badge color="amber-9" label="FabricK" class="q-ml-xs" />
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-cart" label="Purchase Days" color="primary" />
            </div>
            <div v-for="pool in billingPools" :key="pool.name" class="q-mb-md">
              <div class="row items-center justify-between q-mb-xs">
                <span class="text-body2 text-weight-medium">{{ pool.name }}</span>
                <div class="row items-center q-gutter-xs">
                  <span class="text-caption">{{ pool.consumed.toFixed(1) }} / {{ pool.purchased }} days</span>
                  <q-badge v-if="pool.autoRenew" outline color="positive" label="Auto-renew" size="sm" />
                  <q-badge v-if="pool.remaining <= pool.renewThreshold" color="negative" label="Low balance" size="sm" />
                </div>
              </div>
              <q-linear-progress :value="pool.consumed / pool.purchased" :color="pool.remaining <= pool.renewThreshold ? 'negative' : 'primary'" size="10px" rounded />
              <div class="text-caption text-grey-8 q-mt-xs">{{ pool.remaining.toFixed(1) }} days remaining · renews at {{ pool.renewThreshold }} days</div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Usage Summary -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-chart-bar" size="24px" class="q-mr-sm" />
              <span class="text-h6">Usage Summary</span>
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Month</th><th class="text-right">Node-Days</th><th class="text-right">GPU-Hours</th><th class="text-right">Cost</th></tr>
              </thead>
              <tbody>
                <tr v-for="u in billingUsage" :key="u.month">
                  <td>{{ u.month }}</td>
                  <td class="text-right">{{ u.nodeDays }}</td>
                  <td class="text-right">{{ u.gpuHours }}</td>
                  <td class="text-right text-weight-medium">{{ u.cost }}</td>
                </tr>
              </tbody>
            </q-markup-table>
            <div class="text-caption text-grey-8 q-mt-sm">
              <q-icon name="mdi-trending-up" size="14px" class="q-mr-xs" />
              Avg burn rate: {{ Math.round(billingUsage.reduce((s, u) => s + u.nodeDays, 0) / billingUsage.length) }} node-days/mo
            </div>
          </q-card-section>
        </q-card>

        <!-- Invoices -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-receipt-text" size="24px" class="q-mr-sm" />
              <span class="text-h6">Invoices</span>
              <q-space />
              <q-badge outline color="deep-purple" size="sm">
                <q-icon name="mdi-credit-card" size="12px" class="q-mr-xs" />Stripe
              </q-badge>
            </div>
            <q-markup-table flat dense bordered>
              <thead>
                <tr><th class="text-left">Invoice</th><th class="text-left">Date</th><th class="text-right">Amount</th><th class="text-left">Status</th><th class="text-left">Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="inv in billingInvoices" :key="inv.id">
                  <td class="text-weight-medium">{{ inv.id }}</td>
                  <td>{{ inv.date }}</td>
                  <td class="text-right">{{ inv.amount }}</td>
                  <td><q-badge :color="inv.status === 'paid' ? 'positive' : inv.status === 'pending' ? 'warning' : 'negative'" :label="inv.status" /></td>
                  <td><q-btn flat dense size="xs" icon="mdi-download" label="PDF" color="grey-7" /></td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </template>

    </template>


    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- WEAVER TEAM (v2.2 — peer federation)                               -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'weaver-team'">

      <q-card v-if="atLeast('2.2') && appStore.isWeaver && !appStore.isFabrick" flat bordered class="q-mt-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="mdi-account-group" size="24px" class="q-mr-sm" />
            <span class="text-h6">Peer Hosts</span>
            <q-badge outline color="grey-6" label="v2.2.0" class="q-ml-sm" />
            <q-badge color="amber-9" label="Weaver Team" class="q-ml-xs" />
          </div>
          <q-markup-table flat dense bordered>
            <thead>
              <tr><th class="text-left">Host</th><th class="text-left">IP</th><th class="text-left">VMs</th><th class="text-left">Status</th></tr>
            </thead>
            <tbody>
              <tr><td>dev-workstation</td><td>100.100.1.10</td><td>4</td><td><q-badge color="positive" label="Connected" /></td></tr>
              <tr><td>staging-box</td><td>100.100.1.11</td><td>6</td><td><q-badge color="positive" label="Connected" /></td></tr>
              <tr><td>build-server</td><td>100.100.1.12</td><td>2</td><td><q-badge color="grey" label="Offline" /></td></tr>
            </tbody>
          </q-markup-table>
          <div class="row q-gutter-sm q-mt-md">
            <q-btn flat dense size="sm" icon="mdi-plus" label="Add peer" color="primary" />
            <q-btn flat dense size="sm" icon="mdi-radar" label="Tailscale scan" color="grey-7" />
          </div>

          <!-- Blue/green deployment -->
          <q-separator class="q-my-md" />
          <div class="row items-center q-mb-sm">
            <q-icon name="mdi-swap-horizontal" size="20px" class="q-mr-sm" />
            <span class="text-subtitle2">Blue/Green Deployment</span>
          </div>
          <div class="row q-gutter-sm items-center">
            <q-badge color="blue" label="Blue (active)" class="q-pa-sm" />
            <q-icon name="mdi-arrow-right" />
            <q-linear-progress :value="0.85" color="blue" track-color="green" style="width:120px" />
            <q-icon name="mdi-arrow-right" />
            <q-badge color="green" label="Green (standby)" class="q-pa-sm" />
          </div>
          <div class="text-caption text-grey-8 q-mt-xs">Traffic weight: 85% blue / 15% green — AI monitoring health</div>
        </q-card-section>
      </q-card>
      <VersionNag v-else-if="showNag('2.2') && appStore.isWeaver" version="2.2" title="Weaver Team" description="Peer host federation — see your team's workloads across hosts with blue/green deployment" class="q-mt-lg" />

    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Mobile preview moved to MobilePreview.vue overlay (toggle in DemoTierSwitcher) -->

  </div>
</template>

<script setup lang="ts">
import { useAppStore } from 'src/stores/app'
import { STATUSES } from 'src/constants/vocabularies'
import {
  isDemoMode,
  isPublicDemo,
  DEMO_STORAGE_POOLS, DEMO_STORAGE_QUOTAS, DEMO_TEMPLATE_REGISTRY,
  DEMO_EDGE_NODES, DEMO_CLOUD_BURST_NODES, DEMO_FLEET_GPU_INVENTORY,
  DEMO_BILLING_POOLS, DEMO_BILLING_USAGE, DEMO_BILLING_INVOICES,
  DEMO_NIXOS_GENERATIONS,
} from 'src/config/demo'
import VersionNag from 'src/components/demo/VersionNag.vue'

defineProps<{
  /** Which page section to render features for */
  section: 'settings' | 'weaver' | 'workload-detail' | 'network' | 'fabrick' | 'weaver-team'
}>()

const appStore = useAppStore()

function atLeast(v: string): boolean {
  // Public demo: only show features that are in the current released Free version (Decision #135)
  // Never show unreleased future features — they leak roadmap info
  if (isPublicDemo()) {
    const ver = parseFloat(v)
    // Only show features at or below the current demo version, and only if released
    return isDemoMode() && appStore.isDemoVersionAtLeast(v) && ver <= parseFloat(appStore.demoVersion)
  }
  return isDemoMode() && appStore.isDemoVersionAtLeast(v)
}

function showNag(v: string): boolean {
  // Public demo: never show version nags — no roadmap leaks (Decision #135)
  if (isPublicDemo()) return false
  return isDemoMode() && !appStore.isDemoVersionAtLeast(v)
}

// ── Mock data ──────────────────────────────────────────────────────────


const mockSnapshots = [
  { id: 's1', label: 'pre-upgrade', date: '2026-03-30 14:22', size: '2.1 GB' },
  { id: 's2', label: 'nightly-auto', date: '2026-03-29 02:00', size: '2.0 GB' },
  { id: 's3', label: 'before-config-change', date: '2026-03-27 09:15', size: '1.9 GB' },
]

const firewallPresets = [
  { name: 'Web Server', icon: 'mdi-web', active: true },
  { name: 'Database', icon: 'mdi-database', active: true },
  { name: 'SSH Only', icon: 'mdi-console', active: false },
  { name: 'Deny All', icon: 'mdi-close-circle', active: false },
  { name: 'Custom', icon: 'mdi-tune', active: false },
]

// v1.2 mock data
const containerLifecycleMocks = [
  { name: 'nginx-proxy', image: 'nginx:1.25', runtime: 'Docker', status: STATUSES.RUNNING },
  { name: 'redis-cache', image: 'redis:7-alpine', runtime: 'Podman', status: STATUSES.RUNNING },
  { name: 'ml-training', image: 'pytorch.sif', runtime: 'Apptainer', status: STATUSES.STOPPED },
]

const sshKeyMocks = [
  { name: 'deploy-key', fingerprint: 'SHA256:7Kj9...xQ4M', added: '2026-02-15', lastUsed: '2026-03-31' },
  { name: 'admin-key', fingerprint: 'SHA256:Rm3f...pL2w', added: '2026-01-10', lastUsed: '2026-03-30' },
]

// v2.1 mock data
const nixosGenerations = DEMO_NIXOS_GENERATIONS

// v2.5 mock data
const storagePools = DEMO_STORAGE_POOLS
const storageQuotas = DEMO_STORAGE_QUOTAS
const templateRegistry = DEMO_TEMPLATE_REGISTRY

// v3.1 mock data
const edgeNodes = DEMO_EDGE_NODES
const cloudBurstNodes = DEMO_CLOUD_BURST_NODES
const fleetGpuInventory = DEMO_FLEET_GPU_INVENTORY

// v3.2 mock data
const billingPools = DEMO_BILLING_POOLS
const billingUsage = DEMO_BILLING_USAGE
const billingInvoices = DEMO_BILLING_INVOICES

</script>

<style scoped lang="scss">
</style>
