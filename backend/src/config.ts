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

/** The container runtimes Weaver can manage. Apptainer requires Solo or above. */
export type ContainerRuntimeName = 'docker' | 'podman' | 'apptainer'

const VALID_RUNTIMES: readonly ContainerRuntimeName[] = ['docker', 'podman', 'apptainer']

/**
 * Parse CONTAINER_RUNTIMES, declared by the NixOS module.
 *
 * The unset/empty distinction is deliberate — see DashboardConfig.containerRuntimes. An unknown
 * name is DROPPED rather than throwing: this is read at startup, and refusing to boot because a
 * config file names a runtime this build does not know is a worse failure than scanning one
 * fewer runtime. It is logged by the caller instead.
 */
export function parseContainerRuntimes(raw: string | undefined): ContainerRuntimeName[] {
  if (raw === undefined) return ['docker', 'podman']
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ContainerRuntimeName => (VALID_RUNTIMES as readonly string[]).includes(s))
}

export interface NotifyConfig {
  ntfyUrl: string | null
  ntfyTopic: string | null
  ntfyToken: string | null
}

export interface DashboardConfig {
  tier: Tier
  licenseExpiry: Date | null
  licenseGraceMode: boolean
  /**
   * Nodes this licence entitles. `null` = unbounded (a perpetual or unmetered grant).
   *
   * Read from the SIGNED payload, which is what makes a per-node term enforceable at all — Stripe
   * cannot meter an airgapped install, so the signature over this number is the only thing that
   * binds it. Consumed by `requireNodeCapacity()`; see the per-node capacity note in license.ts for why it previously reached the
   * product and stopped here.
   */
  licenseNodes: number | null
  /**
   * Where the key is read from, or null when the tier came from `LICENSE_KEY` / `PREMIUM_ENABLED`.
   *
   * Exposed because the file is re-read while the process runs: a renewal pushes a new
   * key and the host must pick it up without a restart. Nothing to poll when this is null.
   */
  licenseKeyFile: string | null
  storageBackend: 'json' | 'sqlite'
  dataDir: string
  provisioningEnabled: boolean
  microvmsDir: string
  bridgeGateway: string | null
  bridgeInterface: string
  /**
   * DNS Core zone domain. NEVER `.local` — that is reserved for mDNS (RFC 6762) and a `.vm.local`
   * zone collides with Avahi on exactly the home-lab networks this targets.
   */
  dnsDomain: string
  /**
   * How often the status WebSocket broadcasts, in ms.
   *
   * Configurable because the right value is a property of the DEPLOYMENT, not of the product: the
   * loop calls listVms() once per tick regardless of client count, and that cost scales with the
   * number of workloads. A host with 200 workloads pays it 30 times a minute at the 2s default.
   */
  wsBroadcastIntervalMs: number
  /**
   * How to ask the resolver to re-read the generated zone. Empty when DNS Core is not deployed.
   *
   * Supplied by the NixOS module rather than hardcoded, because signalling a unit this build does
   * not manage would either fail on every host or reload someone else's dnsmasq.
   */
  dnsReloadCommand: string
  sudoBin: string
  systemctlBin: string
  iptablesBin: string
  qemuBin: string
  qemuImgBin: string
  /** OVMF CODE + VARS-template paths for UEFI guests; null when the host has no OVMF. */
  ovmf: { code: string; varsTemplate: string } | null
  /** Path to virtio-win.iso for Windows guests; null when not provisioned. */
  virtioWinIso: string | null
  /** Path to swtpm for the emulated TPM 2.0 UEFI guests need; null when unavailable. */
  swtpmBin: string | null
  ipBin: string
  lscpuBin: string
  dfBin: string
  nixosVersionBin: string
  /** Path to the docker binary (default: 'docker') */
  dockerBin: string
  /** Path to the podman binary (default: 'podman') */
  podmanBin: string
  /** Path to the apptainer binary (default: 'apptainer'). Requires Solo or above. */
  apptainerBin: string
  /**
   * Which container runtimes to scan and manage, declared by the operator.
   *
   * UNSET is not the same as EMPTY, and the difference is load-bearing:
   *   unset (env absent) -> ['docker','podman'] — the historical behaviour, preserved so a dev
   *                         box or a non-NixOS install keeps scanning as it always has.
   *   set but empty      -> [] — an operator on NixOS who declared no runtimes. MicroVMs only;
   *                         no container scan is attempted at all.
   * The NixOS module always exports CONTAINER_RUNTIMES (even as ""), so on a managed host the
   * declaration is authoritative and this never silently falls back.
   */
  containerRuntimes: ContainerRuntimeName[]
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
  /**
   * Base URL of the Prometheus that scrapes this host, or null for no metric history at all.
   *
   * Set by the NixOS module when `services.weaver.metrics.enable` is on, which is the default on
   * every tier. Null used to mean "serve from the in-process ring buffer"; phase 4 deleted that
   * buffer, so null now means the metrics endpoint returns an empty series labelled
   * `historySource: 'none'`. That is the honest consequence of switching the option off, not a
   * degradation — what it is NOT is a fallback, because two stores of the same numbers is the
   * state the migration existed to end.
   *
   * When this IS set, a query failure is refused rather than absorbed: an unreachable store
   * rendering as an empty chart is indistinguishable from an idle workload. See
   * `services/promql.ts`.
   */
  prometheusUrl: string | null
}


/** Default status-broadcast cadence. Matches the documented 2s WebSocket contract. */
export const DEFAULT_WS_BROADCAST_INTERVAL_MS = 2000
/** Below this the loop is a self-inflicted load generator, not a feature. */
export const MIN_WS_BROADCAST_INTERVAL_MS = 500
/** Above this the UI stops feeling live, which is the whole point of the socket. */
export const MAX_WS_BROADCAST_INTERVAL_MS = 60_000

/**
 * Parse WS_BROADCAST_INTERVAL_MS, clamped to a sane band.
 *
 * CLAMPS rather than rejects, and that is deliberate: this is a performance knob reached for by
 * an operator whose dashboard is struggling, usually at the point they are least able to
 * troubleshoot a refused start. A typo that would set 5ms should not be honoured, but neither
 * should it prevent the service booting — it lands at the floor and the host stays up.
 *
 * Unparseable input falls back to the default rather than to 0, which matters because a 0 or NaN
 * reaching setInterval schedules immediately-repeating work and pins a core for the life of the
 * process.
 *
 * Note WHICH check does that work. `Number('')` is **0**, not NaN — so an empty or whitespace-only
 * value is caught by the `n <= 0` test below, not by any string-emptiness check. An explicit
 * `raw.trim() === ''` guard here is redundant, and removing it changes no behaviour (verified by
 * deleting it and watching the suite stay green, which is how it was found).
 *
 * The contrast worth remembering: the same coercion fact is LOAD-BEARING in a parser where zero is
 * a legitimate reading — `memory.current` uses `n >= 0`, so there an empty file passes the guard
 * and renders as a confident zero. Whether `Number('')` is a bug depends entirely on whether the
 * validity test admits zero.
 */
export function parseBroadcastInterval(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_WS_BROADCAST_INTERVAL_MS
  const n = Number(raw.trim())
  // Rejects NaN, 0 and negatives in one test — including the empty string, via 0.
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WS_BROADCAST_INTERVAL_MS
  return Math.min(MAX_WS_BROADCAST_INTERVAL_MS, Math.max(MIN_WS_BROADCAST_INTERVAL_MS, Math.round(n)))
}

/**
 * Resolve the OVMF pair for UEFI guests, or null when the host has no usable firmware.
 *
 * BOTH paths are required. A half-configured pair is a misconfiguration, and honouring half of it
 * would attach a read-only CODE image with no variable store — the VM installs and then boots to
 * the UEFI shell forever, which reads as a guest problem rather than a host one. Returning null
 * makes the UEFI request fail at the route with a message naming the fix instead.
 */
export function parseOvmfPaths(
  code: string | undefined,
  vars: string | undefined,
): { code: string; varsTemplate: string } | null {
  const c = code?.trim()
  const v = vars?.trim()
  if (!c || !v) return null
  return { code: c, varsTemplate: v }
}

export function loadConfig(): DashboardConfig {
  const toBool = (v: string | undefined) => v === 'true' || v === '1'

  // Resolve license tier
  // Default is FREE — a real install with no license key is Free tier, not demo.
  // Demo tier only applies to VITE_DEMO_MODE frontend builds (public/private demo SPAs),
  // which don't hit a real backend anyway. No runtime path should reach this default
  // and end up on demo.
  let tier: Tier = TIERS.FREE
  let licenseExpiry: Date | null = null
  let licenseGraceMode = false
  // Keyless default is ONE node, never unbounded: a missing entitlement must under-grant. The
  // same reasoning as the issuer's `quantity ?? 1` — a forgotten value cannot become a free fleet.
  let licenseNodes: number | null = 1

  // `LICENSE_HMAC_SECRET` / `LICENSE_HMAC_SECRET_FILE` resolution is GONE, not merely unused.
  //
  // Nothing reads the value any more, and leaving the block would be worse than dead code: it
  // logged "LICENSE_HMAC_SECRET is required to validate license keys in production", which would
  // now be false and would send an operator to configure a variable that does nothing. It also
  // generated a random secret in development — a fallback that made a forged key verify locally
  // and nowhere else, which is precisely the confusion the whole change removes.
  //
  // Verification material is compiled into the build. There is no licence secret to configure.

  // Resolution order:
  // 1. LICENSE_KEY env var
  // 2. LICENSE_KEY_FILE env var (read from file)
  // 3. PREMIUM_ENABLED=true — backward compat, logs deprecation, and **ignored in production**
  //    (see the branch itself: an operator-set variable cannot be evidence of entitlement)
  // 4. Default: free (real install with no license key)
  const licenseKey = process.env.LICENSE_KEY
  const licenseKeyFile = process.env.LICENSE_KEY_FILE

  // There is no longer a `canValidateLicense` precondition. It read "skip license parsing if the
  // HMAC secret is empty (prevents trivially forged keys)" — a guard whose necessity was itself the
  // bug: whether a key could be forged depended on a value the OPERATOR supplied, and supplying it
  // was equivalent to holding the minting authority. Verification material now comes from
  // the build, so there is no configured precondition to check; an unverifiable key fails
  // verification and we fall back to Free, which is what the guard was reaching for anyway.

  if (licenseKey) {
    try {
      const result = parseLicenseKey(licenseKey.trim())
      tier = result.tier
      licenseExpiry = result.expiry
      licenseGraceMode = result.graceMode
      licenseNodes = result.quantity
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[license] Invalid LICENSE_KEY: ${message} — falling back to free tier`)
    }
  } else if (licenseKeyFile) {
    try {
      const keyFromFile = readFileSync(licenseKeyFile, 'utf-8').trim()
      const result = parseLicenseKey(keyFromFile)
      tier = result.tier
      licenseExpiry = result.expiry
      licenseGraceMode = result.graceMode
      licenseNodes = result.quantity
    } catch (err) {
      // An ABSENT key file is the normal keyless state — a real install is Free until a key is
      // installed (LICENSE_KEY_FILE may point at a path that doesn't exist yet). That is not an
      // error; only a present-but-unreadable/invalid file is. See L-licensing-2026-06-15-01KYSBXCJCMVKEQK3KA8F3KRE9.
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        console.info(`[license] No license key file at ${licenseKeyFile} — free tier`)
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[license] Failed to read LICENSE_KEY_FILE: ${message} — falling back to free tier`)
      }
    }
  } else if (toBool(process.env.PREMIUM_ENABLED)) {
    // NON-PRODUCTION ONLY, and that restriction is the whole point of this branch now.
    //
    // This grants a paid tier on the strength of an environment variable — no key, no signature,
    // nothing verified. That is precisely the capability the Ed25519 work exists to remove: the
    // party a licence restricts is the OPERATOR, so anything the operator sets cannot be
    // evidence of entitlement. Left ungated, it is a complete bypass of the entire scheme, and a
    // far cheaper one than forging a key.
    //
    // It is not simply deleted because it is load-bearing off the production path: every E2E
    // compose service runs on it (`NODE_ENV=test`), as do `dev:backend` and `dev:provision`.
    // Deleting it would take a paid tier out of reach of development entirely while
    // ACCEPTED_PUBLIC_KEYS is still empty. Gating on NODE_ENV keeps those working and closes the
    // deployed path, because the NixOS module sets NODE_ENV=production.
    //
    // The sanctioned way for a real deployment to run a paid tier without a production key is a
    // build that trusts a test authority — regenerate the authority module with `--channel dev`,
    // which is visible in the artifact and in the diff. That is a build-time seam, not an
    // operator-supplied one, and the difference is the design.
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[license] PREMIUM_ENABLED is set but IGNORED in production — it grants a tier with ' +
          'nothing verified, which the licence system exists to prevent. Install a signed ' +
          'LICENSE_KEY / LICENSE_KEY_FILE, or build with `--channel dev` to trust a test ' +
          'authority. Staying on the free tier.',
      )
    } else {
      console.warn(
        `[license] PREMIUM_ENABLED is deprecated — use LICENSE_KEY instead. Mapping to ` +
          `${TIERS.SOLO} tier. Honoured only because NODE_ENV is ` +
          `'${process.env.NODE_ENV ?? 'unset'}'; it is ignored in production.`,
      )
      tier = TIERS.SOLO
      licenseExpiry = null
      licenseGraceMode = false
      licenseNodes = 1
    }
  }

  return {
    tier,
    licenseExpiry,
    licenseGraceMode,
    licenseNodes,
    licenseKeyFile: licenseKeyFile ?? null,
    storageBackend: (process.env.VM_STORAGE_BACKEND ?? 'json') as 'json' | 'sqlite',
    dataDir: process.env.VM_DATA_DIR ?? './data',
    provisioningEnabled: toBool(process.env.PROVISIONING_ENABLED),
    microvmsDir: process.env.MICROVMS_DIR ?? '/var/lib/microvms',
    bridgeGateway: process.env.BRIDGE_GATEWAY || null,
    bridgeInterface: process.env.BRIDGE_INTERFACE ?? 'br-microvm',
    dnsDomain: process.env.DNS_DOMAIN ?? 'vm.internal',
    prometheusUrl: process.env.PROMETHEUS_URL || null,
    wsBroadcastIntervalMs: parseBroadcastInterval(process.env.WS_BROADCAST_INTERVAL_MS),
    dnsReloadCommand: process.env.DNS_RELOAD_COMMAND ?? '',
    sudoBin: process.env.SUDO_PATH ?? 'sudo',
    systemctlBin: process.env.SYSTEMCTL_PATH ?? 'systemctl',
    iptablesBin: process.env.IPTABLES_PATH ?? 'iptables',
    qemuBin: process.env.QEMU_BIN ?? '/run/current-system/sw/bin/qemu-system-x86_64',
    qemuImgBin: process.env.QEMU_IMG_BIN ?? '/run/current-system/sw/bin/qemu-img',
    ovmf: parseOvmfPaths(process.env.OVMF_CODE_PATH, process.env.OVMF_VARS_PATH),
    virtioWinIso: process.env.VIRTIO_WIN_ISO || null,
    swtpmBin: process.env.SWTPM_BIN || null,
    ipBin: process.env.IP_BIN ?? '/run/current-system/sw/bin/ip',
    lscpuBin: process.env.LSCPU_BIN ?? '/run/current-system/sw/bin/lscpu',
    dfBin: process.env.DF_BIN ?? '/run/current-system/sw/bin/df',
    nixosVersionBin: process.env.NIXOS_VERSION_BIN ?? '/run/current-system/sw/bin/nixos-version',
    dockerBin: process.env.DOCKER_BIN ?? 'docker',
    podmanBin: process.env.PODMAN_BIN ?? 'podman',
    apptainerBin: process.env.APPTAINER_BIN ?? 'apptainer',
    containerRuntimes: parseContainerRuntimes(process.env.CONTAINER_RUNTIMES),
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

  // Tier-based default: memory for demo/free, sqlite for paid tiers (weaver/team/fabrick)
  return tier === TIERS.SOLO || tier === TIERS.TEAM || tier === TIERS.FABRICK ? 'sqlite' : 'memory'
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
