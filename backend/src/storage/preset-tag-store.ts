// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Persists admin-defined preset tags as a sorted, deduplicated string[].
 * Preset tags appear as suggestions when tagging VMs, even if no VM uses them yet.
 */
export class PresetTagStore {
  private filePath: string
  private tags: string[] = []

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.tags = JSON.parse(raw) as string[]
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  getAll(): string[] {
    return [...this.tags]
  }

  async set(tags: string[]): Promise<void> {
    this.tags = [...new Set(tags)].sort()
    await this.persist()
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.tags, null, 2), 'utf-8')
  }
}
