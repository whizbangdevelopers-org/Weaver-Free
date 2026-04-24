// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { WorkloadDefinition, WorkloadRegistry } from './workload-registry.js'
import { DEFAULT_VMS } from './seed-data.js'

export class JsonWorkloadRegistry implements WorkloadRegistry {
  private filePath: string
  private vms: Record<string, WorkloadDefinition> = {}

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      this.vms = JSON.parse(data) as Record<string, WorkloadDefinition>
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      // Seed sample VMs only when explicitly requested (E2E, demo).
      // Production and dev start empty — CirrOS example VM is provisioned separately.
      if (process.env.SEED_SAMPLE_VMS === 'true') {
        for (const vm of DEFAULT_VMS) {
          this.vms[vm.name] = vm
        }
      }
      await this.persist()
    }
  }

  async getAll(): Promise<Record<string, WorkloadDefinition>> {
    return { ...this.vms }
  }

  async get(name: string): Promise<WorkloadDefinition | null> {
    return this.vms[name] ?? null
  }

  async has(name: string): Promise<boolean> {
    return name in this.vms
  }

  async add(vm: WorkloadDefinition): Promise<boolean> {
    if (this.vms[vm.name]) return false
    this.vms[vm.name] = vm
    await this.persist()
    return true
  }

  async remove(name: string): Promise<boolean> {
    if (!this.vms[name]) return false
    delete this.vms[name]
    await this.persist()
    return true
  }

  async update(name: string, fields: Partial<WorkloadDefinition>): Promise<boolean> {
    if (!this.vms[name]) return false
    this.vms[name] = { ...this.vms[name], ...fields, name } // name is immutable
    await this.persist()
    return true
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.vms, null, 2), 'utf-8')
  }
}
