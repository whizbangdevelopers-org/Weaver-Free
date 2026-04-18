// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { TIERS, type TierName } from '../constants/vocabularies.js'

export const TIER_ORDER: Record<string, number> = {
  [TIERS.DEMO]: 99,       // demo sees everything
  [TIERS.FREE]: 1,
  [TIERS.SOLO]: 2,
  [TIERS.FABRICK]: 3,
}

export interface TierViewConfig {
  minimumTier: Exclude<TierName, typeof TIERS.DEMO>
  loader: () => Promise<Record<string, unknown>>
  exportName: string
  featureName: string
  featureDescription: string
  features: string[]
}

export const TIER_VIEWS: Record<string, TierViewConfig> = {
  network: {
    minimumTier: TIERS.SOLO,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/weaver/NetworkView.js') } catch { return { default: () => null } } },
    exportName: 'NetworkView',
    featureName: 'Network Topology',
    featureDescription: 'View bridge topology, VM network mappings, and connectivity status.',
    features: ['Bridge visualization', 'VM-to-bridge mapping', 'Network status monitoring'],
  },
  templates: {
    minimumTier: TIERS.SOLO,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/weaver/TemplatesView.js') } catch { return { default: () => null } } },
    exportName: 'TemplatesView',
    featureName: 'VM Templates',
    featureDescription: 'Pre-configured VM templates for common workloads.',
    features: ['Built-in templates', 'Custom templates', 'One-click VM creation'],
  },
  'host-detail': {
    minimumTier: TIERS.FREE,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/weaver/HostDetailView.js') } catch { return { default: () => null } } },
    exportName: 'HostDetailView',
    featureName: 'Host Information',
    featureDescription: 'Basic host info at all tiers. CPU topology, disk, and live metrics require weaver.',
    features: ['Basic host info', 'CPU topology (weaver)', 'Disk usage (weaver)', 'Live metrics (weaver)'],
  },
  notifications: {
    minimumTier: TIERS.FREE,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/weaver/NotificationsView.js') } catch { return { default: () => null } } },
    exportName: 'NotificationsView',
    featureName: 'Notifications',
    featureDescription: 'View system events, VM lifecycle alerts, and error notifications.',
    features: ['Event history', 'Severity filtering', 'VM lifecycle alerts'],
  },
  settings: {
    minimumTier: TIERS.FREE,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/weaver/SettingsView.js') } catch { return { default: () => null } } },
    exportName: 'SettingsView',
    featureName: 'Settings',
    featureDescription: 'Configure AI agent, view connection info, and manage preferences.',
    features: ['AI agent configuration', 'Connection info', 'Tier display'],
  },
  users: {
    minimumTier: TIERS.FABRICK,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/fabrick/UsersView.js') } catch { return { default: () => null } } },
    exportName: 'UsersView',
    featureName: 'User Management',
    featureDescription: 'Manage users, roles, and permissions across your organization.',
    features: ['User listing', 'Role management', 'User detail view'],
  },
  'user-detail': {
    minimumTier: TIERS.FABRICK,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/fabrick/UserDetailView.js') } catch { return { default: () => null } } },
    exportName: 'UserDetailView',
    featureName: 'User Details',
    featureDescription: 'View user info, resource quotas, and per-VM access control.',
    features: ['User profile', 'Resource quotas', 'VM access control'],
  },
  audit: {
    minimumTier: TIERS.FABRICK,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/fabrick/AuditView.js') } catch { return { default: () => null } } },
    exportName: 'AuditView',
    featureName: 'Audit Log',
    featureDescription: 'Track all user actions, VM operations, and security events.',
    features: ['Action history', 'User attribution', 'Success/failure tracking'],
  },
  'fleet-bridges': {
    minimumTier: TIERS.FABRICK,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    loader: async () => { try { return await import('../components/fabrick/FleetBridgesView.js') } catch { return { default: () => null } } },
    exportName: 'FleetBridgesView',
    featureName: 'Fleet Bridges',
    featureDescription: 'Fleet virtual bridges — AI-operated routing across hosts. Replaces K8s CNI, ingress, and rollout controllers.',
    features: ['Fleet bridge overview', 'Endpoint weights', 'Blue/green deployment', 'Cordon status'],
  },
}
