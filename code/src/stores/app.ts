// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'
import { isDemoMode, isPublicDemo, DEMO_VERSIONS, getPublicDemoSteps, getDemoHostBasicInfo } from 'src/config/demo'
import { setMockVmsForHost, clearMockVms } from 'src/services/mock-vm'
import type { HostBasicInfo } from 'src/types/host'
import type { PluginManifest } from 'src/types/plugin'
import type { OrganizationIdentity } from 'src/types/organization'
import { TIERS, TIER_ORDER, type TierName } from 'src/constants/vocabularies'

export type Tier = TierName
export { TIER_ORDER }

export interface AppState {
  initialized: boolean
  loading: boolean
  error: string | null
  tier: Tier
  tierExpiry: string | null
  tierGraceMode: boolean
  provisioningEnabled: boolean
  bridgeGateway: string | null
  hasServerKey: boolean
  /** Demo mode only: override tier for the tier-switcher toolbar */
  demoTierOverride: Tier | null
  /** Demo mode only: current version being previewed in the version-switcher toolbar */
  demoVersion: string
  /** Demo mode only: selected host in the Fabrick fleet view (v3.0+) */
  demoSelectedHostId: string
  /** Demo mode only: host currently drilled into on the Fabrick page (null = fleet view) */
  fabrickDrillHostId: string | null
  /** Demo mode only: Weaver tier sub-variant (Solo = single admin, Team = multi-user). Only relevant at v2.2+. */
  demoWeaverSubTier: 'solo' | 'team'
  /** Fabrick drill-down toolbar state */
  fabrickDrillFilter: 'all' | 'vms' | 'docker' | 'podman' | 'apptainer'
  fabrickDrillView: 'grid' | 'list'
  fabrickDrillSort: 'attention' | 'name-asc' | 'name-desc'
  host: HostBasicInfo | null
  plugins: PluginManifest[]
  /** Customer identity — org name, logo, contact info (Solo+) */
  organization: OrganizationIdentity | null
  /** Access Inspector state (v3.3+) */
  inspectorMode: boolean
  inspectorType: 'viewer' | 'user' | 'group' | null
  inspectorIdentity: { id: string; label: string; subLabel?: string } | null
}

interface HealthResponse {
  tier: string
  tierExpiry: string | null
  tierGraceMode: boolean
  provisioningEnabled: boolean
  bridgeGateway: string | null
  hasServerKey: boolean
  host: HostBasicInfo | null
  plugins?: PluginManifest[]
  organization?: OrganizationIdentity | null
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    initialized: false,
    loading: false,
    error: null,
    tier: TIERS.DEMO,
    tierExpiry: null,
    tierGraceMode: false,
    provisioningEnabled: false,
    bridgeGateway: null,
    hasServerKey: false,
    demoTierOverride: import.meta.env.VITE_DEMO_MODE ? TIERS.FREE as Tier : null,
    demoVersion: '1.0',
    demoSelectedHostId: 'king',
    fabrickDrillHostId: null,
    demoWeaverSubTier: 'solo',
    fabrickDrillFilter: 'all',
    fabrickDrillView: 'grid',
    fabrickDrillSort: 'attention',
    host: null,
    plugins: [],
    organization: null,
    inspectorMode: false,
    inspectorType: null,
    inspectorIdentity: null,
  }),

  getters: {
    /** Effective tier: respects demo override in any demo context (build-time or runtime) */
    effectiveTier(state): Tier {
      if (isDemoMode() && state.demoTierOverride) {
        return state.demoTierOverride
      }
      return state.tier
    },
    isReady: state => state.initialized && !state.loading,
    isDemo(): boolean { return this.effectiveTier === TIERS.DEMO },
    isFree(): boolean { return this.effectiveTier === TIERS.FREE },
    isWeaver(): boolean { return TIER_ORDER[this.effectiveTier] >= TIER_ORDER.weaver },
    isFabrick(): boolean { return this.effectiveTier === TIERS.FABRICK },
    isLicensed(): boolean { return this.effectiveTier !== TIERS.DEMO },
    /** Organization display name — returns org name if set, otherwise 'Weaver' */
    orgDisplayName(state): string {
      return state.organization?.name || 'Weaver'
    },
    /** True when server has an AI key AND current tier is weaver+ (allowed to use it) */
    serverKeyAllowed(): boolean { return this.hasServerKey && TIER_ORDER[this.effectiveTier] >= TIER_ORDER.weaver },
    /** Demo mode only: returns true when the current demo version >= target version.
     *  Usage: appStore.isDemoVersionAtLeast('1.1') */
    isDemoVersionAtLeast(): (target: string) => boolean {
      return (target: string) => {
        const parse = (v: string) => {
          const [maj, min] = v.replace(/^v/, '').split('.').map(Number)
          return (maj ?? 0) * 100 + (min ?? 0)
        }
        return parse(this.demoVersion) >= parse(target)
      }
    },
    /** Plugins accessible at the current effective tier */
    availablePlugins(): PluginManifest[] {
      const tier = this.effectiveTier
      const level = TIER_ORDER[tier]
      return this.plugins.map(p => ({
        ...p,
        status: (p.status === 'coming-soon'
          ? 'coming-soon'
          : level >= TIER_ORDER[p.minimumTier as Tier]
            ? 'active'
            : 'available') as PluginManifest['status'],
      }))
    },
  },

  actions: {
    async initialize() {
      // Demo mode always re-runs so updated mock data (new fields like liveMetrics)
      // is picked up even when initialized: true is persisted from a previous session.
      if (isDemoMode()) {
        this.provisioningEnabled = true
        this.hasServerKey = true
        this.bridgeGateway = '10.10.0.1'
        this.tier = TIERS.DEMO
        // Only reset tier on first init — subsequent calls (router beforeEach fires on every
        // navigation) must not wipe the presenter's tier selection.
        if (!this.initialized) {
          this.demoTierOverride = TIERS.FREE
          // Start with a blank canvas — the wizard scan populates VMs progressively
          clearMockVms()
        }
        this.host = getDemoHostBasicInfo(this.demoSelectedHostId)
        this.plugins = getDemoPlugins()
        this.initialized = true
        this.loading = false
        return
      }

      if (this.initialized) return

      this.loading = true
      this.error = null

      try {
        const { data } = await api.get<HealthResponse>('/health')
        this.tier = (data.tier ?? TIERS.DEMO) as Tier
        this.tierExpiry = data.tierExpiry ?? null
        this.tierGraceMode = data.tierGraceMode ?? false
        this.provisioningEnabled = data.provisioningEnabled ?? false
        this.bridgeGateway = data.bridgeGateway ?? null
        this.hasServerKey = data.hasServerKey ?? false
        this.host = data.host ?? null
        this.plugins = data.plugins ?? []
        this.organization = data.organization ?? null
        this.initialized = true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Initialization failed'
        this.initialized = true // still mark initialized to avoid retry loops
      } finally {
        this.loading = false
      }
    },

    setError(error: string | null) {
      this.error = error
    },

    clearError() {
      this.error = null
    },

    /** Demo mode only: override the effective tier for the tier-switcher toolbar */
    setDemoTier(tier: Tier | null) {
      if (!isDemoMode()) return
      // Public demo is locked to Free tier — no tier switching
      if (isPublicDemo()) return
      this.demoTierOverride = tier
      // Repopulate mock VMs for the new tier (different tiers show different VM sets)
      setMockVmsForHost(this.demoSelectedHostId, this.effectiveTier)
    },

    /** Demo mode only: switch Weaver tier sub-variant (Solo vs Team, v2.2+) */
    setDemoWeaverSubTier(subTier: 'solo' | 'team') {
      if (!isDemoMode()) return
      this.demoWeaverSubTier = subTier
    },

    /** Demo mode only: step to a specific version in the version-switcher toolbar */
    setDemoVersion(version: string) {
      if (!isDemoMode()) return
      // Public demo: only allow Free versions up to v1.3 (Decision #135)
      if (isPublicDemo()) {
        const publicVersions = getPublicDemoSteps().filter(s => s.type === 'version')
        if (!publicVersions.find(s => s.id === version)) return
      }
      const valid = DEMO_VERSIONS.find(v => v.version === version)
      if (valid) this.demoVersion = version
    },

    /** Demo mode only: drill into a host on the Fabrick page (null = back to fleet) */
    setFabrickDrill(hostId: string | null) {
      this.fabrickDrillHostId = hostId
      if (hostId) {
        this.fabrickDrillFilter = 'all'
        this.fabrickDrillSort = 'attention'
      }
    },
    setFabrickDrillFilter(f: AppState['fabrickDrillFilter']) { this.fabrickDrillFilter = f },
    setFabrickDrillView(v: AppState['fabrickDrillView']) { this.fabrickDrillView = v },
    setFabrickDrillSort(s: AppState['fabrickDrillSort']) { this.fabrickDrillSort = s },

    activateViewerInspector() {
      this.inspectorMode = true
      this.inspectorType = 'viewer'
      this.inspectorIdentity = null
    },
    activateIdentityInspector(type: 'user' | 'group', id: string, label: string, subLabel?: string) {
      this.inspectorMode = true
      this.inspectorType = type
      this.inspectorIdentity = { id, label, subLabel }
    },
    exitInspector() {
      this.inspectorMode = false
      this.inspectorType = null
      this.inspectorIdentity = null
    },

    /** Demo mode only: select a host in the Fabrick fleet view (v3.0+) */
    setDemoHost(hostId: string) {
      if (!isDemoMode()) return
      this.demoSelectedHostId = hostId
      this.host = getDemoHostBasicInfo(hostId)
      setMockVmsForHost(hostId, this.effectiveTier)
    },

    /** Demo mode only: reset all demo state back to defaults */
    resetDemo() {
      if (!isDemoMode()) return
      this.demoTierOverride = TIERS.FREE
      this.demoVersion = '1.0'
      this.demoSelectedHostId = 'king'
      this.fabrickDrillHostId = null
      this.inspectorMode = false
      this.inspectorType = null
      this.inspectorIdentity = null
      this.host = getDemoHostBasicInfo('king')
      // Clear VMs so the blank canvas + wizard flow restarts
      clearMockVms()
    },
  },

  persist: true
})

/** Plugin manifests for demo mode (mirrors backend/src/plugins.ts registry) */
function getDemoPlugins(): PluginManifest[] {
  return [
    { id: 'ai-anthropic', name: 'Anthropic (Claude)', description: 'AI diagnostics powered by Claude. BYOK available on all tiers.', category: 'ai', minimumTier: TIERS.FREE, status: 'active', fabrickIncluded: true },
    { id: 'ai-openai', name: 'OpenAI', description: 'AI diagnostics powered by GPT models with profile switching.', category: 'ai', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true },
    { id: 'ai-ollama', name: 'Ollama (Local)', description: 'Run AI diagnostics locally with Ollama. Zero data leaves your network.', category: 'ai', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true },
    { id: 'dns-core', name: 'DNS Management', description: 'Auto-zone .vm.internal, dnsmasq integration, per-VM DNS records.', category: 'dns', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.1.0', fabrickIncluded: true, replacedByFabrick: true },
    { id: 'dns-resolver', name: 'DNS Resolver', description: 'CoreDNS resolver VM with security filtering and query logging.', category: 'dns', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.1.0', fabrickIncluded: true, replacedByFabrick: true },
    { id: 'dns-fabrick', name: 'DNS FabricK', description: 'Split-horizon DNS, Active Directory integration, audit trail.', category: 'dns', minimumTier: TIERS.FABRICK, status: 'coming-soon', targetVersion: 'v1.1.0', fabrickIncluded: true },
    { id: 'firewall-presets', name: 'Firewall Presets', description: 'One-click nftables firewall profiles for common VM workloads.', category: 'firewall', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true, replacedByFabrick: true },
    { id: 'firewall-custom', name: 'Custom Firewall Rules', description: 'Per-VM egress filtering, port whitelisting, and custom nftables rules.', category: 'firewall', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true, replacedByFabrick: true },
    { id: 'firewall-fabrick', name: 'Firewall FabricK', description: 'Security zones, drift detection, firewall audit log.', category: 'firewall', minimumTier: TIERS.FABRICK, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true },
    { id: 'hardening-apparmor', name: 'AppArmor Profiles', description: 'Managed AppArmor profiles for VM process isolation.', category: 'security', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true },
    { id: 'hardening-seccomp', name: 'Seccomp Filters', description: 'Syscall filtering for VM QEMU processes. Reduces attack surface.', category: 'security', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true },
    { id: 'auth-totp', name: 'TOTP (2FA)', description: 'Time-based one-time passwords for two-factor authentication.', category: 'auth', minimumTier: TIERS.FREE, status: 'coming-soon', targetVersion: 'v1.1.0', fabrickIncluded: true },
    { id: 'auth-fido2', name: 'FIDO2 / WebAuthn', description: 'Hardware key authentication (YubiKey, passkeys).', category: 'auth', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v1.1.0', fabrickIncluded: true },
    { id: 'auth-sso', name: 'SSO / LDAP', description: 'SAML, OIDC, and LDAP integration for organizational identity.', category: 'auth', minimumTier: TIERS.FABRICK, status: 'coming-soon', targetVersion: 'v1.2.0', fabrickIncluded: true },
    { id: 'backup-disk', name: 'Disk Backup', description: 'Scheduled disk snapshots with configurable retention.', category: 'backup', minimumTier: TIERS.WEAVER, status: 'coming-soon', targetVersion: 'v2.0.0', fabrickIncluded: true, replacedByFabrick: true },
    { id: 'backup-fabrick', name: 'Backup FabricK', description: 'Multi-target backup (S3, restic, borg), file-level restore, encryption.', category: 'backup', minimumTier: TIERS.FABRICK, status: 'coming-soon', targetVersion: 'v2.6.0', fabrickIncluded: true },
  ]
}
