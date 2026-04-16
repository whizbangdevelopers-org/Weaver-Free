// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import type { WorkloadRegistry } from './workload-registry.js'
import { JsonWorkloadRegistry } from './json-registry.js'

export type StorageBackend = 'json' | 'sqlite'

export async function createRegistry(): Promise<WorkloadRegistry> {
  const backend = (process.env.VM_STORAGE_BACKEND ?? 'json') as StorageBackend
  const dataDir = process.env.VM_DATA_DIR ?? './data'

  let registry: WorkloadRegistry

  if (backend === 'sqlite') {
    const { SqliteWorkloadRegistry } = await import('./sqlite-registry.js')
    registry = new SqliteWorkloadRegistry(resolve(dataDir, 'vms.db'))
  } else {
    registry = new JsonWorkloadRegistry(resolve(dataDir, 'vms.json'))
  }

  await registry.init()
  return registry
}

export type { WorkloadRegistry } from './workload-registry.js'
export type { WorkloadDefinition } from './workload-registry.js'
