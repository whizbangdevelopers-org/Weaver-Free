// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Demo-mode data shim.
 *
 * This file ships to Weaver Free. The companion `demo-data.ts` holds the
 * actual mock data and accessor functions; it is sync-excluded so the Free
 * public mirror never bundles demo content. At build time, Vite's
 * `import.meta.glob` eager-resolves `./demo-data.ts` — on Dev the file
 * exists and the real module loads; on Free the glob is empty and the
 * runtime falls back to stub defaults.
 *
 * Types are preserved via `typeof import('./demo-data')` — tsc resolves
 * these against the real demo-data.ts on Dev, so call-sites keep precise
 * types. On Free builds, tsc is not run against this file; Vite's
 * bundler is type-oblivious and just processes the runtime fallbacks.
 *
 * Flag surface (`isDemoMode`, `isPublicDemo`, `DEMO_LINKS`, etc.) lives
 * in `./demo-mode` and is re-exported here.
 */

export * from './demo-mode'

type DemoData = typeof import('./demo-data')

// Eager glob returns { './demo-data.ts': <module> } on Dev, {} on Free.
const impl = import.meta.glob<DemoData>('./demo-data.ts', { eager: true })
const mod: Partial<DemoData> = (impl['./demo-data.ts'] as DemoData | undefined) ?? {}

// Runtime re-exports with stub defaults. Types come from demo-data via
// typeof; runtime values fall back to empty collections on Free builds.
export const DEMO_VMS: DemoData['DEMO_VMS'] = mod.DEMO_VMS ?? []
export const DEMO_HOSTS: DemoData['DEMO_HOSTS'] = mod.DEMO_HOSTS ?? []
export const DEMO_HOST_CONNECTIONS: DemoData['DEMO_HOST_CONNECTIONS'] = mod.DEMO_HOST_CONNECTIONS ?? []
export const DEMO_WORKLOAD_CONNECTIONS: DemoData['DEMO_WORKLOAD_CONNECTIONS'] = mod.DEMO_WORKLOAD_CONNECTIONS ?? []
export const DEMO_HOST_RESOURCES: DemoData['DEMO_HOST_RESOURCES'] = mod.DEMO_HOST_RESOURCES ?? {}
export const DEMO_FLEET_BRIDGES: DemoData['DEMO_FLEET_BRIDGES'] = mod.DEMO_FLEET_BRIDGES ?? []
export const DEMO_HUB_STATE: DemoData['DEMO_HUB_STATE'] = mod.DEMO_HUB_STATE ?? ({} as DemoData['DEMO_HUB_STATE'])
export const DEMO_NIXOS_GENERATIONS: DemoData['DEMO_NIXOS_GENERATIONS'] = mod.DEMO_NIXOS_GENERATIONS ?? []
export const DEMO_STORAGE_POOLS: DemoData['DEMO_STORAGE_POOLS'] = mod.DEMO_STORAGE_POOLS ?? []
export const DEMO_STORAGE_QUOTAS: DemoData['DEMO_STORAGE_QUOTAS'] = mod.DEMO_STORAGE_QUOTAS ?? []
export const DEMO_TEMPLATE_REGISTRY: DemoData['DEMO_TEMPLATE_REGISTRY'] = mod.DEMO_TEMPLATE_REGISTRY ?? []
export const DEMO_EDGE_NODES: DemoData['DEMO_EDGE_NODES'] = mod.DEMO_EDGE_NODES ?? []
export const DEMO_CLOUD_BURST_NODES: DemoData['DEMO_CLOUD_BURST_NODES'] = mod.DEMO_CLOUD_BURST_NODES ?? []
export const DEMO_FLEET_GPU_INVENTORY: DemoData['DEMO_FLEET_GPU_INVENTORY'] = mod.DEMO_FLEET_GPU_INVENTORY ?? []
export const DEMO_BILLING_POOLS: DemoData['DEMO_BILLING_POOLS'] = mod.DEMO_BILLING_POOLS ?? []
export const DEMO_BILLING_USAGE: DemoData['DEMO_BILLING_USAGE'] = mod.DEMO_BILLING_USAGE ?? []
export const DEMO_BILLING_INVOICES: DemoData['DEMO_BILLING_INVOICES'] = mod.DEMO_BILLING_INVOICES ?? []
export const DEMO_INSPECTOR_USERS: DemoData['DEMO_INSPECTOR_USERS'] = mod.DEMO_INSPECTOR_USERS ?? []
export const DEMO_INSPECTOR_GROUPS: DemoData['DEMO_INSPECTOR_GROUPS'] = mod.DEMO_INSPECTOR_GROUPS ?? []
export const DEMO_VERSIONS: DemoData['DEMO_VERSIONS'] = mod.DEMO_VERSIONS ?? []
export const VERSION_MILESTONES: DemoData['VERSION_MILESTONES'] = mod.VERSION_MILESTONES ?? []
export const MILESTONE_BY_VERSION: DemoData['MILESTONE_BY_VERSION'] = mod.MILESTONE_BY_VERSION ?? new Map()
export const PUBLIC_DEMO_RELEASE_HIGHLIGHTS: DemoData['PUBLIC_DEMO_RELEASE_HIGHLIGHTS'] = mod.PUBLIC_DEMO_RELEASE_HIGHLIGHTS ?? {}
export const ENTERPRISE_ROUTES: DemoData['ENTERPRISE_ROUTES'] = mod.ENTERPRISE_ROUTES ?? []
export const PREMIUM_ROUTES: DemoData['PREMIUM_ROUTES'] = mod.PREMIUM_ROUTES ?? []

// Functions — stub returns empty/default on Free
export const getPublicDemoSteps: DemoData['getPublicDemoSteps'] =
  mod.getPublicDemoSteps ?? (() => [])
export const getDemoVmsForTier: DemoData['getDemoVmsForTier'] =
  mod.getDemoVmsForTier ?? (() => [])
export const getDemoNotificationsForTier: DemoData['getDemoNotificationsForTier'] =
  mod.getDemoNotificationsForTier ?? (() => [])
export const getDemoContainersForTier: DemoData['getDemoContainersForTier'] =
  mod.getDemoContainersForTier ?? (() => [])
export const getDemoVmsForHost: DemoData['getDemoVmsForHost'] =
  mod.getDemoVmsForHost ?? (() => [])
export const getDemoHostVmCount: DemoData['getDemoHostVmCount'] =
  mod.getDemoHostVmCount ?? (() => 0)
export const getDemoHostBasicInfo: DemoData['getDemoHostBasicInfo'] =
  mod.getDemoHostBasicInfo ?? ((() => ({})) as unknown as DemoData['getDemoHostBasicInfo'])
export const getDemoMetricsForVm: DemoData['getDemoMetricsForVm'] =
  mod.getDemoMetricsForVm ?? ((() => ({})) as unknown as DemoData['getDemoMetricsForVm'])
export const getDemoHostConfig: DemoData['getDemoHostConfig'] =
  mod.getDemoHostConfig ?? ((() => ({})) as unknown as DemoData['getDemoHostConfig'])
export const getDemoFleetBridges: DemoData['getDemoFleetBridges'] =
  mod.getDemoFleetBridges ?? (() => [])
export const weeksUntilRelease: DemoData['weeksUntilRelease'] =
  mod.weeksUntilRelease ?? (() => 0)

// Types re-exported via type-only imports. tsc resolves these from
// demo-data.ts directly; no runtime impact.
export type {
  PublicDemoStep,
  DemoVersionInfo,
  VersionMilestone,
  DemoHostInfo,
  DemoHostConnection,
  DemoWorkloadConnection,
  DemoHostResources,
  DemoInspectorUser,
  DemoInspectorGroup,
  FleetOverlayTransport,
  FleetBalanceMode,
  FleetHealthStatus,
  BlueGreenPhase,
  DemoFleetEndpoint,
  DemoBlueGreenState,
  DemoFleetBridgePolicy,
  DemoWorkloadSelector,
  DemoHubState,
  DemoFleetBridge,
  DemoStoragePool,
  DemoStorageQuota,
  DemoTemplateRegistryEntry,
  DemoEdgeNode,
  DemoCloudBurstNode,
  DemoFleetGpu,
  DemoBillingPool,
  DemoBillingUsage,
  DemoBillingInvoice,
} from './demo-data'
