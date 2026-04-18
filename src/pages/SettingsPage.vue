<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="text-h4 q-mb-lg">
      <q-icon name="mdi-cog" class="q-mr-sm" />
      Settings
    </div>

    <div class="q-gutter-md" style="max-width: 700px">

      <!-- ═══ GROUP: Host (Solo+ only) ════════════════════════════════════ -->
      <q-item-label v-if="appStore.isWeaver" header class="text-weight-bold text-uppercase text-grey-7 q-px-none">
        Host
      </q-item-label>

      <!-- Host Information -->
      <q-card flat bordered>
        <q-expansion-item icon="mdi-desktop-tower" label="Host Information" caption="NixOS host hardware and metrics" header-class="text-h6">
          <q-card-section>
            <!-- Weaver admin: detailed info -->
            <template v-if="appStore.isWeaver && authStore.isAdmin">
              <q-btn v-if="!hostDetailed" flat color="primary" label="Load Details" icon="mdi-chart-box" :loading="hostDetailLoading" @click="loadHostDetails" />
              <template v-if="hostDetailed">
                <div v-if="hostDetailed.nixosVersion" class="text-body2 q-mb-md">
                  <span class="text-weight-medium">NixOS:</span> {{ hostDetailed.nixosVersion }}
                </div>
                <div v-if="hostDetailed.cpuTopology" class="q-mb-md">
                  <div class="text-subtitle2 q-mb-xs">CPU Topology</div>
                  <q-markup-table flat dense bordered separator="horizontal">
                    <tbody>
                      <tr v-if="hostDetailed.cpuTopology.sockets"><td class="text-weight-medium" style="width:140px">Sockets</td><td>{{ hostDetailed.cpuTopology.sockets }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.coresPerSocket"><td class="text-weight-medium">Cores/Socket</td><td>{{ hostDetailed.cpuTopology.coresPerSocket }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.threadsPerCore"><td class="text-weight-medium">Threads/Core</td><td>{{ hostDetailed.cpuTopology.threadsPerCore }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.virtualizationType"><td class="text-weight-medium">Virtualization</td><td>{{ hostDetailed.cpuTopology.virtualizationType }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.l1dCache"><td class="text-weight-medium">L1d Cache</td><td>{{ hostDetailed.cpuTopology.l1dCache }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.l1iCache"><td class="text-weight-medium">L1i Cache</td><td>{{ hostDetailed.cpuTopology.l1iCache }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.l2Cache"><td class="text-weight-medium">L2 Cache</td><td>{{ hostDetailed.cpuTopology.l2Cache }}</td></tr>
                      <tr v-if="hostDetailed.cpuTopology.l3Cache"><td class="text-weight-medium">L3 Cache</td><td>{{ hostDetailed.cpuTopology.l3Cache }}</td></tr>
                    </tbody>
                  </q-markup-table>
                </div>
                <div v-if="hostDetailed.diskUsage.length" class="q-mb-md">
                  <div class="text-subtitle2 q-mb-xs">Disk Usage</div>
                  <q-markup-table flat dense bordered separator="horizontal">
                    <thead><tr><th class="text-left">Mount</th><th class="text-left">Size</th><th class="text-left">Used</th><th class="text-left">Avail</th><th class="text-left">Use%</th></tr></thead>
                    <tbody>
                      <tr v-for="d in hostDetailed.diskUsage" :key="d.mountPoint">
                        <td>{{ d.mountPoint }}</td><td>{{ d.sizeHuman }}</td><td>{{ d.usedHuman }}</td><td>{{ d.availHuman }}</td>
                        <td><q-linear-progress :value="d.usePercent / 100" :color="d.usePercent > 90 ? 'negative' : d.usePercent > 75 ? 'warning' : 'positive'" style="width: 60px; display: inline-block" class="q-mr-xs" /> {{ d.usePercent }}%</td>
                      </tr>
                    </tbody>
                  </q-markup-table>
                </div>
                <div v-if="hostDetailed.networkInterfaces.length" class="q-mb-md">
                  <div class="text-subtitle2 q-mb-xs">Network Interfaces</div>
                  <q-markup-table flat dense bordered separator="horizontal">
                    <thead><tr><th class="text-left">Name</th><th class="text-left">State</th><th class="text-left">MAC</th></tr></thead>
                    <tbody>
                      <tr v-for="iface in hostDetailed.networkInterfaces" :key="iface.name">
                        <td>{{ iface.name }}</td><td><q-badge :color="iface.state === 'UP' ? 'positive' : 'grey'" :label="iface.state" /></td><td class="text-caption">{{ iface.macAddress ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </q-markup-table>
                </div>
                <div class="q-mb-md">
                  <div class="text-subtitle2 q-mb-xs">Live Metrics</div>
                  <q-markup-table flat dense bordered separator="horizontal">
                    <tbody>
                      <tr><td class="text-weight-medium" style="width:140px">Free RAM</td><td>{{ Math.round(hostDetailed.liveMetrics.freeMemMb / 1024 * 10) / 10 }} GB</td></tr>
                      <tr><td class="text-weight-medium">Load (1m)</td><td>{{ hostDetailed.liveMetrics.loadAvg1.toFixed(2) }}</td></tr>
                      <tr><td class="text-weight-medium">Load (5m)</td><td>{{ hostDetailed.liveMetrics.loadAvg5.toFixed(2) }}</td></tr>
                      <tr><td class="text-weight-medium">Load (15m)</td><td>{{ hostDetailed.liveMetrics.loadAvg15.toFixed(2) }}</td></tr>
                    </tbody>
                  </q-markup-table>
                </div>
              </template>
            </template>
            <!-- Non-weaver: upgrade prompt -->
            <div v-else-if="!appStore.isWeaver" class="row items-center q-gutter-md">
              <q-icon name="mdi-lock" size="32px" color="grey-5" />
              <div class="text-body2 text-grey-8">
                Detailed host metrics (CPU topology, disk usage, network interfaces) are available with
                <q-badge outline color="purple" label="Weaver Solo" /> or higher.
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- System Health (Doctor) — admin only -->
      <q-card v-if="authStore.isAdmin" flat bordered>
        <q-expansion-item icon="mdi-stethoscope" label="System Health" caption="Hardware readiness diagnostics" header-class="text-h6">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-space />
              <q-btn flat dense color="primary" :label="doctorResult ? 'Re-run' : 'Run Diagnostics'" icon="mdi-play-circle-outline" :loading="doctorLoading" @click="runDoctor" />
            </div>
            <template v-if="doctorResult">
              <q-banner rounded :class="doctorBannerClass" class="q-mb-md">
                <template #avatar><q-icon :name="doctorBannerIcon" :color="doctorBannerColor" /></template>
                {{ doctorResult.summary.passed }} passed, {{ doctorResult.summary.warned }} warnings, {{ doctorResult.summary.failed }} failed
                <span class="text-caption q-ml-sm">({{ doctorResult.durationMs }}ms)</span>
              </q-banner>
              <q-list separator dense>
                <q-item v-for="c in doctorResult.checks" :key="c.check" class="q-py-xs">
                  <q-item-section avatar style="min-width: 28px">
                    <q-icon :name="c.status === 'pass' ? 'mdi-check-circle' : c.status === 'warn' ? 'mdi-alert' : 'mdi-close-circle'" :color="c.status === 'pass' ? 'positive' : c.status === 'warn' ? 'warning' : 'negative'" size="18px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-body2">{{ c.check }}</q-item-label>
                    <q-item-label caption>{{ c.detail }}</q-item-label>
                    <q-item-label v-if="c.remediation && c.status !== 'pass'" caption class="text-orange-8">{{ c.remediation }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </template>
            <div v-else-if="!doctorLoading" class="text-caption text-grey-8">
              Click "Run Diagnostics" to verify hardware, system, and Weaver configuration.
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- Host Config Viewer -->
      <HostConfigViewer />

      <!-- ═══ GROUP: License & Identity (Solo+ only) ══════════════════════ -->
      <q-item-label v-if="appStore.isWeaver" header class="text-weight-bold text-uppercase text-grey-7 q-px-none">
        License &amp; Identity
      </q-item-label>

      <!-- License -->
      <q-card flat bordered>
        <q-expansion-item icon="mdi-license" label="License" :caption="tierBadgeLabel" header-class="text-h6">
          <q-card-section>
            <div class="q-gutter-md">
              <!-- Activation status -->
              <div class="row items-center q-gutter-sm">
                <q-icon :name="licenseActivated ? 'mdi-check-circle' : 'mdi-account-check'" :color="licenseActivated ? 'positive' : 'teal'" size="24px" />
                <span class="text-body1 text-weight-medium">{{ licenseActivated ? 'Activated' : 'Weaver Free — no license key required' }}</span>
                <q-badge :color="tierBadgeColor" :label="tierBadgeLabel" />
              </div>

              <!-- License key details (when activated) -->
              <q-markup-table v-if="licenseActivated" flat dense bordered separator="horizontal">
                <tbody>
                  <tr><td class="text-weight-medium" style="width:140px">License key</td><td class="text-caption" style="font-family: monospace">{{ mockLicenseKey }}</td></tr>
                  <tr><td class="text-weight-medium">Tier</td><td><q-badge :color="tierBadgeColor" :label="tierBadgeLabel" /></td></tr>
                  <tr v-if="appStore.effectiveTier === TIERS.SOLO && appStore.demoWeaverSubTier === 'team'"><td class="text-weight-medium">Seats</td><td>4 users + 1 viewer</td></tr>
                  <tr><td class="text-weight-medium">Status</td><td><q-badge color="positive" label="Valid" /></td></tr>
                  <tr><td class="text-weight-medium">Issued</td><td>{{ mockLicenseIssued }}</td></tr>
                  <tr><td class="text-weight-medium">Expires</td><td>{{ mockLicenseExpiry }}</td></tr>
                  <tr v-if="mockFmSlot"><td class="text-weight-medium">Program</td><td><q-badge color="amber-9" label="Founding Member" /> <span class="text-caption text-grey-8 q-ml-xs">#{{ mockFmSlot.current }} of {{ mockFmSlot.cap }}</span></td></tr>
                  <tr><td class="text-weight-medium">Pricing</td><td>{{ mockLicensePricing }} <span v-if="mockFmSlot" class="text-caption text-grey-8 q-ml-xs">(standard: {{ mockStandardPricing }}) — locked forever</span></td></tr>
                  <tr v-if="mockFmSlot"><td class="text-weight-medium">FM window</td><td>Closes at {{ mockFmSlot.capVersion }} or when {{ mockFmSlot.cap }} slots fill</td></tr>
                </tbody>
              </q-markup-table>

              <!-- Deactivate -->
              <q-btn v-if="licenseActivated" flat dense color="negative" label="Deactivate License" icon="mdi-close-circle" @click="deactivateLicense" />

              <!-- Grace period warning -->
              <q-banner v-if="appStore.tierGraceMode" rounded class="bg-orange-1 text-orange-9">
                <template #avatar><q-icon name="mdi-alert" color="orange" /></template>
                Your license has expired but is in a 30-day grace period.
                Please renew your license to maintain access.
              </q-banner>

              <!-- Upgrade prompt (Free tier) -->
              <q-banner v-if="appStore.isFree" rounded class="bg-blue-1 text-blue-9">
                <template #avatar><q-icon name="mdi-arrow-up-circle" color="blue" /></template>
                Upgrade to Weaver Solo to unlock Live Provisioning, host metrics, distro management, push notifications, and more. Configure your license key in the NixOS module. See the Admin Guide for details.
              </q-banner>
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- Organization Identity (admin, weaver+) -->
      <q-card v-if="authStore.isAdmin && appStore.isWeaver" flat bordered>
        <q-expansion-item icon="mdi-domain" label="Identity" caption="Organization name, logo, contact" header-class="text-h6">
          <q-card-section>
            <div class="q-gutter-y-md">
              <q-input v-model="orgName" label="Organization Name" filled hint="Shown in browser tab, header, and login page" maxlength="100" data-testid="org-name-input"><template #prepend><q-icon name="mdi-office-building" /></template></q-input>
              <q-input v-model="orgLogoUrl" label="Logo URL" filled hint="URL or data URI for your logo (shown in header and login page)" data-testid="org-logo-input"><template #prepend><q-icon name="mdi-image" /></template></q-input>
              <div v-if="orgLogoUrl" class="row items-center q-gutter-sm">
                <span class="text-caption text-grey-8">Preview:</span>
                <img :src="orgLogoUrl" alt="Logo preview" style="max-height: 40px; max-width: 200px; object-fit: contain" />
              </div>
              <q-input v-model="orgContactEmail" label="Contact Email" filled type="email" hint="Shown on the Help page" data-testid="org-email-input"><template #prepend><q-icon name="mdi-email" /></template></q-input>
              <q-input v-model="orgContactPhone" label="Contact Phone" filled hint="Shown on the Help page" data-testid="org-phone-input"><template #prepend><q-icon name="mdi-phone" /></template></q-input>
              <q-btn color="primary" label="Save Identity" icon="mdi-content-save" :loading="savingIdentity" @click="saveIdentity" />
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- ═══ GROUP: AI (Solo+ only) ══════════════════════════════════════ -->
      <q-item-label v-if="appStore.isWeaver" header class="text-weight-bold text-uppercase text-grey-7 q-px-none">
        AI
      </q-item-label>

      <!-- AI Default (server key) — Solo only. Free uses BYOK; Team/Fabrick use credential vault. -->
      <q-card v-if="appStore.isWeaver && !isTeamOrFabrick" flat bordered>
        <q-expansion-item icon="mdi-robot" label="AI Default" caption="Server-side AI key status" header-class="text-h6">
          <q-card-section>
            <div class="q-gutter-md">
              <div class="row items-center q-gutter-sm">
                <q-icon
                  :name="appStore.serverKeyAllowed ? 'mdi-check-circle' : appStore.hasServerKey ? 'mdi-lock' : 'mdi-close-circle'"
                  :color="appStore.serverKeyAllowed ? 'positive' : appStore.hasServerKey ? 'orange' : 'grey-5'"
                  size="20px"
                />
                <span class="text-body2">
                  {{ appStore.serverKeyAllowed ? 'Server AI key active' : appStore.hasServerKey ? 'Server AI key configured but locked' : 'No server AI key configured' }}
                </span>
                <q-badge v-if="!appStore.isWeaver" outline color="amber-9" label="Weaver Solo" />
              </div>
              <div v-if="!appStore.hasServerKey" class="text-caption text-grey-8">
                Set <code>aiApiKey</code> in the NixOS module to provide a shared server key for all users.
              </div>
              <div v-if="appStore.hasServerKey && !appStore.serverKeyAllowed" class="text-caption text-orange-8">
                A server AI key is configured by the administrator but requires a Weaver Solo or higher license to use. Provide your own key via BYOK below.
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- AI Credential Vault — Team and Fabrick (v1.4+). Replaces BYOK and AI Default. -->
      <q-card v-if="isTeamOrFabrick && isDemoMode() && appStore.isDemoVersionAtLeast('1.4')" flat bordered>
        <q-expansion-item icon="mdi-shield-key" label="AI Credential Vault" caption="Admin-managed AI credentials for the team" header-class="text-h6">
          <q-card-section>
            <div class="text-caption text-grey-7 q-mb-md">
              Centrally managed AI credentials shared with all users. Keys are stored server-side in an encrypted vault (SQLCipher) — users never handle API keys directly.
            </div>
            <q-markup-table flat dense bordered separator="horizontal">
              <thead>
                <tr><th class="text-left">Name</th><th class="text-left">Provider</th><th class="text-left">Added</th><th class="text-left">Last rotated</th><th class="text-left">Status</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-weight-medium">prod-claude</td>
                  <td><q-badge color="deep-purple" label="Anthropic" /></td>
                  <td class="text-caption">2026-02-15</td>
                  <td class="text-caption">2026-03-10</td>
                  <td><q-badge color="positive" label="Active" /></td>
                </tr>
                <tr>
                  <td class="text-weight-medium">dev-ollama</td>
                  <td><q-badge color="grey-7" label="Ollama" /></td>
                  <td class="text-caption">2026-03-01</td>
                  <td class="text-caption">—</td>
                  <td><q-badge color="positive" label="Active" /></td>
                </tr>
                <tr v-if="appStore.isFabrick">
                  <td class="text-weight-medium">compliance-local</td>
                  <td><q-badge color="teal" label="Local LLM" /></td>
                  <td class="text-caption">2026-03-20</td>
                  <td class="text-caption">—</td>
                  <td><q-badge color="positive" label="Active" /></td>
                </tr>
              </tbody>
            </q-markup-table>
            <div class="row q-gutter-sm q-mt-md">
              <q-btn flat dense size="sm" icon="mdi-plus" label="Add credential" color="primary" />
              <q-btn flat dense size="sm" icon="mdi-rotate-right" label="Rotate selected" color="grey-7" />
            </div>
            <div v-if="appStore.isFabrick" class="text-caption text-grey-8 q-mt-sm">
              <q-icon name="mdi-shield-check" size="14px" class="q-mr-xs" />
              FabricK: full audit trail of credential access and rotation events
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- AI Provider (BYOK) — Free and Solo only. Team/Fabrick use credential vault. -->
      <q-card v-if="!isTeamOrFabrick" flat bordered>
        <q-expansion-item icon="mdi-key-variant" label="AI Provider (BYOK)" caption="Your personal API key" header-class="text-h6">
          <q-card-section>
            <div class="q-gutter-md">
              <q-select v-model="settingsStore.llmVendor" label="Vendor" outlined dense :options="byokVendorOptions" emit-value map-options :disable="settingsStore.useServerKey" />
              <q-input v-model="byokApiKeyInput" label="API Key (BYOK)" outlined dense :type="showByokKey ? 'text' : 'password'" :disable="settingsStore.useServerKey" hint="Anthropic API key (starts with sk-ant-)" @update:model-value="onByokKeyChange">
                <template #append><q-icon :name="showByokKey ? 'mdi-eye-off' : 'mdi-eye'" class="cursor-pointer" @click="showByokKey = !showByokKey" /></template>
              </q-input>
              <div v-if="appStore.serverKeyAllowed" class="row items-center q-gutter-sm">
                <q-toggle :model-value="settingsStore.useServerKey" label="Use server-configured key" @update:model-value="settingsStore.toggleServerKey($event)" />
              </div>
              <q-banner rounded class="bg-orange-1 text-orange-9">
                <template #avatar><q-icon name="mdi-shield-alert" color="orange" /></template>
                <div class="text-weight-medium">Your key, your responsibility.</div>
                <div class="text-body2 q-mt-xs">
                  Your API key is stored in your browser only — Weaver never sees or stores it.
                  You are responsible for your key's security and all costs incurred through its use.
                  Third-party API provider terms apply. Use a restricted key with minimal permissions
                  and do not enter keys on shared or public devices.
                  <router-link to="/docs/terms-of-service" class="text-primary">Full terms</router-link>.
                </div>
              </q-banner>
              <q-btn flat color="negative" label="Clear Key" icon="mdi-delete" :disable="!settingsStore.hasUserKey" @click="clearByokKey" />
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- Per-Workload AI Assignment (Fabrick admin only) -->
      <q-card v-if="authStore.isAdmin && appStore.isFabrick" flat bordered>
        <q-expansion-item icon="mdi-robot-outline" label="Workload AI Assignment" caption="Per-workload AI provider override" header-class="text-h6">
          <q-card-section>
            <q-badge color="amber-9" label="FabricK" class="q-mb-md" />
            <div class="text-caption text-grey-7 q-mb-md">
              Set a per-workload AI provider override. When set, this overrides the user's BYOK preference for that workload.
            </div>
            <q-markup-table flat dense bordered separator="horizontal">
              <thead><tr><th class="text-left">Workload</th><th class="text-left">Type</th><th class="text-left" style="min-width: 200px">AI Provider Override</th></tr></thead>
              <tbody>
                <tr v-for="wl in workloadAiRows" :key="wl.name">
                  <td class="text-weight-medium">{{ wl.name }}</td>
                  <td><q-badge :color="wl.type === 'vm' ? 'primary' : 'teal'" :label="wl.type" /></td>
                  <td><q-select v-model="wl.provider" :options="aiProviderOptions" emit-value map-options dense outlined style="min-width: 190px" @update:model-value="onWorkloadAiChange(wl.name, $event)" /></td>
                </tr>
              </tbody>
            </q-markup-table>
            <div class="text-caption text-orange-8 q-mt-md row items-center q-gutter-xs">
              <q-icon name="mdi-progress-clock" />
              <span>Per-workload override persistence is coming in a future release.</span>
            </div>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- ═══ GROUP: Workloads (Solo+ only) ═══════════════════════════════ -->
      <q-item-label v-if="appStore.isWeaver" header class="text-weight-bold text-uppercase text-grey-7 q-px-none">
        Workloads
      </q-item-label>

      <!-- Distributions & Image URLs -->
      <q-card flat bordered>
        <q-expansion-item icon="mdi-linux" label="Distributions & Image URLs" caption="Cloud images for VM provisioning" header-class="text-h6">
          <q-card-section>
            <div v-if="appStore.isWeaver" class="row q-gutter-sm q-mb-md">
              <q-btn v-if="authStore.canManageDistros" flat dense color="primary" label="Check URLs" icon="mdi-link-variant" :loading="validatingUrls" @click="validateUrls" />
              <q-btn v-if="authStore.canManageVms" flat dense color="primary" label="Refresh Catalog" icon="mdi-refresh" :loading="refreshingCatalog" @click="refreshCatalog" />
              <div v-if="urlStatus.lastRunAt" class="self-center text-caption text-grey-8">URLs last checked: {{ formatRelativeTime(urlStatus.lastRunAt) }}</div>
            </div>
            <q-list v-if="visibleDistros.length" separator>
              <q-item v-for="d in visibleDistros" :key="d.name" class="q-py-sm">
                <q-item-section>
                  <q-item-label class="row items-center q-gutter-xs">
                    <span>{{ d.label }}</span>
                    <q-badge :color="categoryColor(d.category)" :label="d.category" dense />
                    <q-badge v-if="d.hasOverride" outline color="deep-orange" label="overridden" dense />
                    <q-badge v-if="d.guestOs === 'windows'" outline color="orange" label="Windows" dense />
                    <q-badge v-if="d.cloudInit" outline color="blue" label="cloud-init" dense />
                  </q-item-label>
                  <q-item-label caption class="row items-center q-mt-xs">
                    <q-icon v-if="appStore.isWeaver" :name="urlStatusIcon(d.name)" :color="urlStatusColor(d.name)" size="14px" class="q-mr-xs" />
                    <template v-if="editingUrl === d.name">
                      <q-input v-model="editUrlValue" dense outlined class="col" placeholder="https://... or file:///path/to/image" @keyup.enter="saveUrl(d.name)" @keyup.escape="editingUrl = null">
                        <template #after>
                          <q-btn flat dense icon="mdi-check" color="positive" :loading="savingUrl" @click="saveUrl(d.name)" />
                          <q-btn flat dense icon="mdi-close" @click="editingUrl = null" />
                        </template>
                      </q-input>
                    </template>
                    <template v-else>
                      <span class="ellipsis" style="max-width: 420px">{{ d.effectiveUrl || 'No URL' }}</span>
                    </template>
                  </q-item-label>
                </q-item-section>
                <q-item-section side v-if="authStore.canManageDistros && appStore.isWeaver">
                  <div class="row q-gutter-xs items-center">
                    <template v-if="appStore.provisioningEnabled">
                      <q-btn v-if="distroTestStatus[d.name]?.status !== STATUSES.RUNNING" flat dense icon="mdi-play-circle-outline" :color="testStatusColor(d.name)" size="sm" @click="startDistroTest(d.name)"><q-tooltip>{{ testTooltip(d.name) }}</q-tooltip></q-btn>
                      <q-spinner-dots v-else color="primary" size="20px" class="q-mx-xs" />
                      <q-icon v-if="distroTestStatus[d.name]?.status === 'passed'" name="mdi-check-circle" color="positive" size="18px"><q-tooltip>Test passed ({{ distroTestStatus[d.name]?.durationSeconds }}s)</q-tooltip></q-icon>
                      <q-icon v-else-if="distroTestStatus[d.name]?.status === STATUSES.FAILED" name="mdi-alert-circle" color="negative" size="18px"><q-tooltip>Test failed: {{ distroTestStatus[d.name]?.error }}</q-tooltip></q-icon>
                    </template>
                    <q-btn v-if="editingUrl !== d.name" flat dense icon="mdi-pencil" size="sm" @click="startEditUrl(d)"><q-tooltip>Edit URL</q-tooltip></q-btn>
                    <q-btn v-if="d.hasOverride && d.category !== 'custom'" flat dense icon="mdi-undo" color="deep-orange" size="sm" :loading="resettingUrl === d.name" @click="resetUrlOverride(d.name, d.label)"><q-tooltip>Reset to default URL</q-tooltip></q-btn>
                    <q-btn v-if="d.category === 'custom'" flat dense icon="mdi-delete" color="negative" size="sm" :loading="removingDistro === d.name" @click="confirmRemoveDistro(d.name, d.label)"><q-tooltip>Remove custom distro</q-tooltip></q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-grey-8">{{ appStore.isWeaver ? 'No distributions loaded.' : 'No distributions detected on registered VMs.' }}</div>
            <!-- Free tier: weaver nag -->
            <div v-if="!appStore.isWeaver" class="row items-center q-gutter-md q-mt-md">
              <q-icon name="mdi-lock" size="32px" color="grey-5" />
              <div class="text-body2 text-grey-8">
                <q-badge outline color="purple" label="Weaver Solo" /> unlocks the full distribution catalog,
                URL validation &amp; editing, custom distributions, catalog refresh, and smoke testing.
              </div>
            </div>
            <!-- Add new custom distro form (admin + weaver) -->
            <q-expansion-item v-if="authStore.canManageDistros && appStore.isWeaver" :key="addFormKey" icon="mdi-plus" label="Add custom distribution" dense header-class="text-primary q-mt-md">
              <q-card>
                <q-card-section>
                  <q-form @submit="addDistro" class="q-gutter-sm">
                    <q-input v-model="newDistro.name" label="Short Name *" outlined dense hint="Used internally — e.g. manjaro, void, gentoo" :rules="[nameRule]" lazy-rules />
                    <q-input v-model="newDistro.label" label="Full Name *" outlined dense hint="Shown in dropdowns — e.g. Manjaro 24.1, Void Linux" :rules="[(v: string) => !!v || 'Required']" lazy-rules />
                    <q-input v-model="newDistro.url" label="Cloud Image URL *" outlined dense placeholder="https://... or file:///path/to/image" hint="Remote URL or local path (file:///var/lib/images/my.iso)" :rules="[(v: string) => !!v || 'Required']" lazy-rules />
                    <q-select v-model="newDistro.format" label="Format" outlined dense :options="formatOptions" emit-value map-options />
                    <q-select v-model="newDistro.guestOs" label="Guest OS" outlined dense :options="guestOsOptions" emit-value map-options />
                    <q-toggle v-model="newDistro.cloudInit" label="Supports cloud-init" :disable="newDistro.guestOs === 'windows'" />
                    <div class="row justify-end">
                      <q-btn color="primary" label="Add Distribution" type="submit" :loading="addingDistro" icon="mdi-plus" dense />
                    </div>
                  </q-form>
                </q-card-section>
              </q-card>
            </q-expansion-item>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- Tag Management (admin only) -->
      <TagManagement v-if="authStore.isAdmin" />

      <!-- Notifications -->
      <NotificationSettings />

      <!-- Resource Quotas (weaver+ admin only) -->
      <q-card v-if="authStore.isAdmin && appStore.isWeaver" flat bordered>
        <q-expansion-item icon="mdi-gauge" label="Resource Quotas" :caption="appStore.isFabrick ? 'Per-user VM, memory, vCPU limits' : 'Fabrick tier'" header-class="text-h6">
          <q-card-section>
            <template v-if="appStore.isFabrick">
              <div class="text-body2 text-grey-8">
                Set per-user VM, memory, and vCPU limits from the
                <router-link to="/users" class="text-primary">Users</router-link> page.
                Select a user and configure their quota allocation.
              </div>
            </template>
            <template v-else>
              <div class="row items-center q-gutter-md">
                <q-icon name="mdi-lock" size="32px" color="grey-5" />
                <div class="text-body2 text-grey-8">Per-user resource quotas (VMs, memory, vCPUs) are available on the Fabrick tier.</div>
              </div>
            </template>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- Demo version feature previews (private demo only) -->
      <DemoVersionFeatures v-if="isDemoMode()" section="settings" />

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useSettingsStore } from 'src/stores/settings-store'
import { useAppStore } from 'src/stores/app'
import { useAuthStore } from 'src/stores/auth-store'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useHostInfo } from 'src/composables/useHostInfo'
import { isDemoMode } from 'src/config/demo-mode'
import { distroApiService, organizationApiService, doctorApiService, type DistroEntry, type CustomDistroInput, type UrlValidationData, type DistroTestStatus } from 'src/services/api'
import type { DoctorResult } from 'src/types/host'

import NotificationSettings from 'src/components/settings/NotificationSettings.vue'
import TagManagement from 'src/components/settings/TagManagement.vue'
import HostConfigViewer from 'src/components/settings/HostConfigViewer.vue'
import DemoVersionFeatures from 'src/components/demo/DemoVersionFeatures.vue'
import { extractErrorMessage } from 'src/utils/error'
import { TIERS, STATUSES } from 'src/constants/vocabularies'
import { PRICING, FM_SLOTS } from 'src/constants/pricing'

const $q = useQuasar()
const settingsStore = useSettingsStore()
const appStore = useAppStore()
const authStore = useAuthStore()
const workloadStore = useWorkloadStore()
const { detailed: hostDetailed, fetchDetailed, loading: hostDetailLoading } = useHostInfo()

async function loadHostDetails() {
  await fetchDetailed()
}

// --- System Health (Doctor) ---
const doctorResult = ref<DoctorResult | null>(null)
const doctorLoading = ref(false)

const DEMO_DOCTOR_RESULT: DoctorResult = {
  timestamp: new Date().toISOString(),
  durationMs: 42,
  summary: { total: 14, passed: 12, warned: 2, failed: 0, result: 'warn' },
  checks: [
    { check: 'Architecture', status: 'pass', detail: 'x86_64', remediation: null },
    { check: 'CPU virtualization', status: 'pass', detail: 'Intel VT-x detected', remediation: null },
    { check: 'KVM module', status: 'pass', detail: 'Loaded (kvm_intel, kvm)', remediation: null },
    { check: '/dev/kvm', status: 'pass', detail: 'Accessible (read/write)', remediation: null },
    { check: 'IOMMU', status: 'warn', detail: 'Not detected (device passthrough unavailable)', remediation: 'Enable VT-d in BIOS' },
    { check: 'RAM', status: 'pass', detail: '32768 MB (minimum: 2048 MB)', remediation: null },
    { check: 'Disk space', status: 'pass', detail: '58000 MB available on /', remediation: null },
    { check: 'NixOS version', status: 'pass', detail: '25.11.717285 (demo)', remediation: null },
    { check: 'Bridge module', status: 'pass', detail: 'Loaded', remediation: null },
    { check: 'QEMU', status: 'pass', detail: 'QEMU emulator version 8.2.0', remediation: null },
    { check: 'IP forwarding', status: 'pass', detail: 'Enabled', remediation: null },
    { check: 'Data directory', status: 'pass', detail: 'Writable', remediation: null },
    { check: 'Bridge interface', status: 'warn', detail: 'br-microvm not found (demo mode)', remediation: 'Configure bridge networking' },
    { check: 'License', status: 'pass', detail: 'Weaver Solo (valid)', remediation: null },
  ],
}

async function runDoctor() {
  doctorLoading.value = true
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 800))
    doctorResult.value = { ...DEMO_DOCTOR_RESULT, timestamp: new Date().toISOString() }
    doctorLoading.value = false
    return
  }
  try {
    doctorResult.value = await doctorApiService.runDiagnostics()
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Diagnostics failed'), position: 'top-right', timeout: 5000 })
  } finally {
    doctorLoading.value = false
  }
}

const doctorBannerColor = computed(() => {
  if (!doctorResult.value) return 'grey'
  const r = doctorResult.value.summary.result
  return r === 'pass' ? 'positive' : r === 'warn' ? 'warning' : 'negative'
})

const doctorBannerClass = computed(() => {
  if (!doctorResult.value) return ''
  const r = doctorResult.value.summary.result
  return r === 'pass' ? 'bg-green-1 text-green-9'
    : r === 'warn' ? 'bg-orange-1 text-orange-9'
    : 'bg-red-1 text-red-9'
})

const doctorBannerIcon = computed(() => {
  if (!doctorResult.value) return 'mdi-help-circle'
  const r = doctorResult.value.summary.result
  return r === 'pass' ? 'mdi-check-circle' : r === 'warn' ? 'mdi-alert' : 'mdi-close-circle'
})

// --- Organization Identity ---
const orgName = ref(appStore.organization?.name ?? '')
const orgLogoUrl = ref(appStore.organization?.logoUrl ?? '')
const orgContactEmail = ref(appStore.organization?.contactEmail ?? '')
const orgContactPhone = ref(appStore.organization?.contactPhone ?? '')
const savingIdentity = ref(false)

async function saveIdentity() {
  savingIdentity.value = true
  try {
    const updated = await organizationApiService.setIdentity({
      name: orgName.value || '',
      logoUrl: orgLogoUrl.value || null,
      contactEmail: orgContactEmail.value || null,
      contactPhone: orgContactPhone.value || null,
    })
    appStore.organization = updated
    $q.notify({ type: 'positive', message: 'Identity saved' })
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to save identity') })
  } finally {
    savingIdentity.value = false
  }
}

// --- License management ---

const MOCK_LICENSE_KEYS: Record<string, string> = {
  [TIERS.SOLO]:  'WVR-WVS-3N7R2-F4J8L',
  [TIERS.FABRICK]: 'WVR-FAB-1D5V9-H6T3W',
}
const MOCK_LICENSE_KEYS_TEAM = 'WVR-WVT-6A8C4-M2Y7B'

const licenseActivated = computed(() =>
  appStore.effectiveTier !== TIERS.DEMO && appStore.effectiveTier !== TIERS.FREE
)

const mockLicenseKey = computed(() => {
  if (appStore.effectiveTier === TIERS.SOLO && appStore.demoWeaverSubTier === 'team') return MOCK_LICENSE_KEYS_TEAM
  return MOCK_LICENSE_KEYS[appStore.effectiveTier] ?? ''
})

const mockLicenseIssued = computed(() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 2)
  return d.toLocaleDateString()
})

const mockLicenseExpiry = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString()
})

interface FmSlotInfo { current: number; cap: number; capVersion: string }

const mockFmSlot = computed((): FmSlotInfo | null => {
  const tier = appStore.effectiveTier
  if (tier === TIERS.FREE) return null // Free has no FM program
  if (tier === TIERS.SOLO) {
    if (appStore.demoWeaverSubTier === 'team') return { current: 12, cap: FM_SLOTS.team.cap, capVersion: FM_SLOTS.team.capVersion }
    return { current: 47, cap: FM_SLOTS.solo.cap, capVersion: FM_SLOTS.solo.capVersion }
  }
  if (tier === TIERS.FABRICK) return { current: 8, cap: FM_SLOTS.fabrick.cap, capVersion: FM_SLOTS.fabrick.capVersion }
  return null
})

const mockLicensePricing = computed(() => {
  const tier = appStore.effectiveTier
  if (tier === TIERS.FREE) return PRICING.free.fm
  if (tier === TIERS.SOLO) {
    return appStore.demoWeaverSubTier === 'team' ? PRICING.team.fm : PRICING.solo.fm
  }
  if (tier === TIERS.FABRICK) return PRICING.fabrick.fm
  return '—'
})

const mockStandardPricing = computed(() => {
  const tier = appStore.effectiveTier
  if (tier === TIERS.SOLO) {
    return appStore.demoWeaverSubTier === 'team' ? PRICING.team.standard : PRICING.solo.standard
  }
  if (tier === TIERS.FABRICK) return PRICING.fabrick.standard
  return '—'
})

function deactivateLicense() {
  $q.dialog({
    title: 'Deactivate License',
    message: 'This will revert to Weaver Free. Features above your new tier will become unavailable.',
    cancel: true,
    persistent: false,
    color: 'negative',
  }).onOk(() => {
    $q.notify({ type: 'info', message: 'License deactivated — reverted to Weaver Free', position: 'top-right', timeout: 3000 })
  })
}

// --- License tier display ---

const TIER_LABELS: Record<string, string> = {
  [TIERS.DEMO]: 'Demo',
  [TIERS.FREE]: 'Weaver Free',
  [TIERS.SOLO]: 'Weaver Solo',
  [TIERS.FABRICK]: 'FabricK',
}

const TIER_COLORS: Record<string, string> = {
  [TIERS.DEMO]: 'grey',
  [TIERS.FREE]: 'teal',
  [TIERS.SOLO]: 'purple',
  [TIERS.FABRICK]: 'amber-9',
}

const isTeamOrFabrick = computed(() =>
  (appStore.isWeaver && appStore.demoWeaverSubTier === 'team') || appStore.isFabrick
)
const tierBadgeLabel = computed(() => TIER_LABELS[appStore.effectiveTier] ?? 'Demo')
const tierBadgeColor = computed(() => TIER_COLORS[appStore.effectiveTier] ?? 'grey')

// --- Per-workload AI assignment (Fabrick admin) ---

interface WorkloadAiRow { name: string; type: 'vm' | 'container'; provider: string }

const aiProviderOptions = [
  { label: 'Default (user preference)', value: 'default' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'ZenCoder', value: 'zencoder' },
  { label: 'Local LLM (air-gap)', value: 'local' },
]

const DEMO_WORKLOAD_AI_ROWS: WorkloadAiRow[] = [
  { name: 'web-nginx', type: 'vm', provider: 'default' },
  { name: 'web-app', type: 'vm', provider: 'anthropic' },
  { name: 'dev-node', type: 'vm', provider: 'default' },
  { name: 'dev-python', type: 'vm', provider: 'zencoder' },
  { name: 'svc-postgres', type: 'vm', provider: 'local' },
]

const workloadAiRows = ref<WorkloadAiRow[]>(isDemoMode() ? [...DEMO_WORKLOAD_AI_ROWS] : [])

function onWorkloadAiChange(name: string, provider: string) {
  // Not yet persisted — future backend endpoint: PUT /api/workloads/:name/ai-provider
  void name; void provider
}

// --- BYOK (personal AI key — all users) ---

const showByokKey = ref(false)
const byokApiKeyInput = ref(settingsStore.llmApiKey)

const byokVendorOptions = [
  { label: 'Anthropic (Claude)', value: 'anthropic' },
]

function onByokKeyChange(value: string | number | null) {
  settingsStore.setApiKey(String(value ?? ''))
}

function clearByokKey() {
  byokApiKeyInput.value = ''
  settingsStore.clearApiKey()
}

// --- Distro management ---

const addFormKey = ref(0)
const allDistros = ref<DistroEntry[]>([])

// Free tier: only show distros in use by registered VMs
const visibleDistros = computed(() => {
  if (appStore.isWeaver) return allDistros.value
  const inUse = new Set(workloadStore.workloads.map(w => w.distro).filter(Boolean))
  return allDistros.value.filter(d => inUse.has(d.name))
})
const addingDistro = ref(false)
const removingDistro = ref<string | null>(null)
const refreshingCatalog = ref(false)
const validatingUrls = ref(false)
const urlStatus = ref<UrlValidationData>({ results: {}, lastRunAt: isDemoMode() ? new Date(0).toISOString() : null })
const editingUrl = ref<string | null>(null)
const editUrlValue = ref('')
const savingUrl = ref(false)
const resettingUrl = ref<string | null>(null)

const formatOptions = [
  { label: 'qcow2', value: 'qcow2' },
  { label: 'raw', value: 'raw' },
  { label: 'iso', value: 'iso' },
]

const guestOsOptions = [
  { label: 'Linux', value: 'linux' },
  { label: 'Windows', value: 'windows' },
]

const newDistro = ref<CustomDistroInput>({
  name: '',
  label: '',
  url: '',
  format: 'qcow2',
  cloudInit: true,
  guestOs: 'linux',
})

watch(() => newDistro.value.guestOs, (os) => {
  if (os === 'windows') {
    newDistro.value.cloudInit = false
  }
})

const reservedNames = computed(() => new Set(
  allDistros.value.filter(d => d.category !== 'custom').map(d => d.name)
))

function nameRule(v: string): boolean | string {
  if (!/^[a-z][a-z0-9-]*$/.test(v)) return 'Lowercase letters, digits, hyphens'
  if (reservedNames.value.has(v)) return `"${v}" is already a built-in or catalog distro`
  return true
}

async function loadDistros() {
  if (isDemoMode()) {
    allDistros.value = [
      { name: 'nixos', label: 'NixOS', category: 'builtin', effectiveUrl: 'https://channels.nixos.org/...', cloudInit: false, guestOs: 'linux' as const, hasOverride: false },
      { name: 'arch', label: 'Arch Linux', category: 'builtin', effectiveUrl: 'https://geo.mirror.pkgbuild.com/...', cloudInit: true, guestOs: 'linux' as const, hasOverride: false },
      { name: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS', category: 'catalog', effectiveUrl: 'https://cloud-images.ubuntu.com/...', cloudInit: true, guestOs: 'linux' as const, hasOverride: false },
      { name: 'rocky-9', label: 'Rocky Linux 9', category: 'catalog', effectiveUrl: 'https://download.rockylinux.org/...', cloudInit: true, guestOs: 'linux' as const, hasOverride: false },
      { name: 'debian-12', label: 'Debian 12', category: 'catalog', effectiveUrl: 'https://cloud.debian.org/...', cloudInit: true, guestOs: 'linux' as const, hasOverride: false },
    ] as DistroEntry[]
    return
  }
  try {
    allDistros.value = await distroApiService.getAll()
  } catch {
    allDistros.value = []
  }
}

async function loadUrlStatus() {
  if (isDemoMode()) return
  try {
    urlStatus.value = await distroApiService.getUrlStatus()
  } catch {
    // Validation service may not be available
  }
}

function categoryColor(category: string): string {
  if (category === 'builtin') return 'grey-7'
  if (category === 'catalog') return 'teal'
  return 'purple'
}

function urlStatusIcon(distro: string): string {
  const result = urlStatus.value.results[distro]
  if (!result) return 'mdi-help-circle'
  if (result.status === 'valid') return 'mdi-check-circle'
  if (result.status === 'invalid') return 'mdi-close-circle'
  return 'mdi-help-circle'
}

function urlStatusColor(distro: string): string {
  const result = urlStatus.value.results[distro]
  if (!result) return 'grey'
  if (result.status === 'valid') return 'positive'
  if (result.status === 'invalid') return 'negative'
  return 'grey'
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

async function validateUrls() {
  if (isDemoMode()) {
    validatingUrls.value = true
    await new Promise(resolve => setTimeout(resolve, 900))
    const now = new Date().toISOString()
    const results: UrlValidationData['results'] = {}
    for (const d of allDistros.value) {
      results[d.name] = { distro: d.name, url: d.effectiveUrl, status: 'valid', checkedAt: now }
    }
    urlStatus.value = { results, lastRunAt: new Date().toISOString() }
    $q.notify({ type: 'positive', message: `All ${allDistros.value.length} URLs are valid`, position: 'top-right', timeout: 3000 })
    validatingUrls.value = false
    return
  }
  validatingUrls.value = true
  try {
    urlStatus.value = await distroApiService.validateUrls()
    const results = Object.values(urlStatus.value.results)
    const invalid = results.filter(r => r.status === 'invalid').length
    if (invalid > 0) {
      $q.notify({ type: 'warning', message: `${invalid} URL(s) are invalid or unreachable`, position: 'top-right', timeout: 5000 })
    } else {
      $q.notify({ type: 'positive', message: `All ${results.length} URLs are valid`, position: 'top-right', timeout: 3000 })
    }
  } catch (err: unknown) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'URL validation failed'), position: 'top-right', timeout: 5000 })
  } finally {
    validatingUrls.value = false
  }
}

function startEditUrl(d: DistroEntry) {
  editingUrl.value = d.name
  editUrlValue.value = d.effectiveUrl
}

async function saveUrl(name: string) {
  if (!editUrlValue.value) return
  if (isDemoMode()) { editingUrl.value = null; return }
  savingUrl.value = true
  try {
    await distroApiService.updateUrl(name, editUrlValue.value)
    $q.notify({ type: 'positive', message: `URL updated for ${name}`, position: 'top-right', timeout: 3000 })
    editingUrl.value = null
    await Promise.all([loadDistros(), loadUrlStatus()])
  } catch (err: unknown) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to update URL'), position: 'top-right', timeout: 5000 })
  } finally {
    savingUrl.value = false
  }
}

async function resetUrlOverride(name: string, label: string) {
  $q.dialog({
    title: 'Reset URL Override',
    message: `Reset "${label}" to its default URL? The custom override will be removed.`,
    cancel: true,
    persistent: false,
    color: 'deep-orange',
  }).onOk(async () => {
    resettingUrl.value = name
    try {
      await distroApiService.resetUrlOverride(name)
      $q.notify({ type: 'positive', message: `Default URL restored for ${label}`, position: 'top-right', timeout: 3000 })
      await Promise.all([loadDistros(), loadUrlStatus()])
    } catch (err: unknown) {
      $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to reset URL'), position: 'top-right', timeout: 5000 })
    } finally {
      resettingUrl.value = null
    }
  })
}

async function refreshCatalog() {
  if (isDemoMode()) {
    refreshingCatalog.value = true
    await new Promise(resolve => setTimeout(resolve, 700))
    $q.notify({ type: 'positive', message: `Catalog refreshed — ${allDistros.value.length} distributions`, position: 'top-right', timeout: 3000 })
    refreshingCatalog.value = false
    return
  }
  refreshingCatalog.value = true
  try {
    const result = await distroApiService.refreshCatalog()
    if (result.updated) {
      $q.notify({ type: 'positive', message: `Catalog refreshed — ${result.count} distributions`, position: 'top-right', timeout: 3000 })
    } else {
      $q.notify({ type: 'info', message: 'Catalog is already up to date', position: 'top-right', timeout: 3000 })
    }
    await loadDistros()
  } catch {
    $q.notify({ type: 'warning', message: 'No remote catalog URL configured on server', position: 'top-right', timeout: 3000 })
  } finally {
    refreshingCatalog.value = false
  }
}

async function addDistro() {
  if (isDemoMode()) { $q.notify({ type: 'info', message: 'Custom distros not available in demo mode', position: 'top-right', timeout: 3000 }); return }
  addingDistro.value = true
  try {
    const result = await distroApiService.add(newDistro.value)
    $q.notify({ type: 'positive', message: result.message, position: 'top-right', timeout: 3000 })
    newDistro.value = { name: '', label: '', url: '', format: 'qcow2', cloudInit: true, guestOs: 'linux' }
    addFormKey.value++
    await loadDistros()
  } catch (err: unknown) {
    const message = extractErrorMessage(err, 'Failed to add distribution')
    $q.notify({ type: 'negative', message, position: 'top-right', timeout: 5000 })
  } finally {
    addingDistro.value = false
  }
}

function confirmRemoveDistro(name: string, label: string) {
  $q.dialog({
    title: 'Remove Distribution',
    message: `Remove "${label}" (${name})? VMs using this distro won't be affected.`,
    cancel: true,
    persistent: false,
    color: 'negative',
  }).onOk(() => removeDistro(name))
}

async function removeDistro(name: string) {
  removingDistro.value = name
  try {
    const result = await distroApiService.remove(name)
    $q.notify({ type: 'positive', message: result.message, position: 'top-right', timeout: 3000 })
    await loadDistros()
  } catch (err: unknown) {
    const message = extractErrorMessage(err, 'Failed to remove distribution')
    $q.notify({ type: 'negative', message, position: 'top-right', timeout: 5000 })
  } finally {
    removingDistro.value = null
  }
}

// --- Distro smoke testing ---

const distroTestStatus = ref<Record<string, DistroTestStatus>>({})
const testPollingTimers: Record<string, ReturnType<typeof setInterval>> = {}

function testStatusColor(name: string): string {
  const s = distroTestStatus.value[name]
  if (!s || s.status === 'none') return 'grey'
  if (s.status === 'passed') return 'positive'
  if (s.status === STATUSES.FAILED) return 'negative'
  return 'primary'
}

function testTooltip(name: string): string {
  const s = distroTestStatus.value[name]
  if (!s || s.status === 'none') return 'Test if this image boots'
  if (s.status === 'passed') return `Passed (${s.durationSeconds}s) — click to re-test`
  if (s.status === STATUSES.FAILED) return `Failed: ${s.error} — click to retry`
  return 'Test running...'
}

async function startDistroTest(name: string) {
  if (isDemoMode()) { $q.notify({ type: 'info', message: 'Distro testing not available in demo mode', position: 'top-right', timeout: 3000 }); return }
  try {
    await distroApiService.startTest(name)
    distroTestStatus.value[name] = { status: STATUSES.RUNNING, startedAt: new Date().toISOString() }
    // Start polling for result
    pollTestStatus(name)
  } catch (err: unknown) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, `Failed to start test for ${name}`), position: 'top-right', timeout: 5000 })
  }
}

function pollTestStatus(name: string) {
  // Clear any existing timer
  if (testPollingTimers[name]) clearInterval(testPollingTimers[name])

  testPollingTimers[name] = setInterval(async () => {
    try {
      const status = await distroApiService.getTestStatus(name)
      distroTestStatus.value[name] = status
      if (status.status !== STATUSES.RUNNING) {
        clearInterval(testPollingTimers[name])
        delete testPollingTimers[name]
        if (status.status === 'passed') {
          $q.notify({ type: 'positive', message: `${name} test passed (${status.durationSeconds}s)`, position: 'top-right', timeout: 5000 })
        } else if (status.status === STATUSES.FAILED) {
          $q.notify({ type: 'negative', message: `${name} test failed: ${status.error}`, position: 'top-right', timeout: 8000 })
        }
      }
    } catch {
      // Polling error — keep trying
    }
  }, 3000)
}

onMounted(() => {
  void loadDistros()
  void loadUrlStatus()
})

</script>
