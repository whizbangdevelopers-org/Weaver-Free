// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Demo mode configuration.
 *
 * When VITE_DEMO_MODE is set to 'true' at build time (or the user enters
 * via the demo login page), the app uses mock services and shows the demo
 * banner instead of hitting a real backend.
 */

import type { WorkloadInfo } from 'src/types/workload'
import type { HostBasicInfo } from 'src/types/host'
import type { NixConfigResponse, NixConfigSection } from 'src/types/host-config'
import { DELIVERY_TARGET_DATES } from './delivery-versions'
import type { NotificationEvent } from 'src/types/notification'
import type { ContainerInfo } from 'src/types/container'
import type { VmMetrics, MetricPoint } from 'src/types/metrics'
import { TIERS, STATUSES, ROLES, type TierName, type UserRole } from 'src/constants/vocabularies'

/**
 * Tier stage labels — update here as product progresses.
 * Shown on the tier buttons in the private demo toolbar.
 */
export const DEMO_TIER_STAGES: Record<string, string> = {
  [TIERS.FREE]:    'Released',
  [TIERS.WEAVER]:  'User Testing',
  [TIERS.FABRICK]: 'In Development',
}

/** Check whether the app is running in demo mode. */
export function isDemoMode(): boolean {
  // Build-time flag (set by CI or scripts/build-demo.sh)
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true
  if (typeof localStorage !== 'undefined') {
    // Migrate legacy container-loom-demo-mode key to weaver-demo-mode
    const legacyCl = localStorage.getItem('container-loom-demo-mode')
    if (legacyCl !== null) {
      localStorage.setItem('weaver-demo-mode', legacyCl)
      localStorage.removeItem('container-loom-demo-mode')
    }
    // Runtime flag (set by DemoLoginPage after captcha)
    if (localStorage.getItem('weaver-demo-mode') === 'true') return true
    // Legacy key (backward compat)
    if (localStorage.getItem('microvm-demo-mode') === 'true') return true
  }
  return false
}

/** Check whether this is the public (curated) demo build. */
export function isPublicDemo(): boolean {
  return import.meta.env.VITE_DEMO_PUBLIC === 'true'
}

/** Links shown in the demo banner and throughout demo-mode UI. */
export const DEMO_LINKS = {
  github: 'https://github.com/whizbangdevelopers-org/Weaver-Free',
  install: 'https://github.com/whizbangdevelopers-org/Weaver-Free#quick-start',
  docs: 'https://github.com/whizbangdevelopers-org/Weaver-Free/tree/main/docs',
  demo: 'https://weaver-demo.github.io',
} as const

/** Links for the public demo funnel — CTAs point to WBD website Divi forms (Decision #135). */
export const PUBLIC_DEMO_LINKS = {
  fmProgram: 'https://whizbangdevelopers.com/founding-member',
  contact: 'https://whizbangdevelopers.com/contact',
  getStarted: DEMO_LINKS.install,
} as const

// ---------------------------------------------------------------------------
// Public demo funnel step model (Decision #135).
//
// The version switcher IS the funnel. Three presentation patterns:
//   version   — full interactive (released Free versions, mock data)
//   teaser    — interactive teaser (next tier to ship, scoped mock data)
//   marketing — identity/vision page (further-out tiers, no features)
//
// Linear journey: v1.0 → … → v1.3 → Solo → Team → Fabrick → Pricing
// ---------------------------------------------------------------------------

/** A step in the public demo funnel — maps to one of the three presentation patterns. */
export interface PublicDemoStep {
  /** 'version' = full interactive, 'teaser' = interactive teaser, 'marketing' = identity/vision page */
  type: 'version' | 'teaser' | 'marketing'
  /** For version steps: '1.0', '1.1', etc. For teaser/marketing: 'solo', 'team', etc. */
  id: string
  /** Display label in the switcher */
  label: string
  /** Route to navigate to for teaser/marketing steps (version steps use store + existing pages) */
  route?: string
  /** Color class for the label in the switcher */
  colorClass?: string
  /** Subtitle shown below label */
  subtitle?: string
}

/** Build the public demo funnel steps: released Free versions + teaser + marketing pages. */
export function getPublicDemoSteps(): PublicDemoStep[] {
  // Version steps — all Free versions up to tierCeiling: FREE = v1.3
  const versionSteps: PublicDemoStep[] = DEMO_VERSIONS
    .filter(v => parseFloat(v.version) <= 1.3)
    .map(v => ({
      type: 'version' as const,
      id: v.version,
      label: `v ${v.version}`,
      subtitle: v.headline,
    }))

  // Teaser step — interactive with mock data (next tier to ship)
  const teaserSteps: PublicDemoStep[] = [
    { type: 'teaser', id: 'solo', label: 'Solo', route: '/explore/solo', colorClass: 'text-primary', subtitle: 'Live Provisioning' },
  ]

  // Marketing steps — identity/vision pages (further-out tiers)
  const marketingSteps: PublicDemoStep[] = [
    { type: 'marketing', id: 'team', label: 'Team', route: '/explore/team', colorClass: 'text-primary', subtitle: 'Peer management' },
    { type: 'marketing', id: 'fabrick', label: 'FabricK', route: '/explore/fabrick', colorClass: 'text-fabrick', subtitle: 'Fleet governance' },
    { type: 'marketing', id: 'pricing', label: 'Pricing', route: '/explore/pricing', colorClass: 'text-grey-8', subtitle: 'Compare & save' },
  ]

  return [...versionSteps, ...teaserSteps, ...marketingSteps]
}

// ---------------------------------------------------------------------------
// Tier-specific VM sets for the interactive explainer.
//
// Each set tells the story of a typical user at that tier:
//   Weaver Free — home lab / single node, few VMs, single distro
//   Weaver Solo — serious admin / small team, mixed distros, provisioning
//   Fabrick    — org / multi-team, tags for ownership, descriptions, scale
// ---------------------------------------------------------------------------

/** Free tier: home lab / single node — 3 NixOS VMs, basic setup */
const FREE_VMS: WorkloadInfo[] = [
  {
    name: 'my-webserver',
    status: STATUSES.RUNNING,
    ip: '10.10.0.10',
    mem: 256,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    distro: 'nixos',
    bridge: 'br-microvm',
    autostart: true,
    description: 'Personal web server',
    tags: ['web'],
  },
  {
    name: 'dev-playground',
    status: STATUSES.RUNNING,
    ip: '10.10.0.11',
    mem: 512,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 3_600_000 * 6).toISOString(),
    distro: 'nixos',
    bridge: 'br-microvm',
    description: 'Local development environment',
    tags: ['dev'],
  },
  {
    name: 'backup-test',
    status: STATUSES.IDLE,
    ip: '10.10.0.12',
    mem: 256,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: null,
    distro: 'nixos',
    bridge: 'br-microvm',
    description: 'Backup and restore testing',
    tags: ['backup'],
  },
]

/** Weaver Solo tier: serious admin — 6 VMs across 3 bridges, mixed distros + hypervisors.
 *
 *  br-prod  10.10.0.0/24 — Production: web + app tier (internet-facing)
 *  br-data  10.10.2.0/24 — Data tier: database (isolated from prod, app-tier access only)
 *  br-dev   10.10.1.0/24 — Dev/CI: experimentation, builds, staging
 */
const PREMIUM_VMS: WorkloadInfo[] = [
  // --- br-prod: production services ---
  {
    name: 'web-nginx',
    status: STATUSES.RUNNING,
    ip: '10.10.0.10',
    mem: 256,
    vcpu: 1,
    hypervisor: 'qemu',
    vmType: 'server',
    uptime: new Date(Date.now() - 86_400_000 * 12).toISOString(),
    distro: 'nixos',
    bridge: 'br-prod',
    autostart: true,
    description: 'Reverse proxy + TLS termination',
    tags: ['production', 'web'],
  },
  {
    name: 'app-server',
    status: STATUSES.RUNNING,
    ip: '10.10.0.11',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'cloud-hypervisor',
    vmType: 'server',
    uptime: new Date(Date.now() - 86_400_000 * 5).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-prod',
    autostart: true,
    description: 'Node.js application backend',
    tags: ['production', 'web'],
  },
  // --- br-data: database tier (isolated — app-tier access only) ---
  {
    name: 'db-postgres',
    status: STATUSES.RUNNING,
    ip: '10.10.2.10',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    vmType: 'server',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'rocky-9',
    bridge: 'br-data',
    autostart: true,
    description: 'PostgreSQL 16 primary',
    tags: ['production', 'database'],
  },
  // --- br-dev: development / CI ---
  {
    name: 'dev-python',
    status: STATUSES.RUNNING,
    ip: '10.10.1.20',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
    vmType: 'desktop',
    uptime: new Date(Date.now() - 3_600_000 * 8).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-dev',
    description: 'ML experimentation sandbox',
    tags: ['dev'],
  },
  {
    name: 'ci-runner',
    status: STATUSES.IDLE,
    ip: '10.10.1.40',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    vmType: 'server',
    uptime: null,
    distro: 'nixos',
    bridge: 'br-dev',
    description: 'Ephemeral CI build agent',
    tags: ['ci'],
  },
  {
    name: 'staging-env',
    status: STATUSES.FAILED,
    ip: '10.10.1.50',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
    vmType: 'server',
    uptime: null,
    distro: 'alma-9',
    bridge: 'br-dev',
    description: 'Pre-production mirror (disk full)',
    tags: ['staging'],
  },
]

/** Fabrick tier: multi-team org — 10 VMs across 5 segmented bridges.
 *
 *  br-edge    10.10.1.0/24  — DMZ: load balancers, API gateway (internet-facing)
 *  br-app     10.10.2.0/24  — Application tier: microservices (no direct ingress)
 *  br-data    10.10.3.0/24  — Database tier: isolated, app-tier access only
 *  br-mgmt    10.10.100.0/24 — Management: monitoring, bastion/jump host
 *  br-staging 10.10.10.0/24  — Non-production: QA, load testing
 */
const ENTERPRISE_VMS: WorkloadInfo[] = [
  // --- br-edge: DMZ / edge services ---
  {
    name: 'lb-haproxy-01',
    status: STATUSES.RUNNING,
    ip: '10.10.1.10',
    mem: 512,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-edge',
    autostart: true,
    description: 'Primary load balancer (TLS termination)',
    tags: ['platform', 'production', 'critical'],
  },
  {
    name: 'api-gateway',
    status: STATUSES.RUNNING,
    ip: '10.10.1.11',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 45).toISOString(),
    distro: 'nixos',
    bridge: 'br-edge',
    autostart: true,
    description: 'Kong API gateway + rate limiting',
    tags: ['platform', 'production'],
  },
  // --- br-app: application tier ---
  // LB and gateway on br-edge proxy down to these servers
  {
    name: 'web-frontend-01',
    status: STATUSES.RUNNING,
    ip: '10.10.2.5',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-app',
    autostart: true,
    description: 'Next.js SSR frontend (blue)',
    tags: ['frontend', 'production'],
  },
  {
    name: 'web-frontend-02',
    status: STATUSES.RUNNING,
    ip: '10.10.2.6',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-app',
    autostart: true,
    description: 'Next.js SSR frontend (green)',
    tags: ['frontend', 'production'],
  },
  {
    name: 'svc-orders',
    status: STATUSES.RUNNING,
    ip: '10.10.2.10',
    mem: 2048,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 15).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-app',
    autostart: true,
    description: 'Order processing microservice',
    tags: ['backend', 'production'],
  },
  {
    name: 'svc-payments',
    status: STATUSES.RUNNING,
    ip: '10.10.2.11',
    mem: 2048,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 15).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-app',
    autostart: true,
    description: 'Payment gateway integration',
    tags: ['backend', 'production', 'critical'],
  },
  // --- br-data: database tier (isolated) ---
  {
    name: 'db-primary',
    status: STATUSES.RUNNING,
    ip: '10.10.3.10',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'rocky-9',
    bridge: 'br-data',
    autostart: true,
    description: 'PostgreSQL 16 primary',
    tags: ['database', 'production', 'critical'],
  },
  {
    name: 'db-replica',
    status: STATUSES.RUNNING,
    ip: '10.10.3.11',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'rocky-9',
    bridge: 'br-data',
    autostart: true,
    description: 'PostgreSQL streaming replica',
    tags: ['database', 'production'],
  },
  // --- br-mgmt: management / monitoring ---
  {
    name: 'mon-prometheus',
    status: STATUSES.RUNNING,
    ip: '10.10.100.10',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 120).toISOString(),
    distro: 'nixos',
    bridge: 'br-mgmt',
    autostart: true,
    description: 'Prometheus + Grafana monitoring stack',
    tags: ['ops', 'monitoring', 'critical'],
  },
  {
    name: 'bastion-01',
    status: STATUSES.RUNNING,
    ip: '10.10.100.11',
    mem: 256,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 180).toISOString(),
    distro: 'nixos',
    bridge: 'br-mgmt',
    autostart: true,
    description: 'SSH jump host (2FA enforced)',
    tags: ['ops', 'security'],
  },
  // --- br-staging: non-production ---
  {
    name: 'qa-staging',
    status: STATUSES.RUNNING,
    ip: '10.10.10.10',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-staging',
    description: 'Full-stack staging mirror',
    tags: ['qa', 'staging'],
  },
  {
    name: 'qa-load-test',
    status: STATUSES.IDLE,
    ip: '10.10.10.11',
    mem: 4096,
    vcpu: 8,
    hypervisor: 'qemu',
    uptime: null,
    distro: 'ubuntu-24.04',
    bridge: 'br-staging',
    description: 'k6 load test runner (on-demand)',
    tags: ['qa', 'staging'],
  },
]

/** Cross-bridge application-layer routes (Fabrick demo only).
 *  Visualizes how traffic flows across network segments:
 *    edge tier → app tier → data tier
 *  These render as dashed directional edges in the network topology graph.
 */
export const ENTERPRISE_ROUTES: Array<{ source: string; target: string }> = [
  // LB distributes to web frontends (edge → app)
  { source: 'lb-haproxy-01', target: 'web-frontend-01' },
  { source: 'lb-haproxy-01', target: 'web-frontend-02' },
  // API gateway routes to backend services (edge → app)
  { source: 'api-gateway', target: 'svc-orders' },
  { source: 'api-gateway', target: 'svc-payments' },
  // App tier queries data tier (app → data)
  { source: 'svc-orders', target: 'db-primary' },
  { source: 'svc-payments', target: 'db-primary' },
]

/** Cross-bridge application-layer routes (Weaver Solo demo only).
 *  Shows the request flow: nginx → app-server → db-postgres.
 */
export const PREMIUM_ROUTES: Array<{ source: string; target: string }> = [
  { source: 'web-nginx', target: 'app-server' },
  { source: 'app-server', target: 'db-postgres' },
]

/** Get the demo VMs for the given tier. */
export function getDemoVmsForTier(tier: string): WorkloadInfo[] {
  switch (tier) {
    case TIERS.WEAVER: return PREMIUM_VMS
    case TIERS.FABRICK: return ENTERPRISE_VMS
    default: return FREE_VMS
  }
}

/** Legacy export — defaults to the full showcase set for backward compat. */
export const DEMO_VMS = PREMIUM_VMS

// ---------------------------------------------------------------------------
// Demo notification seed data — shown in the notification bell per tier.
// ---------------------------------------------------------------------------

const _t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString()

const FREE_NOTIFICATIONS: NotificationEvent[] = [
  { id: 'fn-1', timestamp: _t(35), event: 'vm:started', vmName: 'my-webserver', severity: 'success', message: 'my-webserver started successfully' },
  { id: 'fn-2', timestamp: _t(60 * 26), event: 'vm:stopped', vmName: 'backup-test', severity: 'info', message: 'backup-test stopped' },
]

const PREMIUM_NOTIFICATIONS: NotificationEvent[] = [
  { id: 'pn-1', timestamp: _t(12), event: 'vm:failed', vmName: 'staging-env', severity: 'error', message: 'staging-env entered failed state — disk full' },
  { id: 'pn-2', timestamp: _t(60 * 3), event: 'resource:high-cpu', vmName: 'dev-python', severity: 'info', message: 'dev-python CPU at 94% for 5 minutes' },
  { id: 'pn-3', timestamp: _t(60 * 24 * 2), event: 'vm:stopped', vmName: 'ci-runner', severity: 'info', message: 'ci-runner stopped (job complete)' },
  { id: 'pn-4', timestamp: _t(60 * 24 * 12), event: 'vm:started', vmName: 'web-nginx', severity: 'success', message: 'web-nginx started after host reboot' },
]

const ENTERPRISE_NOTIFICATIONS: NotificationEvent[] = [
  { id: 'en-1', timestamp: _t(8), event: 'security:auth-failure', severity: 'error', message: 'Failed login attempt for user "deploy-bot" from 203.0.113.45' },
  { id: 'en-2', timestamp: _t(45), event: 'resource:high-memory', vmName: 'svc-orders', severity: 'info', message: 'svc-orders memory at 87% (1.8 GB / 2 GB)' },
  { id: 'en-3', timestamp: _t(60 * 2), event: 'vm:recovered', vmName: 'db-replica', severity: 'success', message: 'db-replica recovered — streaming replication resumed' },
  { id: 'en-4', timestamp: _t(60 * 5), event: 'resource:high-cpu', vmName: 'svc-payments', severity: 'info', message: 'svc-payments CPU at 91% — possible traffic spike' },
  { id: 'en-5', timestamp: _t(60 * 12), event: 'migration:eligible', vmName: 'svc-orders', severity: 'success', message: 'svc-orders is now migratable — titan joined the fleet with matching resources' },
  { id: 'en-6', timestamp: _t(60 * 24), event: 'vm:started', vmName: 'qa-staging', severity: 'success', message: 'qa-staging started for release validation' },
  { id: 'en-7', timestamp: _t(60 * 24 * 2), event: 'migration:completed', vmName: 'ci-runner', severity: 'success', message: 'ci-runner migrated from crucible → nexus (cold, 28s downtime)' },
  { id: 'en-8', timestamp: _t(60 * 24 * 3), event: 'security:permission-denied', vmName: 'db-primary', severity: 'error', message: 'Access denied: viewer1 attempted to start db-primary' },
  // Fleet bridge events (v3.0+)
  { id: 'en-fb-1', timestamp: _t(12), event: 'fleet-bridge:blue-green', severity: 'info', message: 'fb-production: AI deploying v2.2 canary — shifting 10% traffic to cloud-api-eu-v22' },
  { id: 'en-fb-2', timestamp: _t(35), event: 'fleet-bridge:cordon', severity: 'warning', message: 'fb-edge: AI cordoned iot-factory-01 — thermal throttling detected, endpoints draining' },
  { id: 'en-fb-3', timestamp: _t(60 * 4), event: 'fleet-bridge:weight-adjust', severity: 'info', message: 'fb-production: AI rebalanced weights — king:web-app 40%, hetzner:cloud-api-eu 35%, do:cloud-api-apac 15%' },
  { id: 'en-fb-4', timestamp: _t(60 * 8), event: 'fleet-bridge:endpoint-registered', severity: 'success', message: 'fb-cicd: ci-runner-03 auto-registered on matrix (LP provisioned from queue depth spike)' },
  { id: 'en-fb-5', timestamp: _t(60 * 24), event: 'fleet-bridge:hub-sync', severity: 'info', message: 'Hub sync: all 10 hosts current — last-known weights pushed for DR' },
]

/** Get demo in-app notifications for the given tier. */
export function getDemoNotificationsForTier(tier: string): NotificationEvent[] {
  switch (tier) {
    case TIERS.FABRICK: return ENTERPRISE_NOTIFICATIONS
    case TIERS.WEAVER: return PREMIUM_NOTIFICATIONS
    default: return FREE_NOTIFICATIONS
  }
}

// ---------------------------------------------------------------------------
// Demo container data per tier (v1.1.0).
//
// Free  — Docker + Podman (adoption attractors, every homelab has Docker)
// Weaver Solo/Fabrick — + Apptainer (HPC/institutional buyers)
// ---------------------------------------------------------------------------

const _ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString()

const FREE_CONTAINERS: ContainerInfo[] = [
  {
    id: 'a1b2c3d4e5f6',
    name: 'nginx-proxy',
    image: 'nginx:alpine',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(14),
    ports: [
      { hostPort: 80, containerPort: 80, protocol: 'tcp' },
      { hostPort: 443, containerPort: 443, protocol: 'tcp' },
    ],
    mounts: [{ source: '/etc/nginx/conf.d', destination: '/etc/nginx/conf.d', readonly: true }],
    memoryUsageMb: 28,
    memoryLimitMb: 128,
    cpuPercent: 1.2,
  },
  {
    id: 'b2c3d4e5f6a1',
    name: 'homeassistant',
    image: 'homeassistant/home-assistant:stable',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(60),
    ports: [{ hostPort: 8123, containerPort: 8123, protocol: 'tcp' }],
    mounts: [{ source: '/opt/homeassistant/config', destination: '/config', readonly: false }],
    memoryUsageMb: 312,
    memoryLimitMb: 512,
    cpuPercent: 3.8,
  },
  {
    id: 'c3d4e5f6a1b2',
    name: 'postgres-dev',
    image: 'postgres:16-alpine',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(7),
    ports: [{ hostPort: 5432, containerPort: 5432, protocol: 'tcp' }],
    mounts: [{ source: '/opt/pgdata', destination: '/var/lib/postgresql/data', readonly: false }],
    memoryUsageMb: 96,
    memoryLimitMb: 256,
    cpuPercent: 0.5,
    labels: { env: 'dev' },
  },
  {
    id: 'd4e5f6a1b2c3',
    name: 'redis-cache',
    image: 'redis:7-alpine',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(7),
    ports: [{ hostPort: 6379, containerPort: 6379, protocol: 'tcp' }],
    memoryUsageMb: 12,
    memoryLimitMb: 64,
    cpuPercent: 0.2,
  },
  {
    id: 'e5f6a1b2c3d4',
    name: 'pihole',
    image: 'pihole/pihole:latest',
    runtime: 'podman',
    status: STATUSES.RUNNING,
    created: _ago(30),
    ports: [
      { hostPort: 53, containerPort: 53, protocol: 'udp' },
      { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
    ],
    mounts: [{ source: '/opt/pihole/etc', destination: '/etc/pihole', readonly: false }],
    memoryUsageMb: 48,
    memoryLimitMb: 128,
    cpuPercent: 0.8,
    labels: { purpose: 'dns-blocking' },
  },
]

/** Weaver Solo adds Apptainer for HPC/research workloads. */
const PREMIUM_CONTAINERS: ContainerInfo[] = [
  ...FREE_CONTAINERS,
  {
    id: 'f6a1b2c3d4e5',
    name: 'pytorch-train',
    image: '/opt/containers/pytorch-2.1.sif',
    runtime: 'apptainer',
    status: STATUSES.RUNNING,
    created: _ago(0, 3),
    memoryUsageMb: 4800,
    memoryLimitMb: 8192,
    cpuPercent: 88.4,
    labels: { job: 'ml-training', user: 'researcher1' },
  },
  {
    id: 'a2b3c4d5e6f7',
    name: 'bioinfo-pipeline',
    image: 'docker://biocontainers/samtools:1.19.2',
    runtime: 'apptainer',
    status: STATUSES.RUNNING,
    created: _ago(1),
    memoryUsageMb: 1280,
    memoryLimitMb: 4096,
    cpuPercent: 42.1,
    labels: { job: 'sequence-alignment', user: 'researcher2' },
  },
  {
    id: 'b3c4d5e6f7a2',
    name: 'matlab-r2024a',
    image: '/opt/containers/matlab-r2024a.sif',
    runtime: 'apptainer',
    status: STATUSES.STOPPED,
    created: _ago(3),
    labels: { job: 'simulation', user: 'researcher3' },
  },
]

/** Fabrick: team-labeled, registry-sourced, resource-limited. */
const ENTERPRISE_CONTAINERS: ContainerInfo[] = [
  {
    id: 'c4d5e6f7a2b3',
    name: 'web-gateway',
    image: 'registry.internal/platform/nginx:1.25-prod',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(90),
    ports: [
      { hostPort: 80, containerPort: 80, protocol: 'tcp' },
      { hostPort: 443, containerPort: 443, protocol: 'tcp' },
    ],
    memoryUsageMb: 64,
    memoryLimitMb: 256,
    cpuPercent: 4.2,
    labels: { team: 'platform', env: 'production', 'managed-by': 'ops' },
  },
  {
    id: 'd5e6f7a2b3c4',
    name: 'api-service',
    image: 'registry.internal/backend/api:v2.14.1',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(5),
    ports: [{ hostPort: 3000, containerPort: 3000, protocol: 'tcp' }],
    memoryUsageMb: 384,
    memoryLimitMb: 768,
    cpuPercent: 22.6,
    labels: { team: 'backend', env: 'production' },
  },
  {
    id: 'e6f7a2b3c4d5',
    name: 'worker-queue',
    image: 'redis:7-alpine',
    runtime: 'docker',
    status: STATUSES.RUNNING,
    created: _ago(30),
    ports: [{ hostPort: 6379, containerPort: 6379, protocol: 'tcp' }],
    memoryUsageMb: 24,
    memoryLimitMb: 128,
    cpuPercent: 0.4,
    labels: { team: 'backend', role: 'queue' },
  },
  {
    id: 'f7a2b3c4d5e6',
    name: 'metrics-exporter',
    image: 'prom/node-exporter:latest',
    runtime: 'podman',
    status: STATUSES.RUNNING,
    created: _ago(120),
    ports: [{ hostPort: 9100, containerPort: 9100, protocol: 'tcp' }],
    memoryUsageMb: 16,
    cpuPercent: 0.3,
    labels: { team: 'ops', role: 'monitoring' },
  },
  {
    id: 'a3b4c5d6e7f8',
    name: 'sim-workload-01',
    image: 'registry.internal/hpc/simulation:v2.1',
    runtime: 'apptainer',
    status: STATUSES.RUNNING,
    created: _ago(0, 6),
    memoryUsageMb: 12288,
    memoryLimitMb: 16384,
    cpuPercent: 94.8,
    labels: { team: 'research', project: 'climate-model', allocation: 'grant-2024' },
  },
  {
    id: 'b4c5d6e7f8a3',
    name: 'sim-workload-02',
    image: 'registry.internal/hpc/simulation:v2.1',
    runtime: 'apptainer',
    status: STATUSES.RUNNING,
    created: _ago(0, 6),
    memoryUsageMb: 11776,
    memoryLimitMb: 16384,
    cpuPercent: 91.3,
    labels: { team: 'research', project: 'climate-model', allocation: 'grant-2024' },
  },
]

/** Get demo containers for the given tier. */
export function getDemoContainersForTier(tier: string): ContainerInfo[] {
  switch (tier) {
    case TIERS.FABRICK: return ENTERPRISE_CONTAINERS
    case TIERS.WEAVER: return PREMIUM_CONTAINERS
    default: return FREE_CONTAINERS
  }
}

// ---------------------------------------------------------------------------
// Demo resource metrics (v1.1.0).
//
// Generates deterministic time-series data per VM using sine-wave variation
// so the charts look realistic without Math.random() (stable across renders).
//
// Free:    60 points × 1-min interval = 1h window
// Weaver Solo/Fabrick: 288 points × 5-min interval = 24h window
// ---------------------------------------------------------------------------

/** Deterministic "noise" based on index — avoids Math.random() instability. */
function _noise(i: number, seed: number): number {
  return ((i * seed + 13) % 100) / 100 - 0.5
}

interface MetricProfile {
  baseCpu: number
  cpuRange: number
  baseMem: number
  memRange: number
  baseRead: number
  baseWrite: number
}

const METRIC_PROFILES: Record<string, MetricProfile> = {
  web:      { baseCpu: 8,  cpuRange: 12,  baseMem: 180,  memRange: 40,   baseRead: 0.4, baseWrite: 0.2 },
  app:      { baseCpu: 28, cpuRange: 25,  baseMem: 620,  memRange: 80,   baseRead: 0.8, baseWrite: 0.6 },
  database: { baseCpu: 6,  cpuRange: 8,   baseMem: 1400, memRange: 200,  baseRead: 5.0, baseWrite: 3.0 },
  dev:      { baseCpu: 35, cpuRange: 45,  baseMem: 480,  memRange: 120,  baseRead: 2.0, baseWrite: 1.5 },
  ops:      { baseCpu: 12, cpuRange: 10,  baseMem: 900,  memRange: 100,  baseRead: 1.0, baseWrite: 0.8 },
  security: { baseCpu: 2,  cpuRange: 3,   baseMem: 80,   memRange: 10,   baseRead: 0.1, baseWrite: 0.0 },
  hpc:      { baseCpu: 88, cpuRange: 8,   baseMem: 6000, memRange: 1000, baseRead: 10,  baseWrite: 8.0 },
  idle:     { baseCpu: 2,  cpuRange: 3,   baseMem: 80,   memRange: 20,   baseRead: 0.1, baseWrite: 0.0 },
}

function _profileForVm(name: string): MetricProfile {
  if (/nginx|web|gateway|proxy|lb|haproxy|frontend/.test(name)) return METRIC_PROFILES.web!
  if (/app|api|svc|service|orders|payments|worker/.test(name))   return METRIC_PROFILES.app!
  if (/db|postgres|mysql|mongo|redis|replica|primary/.test(name)) return METRIC_PROFILES.database!
  if (/dev|python|node|ci|runner|staging|playground/.test(name)) return METRIC_PROFILES.dev!
  if (/prometheus|grafana|mon|exporter|metrics/.test(name))      return METRIC_PROFILES.ops!
  if (/bastion|security|jump/.test(name))                        return METRIC_PROFILES.security!
  if (/sim|hpc|train|bioinfo|matlab|research/.test(name))        return METRIC_PROFILES.hpc!
  return METRIC_PROFILES.idle!
}

function _buildPoints(count: number, intervalMs: number, p: MetricProfile): MetricPoint[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const phase = (i / count) * Math.PI * 6  // ~3 cycles across window
    const cpu = Math.max(0.3, Math.min(99.5,
      p.baseCpu + Math.sin(phase) * p.cpuRange * 0.6 + _noise(i, 7919) * p.cpuRange * 0.4
    ))
    const mem = Math.max(32, Math.round(
      p.baseMem + Math.sin(phase * 0.4) * p.memRange
    ))
    return {
      timestamp: new Date(now - (count - 1 - i) * intervalMs).toISOString(),
      cpuPercent: Math.round(cpu * 10) / 10,
      memoryMb: mem,
      diskReadMbps: Math.max(0, Math.round((p.baseRead + _noise(i, 3711) * p.baseRead) * 10) / 10),
      diskWriteMbps: Math.max(0, Math.round((p.baseWrite + _noise(i, 1337) * p.baseWrite) * 10) / 10),
    }
  })
}

// ---------------------------------------------------------------------------
// Demo version manifest (private demo — QA / investor validation tool).
//
// Each entry represents one release version. targetDate is an estimate;
// update as plans firm up. weeksUntil is computed at runtime.
// ---------------------------------------------------------------------------

export interface DemoVersionInfo {
  /** Short version string used as state key, e.g. '1.1' */
  version: string
  /** Display label, e.g. 'v1.1.0' */
  label: string
  /** 'released' = shipped, 'in-progress' = actively built, 'planned' = roadmap */
  status: 'released' | 'in-progress' | 'planned'
  /** ISO date of actual release or estimated target */
  targetDate: string
  /** One-line feature headline shown below the version number */
  headline: string
  /** Last version to add features for this tier — shown as a boundary marker */
  tierCeiling?: TierName
}

// ---------------------------------------------------------------------------
// Public demo release highlights (Decision #135).
//
// Shown cumulatively at the bottom of the page as the prospect steps through
// Free versions. Tells the "we ship consistently" story without leaking
// roadmap details — only features that are in the current demo version.
// ---------------------------------------------------------------------------

/** Feature highlights per Free-tier version for the public demo release summary. */
export const PUBLIC_DEMO_RELEASE_HIGHLIGHTS: Record<string, string[]> = {
  '1.0': [
    'Workload management with real-time status',
    'Start / stop / restart VMs',
    'Network topology (Strands)',
    'AI diagnostics (BYOK)',
    'Serial console',
    'Host configuration viewer',
    'TUI client',
  ],
  '1.1': [
    'Docker + Podman container visibility',
    'Container status + resource metrics',
    'Container detail view',
  ],
  '1.2': [
    'Full container lifecycle (start / stop / create / delete)',
    'Firewall templates + network hardening',
    'GPU passthrough',
    'Container management (Apptainer for Weaver Solo)',
  ],
  '1.3': [
    'Remote access (Tailscale tunnel)',
    'Mobile app (iOS + Android)',
    'Push notifications',
    'Biometric authentication',
  ],
}

// Dates cascade from forge/DELIVERY.json — edit weeks there, not here.
// delivery-versions.ts is auto-generated on every build/dev start.
export const DEMO_VERSIONS: DemoVersionInfo[] = [
  { version: '1.0', label: 'v1.0.0', status: 'released',    targetDate: DELIVERY_TARGET_DATES['1.0.0']!, headline: 'Core Platform' },
  { version: '1.1', label: 'v1.1.0', status: 'in-progress', targetDate: DELIVERY_TARGET_DATES['1.1.0']!, headline: 'Container Visibility' },
  { version: '1.2', label: 'v1.2.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['1.2.0']!, headline: 'Container Management' },
  { version: '1.3', label: 'v1.3.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['1.3.0']!, headline: 'Remote Access + Mobile', tierCeiling: TIERS.FREE },
  { version: '1.4', label: 'v1.4.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['1.4.0']!, headline: 'Cross-Resource AI' },
  { version: '1.5', label: 'v1.5.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['1.5.0']!, headline: 'Integrated Secrets Management' },
  { version: '1.6', label: 'v1.6.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['1.6.0']!, headline: 'Migration Tooling' },
  { version: '2.0', label: 'v2.0.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.0.0']!, headline: 'Storage + Templates', tierCeiling: TIERS.WEAVER },
  { version: '2.1', label: 'v2.1.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.1.0']!, headline: 'Storage Phase 2' },
  { version: '2.2', label: 'v2.2.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.2.0']!, headline: 'Weaver Team — Peer Federation' },
  { version: '2.3', label: 'v2.3.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.3.0']!, headline: 'FabricK Basic Clustering' },
  { version: '2.4', label: 'v2.4.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.4.0']!, headline: 'Backup Weaver' },
  { version: '2.5', label: 'v2.5.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.5.0']!, headline: 'Storage & Template FabricK' },
  { version: '2.6', label: 'v2.6.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['2.6.0']!, headline: 'Backup FabricK + Extensions' },
  { version: '3.0', label: 'v3.0.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['3.0.0']!, headline: 'FabricK — Multi-Host Fleet' },
  { version: '3.1', label: 'v3.1.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['3.1.0']!, headline: 'Edge Fleet + Cloud Burst' },
  { version: '3.2', label: 'v3.2.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['3.2.0']!, headline: 'Cloud Burst Self-Serve Billing' },
  { version: '3.3', label: 'v3.3.0', status: 'planned',     targetDate: DELIVERY_TARGET_DATES['3.3.0']!, headline: 'FabricK Maturity — Workload Groups + Compliance' },
]

/** Compute weeks until a target date (negative = in the past). */
export function weeksUntilRelease(isoDate: string): number {
  const ms = new Date(isoDate).getTime()
  if (Number.isNaN(ms)) return 0
  return Math.round((ms - Date.now()) / (7 * 24 * 60 * 60 * 1000))
}

// ---------------------------------------------------------------------------
// Version Milestones — product architecture progression (private demo only).
//
// Nine critical milestones showing the full product journey from foundation
// to architecture-complete. Displayed as modals when investors step through
// versions in the private demo version switcher.
// ---------------------------------------------------------------------------

export interface VersionMilestone {
  /** Version string matching DEMO_VERSIONS (e.g. '1.0', '2.2') */
  version: string
  /** Short milestone title */
  title: string
  /** Memorable one-liner tagline */
  tagline: string
  /** What shipped at this version — bullet points, architecture-level */
  whatShipped: string[]
  /** Why this matters to investors/customers — bullet points */
  businessImpact: string[]
  /** Which tier unlocks this milestone */
  tier: string
  /** Tier transition that happens at this version, if any */
  tierUpgrade?: { from: string; to: string }
  /** Progression step (1-based) */
  step: number
  /** Total milestones in the full product journey */
  totalSteps: number
}

export const VERSION_MILESTONES: VersionMilestone[] = [
  {
    version: '1.0',
    title: 'Core Platform',
    tagline: 'Foundation.',
    whatShipped: [
      '5 hypervisors: QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker',
      'Live Provisioning — create/manage VMs via API, zero host rebuilds',
      'AI diagnostics with BYOK (bring your own key)',
      'Network topology visualization (Strands)',
      'Serial console, RBAC, tier gating',
      'TUI client with 97% feature parity',
    ],
    businessImpact: [
      'A shipping product — not a prototype',
      'Hardware isolation per workload from day one — every VM behind a hypervisor boundary',
      'In the Project Glasswing era (AI discovering thousands of zero-days), this architecture means a compromised workload cannot escape to the host',
    ],
    tier: 'Free',
    step: 1, totalSteps: 9,
  },
  {
    version: '1.1',
    title: 'Container Visibility',
    tagline: 'One pane for all workloads.',
    whatShipped: [
      'Docker, Podman, and Apptainer containers alongside MicroVMs',
      'Container status, resource metrics, and detail views',
      'DNS extension with auto-zone (.vm.internal)',
      'Topology elbow routing for datacenter-grade network visualization',
    ],
    businessImpact: [
      'No competitor shows VMs and containers in a single view',
      'Unified workload promise made real — one dashboard, not three tools',
      'Apptainer visibility captures the HPC/research market Proxmox ignores',
    ],
    tier: 'Free',
    step: 2, totalSteps: 9,
  },
  {
    version: '1.2',
    title: 'The Closer',
    tagline: 'Feature parity with Proxmox.',
    whatShipped: [
      'Full container lifecycle — create, start, stop, delete',
      'GPU passthrough via VFIO-PCI (NVIDIA, AMD, Intel)',
      'Firewall templates with nftables presets',
      'Security hardening — AppArmor, Seccomp, kernel hardening',
      'Manual bridge weight controls for traffic distribution',
      'SSH key management',
    ],
    businessImpact: [
      'Makes "why not Proxmox?" unanswerable — everything they do, plus AI, plus GPU, plus containers',
      'Layered defense (hardware isolation + AppArmor + Seccomp + NixOS deterministic patching) is the minimum viable posture in the Glasswing era',
      'Founding Member price locks here — strongest conversion trigger',
    ],
    tier: 'Free',
    step: 3, totalSteps: 9,
  },
  {
    version: '1.3',
    title: 'Remote Access + Mobile',
    tagline: 'Manage from your pocket.',
    whatShipped: [
      'Tailscale zero-config tunnel (Free) + WireGuard self-hosted (Solo)',
      'Native iOS/Android app via Capacitor — same Quasar codebase',
      'Push notifications + deep-link actions',
      'Biometric authentication',
      'Network Isolation Mode for compliance',
    ],
    businessImpact: [
      'Triple-interface product: web + TUI + mobile',
      'No competitor has a native mobile app for infrastructure management',
      'Free tier ceiling — everything after this requires Solo',
      'Sysop-as-champion can manage infrastructure from anywhere',
    ],
    tier: 'Free',
    step: 4, totalSteps: 9,
  },
  {
    version: '1.4',
    title: 'Bridge Active Routing + AI Agent',
    tagline: 'The bridge becomes a load balancer.',
    whatShipped: [
      'Weighted traffic distribution with health-aware endpoint selection',
      'Cross-resource AI agent — diagnostics across VMs and containers',
      'AI credential vault for admin-managed model keys',
      'Bridge replaces CNI + ingress controller — two K8s components → one',
    ],
    businessImpact: [
      'Solo differentiator — this is what Free users upgrade for',
      'Bridge convergence starts: one component replaces three K8s components',
      'AI moves from diagnostics to active infrastructure management',
    ],
    tier: 'Solo',
    tierUpgrade: { from: 'Free', to: 'Solo' },
    step: 5, totalSteps: 9,
  },
  {
    version: '2.0',
    title: 'Storage + Templates',
    tagline: 'The full single-host product.',
    whatShipped: [
      'Disk provisioning with lifecycle management',
      'System templates — built-in archetypes + create-from-template + cloud-init',
      'Snapshot provisioning — "build once, run many" (2-5 sec VM restore)',
      'Import/export — Proxmox .conf, libvirt XML, Docker Compose',
      'Backup with BYOB plugin model (restic, borg, S3)',
    ],
    businessImpact: [
      'Weaver Solo is feature-complete for single-host management',
      'Every sysadmin capability in one product: provisioning, templates, snapshots, backup, import',
      'Solo ceiling — everything after this is multi-host',
    ],
    tier: 'Solo',
    step: 6, totalSteps: 9,
  },
  {
    version: '2.2',
    title: 'Weaver Team + Smart Bridges',
    tagline: 'No platform team required.',
    whatShipped: [
      'Weaver Team tier — peer federation (manage 2 remote hosts)',
      'Tailscale auto-discovery for zero-config peer setup',
      'Multi-user with auditor role',
      'Smart Bridges — AI-operated blue/green, health routing, weight shifting',
      'Auto-TLS reverse proxy for Team + FabricK',
    ],
    businessImpact: [
      'K8s competitive story becomes concrete — Smart Bridges replaces Argo Rollouts + service mesh',
      'Three K8s components → one bridge',
      'Small teams (2-4 people) get automated deployments without a platform engineer',
      '$199/user/yr vs $150K+/yr for a K8s platform engineer',
    ],
    tier: 'Team',
    tierUpgrade: { from: 'Solo', to: 'Team' },
    step: 7, totalSteps: 9,
  },
  {
    version: '3.0',
    title: 'FabricK Fleet',
    tagline: 'Full fleet at $20K/yr.',
    whatShipped: [
      'Multi-host fleet management with Observer (any-Linux inventory)',
      'HA + live migration across hosts',
      'Fleet virtual bridges with cross-node traffic routing',
      'Warp — fleet configuration patterns + drift detection',
      'Fleet Topology (Loom) — visual host-to-host map',
      'Container orchestration with image registry',
      'Edge computing via nixos-anywhere',
    ],
    businessImpact: [
      'FabricK tier ships — full K8s stack replacement at fleet scale',
      '10-node fleet: $20K/yr replaces $500K+/yr in K8s tooling + headcount',
      'Observer lets enterprises start today — install on Ubuntu/RHEL, see the fleet, convert incrementally',
      'Fleet-wide hardware isolation + hypervisor diversity + deterministic NixOS patching — defense that scales as fast as AI scales offense',
    ],
    tier: 'FabricK',
    tierUpgrade: { from: 'Team', to: 'FabricK' },
    step: 8, totalSteps: 9,
  },
  {
    version: '3.3',
    title: 'Workload Groups + Compliance',
    tagline: 'Architecture complete.',
    whatShipped: [
      'Workload Groups — compliance boundaries with per-group AI policy',
      'Per-department AI governance (Marketing: Mistral, Engineering: Claude, Finance: local-only)',
      'MCP server — fleet API for external AI tools',
      'Compliance Pack with per-group audit',
      'Access Inspector for access request workflows',
    ],
    businessImpact: [
      'Architecture is complete — every K8s component has a Weaver equivalent',
      'Workload Groups replace K8s namespaces with hardware isolation',
      'MCP replaces the K8s API server — AI agents manage the fleet natively',
      'Simpler, cheaper, hardware-isolated',
    ],
    tier: 'FabricK',
    step: 9, totalSteps: 9,
  },
]

/** Map version string → milestone (undefined for non-milestone versions). */
export const MILESTONE_BY_VERSION = new Map(
  VERSION_MILESTONES.map(m => [m.version, m]),
)

// ---------------------------------------------------------------------------
// Fabrick multi-host data (v3.0 demo only).
//
// Three hosts form the fleet:
//   king    — primary production host (existing VMs)
//   forge   — CI / build host
//   vault   — security / services host
// ---------------------------------------------------------------------------

export interface DemoHostInfo {
  id: string
  hostname: string
  ipAddress: string
  arch: string
  cpuModel: string
  cpuCount: number
  totalMemMb: number
  kernelVersion: string
  uptimeSeconds: number
  kvmAvailable: boolean
  role: string
  status: 'healthy' | 'degraded' | 'offline'
  /** Distinguishes on-prem, cloud provider, WireGuard-connected remote, and IoT/edge devices. */
  kind?: 'local' | 'cloud' | 'remote' | 'iot'
  /** Cloud provider identifier — 'hetzner' | 'digitalocean' | 'aws' */
  provider?: string
  /** Region slug — e.g. 'fsn1', 'sgp1', 'us-east-1' */
  region?: string
}

export const DEMO_HOSTS: DemoHostInfo[] = [
  {
    id: 'king',
    hostname: 'king',
    ipAddress: '10.0.0.122',
    arch: 'x86_64',
    cpuModel: 'Intel Xeon E5-1620 v3 @ 3.50GHz',
    cpuCount: 8,
    totalMemMb: 64220,
    kernelVersion: '6.18.8',
    uptimeSeconds: 376555,
    kvmAvailable: true,
    role: 'Production',
    status: 'healthy',
  },
  {
    id: 'crucible',
    hostname: 'crucible',
    ipAddress: '10.0.0.123',
    arch: 'x86_64',
    cpuModel: 'AMD Ryzen 9 5900X @ 3.70GHz',
    cpuCount: 24,
    totalMemMb: 32768,
    kernelVersion: '6.18.8',
    uptimeSeconds: 189200,
    kvmAvailable: true,
    role: 'CI / Build',
    status: 'healthy',
  },
  {
    id: 'vault',
    hostname: 'vault',
    ipAddress: '10.0.0.124',
    arch: 'x86_64',
    cpuModel: 'Intel Core i7-12700 @ 2.10GHz',
    cpuCount: 12,
    totalMemMb: 16384,
    kernelVersion: '6.18.8',
    uptimeSeconds: 604800,
    kvmAvailable: true,
    role: 'Security / Services',
    status: 'healthy',
  },
  {
    id: 'bastion',
    hostname: 'bastion',
    ipAddress: '10.0.0.125',
    arch: 'x86_64',
    cpuModel: 'Intel Core i5-12600K @ 3.70GHz',
    cpuCount: 4,
    totalMemMb: 8192,
    kernelVersion: '6.18.8',
    uptimeSeconds: 2_592_000,
    kvmAvailable: true,
    role: 'Jump Host / Access',
    status: 'healthy',
  },
  {
    id: 'titan',
    hostname: 'titan',
    ipAddress: '10.0.0.126',
    arch: 'x86_64',
    cpuModel: 'AMD EPYC 7763 @ 2.45GHz',
    cpuCount: 32,
    totalMemMb: 131072,
    kernelVersion: '6.18.8',
    uptimeSeconds: 864_000,
    kvmAvailable: true,
    role: 'HPC / Compute',
    status: 'healthy',
  },
  {
    id: 'nexus',
    hostname: 'nexus',
    ipAddress: '10.0.0.127',
    arch: 'x86_64',
    cpuModel: 'AMD Ryzen 7 5800X @ 3.80GHz',
    cpuCount: 8,
    totalMemMb: 32768,
    kernelVersion: '6.18.8',
    uptimeSeconds: 1_296_000,
    kvmAvailable: true,
    role: 'DevOps / Registry',
    status: 'healthy',
  },
  {
    id: 'sentinel',
    hostname: 'sentinel',
    ipAddress: '10.0.0.128',
    arch: 'x86_64',
    cpuModel: 'Intel Xeon E-2374G @ 3.70GHz',
    cpuCount: 8,
    totalMemMb: 16384,
    kernelVersion: '6.18.8',
    uptimeSeconds: 7_776_000,
    kvmAvailable: true,
    role: 'Security Monitoring',
    status: 'healthy',
  },
  {
    id: 'atlas',
    hostname: 'atlas',
    ipAddress: '10.0.0.129',
    arch: 'x86_64',
    cpuModel: 'Intel Core i7-10700 @ 2.90GHz',
    cpuCount: 4,
    totalMemMb: 8192,
    kernelVersion: '6.18.8',
    uptimeSeconds: 5_184_000,
    kvmAvailable: true,
    role: 'Edge / Load Balancer',
    status: 'healthy',
  },
  {
    id: 'matrix',
    hostname: 'matrix',
    ipAddress: '10.0.0.130',
    arch: 'x86_64',
    cpuModel: 'AMD Ryzen 9 5950X @ 3.40GHz',
    cpuCount: 16,
    totalMemMb: 65536,
    kernelVersion: '6.18.8',
    uptimeSeconds: 432_000,
    kvmAvailable: true,
    role: 'Dev / Test',
    status: 'healthy',
  },
  {
    id: 'beacon',
    hostname: 'beacon',
    ipAddress: '10.0.0.131',
    arch: 'x86_64',
    cpuModel: 'Intel Xeon E5-2680 v4 @ 2.40GHz',
    cpuCount: 8,
    totalMemMb: 32768,
    kernelVersion: '6.18.8',
    uptimeSeconds: 3_456_000,
    kvmAvailable: true,
    role: 'Observability',
    status: 'healthy',
  },

  // ── Cloud hosts ─────────────────────────────────────────────────────────────
  {
    id: 'cloud-hetzner-fsn1',
    hostname: 'hetzner-fsn1',
    ipAddress: '65.109.100.50',
    arch: 'x86_64',
    cpuModel: 'AMD EPYC 7282 @ 2.80GHz',
    cpuCount: 8,
    totalMemMb: 32768,
    kernelVersion: '6.18.8',
    uptimeSeconds: 604_800,
    kvmAvailable: true,
    role: 'Cloud Burst / EU Production',
    status: 'healthy',
    kind: 'cloud',
    provider: 'hetzner',
    region: 'fsn1',
  },
  {
    id: 'cloud-do-sgp1',
    hostname: 'do-sgp1',
    ipAddress: '167.172.100.20',
    arch: 'x86_64',
    cpuModel: 'AMD EPYC 7543 @ 2.80GHz',
    cpuCount: 4,
    totalMemMb: 8192,
    kernelVersion: '6.18.8',
    uptimeSeconds: 1_728_000,
    kvmAvailable: true,
    role: 'Cloud / APAC Presence',
    status: 'healthy',
    kind: 'cloud',
    provider: 'digitalocean',
    region: 'sgp1',
  },

  // ── Remote host (WireGuard-connected branch) ─────────────────────────────────
  {
    id: 'remote-branch-boston',
    hostname: 'branch-boston',
    ipAddress: '10.0.0.200',
    arch: 'x86_64',
    cpuModel: 'Intel Core i7-12700T @ 1.40GHz',
    cpuCount: 8,
    totalMemMb: 16384,
    kernelVersion: '6.18.8',
    uptimeSeconds: 2_160_000,
    kvmAvailable: true,
    role: 'Remote Branch / Boston Office',
    status: 'healthy',
    kind: 'remote',
    provider: 'wireguard',
    region: 'us-east',
  },

  // ── IoT / edge hosts ─────────────────────────────────────────────────────────
  {
    id: 'iot-factory-01',
    hostname: 'factory-floor-01',
    ipAddress: '10.200.1.10',
    arch: 'aarch64',
    cpuModel: 'ARM Cortex-A72 @ 1.50GHz',
    cpuCount: 4,
    totalMemMb: 8192,
    kernelVersion: '6.1.21',
    uptimeSeconds: 5_184_000,
    kvmAvailable: false,
    role: 'IoT Gateway / Manufacturing',
    status: 'healthy',
    kind: 'iot',
    provider: 'on-prem',
    region: 'plant-a',
  },
  {
    id: 'iot-edge-lab',
    hostname: 'edge-lab-01',
    ipAddress: '10.200.2.10',
    arch: 'aarch64',
    cpuModel: 'ARM Cortex-A55 @ 1.80GHz',
    cpuCount: 8,
    totalMemMb: 4096,
    kernelVersion: '6.1.21',
    uptimeSeconds: 864_000,
    kvmAvailable: false,
    role: 'Edge Compute / R&D Lab',
    status: 'degraded',
    kind: 'iot',
    provider: 'on-prem',
    region: 'lab-b',
  },
]

export interface DemoHostConnection {
  source: string
  target: string
  label: string
}

/** Logical inter-host connections for the Fabrick topology map. */
export const DEMO_HOST_CONNECTIONS: DemoHostConnection[] = [
  { source: 'crucible',             target: 'king',               label: 'deploy'   },
  { source: 'vault',                target: 'king',               label: 'auth'     },
  { source: 'vault',                target: 'crucible',           label: 'auth'     },
  { source: 'bastion',              target: 'king',               label: 'route'    },
  { source: 'bastion',              target: 'vault',              label: 'auth'     },
  { source: 'beacon',               target: 'king',               label: 'monitor'  },
  { source: 'beacon',               target: 'crucible',           label: 'monitor'  },
  { source: 'nexus',                target: 'crucible',           label: 'registry' },
  // Cloud
  { source: 'cloud-hetzner-fsn1',  target: 'king',               label: 'replicate' },
  { source: 'cloud-hetzner-fsn1',  target: 'vault',              label: 'auth'      },
  { source: 'cloud-do-sgp1',       target: 'cloud-hetzner-fsn1', label: 'failover'  },
  // Remote branch
  { source: 'remote-branch-boston', target: 'bastion',           label: 'vpn'       },
  { source: 'remote-branch-boston', target: 'vault',             label: 'auth'      },
  // IoT
  { source: 'iot-factory-01',       target: 'king',              label: 'telemetry' },
  { source: 'iot-factory-01',       target: 'sentinel',          label: 'audit'     },
  { source: 'iot-edge-lab',         target: 'titan',             label: 'model-sync' },
]

export interface DemoWorkloadConnection {
  fromHost:     string
  fromWorkload: string
  toHost:       string
  toWorkload:   string
  label:        string
  protocol:     string
}

/**
 * Cross-host workload service connections shown in the Loom topology.
 * Each entry renders as a dashed amber edge between two workload sub-nodes
 * on different hosts, illustrating the service mesh across the Fabrick fleet.
 */
export const DEMO_WORKLOAD_CONNECTIONS: DemoWorkloadConnection[] = [
  { fromHost: 'king',                  fromWorkload: 'web-app',          toHost: 'vault',               toWorkload: 'auth-server',    label: 'OIDC auth',      protocol: 'OIDC'      },
  { fromHost: 'king',                  fromWorkload: 'web-app',          toHost: 'vault',               toWorkload: 'secrets-vault',  label: 'secrets',        protocol: 'HTTPS'     },
  { fromHost: 'crucible',              fromWorkload: 'ci-runner-01',     toHost: 'king',                toWorkload: 'web-app',        label: 'deploy',         protocol: 'SSH'       },
  { fromHost: 'bastion',               fromWorkload: 'vpn-gateway',      toHost: 'king',                toWorkload: 'web-app',        label: 'route',          protocol: 'WireGuard' },
  { fromHost: 'vault',                 fromWorkload: 'cert-manager',     toHost: 'king',                toWorkload: 'web-nginx',      label: 'cert provision', protocol: 'ACME'      },
  // Cloud burst — cloud hosts replicate from and sync to on-prem
  { fromHost: 'king',                  fromWorkload: 'db-primary',       toHost: 'cloud-hetzner-fsn1', toWorkload: 'cloud-db-eu',    label: 'DB replica',     protocol: 'pglogical'  },
  { fromHost: 'cloud-hetzner-fsn1',    fromWorkload: 'cloud-api-eu',     toHost: 'vault',               toWorkload: 'auth-server',    label: 'OIDC auth',      protocol: 'OIDC'       },
  { fromHost: 'cloud-do-sgp1',         fromWorkload: 'cloud-api-apac',   toHost: 'cloud-hetzner-fsn1', toWorkload: 'cloud-api-eu',   label: 'failover',       protocol: 'HTTPS'      },
  // Remote branch — branch VMs authenticate through vault, sync artifacts via nexus
  { fromHost: 'remote-branch-boston',  fromWorkload: 'branch-erp',       toHost: 'vault',               toWorkload: 'auth-server',    label: 'OIDC auth',      protocol: 'OIDC'       },
  { fromHost: 'remote-branch-boston',  fromWorkload: 'branch-erp',       toHost: 'king',                toWorkload: 'db-primary',     label: 'data sync',      protocol: 'HTTPS'      },
  // IoT — factory sensors stream to on-prem ingest, edge lab pulls models from titan
  { fromHost: 'iot-factory-01',        fromWorkload: 'iot-ingest',        toHost: 'king',                toWorkload: 'svc-orders',     label: 'telemetry',      protocol: 'MQTT'       },
  { fromHost: 'iot-factory-01',        fromWorkload: 'plc-proxy',         toHost: 'sentinel',            toWorkload: 'siem-collector', label: 'audit logs',     protocol: 'syslog'     },
  { fromHost: 'iot-edge-lab',          fromWorkload: 'edge-inference',    toHost: 'titan',               toWorkload: 'hpc-worker-01',  label: 'model sync',     protocol: 'S3'         },
]

/** VMs running on the crucible (CI/build) host. */
const CRUCIBLE_VMS: WorkloadInfo[] = [
  {
    name: 'ci-runner-01',
    status: STATUSES.RUNNING,
    ip: '10.20.0.10',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    distro: 'nixos',
    bridge: 'br-ci',
    autostart: true,
    description: 'Ephemeral CI build agent (slot 1)',
    tags: ['ci', 'build'],
  },
  {
    name: 'ci-runner-02',
    status: STATUSES.RUNNING,
    ip: '10.20.0.11',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 3_600_000 * 1).toISOString(),
    distro: 'nixos',
    bridge: 'br-ci',
    autostart: true,
    description: 'Ephemeral CI build agent (slot 2)',
    tags: ['ci', 'build'],
  },
  {
    name: 'build-cache',
    status: STATUSES.RUNNING,
    ip: '10.20.0.20',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 14).toISOString(),
    distro: 'nixos',
    bridge: 'br-ci',
    autostart: true,
    description: 'Nix binary cache + build artifact store',
    tags: ['build', 'cache'],
  },
  {
    name: 'registry',
    status: STATUSES.RUNNING,
    ip: '10.20.0.30',
    mem: 1024,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-svc',
    autostart: true,
    description: 'Internal OCI container registry',
    tags: ['registry', 'build'],
  },
  {
    name: 'artifact-store',
    status: STATUSES.IDLE,
    ip: '10.20.0.31',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: null,
    distro: 'nixos',
    bridge: 'br-svc',
    description: 'Release artifact archive (on-demand)',
    tags: ['build'],
  },
]

/** VMs running on the vault (security/services) host. */
const VAULT_VMS: WorkloadInfo[] = [
  {
    name: 'auth-server',
    status: STATUSES.RUNNING,
    ip: '10.30.0.10',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-secure',
    autostart: true,
    description: 'Keycloak SSO / OIDC identity provider',
    tags: ['security', 'auth', 'critical'],
  },
  {
    name: 'secrets-vault',
    status: STATUSES.RUNNING,
    ip: '10.30.0.11',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 180).toISOString(),
    distro: 'nixos',
    bridge: 'br-secure',
    autostart: true,
    description: 'HashiCorp Vault — secrets management',
    tags: ['security', 'secrets', 'critical'],
  },
  {
    name: 'cert-manager',
    status: STATUSES.RUNNING,
    ip: '10.30.0.12',
    mem: 256,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'nixos',
    bridge: 'br-secure',
    autostart: true,
    description: 'Internal CA + cert lifecycle (step-ca)',
    tags: ['security', 'pki'],
  },
]

const BASTION_VMS: WorkloadInfo[] = [
  {
    name: 'jump-01',
    status: STATUSES.RUNNING,
    ip: '10.40.0.10',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 120).toISOString(),
    distro: 'nixos',
    bridge: 'br-access',
    autostart: true,
    description: 'SSH jump host — external access gateway',
    tags: ['access', 'security'],
  },
  {
    name: 'vpn-gateway',
    status: STATUSES.RUNNING,
    ip: '10.40.0.11',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-access',
    autostart: true,
    description: 'WireGuard VPN gateway',
    tags: ['vpn', 'access'],
  },
]

const TITAN_VMS: WorkloadInfo[] = [
  {
    name: 'hpc-worker-01',
    status: STATUSES.RUNNING,
    ip: '10.50.0.10',
    mem: 32768,
    vcpu: 8,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 3_600_000 * 6).toISOString(),
    distro: 'nixos',
    bridge: 'br-hpc',
    autostart: true,
    description: 'HPC compute node — batch job slot 1',
    tags: ['hpc', 'compute'],
  },
  {
    name: 'hpc-worker-02',
    status: STATUSES.RUNNING,
    ip: '10.50.0.11',
    mem: 32768,
    vcpu: 8,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 3_600_000 * 4).toISOString(),
    distro: 'nixos',
    bridge: 'br-hpc',
    autostart: true,
    description: 'HPC compute node — batch job slot 2',
    tags: ['hpc', 'compute'],
  },
  {
    name: 'hpc-worker-03',
    status: STATUSES.RUNNING,
    ip: '10.50.0.12',
    mem: 32768,
    vcpu: 8,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    distro: 'nixos',
    bridge: 'br-hpc',
    autostart: true,
    description: 'HPC compute node — batch job slot 3',
    tags: ['hpc', 'compute'],
  },
  {
    name: 'hpc-scheduler',
    status: STATUSES.RUNNING,
    ip: '10.50.0.20',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-hpc',
    autostart: true,
    description: 'SLURM job scheduler',
    tags: ['hpc', 'scheduler'],
  },
]

const NEXUS_VMS: WorkloadInfo[] = [
  {
    name: 'oci-registry',
    status: STATUSES.RUNNING,
    ip: '10.60.0.10',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'nixos',
    bridge: 'br-devops',
    autostart: true,
    description: 'Internal OCI container registry (Harbor)',
    tags: ['registry', 'devops'],
  },
  {
    name: 'pkg-proxy',
    status: STATUSES.RUNNING,
    ip: '10.60.0.11',
    mem: 1024,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 45).toISOString(),
    distro: 'nixos',
    bridge: 'br-devops',
    autostart: true,
    description: 'Package proxy cache (npm, pip, nix)',
    tags: ['devops', 'cache'],
  },
  {
    name: 'sonar',
    status: STATUSES.IDLE,
    ip: '10.60.0.20',
    mem: 4096,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 7).toISOString(),
    distro: 'nixos',
    bridge: 'br-devops',
    autostart: false,
    description: 'SonarQube — static code analysis',
    tags: ['devops', 'quality'],
  },
]

const SENTINEL_VMS: WorkloadInfo[] = [
  {
    name: 'siem-collector',
    status: STATUSES.RUNNING,
    ip: '10.70.0.10',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 180).toISOString(),
    distro: 'nixos',
    bridge: 'br-siem',
    autostart: true,
    description: 'Log aggregation + SIEM ingest (Wazuh)',
    tags: ['security', 'siem'],
  },
  {
    name: 'threat-analyzer',
    status: STATUSES.RUNNING,
    ip: '10.70.0.11',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-siem',
    autostart: true,
    description: 'Threat intelligence correlation engine',
    tags: ['security', 'threat-intel'],
  },
  {
    name: 'audit-logger',
    status: STATUSES.RUNNING,
    ip: '10.70.0.12',
    mem: 1024,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 365).toISOString(),
    distro: 'nixos',
    bridge: 'br-siem',
    autostart: true,
    description: 'Immutable audit log sink (compliance)',
    tags: ['security', 'compliance', 'critical'],
  },
]

const ATLAS_VMS: WorkloadInfo[] = [
  {
    name: 'lb-primary',
    status: STATUSES.RUNNING,
    ip: '10.80.0.10',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 200).toISOString(),
    distro: 'nixos',
    bridge: 'br-edge',
    autostart: true,
    description: 'HAProxy — primary load balancer',
    tags: ['edge', 'lb', 'critical'],
  },
  {
    name: 'lb-standby',
    status: STATUSES.RUNNING,
    ip: '10.80.0.11',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 200).toISOString(),
    distro: 'nixos',
    bridge: 'br-edge',
    autostart: true,
    description: 'HAProxy — standby (VRRP failover)',
    tags: ['edge', 'lb'],
  },
  {
    name: 'edge-cache',
    status: STATUSES.RUNNING,
    ip: '10.80.0.20',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'nixos',
    bridge: 'br-edge',
    autostart: true,
    description: 'Nginx reverse proxy + static asset cache',
    tags: ['edge', 'cache'],
  },
]

const MATRIX_VMS: WorkloadInfo[] = [
  {
    name: 'dev-env-01',
    status: STATUSES.RUNNING,
    ip: '10.90.0.10',
    mem: 8192,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 3_600_000 * 8).toISOString(),
    distro: 'nixos',
    bridge: 'br-dev',
    autostart: false,
    description: 'Developer sandbox — team alpha',
    tags: ['dev', 'sandbox'],
  },
  {
    name: 'dev-env-02',
    status: STATUSES.IDLE,
    ip: '10.90.0.11',
    mem: 8192,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    distro: 'nixos',
    bridge: 'br-dev',
    autostart: false,
    description: 'Developer sandbox — team beta',
    tags: ['dev', 'sandbox'],
  },
  {
    name: 'test-runner',
    status: STATUSES.RUNNING,
    ip: '10.90.0.20',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 3_600_000 * 1).toISOString(),
    distro: 'nixos',
    bridge: 'br-test',
    autostart: true,
    description: 'Integration test runner (ephemeral)',
    tags: ['test', 'ci'],
  },
  {
    name: 'staging',
    status: STATUSES.RUNNING,
    ip: '10.90.0.30',
    mem: 8192,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    distro: 'nixos',
    bridge: 'br-staging',
    autostart: true,
    description: 'Pre-production staging environment',
    tags: ['staging', 'test'],
  },
]

const BEACON_VMS: WorkloadInfo[] = [
  {
    name: 'prometheus',
    status: STATUSES.RUNNING,
    ip: '10.100.0.10',
    mem: 4096,
    vcpu: 2,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-obs',
    autostart: true,
    description: 'Prometheus metrics store + alerting',
    tags: ['observability', 'metrics'],
  },
  {
    name: 'grafana',
    status: STATUSES.RUNNING,
    ip: '10.100.0.11',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-obs',
    autostart: true,
    description: 'Grafana dashboards + on-call routing',
    tags: ['observability', 'dashboards'],
  },
  {
    name: 'loki',
    status: STATUSES.RUNNING,
    ip: '10.100.0.12',
    mem: 4096,
    vcpu: 2,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'nixos',
    bridge: 'br-obs',
    autostart: true,
    description: 'Loki log aggregation',
    tags: ['observability', 'logs'],
  },
  {
    name: 'alertmanager',
    status: STATUSES.IDLE,
    ip: '10.100.0.13',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-obs',
    autostart: true,
    description: 'Alertmanager — silence + route rules',
    tags: ['observability', 'alerting'],
  },
]

// ── Cloud host VMs ──────────────────────────────────────────────────────────

const CLOUD_HETZNER_VMS: WorkloadInfo[] = [
  {
    name: 'cloud-web-eu',
    status: STATUSES.RUNNING,
    ip: '10.0.1.10',
    mem: 512,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 14).toISOString(),
    distro: 'nixos',
    bridge: 'br-cloud',
    autostart: true,
    description: 'EU edge — Caddy reverse proxy + TLS',
    tags: ['cloud', 'production', 'eu'],
  },
  {
    name: 'cloud-api-eu',
    status: STATUSES.RUNNING,
    ip: '10.0.1.11',
    mem: 2048,
    vcpu: 4,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 14).toISOString(),
    distro: 'nixos',
    bridge: 'br-cloud',
    autostart: true,
    description: 'EU API replica — latency-optimized for EMEA',
    tags: ['cloud', 'production', 'eu'],
  },
  {
    name: 'cloud-db-eu',
    status: STATUSES.RUNNING,
    ip: '10.0.1.20',
    mem: 8192,
    vcpu: 4,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 14).toISOString(),
    distro: 'rocky-9',
    bridge: 'br-cloud',
    autostart: true,
    description: 'PostgreSQL logical replica (read-only, EU)',
    tags: ['cloud', 'database', 'eu'],
  },
]

const CLOUD_DO_VMS: WorkloadInfo[] = [
  {
    name: 'cloud-cdn-apac',
    status: STATUSES.RUNNING,
    ip: '10.0.2.10',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-cloud',
    autostart: true,
    description: 'APAC static asset cache (Nginx)',
    tags: ['cloud', 'production', 'apac'],
  },
  {
    name: 'cloud-api-apac',
    status: STATUSES.RUNNING,
    ip: '10.0.2.11',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'cloud-hypervisor',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-cloud',
    autostart: true,
    description: 'APAC API read replica — Singapore POP',
    tags: ['cloud', 'production', 'apac'],
  },
]

// ── Remote branch VMs ────────────────────────────────────────────────────────

const REMOTE_BRANCH_VMS: WorkloadInfo[] = [
  {
    name: 'branch-erp',
    status: STATUSES.RUNNING,
    ip: '192.168.50.10',
    mem: 4096,
    vcpu: 4,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 60).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-office',
    autostart: true,
    description: 'Branch ERP instance (Odoo)',
    tags: ['branch', 'erp'],
  },
  {
    name: 'branch-share',
    status: STATUSES.RUNNING,
    ip: '192.168.50.11',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 90).toISOString(),
    distro: 'nixos',
    bridge: 'br-office',
    autostart: true,
    description: 'File share + print server (Samba)',
    tags: ['branch', 'storage'],
  },
  {
    name: 'branch-vpn-term',
    status: STATUSES.RUNNING,
    ip: '192.168.50.20',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: new Date(Date.now() - 86_400_000 * 120).toISOString(),
    distro: 'nixos',
    bridge: 'br-office',
    autostart: true,
    description: 'WireGuard tunnel terminator',
    tags: ['branch', 'vpn', 'access'],
  },
]

// ── IoT / edge VMs ───────────────────────────────────────────────────────────

const IOT_FACTORY_VMS: WorkloadInfo[] = [
  {
    name: 'iot-ingest',
    status: STATUSES.RUNNING,
    ip: '10.200.1.20',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 45).toISOString(),
    distro: 'nixos',
    bridge: 'br-iot',
    autostart: true,
    description: 'MQTT broker + time-series ingest (InfluxDB)',
    tags: ['iot', 'ingest'],
  },
  {
    name: 'plc-proxy',
    status: STATUSES.RUNNING,
    ip: '10.200.1.21',
    mem: 512,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'nixos',
    bridge: 'br-iot',
    autostart: true,
    description: 'OPC-UA / Modbus protocol proxy',
    tags: ['iot', 'plc', 'opc-ua'],
  },
  {
    name: 'iot-edge-rules',
    status: STATUSES.IDLE,
    ip: '10.200.1.22',
    mem: 512,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: null,
    distro: 'nixos',
    bridge: 'br-iot',
    description: 'Edge rule engine — local alerting',
    tags: ['iot', 'rules'],
  },
]

const IOT_EDGE_LAB_VMS: WorkloadInfo[] = [
  {
    name: 'edge-inference',
    status: STATUSES.RUNNING,
    ip: '10.200.2.20',
    mem: 2048,
    vcpu: 4,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 3_600_000 * 12).toISOString(),
    distro: 'nixos',
    bridge: 'br-lab',
    autostart: true,
    description: 'On-device ML inference (ONNX runtime)',
    tags: ['iot', 'ml', 'inference'],
  },
  {
    name: 'edge-data-buffer',
    status: STATUSES.RUNNING,
    ip: '10.200.2.21',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 10).toISOString(),
    distro: 'nixos',
    bridge: 'br-lab',
    autostart: true,
    description: 'Offline-first telemetry buffer (sync on reconnect)',
    tags: ['iot', 'buffer'],
  },
]

/** Get the VM list for a specific host in the Fabrick demo. */
export function getDemoVmsForHost(hostId: string, tier: string): WorkloadInfo[] {
  if (hostId === 'crucible')              return CRUCIBLE_VMS
  if (hostId === 'vault')                 return VAULT_VMS
  if (hostId === 'bastion')               return BASTION_VMS
  if (hostId === 'titan')                 return TITAN_VMS
  if (hostId === 'nexus')                 return NEXUS_VMS
  if (hostId === 'sentinel')              return SENTINEL_VMS
  if (hostId === 'atlas')                 return ATLAS_VMS
  if (hostId === 'matrix')                return MATRIX_VMS
  if (hostId === 'beacon')                return BEACON_VMS
  if (hostId === 'cloud-hetzner-fsn1')   return CLOUD_HETZNER_VMS
  if (hostId === 'cloud-do-sgp1')        return CLOUD_DO_VMS
  if (hostId === 'remote-branch-boston') return REMOTE_BRANCH_VMS
  if (hostId === 'iot-factory-01')       return IOT_FACTORY_VMS
  if (hostId === 'iot-edge-lab')         return IOT_EDGE_LAB_VMS
  return getDemoVmsForTier(tier)
}

/** VM count per host for fleet summary cards. */
export function getDemoHostVmCount(hostId: string, tier: string): number {
  return getDemoVmsForHost(hostId, tier).length
}

// ---------------------------------------------------------------------------
// Fabrick host resource utilization — shared across demo components.
// FabrickOverviewPage reads these for the host cards; app store uses them
// to build liveMetrics when the selected host changes (HostInfoStrip).
// ---------------------------------------------------------------------------

export interface DemoHostResources {
  cpu: number    // % CPU utilization
  mem: number    // % memory utilization
  disk: number   // % disk utilization
  net: number    // % network bandwidth
  diskGb: number // total disk size in GB
}

export const DEMO_HOST_RESOURCES: Record<string, DemoHostResources> = {
  king:                   { cpu: 42, mem: 58, disk: 65, net: 45, diskGb: 915  },
  crucible:               { cpu: 71, mem: 44, disk: 82, net: 20, diskGb: 2000 },
  vault:                  { cpu: 18, mem: 62, disk: 30, net: 10, diskGb: 500  },
  bastion:                { cpu: 8,  mem: 22, disk: 15, net:  5, diskGb: 250  },
  titan:                  { cpu: 88, mem: 76, disk: 45, net: 30, diskGb: 8000 },
  nexus:                  { cpu: 35, mem: 55, disk: 70, net: 25, diskGb: 4000 },
  sentinel:               { cpu: 42, mem: 38, disk: 55, net: 15, diskGb: 1000 },
  atlas:                  { cpu: 22, mem: 30, disk: 20, net: 85, diskGb: 500  },
  matrix:                 { cpu: 65, mem: 70, disk: 55, net: 40, diskGb: 2000 },
  beacon:                 { cpu: 45, mem: 65, disk: 40, net: 35, diskGb: 1000 },
  // Cloud hosts
  'cloud-hetzner-fsn1':  { cpu: 38, mem: 52, disk: 40, net: 60, diskGb: 640  },
  'cloud-do-sgp1':       { cpu: 25, mem: 45, disk: 30, net: 55, diskGb: 160  },
  // Remote
  'remote-branch-boston':{ cpu: 30, mem: 48, disk: 55, net: 20, diskGb: 500  },
  // IoT / edge
  'iot-factory-01':      { cpu: 52, mem: 60, disk: 35, net: 18, diskGb: 128  },
  'iot-edge-lab':        { cpu: 78, mem: 82, disk: 70, net: 22, diskGb: 64   },
}

/** Build a HostBasicInfo (with liveMetrics) for a given demo host ID. */
export function getDemoHostBasicInfo(hostId: string): HostBasicInfo {
  const h = DEMO_HOSTS.find(d => d.id === hostId) ?? DEMO_HOSTS[0]!
  const r = DEMO_HOST_RESOURCES[hostId] ?? { cpu: 30, mem: 50, disk: 30, net: 20, diskGb: 500 }
  const freeMemMb = Math.round(h.totalMemMb * (1 - r.mem / 100))
  const diskUsedGb = Math.round(r.diskGb * r.disk / 100)
  const loadAvg1 = Math.round((r.cpu / 100) * h.cpuCount * 10) / 10
  return {
    hostname: h.hostname,
    ipAddress: h.ipAddress,
    arch: h.arch,
    cpuModel: h.cpuModel,
    cpuCount: h.cpuCount,
    totalMemMb: h.totalMemMb,
    kernelVersion: h.kernelVersion,
    uptimeSeconds: h.uptimeSeconds,
    kvmAvailable: h.kvmAvailable,
    liveMetrics: {
      cpuUsagePercent: r.cpu,
      freeMemMb,
      rootDiskUsedGb: diskUsedGb,
      rootDiskTotalGb: r.diskGb,
      rootDiskUsedPercent: r.disk,
      netRxBytesPerSec: Math.round(r.net * 12_500_000),
      netTxBytesPerSec: Math.round(r.net * 3_100_000),
      loadAvg1,
      loadAvg5: Math.round(loadAvg1 * 0.85 * 10) / 10,
      loadAvg15: Math.round(loadAvg1 * 0.72 * 10) / 10,
    },
  }
}

/** Get demo resource metrics for a VM. Free tier returns 1h, weaver/fabrick returns 24h. */
export function getDemoMetricsForVm(vmName: string, tier: string): VmMetrics {
  const is24h = tier === TIERS.WEAVER || tier === TIERS.FABRICK
  const count = is24h ? 288 : 60         // 24h @ 5-min  OR  1h @ 1-min
  const intervalMs = is24h ? 300_000 : 60_000
  const resolution = is24h ? '5m' : '1m'
  const profile = _profileForVm(vmName)
  return {
    vmName,
    resolution,
    points: _buildPoints(count, intervalMs, profile),
  }
}

// ── Host Config demo data ──────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Demo host config — matches actual demo workloads per tier.
// MicroVM sections generated from FREE_VMS / PREMIUM_VMS.
// OCI containers version-gated to v1.1+.
// Slurm section Fabrick-only (filtered in HostConfigViewer).
// ---------------------------------------------------------------------------

/** Generate MicroVM NixOS config section from a WorkloadInfo */
function vmToNixSection(vm: WorkloadInfo, lineStart: number): NixConfigSection {
  const lineEnd = lineStart + 7
  return {
    id: `microvm-${vm.name}`,
    label: `${vm.name} (MicroVM)`,
    type: 'microvm',
    lineStart,
    lineEnd,
    rawNix: `  microvm.vms.${vm.name} = {
    config = {
      microvm.hypervisor = "${vm.hypervisor}";
      microvm.mem = ${vm.mem};
      microvm.vcpu = ${vm.vcpu};
      networking.interfaces.eth0.ipv4.addresses = [
        { address = "${vm.ip}"; prefixLength = 24; }
      ];
    };
  };`,
  }
}

/** Generate OCI container NixOS config section from a ContainerInfo */
function containerToNixSection(c: ContainerInfo, lineStart: number): NixConfigSection {
  const ports = c.ports?.map(p => `"${p.hostPort}:${p.containerPort}"`).join(' ') ?? ''
  const mounts = c.mounts?.map(m => `"${m.source}:${m.destination}${m.readonly ? ':ro' : ''}"`).join(' ') ?? ''
  const lines = [`  virtualisation.oci-containers.containers.${c.name} = {`, `    image = "${c.image}";`]
  if (ports) lines.push(`    ports = [ ${ports} ];`)
  if (mounts) lines.push(`    volumes = [ ${mounts} ];`)
  lines.push('  };')
  const lineEnd = lineStart + lines.length - 1
  return {
    id: `oci-${c.name}`,
    label: `${c.name} (OCI Container)`,
    type: 'oci-container',
    lineStart,
    lineEnd,
    rawNix: lines.join('\n'),
  }
}

const INFRA_SECTION: NixConfigSection = {
  id: 'infrastructure',
  label: 'Infrastructure',
  type: 'infrastructure',
  lineStart: 0, // recalculated
  lineEnd: 0,
  rawNix: `  networking.bridges.br-microvm.interfaces = [];
  networking.interfaces.br-microvm.ipv4.addresses = [
    { address = "10.10.0.1"; prefixLength = 24; }
  ];
  boot.kernelModules = [ "kvm-intel" "vhost_vsock" ];
  networking.nftables.enable = true;
  networking.nat.enable = true;
  networking.nat.internalInterfaces = [ "br-microvm" ];`,
}

const SLURM_SECTION: NixConfigSection = {
  id: 'slurm-slurm',
  label: 'Slurm Node Config',
  type: 'slurm',
  lineStart: 0, // recalculated
  lineEnd: 0,
  rawNix: `  services.slurm.enableSlurmctld = false;
  services.slurm.enableSlurmd = true;
  services.slurm.nodeName = "worker01 CPUs=8 Sockets=1 CoresPerSocket=4 ThreadsPerCore=2 RealMemory=32768 State=UNKNOWN";`,
}

/**
 * Build demo host config that matches the actual workloads for the current
 * tier and version. Sections are generated from FREE_VMS/PREMIUM_VMS and
 * FREE_CONTAINERS, version-gated (containers at v1.1+, Slurm at Fabrick).
 */
export function getDemoHostConfig(tier: string, version: string): NixConfigResponse {
  const vms = getDemoVmsForTier(tier)
  const ver = parseFloat(version)

  const sections: NixConfigSection[] = []
  let line = 4 // after the `{ config, pkgs, lib, ... }: {` header

  // MicroVM sections — always present
  for (const vm of vms) {
    const section = vmToNixSection(vm, line)
    sections.push(section)
    line = section.lineEnd + 2
  }

  // OCI container sections — v1.1+ only
  if (ver >= 1.1) {
    const containers = getDemoContainersForTier(tier)
    for (const c of containers) {
      const section = containerToNixSection(c, line)
      sections.push(section)
      line = section.lineEnd + 2
    }
  }

  // Slurm — Fabrick only (also filtered in HostConfigViewer)
  if (tier === TIERS.FABRICK) {
    const slurm = { ...SLURM_SECTION, lineStart: line, lineEnd: line + 2 }
    sections.push(slurm)
    line = slurm.lineEnd + 2
  }

  // Infrastructure — always present
  const infraLines = INFRA_SECTION.rawNix.split('\n').length
  const infra = { ...INFRA_SECTION, lineStart: line, lineEnd: line + infraLines - 1 }
  sections.push(infra)

  // Build raw content from all sections
  const rawParts = ['{ config, pkgs, lib, ... }: {', '']
  if (sections.some(s => s.type === 'microvm')) {
    rawParts.push('  # ── MicroVM workload definitions ──────────────────────────────────────────')
    for (const s of sections.filter(s => s.type === 'microvm')) rawParts.push(s.rawNix, '')
  }
  if (sections.some(s => s.type === 'oci-container')) {
    rawParts.push('  # ── OCI container definitions ──────────────────────────────────────────────')
    for (const s of sections.filter(s => s.type === 'oci-container')) rawParts.push(s.rawNix, '')
  }
  if (sections.some(s => s.type === 'slurm')) {
    rawParts.push('  # ── Slurm node configuration ──────────────────────────────────────────────')
    for (const s of sections.filter(s => s.type === 'slurm')) rawParts.push(s.rawNix, '')
  }
  rawParts.push('  # ── Infrastructure ────────────────────────────────────────────────────────')
  rawParts.push(infra.rawNix, '}')

  return {
    available: true,
    rawContent: rawParts.join('\n'),
    sections,
    configPath: '/etc/nixos/configuration.nix',
    readAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Access Inspector mock data (v3.3+, Decision #88/#89)
// ---------------------------------------------------------------------------

export interface DemoInspectorUser {
  id: string
  name: string
  role: UserRole | 'auditor'
  groups: string[]
}

export interface DemoInspectorGroup {
  id: string
  name: string
  frameworks: string[]
  aiPolicy: 'allow-all' | 'claude-only' | 'local-only' | 'none'
  memberCount: number
  workloadCount: number
}

export const DEMO_INSPECTOR_USERS: DemoInspectorUser[] = [
  { id: 'alice',   name: 'Alice Chen',    role: ROLES.OPERATOR, groups: ['ephi-workloads', 'ops-group'] },
  { id: 'bob',     name: 'Bob Martinez',  role: ROLES.VIEWER,   groups: ['dev-group'] },
  { id: 'charlie', name: 'Charlie Kim',   role: 'auditor',      groups: ['ephi-workloads', 'pci-group'] },
  { id: 'dana',    name: 'Dana Patel',    role: ROLES.OPERATOR, groups: ['ops-group', 'itar-group'] },
]

export const DEMO_INSPECTOR_GROUPS: DemoInspectorGroup[] = [
  { id: 'ephi-workloads', name: 'ePHI Workloads',   frameworks: ['hipaa'],          aiPolicy: 'claude-only', memberCount: 3, workloadCount: 4  },
  { id: 'ops-group',      name: 'Operations',        frameworks: ['pci-cde'],        aiPolicy: 'claude-only', memberCount: 5, workloadCount: 7  },
  { id: 'itar-group',     name: 'ITAR Restricted',   frameworks: ['itar', 'cmmc'],   aiPolicy: 'local-only',  memberCount: 2, workloadCount: 3  },
  { id: 'dev-group',      name: 'Development',       frameworks: [],                 aiPolicy: 'allow-all',   memberCount: 8, workloadCount: 12 },
]

// ---------------------------------------------------------------------------
// Fleet Virtual Bridges (v3.0+ Fabrick only — Decisions #114, #115)
//
// Fleet bridges are the convergence primitive that replaces:
//   K8s CNI plugin      → overlay-backed L2 adjacency across hosts
//   Ingress + MetalLB   → weight-based endpoint routing across the fleet
//   Argo Rollouts       → fleet blue/green via weight shifting
//   Service mesh        → endpoint auto-registration via workload selectors
//
// AI operates these: adjusts weights, triggers blue/green, cordons hosts,
// scales endpoints — all through the same bridge weight API.
//
// Each fleet bridge maps 1:1 to a workload group (Decision #88 + #114):
//   creating a group creates its bridge; the compliance boundary IS the
//   network isolation boundary.
// ---------------------------------------------------------------------------

/** Overlay transport backing a fleet bridge. */
export type FleetOverlayTransport = 'vxlan' | 'wireguard'

/** Balance mode for fleet bridge routing. */
export type FleetBalanceMode = 'latency' | 'throughput' | 'round-robin' | 'manual'

/** Health of a fleet bridge or endpoint. */
export type FleetHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'draining'

/** Blue/green deployment phase. */
export type BlueGreenPhase = 'cloning' | 'shifting' | 'health-check' | 'confirming' | 'confirmed' | 'rolled-back'

/** A single endpoint on a fleet bridge — a workload on a specific host. */
export interface DemoFleetEndpoint {
  /** Endpoint identifier in hub API format: host:workload (Decision #114) */
  id: string
  /** Host this endpoint lives on */
  hostId: string
  /** Workload name on that host */
  workloadName: string
  /** Traffic weight (0–100). 0 = cordoned/draining. AI adjusts these. */
  weight: number
  /** Local Linux bridge on this host (the physical port of the virtual bridge) */
  localBridge: string
  /** Endpoint health — hub monitors via health checks */
  health: FleetHealthStatus
  /** True if auto-registered via workload selector match (LP created it) */
  autoRegistered: boolean
  /** GPU vendor if this is an inference endpoint, null otherwise */
  gpuVendor?: 'nvidia' | 'amd' | 'intel' | null
}

/** Blue/green deployment state on a fleet bridge. */
export interface DemoBlueGreenState {
  /** Current phase of the deployment */
  phase: BlueGreenPhase
  /** The existing (blue) endpoint being replaced */
  blueEndpointId: string
  /** The new (green) endpoint being validated */
  greenEndpointId: string
  /** Current traffic weight on blue (AI shifts this down) */
  blueWeight: number
  /** Current traffic weight on green (AI shifts this up) */
  greenWeight: number
  /** When the deployment started */
  startedAt: string
  /** AI agent that initiated the deployment (null if manual) */
  initiatedBy: string | null
}

/** Cold start / routing policy for a fleet bridge (Decision #115). */
export interface DemoFleetBridgePolicy {
  /** How new endpoints get initial weight */
  defaultWeightRule: 'equal' | 'capacity-weighted' | 'manual'
  /** Balance mode for traffic distribution */
  balanceMode: FleetBalanceMode
  /** Health check interval in seconds */
  healthCheckIntervalSec: number
  /** Drain timeout before force-removing unhealthy endpoint */
  drainTimeoutSec: number
  /** Threshold: mark bridge degraded when this % of endpoints are unhealthy */
  degradedThresholdPercent: number
}

/** Workload selector that determines which workloads auto-register on this bridge. */
export interface DemoWorkloadSelector {
  /** Match workloads by template ID (null = any) */
  templateId: string | null
  /** Match workloads by tags (empty = any) */
  tags: string[]
  /** Match by GPU vendor (null = any, including CPU-only) */
  gpuVendor: 'nvidia' | 'amd' | 'intel' | null
}

/** Hub authority and DR state for fleet bridge routing (Decision #115). */
export interface DemoHubState {
  /** Which host runs the Fabrick hub */
  hubHostId: string
  /** Last time hub synced weights to all hosts */
  lastSyncAt: string
  /** Hub sync status */
  syncStatus: 'synced' | 'stale' | 'partitioned'
  /** Per-host last-known-weights DR state */
  hostDrState: Array<{
    hostId: string
    /** ISO timestamp of last weight push from hub to this host */
    lastWeightPushAt: string
    /** Status of this host's DR store */
    status: 'current' | 'stale' | 'disconnected'
  }>
}

/** A fleet virtual bridge — the convergence primitive (Decision #114). */
export interface DemoFleetBridge {
  /** Bridge name — prefixed fb- to distinguish from local bridges */
  name: string
  /** Display label */
  label: string
  /** 1:1 workload group ID (Decision #88 + #114) */
  workloadGroupId: string
  /** Overlay transport (VXLAN for datacenter, WireGuard for edge/remote) */
  overlay: FleetOverlayTransport
  /** VXLAN VNI or WireGuard subnet — the overlay segment identifier */
  overlaySegment: string
  /** Logical subnet spanning all hosts on this bridge */
  subnet: string
  /** Workload selector — determines which workloads auto-register */
  selector: DemoWorkloadSelector
  /** Routing / cold-start policy */
  policy: DemoFleetBridgePolicy
  /** All endpoints currently registered on this bridge */
  endpoints: DemoFleetEndpoint[]
  /** Bridge-level health — derived from endpoint health */
  health: FleetHealthStatus
  /** Active blue/green deployment (null if none in progress) */
  blueGreen: DemoBlueGreenState | null
  /** What K8s component this replaces — shown in demo to tell the story */
  replaces: string
}

// ── Fleet bridge mock data ──────────────────────────────────────────────────

/**
 * fb-production — global production bridge spanning on-prem + cloud.
 * Replaces: K8s ingress controller + MetalLB + CNI.
 * Active blue/green: AI is shifting traffic from v2.1 to v2.2 API.
 */
const FB_PRODUCTION: DemoFleetBridge = {
  name: 'fb-production',
  label: 'Production',
  workloadGroupId: 'prod',
  overlay: 'vxlan',
  overlaySegment: 'VNI 1001',
  subnet: '10.100.1.0/24',
  selector: { templateId: 'web-app-prod', tags: ['production'], gpuVendor: null },
  policy: {
    defaultWeightRule: 'capacity-weighted',
    balanceMode: 'latency',
    healthCheckIntervalSec: 5,
    drainTimeoutSec: 30,
    degradedThresholdPercent: 30,
  },
  endpoints: [
    { id: 'king:web-app',             hostId: 'king',              workloadName: 'web-app',        weight: 40, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'king:svc-orders',          hostId: 'king',              workloadName: 'svc-orders',     weight: 40, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'cloud-hetzner-fsn1:cloud-api-eu',   hostId: 'cloud-hetzner-fsn1', workloadName: 'cloud-api-eu',   weight: 35, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'cloud-do-sgp1:cloud-api-apac',      hostId: 'cloud-do-sgp1',      workloadName: 'cloud-api-apac', weight: 15, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    // Blue/green: v2.2 green endpoint on hetzner, being validated by AI
    { id: 'cloud-hetzner-fsn1:cloud-api-eu-v22', hostId: 'cloud-hetzner-fsn1', workloadName: 'cloud-api-eu-v22', weight: 10, localBridge: 'br-app', health: 'healthy', autoRegistered: true, gpuVendor: null },
  ],
  health: 'healthy',
  blueGreen: {
    phase: 'shifting',
    blueEndpointId: 'cloud-hetzner-fsn1:cloud-api-eu',
    greenEndpointId: 'cloud-hetzner-fsn1:cloud-api-eu-v22',
    blueWeight: 35,
    greenWeight: 10,
    startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    initiatedBy: 'AI Agent — latency regression detected on v2.1, deploying v2.2 canary',
  },
  replaces: 'K8s Ingress Controller + MetalLB + Argo Rollouts',
}

/**
 * fb-cicd — build pipeline bridge spanning CI hosts.
 * Replaces: K8s CNI + Jenkins agent networking.
 * AI auto-scales CI runner endpoints based on queue depth.
 */
const FB_CICD: DemoFleetBridge = {
  name: 'fb-cicd',
  label: 'CI/CD',
  workloadGroupId: 'cicd',
  overlay: 'vxlan',
  overlaySegment: 'VNI 1002',
  subnet: '10.100.2.0/24',
  selector: { templateId: 'ci-runner', tags: ['ci', 'build'], gpuVendor: null },
  policy: {
    defaultWeightRule: 'equal',
    balanceMode: 'round-robin',
    healthCheckIntervalSec: 10,
    drainTimeoutSec: 60,
    degradedThresholdPercent: 50,
  },
  endpoints: [
    { id: 'crucible:ci-runner-01',   hostId: 'crucible', workloadName: 'ci-runner-01',   weight: 34, localBridge: 'br-ci',  health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'crucible:ci-runner-02',   hostId: 'crucible', workloadName: 'ci-runner-02',   weight: 33, localBridge: 'br-ci',  health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'nexus:registry-cache',    hostId: 'nexus',    workloadName: 'registry-cache', weight: 33, localBridge: 'br-svc', health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'matrix:ci-runner-03',     hostId: 'matrix',   workloadName: 'ci-runner-03',   weight: 0,  localBridge: 'br-dev', health: 'draining', autoRegistered: true,  gpuVendor: null },
  ],
  health: 'healthy',
  blueGreen: null,
  replaces: 'K8s CNI + Jenkins Agent Networking',
}

/**
 * fb-data — isolated data tier. HIPAA + PCI-DSS compliance boundary.
 * Replaces: K8s NetworkPolicy + dedicated data plane CNI.
 * Cross-bridge traffic is impossible — overlay segments enforce isolation.
 * AI policy: local-only (no external AI touches this data).
 */
const FB_DATA: DemoFleetBridge = {
  name: 'fb-data',
  label: 'Data Platform',
  workloadGroupId: 'data',
  overlay: 'vxlan',
  overlaySegment: 'VNI 1003',
  subnet: '10.100.3.0/24',
  selector: { templateId: null, tags: ['database', 'cache'], gpuVendor: null },
  policy: {
    defaultWeightRule: 'manual',
    balanceMode: 'manual',
    healthCheckIntervalSec: 3,
    drainTimeoutSec: 120,
    degradedThresholdPercent: 10,
  },
  endpoints: [
    { id: 'king:db-primary',         hostId: 'king',              workloadName: 'db-primary',     weight: 80, localBridge: 'br-data', health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'vault:db-replica',        hostId: 'vault',             workloadName: 'db-replica',     weight: 20, localBridge: 'br-data', health: 'healthy',  autoRegistered: true,  gpuVendor: null },
    { id: 'cloud-hetzner-fsn1:cloud-db-eu', hostId: 'cloud-hetzner-fsn1', workloadName: 'cloud-db-eu', weight: 0, localBridge: 'br-data', health: 'healthy', autoRegistered: true, gpuVendor: null },
  ],
  health: 'healthy',
  blueGreen: null,
  replaces: 'K8s NetworkPolicy + Dedicated Data Plane',
}

/**
 * fb-edge — edge/IoT fleet over WireGuard (not VXLAN — no datacenter fabric).
 * Replaces: K8s KubeEdge + custom VPN tunneling.
 * One host cordoned (iot-factory-01) — AI detected thermal throttling,
 * set weight to 0, traffic drained to other edge nodes.
 * GPU inference endpoints: AI routes to least-loaded GPU across edge fleet.
 */
const FB_EDGE: DemoFleetBridge = {
  name: 'fb-edge',
  label: 'Edge Fleet',
  workloadGroupId: 'edge',
  overlay: 'wireguard',
  overlaySegment: 'wg-edge0',
  subnet: '10.100.4.0/24',
  selector: { templateId: 'edge-inference', tags: ['edge', 'iot'], gpuVendor: null },
  policy: {
    defaultWeightRule: 'capacity-weighted',
    balanceMode: 'latency',
    healthCheckIntervalSec: 15,
    drainTimeoutSec: 30,
    degradedThresholdPercent: 40,
  },
  endpoints: [
    { id: 'iot-factory-01:iot-ingest',     hostId: 'iot-factory-01',       workloadName: 'iot-ingest',     weight: 0,  localBridge: 'br-iot', health: 'draining',  autoRegistered: true, gpuVendor: null },
    { id: 'iot-factory-01:plc-proxy',      hostId: 'iot-factory-01',       workloadName: 'plc-proxy',      weight: 0,  localBridge: 'br-iot', health: 'draining',  autoRegistered: true, gpuVendor: null },
    { id: 'iot-edge-lab:edge-inference',   hostId: 'iot-edge-lab',         workloadName: 'edge-inference', weight: 60, localBridge: 'br-iot', health: 'healthy',   autoRegistered: true, gpuVendor: 'nvidia' },
    { id: 'remote-branch-boston:branch-erp', hostId: 'remote-branch-boston', workloadName: 'branch-erp',   weight: 40, localBridge: 'br-office', health: 'healthy', autoRegistered: true, gpuVendor: null },
  ],
  health: 'degraded',
  blueGreen: null,
  replaces: 'K8s KubeEdge + Custom VPN Tunneling',
}

/** All fleet bridges — the complete Fabrick v3.0 fleet network layer. */
export const DEMO_FLEET_BRIDGES: DemoFleetBridge[] = [
  FB_PRODUCTION,
  FB_CICD,
  FB_DATA,
  FB_EDGE,
]

/**
 * Hub authority state (Decision #115).
 * king is the hub — single source of truth for fleet bridge weights.
 * Hosts persist last-known weights for disaster recovery.
 */
export const DEMO_HUB_STATE: DemoHubState = {
  hubHostId: 'king',
  lastSyncAt: new Date(Date.now() - 8_000).toISOString(),
  syncStatus: 'synced',
  hostDrState: [
    { hostId: 'king',               lastWeightPushAt: new Date(Date.now() - 8_000).toISOString(),      status: 'current' },
    { hostId: 'crucible',           lastWeightPushAt: new Date(Date.now() - 8_000).toISOString(),      status: 'current' },
    { hostId: 'vault',              lastWeightPushAt: new Date(Date.now() - 8_000).toISOString(),      status: 'current' },
    { hostId: 'cloud-hetzner-fsn1', lastWeightPushAt: new Date(Date.now() - 12_000).toISOString(),     status: 'current' },
    { hostId: 'cloud-do-sgp1',      lastWeightPushAt: new Date(Date.now() - 15_000).toISOString(),     status: 'current' },
    { hostId: 'nexus',              lastWeightPushAt: new Date(Date.now() - 8_000).toISOString(),      status: 'current' },
    { hostId: 'matrix',             lastWeightPushAt: new Date(Date.now() - 8_000).toISOString(),      status: 'current' },
    { hostId: 'iot-factory-01',     lastWeightPushAt: new Date(Date.now() - 720_000).toISOString(),    status: 'stale' },
    { hostId: 'iot-edge-lab',       lastWeightPushAt: new Date(Date.now() - 20_000).toISOString(),     status: 'current' },
    { hostId: 'remote-branch-boston', lastWeightPushAt: new Date(Date.now() - 45_000).toISOString(),   status: 'current' },
  ],
}

/** Get fleet bridges (caller must gate on isDemoVersionAtLeast('3.0') && isFabrick). */
export function getDemoFleetBridges(): DemoFleetBridge[] {
  return DEMO_FLEET_BRIDGES
}

// ══════════════════════════════════════════════════════════════════════════
// v2.1 — Host Maintenance Manager mock data
// ══════════════════════════════════════════════════════════════════════════

export const DEMO_NIXOS_GENERATIONS = [
  { id: 42, date: '2026-03-30 14:15', size: '2.1 GB', kernel: '6.12.8', current: true },
  { id: 41, date: '2026-03-25 09:00', size: '2.0 GB', kernel: '6.12.6', current: false },
  { id: 40, date: '2026-03-18 16:30', size: '1.9 GB', kernel: '6.12.6', current: false },
]

// ══════════════════════════════════════════════════════════════════════════
// v2.5 — Storage & Template Fabrick mock data
// ══════════════════════════════════════════════════════════════════════════

export interface DemoStoragePool {
  name: string
  type: string
  totalGb: number
  usedGb: number
  snapshotOverheadGb: number
}

export const DEMO_STORAGE_POOLS: DemoStoragePool[] = [
  { name: 'pool-fast', type: 'NVMe SSD', totalGb: 2000, usedGb: 1240, snapshotOverheadGb: 180 },
  { name: 'pool-bulk', type: 'HDD RAID-6', totalGb: 8000, usedGb: 3200, snapshotOverheadGb: 420 },
  { name: 'pool-archive', type: 'Cold Storage', totalGb: 20000, usedGb: 8400, snapshotOverheadGb: 0 },
]

export interface DemoStorageQuota {
  group: string
  usedGb: number
  limitGb: number
}

export const DEMO_STORAGE_QUOTAS: DemoStorageQuota[] = [
  { group: 'Production', usedGb: 480, limitGb: 1000 },
  { group: 'CI/CD', usedGb: 120, limitGb: 500 },
  { group: 'Data Science', usedGb: 780, limitGb: 2000 },
]

export interface DemoTemplateRegistryEntry {
  name: string
  version: string
  baseDistro: string
  deployedHosts: number
  totalHosts: number
  lastPush: string
}

export const DEMO_TEMPLATE_REGISTRY: DemoTemplateRegistryEntry[] = [
  { name: 'web-app-prod', version: 'v2.2', baseDistro: 'NixOS 25.11', deployedHosts: 4, totalHosts: 5, lastPush: '2026-03-28' },
  { name: 'ci-runner', version: 'v1.4', baseDistro: 'NixOS 25.11', deployedHosts: 5, totalHosts: 5, lastPush: '2026-03-25' },
  { name: 'edge-inference', version: 'v3.1', baseDistro: 'NixOS 25.11', deployedHosts: 2, totalHosts: 3, lastPush: '2026-03-30' },
  { name: 'db-postgres-16', version: 'v1.0', baseDistro: 'NixOS 25.11', deployedHosts: 3, totalHosts: 3, lastPush: '2026-03-15' },
]

// ══════════════════════════════════════════════════════════════════════════
// v3.1 — Edge Fleet + Cloud Burst mock data
// ══════════════════════════════════════════════════════════════════════════

export interface DemoEdgeNode {
  hostname: string
  arch: string
  kind: string
  lastHeartbeat: string
  status: 'healthy' | 'degraded' | 'offline'
  workloads: number
}

export const DEMO_EDGE_NODES: DemoEdgeNode[] = [
  { hostname: 'iot-factory-01', arch: 'aarch64', kind: 'iot', lastHeartbeat: '12s ago', status: 'healthy', workloads: 3 },
  { hostname: 'iot-edge-lab', arch: 'aarch64', kind: 'iot', lastHeartbeat: '8s ago', status: 'healthy', workloads: 2 },
  { hostname: 'edge-retail-pos', arch: 'x86_64', kind: 'edge', lastHeartbeat: '2m ago', status: 'degraded', workloads: 1 },
]

export interface DemoCloudBurstNode {
  hostname: string
  provider: string
  region: string
  lifecycle: 'active' | 'draining' | 'deregistered'
  nodeDays: number
  gpus: string
}

export const DEMO_CLOUD_BURST_NODES: DemoCloudBurstNode[] = [
  { hostname: 'cloud-hetzner-fsn1', provider: 'Hetzner', region: 'eu-central', lifecycle: 'active', nodeDays: 47.3, gpus: '1x T4' },
  { hostname: 'cloud-do-sgp1', provider: 'DigitalOcean', region: 'ap-southeast', lifecycle: 'active', nodeDays: 12.1, gpus: 'none' },
  { hostname: 'burst-aws-usw2', provider: 'AWS', region: 'us-west-2', lifecycle: 'draining', nodeDays: 89.7, gpus: '2x A10G' },
]

export interface DemoFleetGpu {
  host: string
  vendor: string
  model: string
  count: number
  utilization: number
}

export const DEMO_FLEET_GPU_INVENTORY: DemoFleetGpu[] = [
  { host: 'titan', vendor: 'NVIDIA', model: 'A100 80GB', count: 2, utilization: 78 },
  { host: 'cloud-hetzner-fsn1', vendor: 'NVIDIA', model: 'T4 16GB', count: 1, utilization: 45 },
  { host: 'burst-aws-usw2', vendor: 'NVIDIA', model: 'A10G 24GB', count: 2, utilization: 92 },
  { host: 'iot-factory-01', vendor: 'NVIDIA', model: 'Jetson Orin', count: 1, utilization: 61 },
]

// ══════════════════════════════════════════════════════════════════════════
// v3.2 — Cloud Burst Self-Serve Billing mock data
// ══════════════════════════════════════════════════════════════════════════

export interface DemoBillingPool {
  name: string
  purchased: number
  consumed: number
  remaining: number
  autoRenew: boolean
  renewThreshold: number
}

export const DEMO_BILLING_POOLS: DemoBillingPool[] = [
  { name: 'Primary Pool', purchased: 100, consumed: 47.3, remaining: 52.7, autoRenew: true, renewThreshold: 10 },
  { name: 'GPU Burst Pool', purchased: 30, consumed: 22.8, remaining: 7.2, autoRenew: false, renewThreshold: 5 },
]

export interface DemoBillingUsage {
  month: string
  nodeDays: number
  gpuHours: number
  cost: string
}

export const DEMO_BILLING_USAGE: DemoBillingUsage[] = [
  { month: 'Jan 2026', nodeDays: 142, gpuHours: 320, cost: '$1,847' },
  { month: 'Feb 2026', nodeDays: 168, gpuHours: 410, cost: '$2,234' },
  { month: 'Mar 2026', nodeDays: 155, gpuHours: 380, cost: '$2,065' },
]

export interface DemoBillingInvoice {
  id: string
  date: string
  amount: string
  status: 'paid' | 'pending' | 'overdue'
}

export const DEMO_BILLING_INVOICES: DemoBillingInvoice[] = [
  { id: 'INV-2026-003', date: '2026-03-01', amount: '$2,065.00', status: 'paid' },
  { id: 'INV-2026-002', date: '2026-02-01', amount: '$2,234.00', status: 'paid' },
  { id: 'INV-2026-001', date: '2026-01-01', amount: '$1,847.00', status: 'paid' },
]
