// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { OrganizationIdentity } from '../models/organization.js'

const DEFAULT_IDENTITY: OrganizationIdentity = {
  name: '',
  logoUrl: null,
  contactEmail: null,
  contactPhone: null,
}

export class OrganizationStore {
  private filePath: string
  private data: OrganizationIdentity = structuredClone(DEFAULT_IDENTITY)

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.data = JSON.parse(raw) as OrganizationIdentity
    } catch {
      // File doesn't exist yet — use defaults, don't persist until explicitly set
    }
  }

  getIdentity(): OrganizationIdentity {
    return structuredClone(this.data)
  }

  async setIdentity(identity: Partial<OrganizationIdentity>): Promise<void> {
    this.data = { ...this.data, ...identity }
    await this.persist()
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}
