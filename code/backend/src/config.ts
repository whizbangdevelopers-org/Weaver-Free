// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Tier } from './license.js'
import { parseLicenseKey } from './license.js'
import { TIERS } from './constants/vocabularies.js'
import type { SmtpConfig } from './services/email.js'

export type { Tier }

export type SessionStoreType = 'memory' | 'sqlite'

export interface NotifyConfig {
  ntfyUrl: string | null
  ntfyTopic: string | null
  ntfyToken: string | null
}

export interface DashboardConfig {
  tier: Tier
  licenseExpiry: Date | null
  licenseGraceMode: boolean
  storageBackend: 'json' | 'sqlite'
  dataDir: string
  provisioningEnabled: boolean
  microvmsDir: string
  bridgeGateway: string | null
  bridgeInterface: string
  sudoBin: string
  systemctlBin: string
  iptablesBin: string
  qemuBin: string
  qemuImgBin: string
  ipBin: string
  lscpuBin: string
  dfBin: string
  nixosVersionBin: string
  /** Path to the docker binary (default: 'docker') */
  dockerBin: string
  /** Path to the podman binary (default: 'podman') */
  podmanBin: string
  distroCatalogUrl: string | null
  jwtSecret: string
  sessionStoreType: SessionStoreType
  notify: NotifyConfig
  /** Server-side AI API key for any vendor (empty string = not configured) */
  aiApiKey: string
  /** Path to the NixOS configuration file (default: /etc/nixos/configuration.nix) */
  nixConfigPath: string
  /** Path to weasyprint binary for compliance PDF generation */
  weasyprintBin: string
  /** Stripe secret key (empty = Stripe disabled) */
  stripeSecretKey: string
  /** Stripe webhook signing secret */
  stripeWebhookSecret: string
  /** Stripe Product IDs for tier mapping */
  stripeProducts: {
    soloProductId: string
    teamProductId: string
    fabrickProductId: string
  }
  /** Stripe Price IDs for checkout sessions */
  stripePrices: Record<string, string>
  /** Public-facing site URL for Stripe redirects */
  siteUrl: string
  /** SMTP configuration for transactional emails (null = email disabled) */
  smtp: SmtpConfig | null
}

export function loadConfig(): DashboardConfig {
  const toBool = (v: string | undefined) => v === 'true' || v === '1'

  // Resolve license tier
  let tier: Tier = TIERS.DEMO
  let licenseExpiry: Date | null = null
  let licenseGraceMode = false

  // HMAC secret for license key validation
  let hmacSecret = process.env.LICENSE_HMAC_SECRET
  if (!hmacSecret) {
    if (process.env.NODE_ENV !== 'production') {
      hmacSecret = randomBytes(32).toString('hex')
      console.warn('[license] LICENSE_HMAC_SECRET not set — generated random secret for development')
    } else {
      // Production without HMAC secret: skip license key parsing entirely (fall back to demo)
      hmacSecret = ''
      if (process.env.LICENSE_KEY || process.env.LICENSE_KEY_FILE) {
        console.error('[license] LICENSE_HMAC_SECRET is required to validate license keys in production — ignoring LICENSE_KEY')
      }
    }
  }

  // Resolution order:
  // 1. LICENSE_KEY env var
  // 2. LICENSE_KEY_FILE env var (read from file)
  // 3. PREMIUM_ENABLED=true (backward compat, logs deprecation)
  // 4. Default: demo
  const licenseKey = process.env.LICENSE_KEY
  const licenseKeyFile = process.env.LICENSE_KEY_FILE

  // Skip license parsing if HMAC secret is empty (prevents trivially forged keys)
  const canValidateLicense = hmacSecret.length > 0

  if (licenseKey && canValidateLicense) {
    try {
      const result = parseLicenseKey(licenseKey.trim(), hmacSecret)
      tier = result.tier
      licenseExpiry = result.expiry
      licenseGraceMode = result.graceMode
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[license] Invalid LICENSE_KEY: ${message} — falling back to demo tier`)
    }
  } else if (licenseKeyFile && canValidateLicense) {
    try {
      const keyFromFile = readFileSync(licenseKeyFile, 'utf-8').trim()
      const result = parseLicenseKey(keyFromFile, hmacSecret)
      tier = result.tier
      licenseExpiry = result.expiry
      licenseGraceMode = result.graceMode
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[license] Failed to read LICENSE_KEY_FILE: ${message} — falling back to demo tier`)
    }
  } else if (toBool(process.env.PREMIUM_ENABLED)) {
    console.warn('[license] PREMIUM_ENABLED is deprecated — use LICENSE_KEY instead. Mapping to weaver tier.')
    tier = TIERS.WEAVER
    licenseExpiry = null
    licenseGraceMode = false
  }

  return {
    tier,
    licenseExpiry,
    licenseGraceMode,
    storageBackend: (process.env.VM_STORAGE_BACKEND ?? 'json') as 'json' | 'sqlite',
    dataDir: process.env.VM_DATA_DIR ?? './data',
    provisioningEnabled: toBool(process.env.PROVISIONING_ENABLED),
    microvmsDir: process.env.MICROVMS_DIR ?? '/var/lib/microvms',
    bridgeGateway: process.env.BRIDGE_GATEWAY || null,
    bridgeInterface: process.env.BRIDGE_INTERFACE ?? 'br-microvm',
    sudoBin: process.env.SUDO_PATH ?? 'sudo',
    systemctlBin: process.env.SYSTEMCTL_PATH ?? 'systemctl',
    iptablesBin: process.env.IPTABLES_PATH ?? 'iptables',
    qemuBin: process.env.QEMU_BIN ?? '/run/current-system/sw/bin/qemu-system-x86_64',
    qemuImgBin: process.env.QEMU_IMG_BIN ?? '/run/current-system/sw/bin/qemu-img',
    ipBin: process.env.IP_BIN ?? '/run/current-system/sw/bin/ip',
    lscpuBin: process.env.LSCPU_BIN ?? '/run/current-system/sw/bin/lscpu',
    dfBin: process.env.DF_BIN ?? '/run/current-system/sw/bin/df',
    nixosVersionBin: process.env.NIXOS_VERSION_BIN ?? '/run/current-system/sw/bin/nixos-version',
    dockerBin: process.env.DOCKER_BIN ?? 'docker',
    podmanBin: process.env.PODMAN_BIN ?? 'podman',
    distroCatalogUrl: process.env.DISTRO_CATALOG_URL || null,
    jwtSecret: resolveJwtSecret(),
    sessionStoreType: resolveSessionStoreType(tier),
    notify: {
      ntfyUrl: process.env.NTFY_URL || null,
      ntfyTopic: process.env.NTFY_TOPIC || null,
      ntfyToken: process.env.NTFY_TOKEN || null,
    },
    aiApiKey: resolveAiApiKey(),
    nixConfigPath: process.env.NIXOS_CONFIG_PATH ?? '/etc/nixos/configuration.nix',
    weasyprintBin: process.env.WEASYPRINT_BIN ?? 'weasyprint',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    stripeProducts: {
      soloProductId: process.env.STRIPE_PRODUCT_SOLO ?? '',
      teamProductId: process.env.STRIPE_PRODUCT_TEAM ?? '',
      fabrickProductId: process.env.STRIPE_PRODUCT_FABRICK ?? '',
    },
    stripePrices: {
      'weaver-solo': process.env.STRIPE_PRICE_SOLO ?? '',
      'weaver-team': process.env.STRIPE_PRICE_TEAM ?? '',
      'fabrick': process.env.STRIPE_PRICE_FABRICK ?? '',
      'fm-solo': process.env.STRIPE_PRICE_FM_SOLO ?? '',
      'fm-team': process.env.STRIPE_PRICE_FM_TEAM ?? '',
      'fm-fabrick': process.env.STRIPE_PRICE_FM_FABRICK ?? '',
    },
    siteUrl: process.env.SITE_URL ?? 'https://whizbangdevelopers.com',
    smtp: resolveSmtpConfig(),
  }
}

function resolveJwtSecret(): string {
  // 1. JWT_SECRET env var
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET

  // 2. JWT_SECRET_FILE env var (e.g. NixOS sops-nix)
  if (process.env.JWT_SECRET_FILE) {
    try {
      return readFileSync(process.env.JWT_SECRET_FILE, 'utf-8').trim()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[auth] Failed to read JWT_SECRET_FILE: ${message}`)
    }
  }

  // 3. Production: fail startup. Dev/test: auto-generate.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[auth] JWT_SECRET or JWT_SECRET_FILE is required in production')
  }

  const generated = randomBytes(64).toString('hex')
  console.warn('[auth] JWT_SECRET not set — generated random secret (tokens will not survive restart)')
  return generated
}

function resolveAiApiKey(): string {
  // 1. AI_API_KEY env var (vendor-agnostic)
  if (process.env.AI_API_KEY) return process.env.AI_API_KEY

  // 2. AI_API_KEY_FILE env var (e.g. NixOS sops-nix)
  if (process.env.AI_API_KEY_FILE) {
    try {
      return readFileSync(process.env.AI_API_KEY_FILE, 'utf-8').trim()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[ai] Failed to read AI_API_KEY_FILE: ${message}`)
    }
  }

  // 3. Backward compat: ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY

  return ''
}

function resolveSessionStoreType(tier: Tier): SessionStoreType {
  // Explicit override
  const explicit = process.env.SESSION_STORE_TYPE as SessionStoreType | undefined
  if (explicit === 'memory' || explicit === 'sqlite') return explicit

  // Tier-based default: memory for demo/free, sqlite for weaver/fabrick
  return tier === TIERS.WEAVER || tier === TIERS.FABRICK ? 'sqlite' : 'memory'
}

function resolveSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  if (!host) return null

  return {
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'Weaver <licenses@whizbangdevelopers.com>',
    replyTo: process.env.EMAIL_REPLY_TO ?? 'Weaver Support <support@whizbangdevelopers.com>',
  }
}
