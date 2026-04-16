// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Demo VM data for TUI --demo mode.
 * Mirrors src/config/demo.ts tier-specific VM sets (stripped of import.meta.env references).
 */

import type { VmInfo } from '../types/vm.js'
import { TIERS, STATUSES } from '../constants/vocabularies.js'

/** Free tier: home lab / single node — 3 NixOS VMs, basic setup */
export const FREE_VMS: VmInfo[] = [
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

/** Weaver Solo tier: serious admin — 6 VMs across 2 bridges, mixed distros + hypervisors.
 *
 *  br-prod  10.10.0.0/24 — Production: web, app, database
 *  br-dev   10.10.1.0/24 — Dev/CI: experimentation, builds, staging
 */
export const PREMIUM_VMS: VmInfo[] = [
  {
    name: 'web-nginx',
    status: STATUSES.RUNNING,
    ip: '10.10.0.10',
    mem: 256,
    vcpu: 1,
    hypervisor: 'qemu',
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
    uptime: new Date(Date.now() - 86_400_000 * 5).toISOString(),
    distro: 'ubuntu-24.04',
    bridge: 'br-prod',
    autostart: true,
    description: 'Node.js application backend',
    tags: ['production', 'web'],
  },
  {
    name: 'db-postgres',
    status: STATUSES.RUNNING,
    ip: '10.10.0.30',
    mem: 2048,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    distro: 'rocky-9',
    bridge: 'br-prod',
    autostart: true,
    description: 'PostgreSQL 16 primary',
    tags: ['production', 'database'],
  },
  {
    name: 'dev-python',
    status: STATUSES.RUNNING,
    ip: '10.10.1.20',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
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
    uptime: null,
    distro: 'alma-9',
    bridge: 'br-dev',
    description: 'Pre-production mirror (disk full)',
    tags: ['staging'],
  },
]

/** Fabrick tier: multi-team org — 12 VMs across 5 segmented bridges.
 *
 *  br-edge    10.10.1.0/24   — DMZ: load balancers, API gateway
 *  br-app     10.10.2.0/24   — Application tier: microservices
 *  br-data    10.10.3.0/24   — Database tier: isolated
 *  br-mgmt    10.10.100.0/24 — Management: monitoring, bastion
 *  br-staging 10.10.10.0/24  — Non-production: QA, load testing
 */
export const ENTERPRISE_VMS: VmInfo[] = [
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

/** Get the demo VMs for the given tier. */
export function getDemoVmsForTier(tier: string): VmInfo[] {
  switch (tier) {
    case TIERS.SOLO: return PREMIUM_VMS
    case TIERS.FABRICK: return ENTERPRISE_VMS
    default: return FREE_VMS
  }
}

/** Legacy export — defaults to the full weaver showcase set for backward compat. */
export const DEMO_VMS = PREMIUM_VMS

// ---------------------------------------------------------------------------
// Fleet Virtual Bridges (v3.0+ Fabrick — mirrors web demo data)
// ---------------------------------------------------------------------------

import type { FleetBridge } from '../types/fleet-bridge.js'

export const DEMO_FLEET_BRIDGES: FleetBridge[] = [
  {
    name: 'fb-production', label: 'Production', workloadGroupId: 'prod',
    overlay: 'vxlan', overlaySegment: 'VNI 1001', subnet: '10.100.1.0/24',
    health: 'healthy', replaces: 'K8s Ingress Controller + MetalLB + Argo Rollouts',
    policy: { balanceMode: 'latency', defaultWeightRule: 'capacity-weighted', healthCheckIntervalSec: 5, drainTimeoutSec: 30 },
    endpoints: [
      { id: 'king:web-app',             hostId: 'king',              workloadName: 'web-app',          weight: 40, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'king:svc-orders',          hostId: 'king',              workloadName: 'svc-orders',       weight: 40, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'hetzner:cloud-api-eu',     hostId: 'cloud-hetzner-fsn1', workloadName: 'cloud-api-eu',   weight: 35, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'do:cloud-api-apac',        hostId: 'cloud-do-sgp1',     workloadName: 'cloud-api-apac',  weight: 15, localBridge: 'br-app',  health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'hetzner:cloud-api-eu-v22', hostId: 'cloud-hetzner-fsn1', workloadName: 'cloud-api-eu-v22', weight: 10, localBridge: 'br-app', health: 'healthy', autoRegistered: true, gpuVendor: null },
    ],
    blueGreen: {
      phase: 'shifting', blueEndpointId: 'hetzner:cloud-api-eu', greenEndpointId: 'hetzner:cloud-api-eu-v22',
      blueWeight: 35, greenWeight: 10, startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      initiatedBy: 'AI Agent — latency regression detected',
    },
  },
  {
    name: 'fb-cicd', label: 'CI/CD', workloadGroupId: 'cicd',
    overlay: 'vxlan', overlaySegment: 'VNI 1002', subnet: '10.100.2.0/24',
    health: 'healthy', replaces: 'K8s CNI + Jenkins Agent Networking',
    policy: { balanceMode: 'round-robin', defaultWeightRule: 'equal', healthCheckIntervalSec: 10, drainTimeoutSec: 60 },
    endpoints: [
      { id: 'crucible:ci-runner-01', hostId: 'crucible', workloadName: 'ci-runner-01',   weight: 34, localBridge: 'br-ci',  health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'crucible:ci-runner-02', hostId: 'crucible', workloadName: 'ci-runner-02',   weight: 33, localBridge: 'br-ci',  health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'nexus:registry-cache',  hostId: 'nexus',    workloadName: 'registry-cache', weight: 33, localBridge: 'br-svc', health: 'healthy',  autoRegistered: true, gpuVendor: null },
      { id: 'matrix:ci-runner-03',   hostId: 'matrix',   workloadName: 'ci-runner-03',   weight: 0,  localBridge: 'br-dev', health: 'draining', autoRegistered: true, gpuVendor: null },
    ],
    blueGreen: null,
  },
  {
    name: 'fb-data', label: 'Data Platform', workloadGroupId: 'data',
    overlay: 'vxlan', overlaySegment: 'VNI 1003', subnet: '10.100.3.0/24',
    health: 'healthy', replaces: 'K8s NetworkPolicy + Dedicated Data Plane',
    policy: { balanceMode: 'manual', defaultWeightRule: 'manual', healthCheckIntervalSec: 3, drainTimeoutSec: 120 },
    endpoints: [
      { id: 'king:db-primary',       hostId: 'king',              workloadName: 'db-primary',  weight: 80, localBridge: 'br-data', health: 'healthy', autoRegistered: true, gpuVendor: null },
      { id: 'vault:db-replica',      hostId: 'vault',             workloadName: 'db-replica',  weight: 20, localBridge: 'br-data', health: 'healthy', autoRegistered: true, gpuVendor: null },
      { id: 'hetzner:cloud-db-eu',   hostId: 'cloud-hetzner-fsn1', workloadName: 'cloud-db-eu', weight: 0, localBridge: 'br-data', health: 'healthy', autoRegistered: true, gpuVendor: null },
    ],
    blueGreen: null,
  },
  {
    name: 'fb-edge', label: 'Edge Fleet', workloadGroupId: 'edge',
    overlay: 'wireguard', overlaySegment: 'wg-edge0', subnet: '10.100.4.0/24',
    health: 'degraded', replaces: 'K8s KubeEdge + Custom VPN Tunneling',
    policy: { balanceMode: 'latency', defaultWeightRule: 'capacity-weighted', healthCheckIntervalSec: 15, drainTimeoutSec: 30 },
    endpoints: [
      { id: 'factory-01:iot-ingest',   hostId: 'iot-factory-01',       workloadName: 'iot-ingest',     weight: 0,  localBridge: 'br-iot',    health: 'draining', autoRegistered: true, gpuVendor: null },
      { id: 'factory-01:plc-proxy',    hostId: 'iot-factory-01',       workloadName: 'plc-proxy',      weight: 0,  localBridge: 'br-iot',    health: 'draining', autoRegistered: true, gpuVendor: null },
      { id: 'edge-lab:edge-inference', hostId: 'iot-edge-lab',         workloadName: 'edge-inference', weight: 60, localBridge: 'br-iot',    health: 'healthy',  autoRegistered: true, gpuVendor: 'nvidia' },
      { id: 'boston:branch-erp',       hostId: 'remote-branch-boston', workloadName: 'branch-erp',     weight: 40, localBridge: 'br-office', health: 'healthy',  autoRegistered: true, gpuVendor: null },
    ],
    blueGreen: null,
  },
]
