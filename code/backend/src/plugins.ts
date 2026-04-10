// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { Tier } from './license.js'
import { TIER_ORDER } from './license.js'
import { TIERS } from './constants/vocabularies.js'

// --- Plugin Manifest ---

export type PluginCategory = 'ai' | 'dns' | 'firewall' | 'security' | 'backup' | 'auth'

export type PluginStatus = 'active' | 'available' | 'coming-soon'

export interface PluginManifest {
  /** Unique plugin identifier (e.g. 'ai-anthropic', 'dns-core') */
  id: string
  /** Human-readable name */
  name: string
  /** Short description */
  description: string
  /** Plugin domain category */
  category: PluginCategory
  /** Minimum tier required to activate this plugin */
  minimumTier: Tier
  /** Current status */
  status: PluginStatus
  /** Target version (for coming-soon plugins) */
  targetVersion?: string
  /** Whether this plugin is included with Fabrick (true) or à la carte only */
  fabrickIncluded: boolean
}

// --- Plugin Registry ---

const registry = new Map<string, PluginManifest>()

export function registerPlugin(manifest: PluginManifest): void {
  if (registry.has(manifest.id)) {
    throw new Error(`Plugin '${manifest.id}' is already registered`)
  }
  registry.set(manifest.id, manifest)
}

export function getPlugin(id: string): PluginManifest | undefined {
  return registry.get(id)
}

export function getAllPlugins(): PluginManifest[] {
  return Array.from(registry.values())
}

export function getPluginsByCategory(category: PluginCategory): PluginManifest[] {
  return getAllPlugins().filter(p => p.category === category)
}

/**
 * Guard that throws a 403-style error if the plugin is not available
 * at the current tier, or if the plugin doesn't exist.
 */
export function requirePlugin(config: { tier: Tier }, pluginId: string): void {
  const plugin = registry.get(pluginId)
  if (!plugin) {
    throw Object.assign(
      new Error(`Plugin '${pluginId}' is not registered`),
      { statusCode: 404 }
    )
  }
  if (plugin.status === 'coming-soon') {
    throw Object.assign(
      new Error(`Plugin '${plugin.name}' is coming soon in ${plugin.targetVersion ?? 'a future release'}`),
      { statusCode: 403 }
    )
  }
  if (TIER_ORDER[config.tier] < TIER_ORDER[plugin.minimumTier]) {
    throw Object.assign(
      new Error(`Plugin '${plugin.name}' requires ${plugin.minimumTier} tier or higher (current: ${config.tier})`),
      { statusCode: 403 }
    )
  }
}

// --- Built-in Plugin Registrations ---

// AI Providers — the reference plugin implementation
registerPlugin({
  id: 'ai-anthropic',
  name: 'Anthropic (Claude)',
  description: 'AI diagnostics powered by Claude. BYOK available on all tiers.',
  category: 'ai',
  minimumTier: TIERS.FREE,
  status: 'active',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'ai-openai',
  name: 'OpenAI',
  description: 'AI diagnostics powered by GPT models with profile switching.',
  category: 'ai',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'ai-ollama',
  name: 'Ollama (Local)',
  description: 'Run AI diagnostics locally with Ollama. Zero data leaves your network.',
  category: 'ai',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

// DNS — first purchasable plugin (v1.1.0)
registerPlugin({
  id: 'dns-core',
  name: 'DNS Management',
  description: 'Auto-zone .vm.internal, dnsmasq integration, per-VM DNS records.',
  category: 'dns',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.1.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'dns-resolver',
  name: 'DNS Resolver',
  description: 'CoreDNS resolver VM with security filtering and query logging.',
  category: 'dns',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.1.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'dns-fabrick',
  name: 'DNS Fabrick',
  description: 'Split-horizon DNS, Active Directory integration, audit trail.',
  category: 'dns',
  minimumTier: TIERS.FABRICK,
  status: 'coming-soon',
  targetVersion: 'v1.1.0',
  fabrickIncluded: true,
})

// Firewall (v1.2.0)
registerPlugin({
  id: 'firewall-presets',
  name: 'Firewall Presets',
  description: 'One-click nftables firewall profiles for common VM workloads.',
  category: 'firewall',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'firewall-custom',
  name: 'Custom Firewall Rules',
  description: 'Per-VM egress filtering, port whitelisting, and custom nftables rules.',
  category: 'firewall',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'firewall-fabrick',
  name: 'Firewall Fabrick',
  description: 'Security zones, drift detection, firewall audit log.',
  category: 'firewall',
  minimumTier: TIERS.FABRICK,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

// Security / Hardening (v1.2.0+)
registerPlugin({
  id: 'hardening-apparmor',
  name: 'AppArmor Profiles',
  description: 'Managed AppArmor profiles for VM process isolation.',
  category: 'security',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'hardening-seccomp',
  name: 'Seccomp Filters',
  description: 'Syscall filtering for VM QEMU processes. Reduces attack surface.',
  category: 'security',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

// Auth (v1.1.0+)
registerPlugin({
  id: 'auth-totp',
  name: 'TOTP (2FA)',
  description: 'Time-based one-time passwords for two-factor authentication.',
  category: 'auth',
  minimumTier: TIERS.FREE,
  status: 'coming-soon',
  targetVersion: 'v1.1.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'auth-fido2',
  name: 'FIDO2 / WebAuthn',
  description: 'Hardware key authentication (YubiKey, passkeys).',
  category: 'auth',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v1.1.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'auth-sso',
  name: 'SSO / LDAP',
  description: 'SAML, OIDC, and LDAP integration for organizational identity.',
  category: 'auth',
  minimumTier: TIERS.FABRICK,
  status: 'coming-soon',
  targetVersion: 'v1.2.0',
  fabrickIncluded: true,
})

// Backup (v2.0.0+)
registerPlugin({
  id: 'backup-disk',
  name: 'Disk Backup',
  description: 'Scheduled disk snapshots with configurable retention.',
  category: 'backup',
  minimumTier: TIERS.WEAVER,
  status: 'coming-soon',
  targetVersion: 'v2.0.0',
  fabrickIncluded: true,
})

registerPlugin({
  id: 'backup-fabrick',
  name: 'Backup Fabrick',
  description: 'Multi-target backup (S3, restic, borg), file-level restore, encryption.',
  category: 'backup',
  minimumTier: TIERS.FABRICK,
  status: 'coming-soon',
  targetVersion: 'v2.6.0',
  fabrickIncluded: true,
})
