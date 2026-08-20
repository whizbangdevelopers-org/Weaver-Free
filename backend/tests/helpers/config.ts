// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// One complete `DashboardConfig` fixture, for every spec that needs one.
//
// Before this, eight specs each carried their own `makeConfig` returning a hand-picked subset of
// the interface's 43 fields. Every one of them was a copy that drifts the moment a field is added,
// and they had all already drifted: the first typecheck of `backend/tests/` reported thirteen
// errors of exactly this shape (TS2740 "missing the following properties", TS2322, TS1360).
//
// They compiled against nothing and ran anyway, because a route reading `config.dnsDomain` from a
// fixture that omits it gets `undefined` and usually does not care — until one does, and then the
// failure surfaces as a test asserting behaviour no real config could produce.
//
// So this is deliberately a COMPLETE config, not a partial. Overrides are the only thing a spec
// supplies, which is also the only thing a spec is ever really saying: "like a normal host, except
// this." Adding a field to `DashboardConfig` now breaks exactly one file.
import type { DashboardConfig } from '../../src/config.js'

/**
 * A complete config for a plausible test host.
 *
 * Defaults are chosen to be INERT: no provisioning, no Stripe, no SMTP, no Prometheus, free tier.
 * A spec that needs a capability turns it on explicitly, so reading the override list tells you
 * exactly what the test depends on — and nothing is enabled by accident because it happened to be
 * convenient in whichever spec the fixture was copied from.
 */
export function makeTestConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    tier: 'free',
    licenseExpiry: null,
    licenseGraceMode: false,
    // One node, matching the keyless default in config.ts — a missing entitlement under-grants
    // rather than opening up. A spec exercising multi-node overrides it explicitly.
    licenseNodes: 1,
    licenseKeyFile: null,

    storageBackend: 'json',
    dataDir: './data',

    provisioningEnabled: false,
    microvmsDir: '/var/lib/microvms',
    bridgeGateway: '10.10.0.1',
    bridgeInterface: 'br-microvm',

    dnsDomain: 'vm.internal',
    dnsReloadCommand: '',

    wsBroadcastIntervalMs: 2000,

    sudoBin: '/usr/bin/sudo',
    systemctlBin: '/usr/bin/systemctl',
    iptablesBin: '/usr/sbin/iptables',
    qemuBin: '/usr/bin/qemu-system-x86_64',
    qemuImgBin: '/usr/bin/qemu-img',
    ipBin: '/usr/sbin/ip',
    lscpuBin: '/usr/bin/lscpu',
    dfBin: '/usr/bin/df',
    nixosVersionBin: '/run/current-system/sw/bin/nixos-version',
    dockerBin: 'docker',
    podmanBin: 'podman',
    apptainerBin: 'apptainer',
    weasyprintBin: '/usr/bin/weasyprint',

    // Null rather than a plausible path: these are "is this host equipped?" questions, and a
    // fixture that always answers yes hides every not-equipped branch.
    ovmf: null,
    virtioWinIso: null,
    swtpmBin: null,

    containerRuntimes: ['docker', 'podman'],
    distroCatalogUrl: null,

    jwtSecret: 'test-jwt-secret-not-a-real-credential',
    sessionStoreType: 'memory',

    notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },

    aiApiKey: '',
    nixConfigPath: '/etc/nixos/configuration.nix',

    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripeProducts: { soloProductId: '', teamProductId: '', fabrickProductId: '' },
    stripePrices: {},
    siteUrl: 'https://whizbangdevelopers.com',
    smtp: null,

    prometheusUrl: null,

    ...overrides,
  }
}
