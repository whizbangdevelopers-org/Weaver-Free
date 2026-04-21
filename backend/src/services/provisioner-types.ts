// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { EventEmitter } from 'node:events'
import type { ProvisioningState } from '../storage/workload-registry.js'
import { STATUSES } from '../constants/vocabularies.js'

export interface ProvisioningEvent {
  name: string
  state: ProvisioningState
  progress?: string
  error?: string
}

/** Global event emitter for provisioning state changes (consumed by WebSocket handler) */
export const provisioningEvents = new EventEmitter()

/**
 * Provisioner interface — extracted so free-tier code can reference
 * the type without importing the weaver-tier implementation.
 */
export interface Provisioner {
  autostartCloudVms(): Promise<void>
  provision(name: string): Promise<void>
  destroy(name: string): Promise<void>
  startCloudVm(name: string): Promise<{ success: boolean; message: string }>
  stopCloudVm(name: string): Promise<{ success: boolean; message: string }>
  getCloudVmStatus(name: string): typeof STATUSES.RUNNING | typeof STATUSES.STOPPED
  getCloudVmUptime(name: string): string | null
  isCloudDistro(distro?: string): boolean
  isIsoDistro(distro?: string): boolean
  isFlakeDistro(distro?: string): boolean
  isQemuVm(distro?: string): boolean
  getConsolePort(name: string): Promise<number | null>
  getLog(name: string): Promise<string>
}
