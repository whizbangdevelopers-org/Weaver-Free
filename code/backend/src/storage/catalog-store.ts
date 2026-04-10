// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DistroImageSource } from '../services/image-manager.js'
import { validateExternalUrl } from '../validate-url.js'

export interface CatalogDistro {
  name: string
  label: string
  description?: string
  url?: string
  format: 'qcow2' | 'raw' | 'iso' | 'flake'
  cloudInit: boolean
  guestOs?: 'linux' | 'windows'
  /** SPDX license identifier for the OS/software (e.g., 'GPL-2.0-only', 'MIT', 'proprietary') */
  license?: string
}

export interface CatalogData {
  version: number
  entries: CatalogDistro[]
}

export class CatalogStore {
  private persistPath: string
  private defaultPath: string
  private remoteUrl: string | null
  private distros: Record<string, CatalogDistro> = {}

  constructor(persistPath: string, defaultPath: string, remoteUrl?: string) {
    this.persistPath = persistPath
    this.defaultPath = defaultPath
    this.remoteUrl = remoteUrl ?? null
  }

  /** Load catalog from persist path, falling back to default (shipped) path */
  async init(): Promise<void> {
    // Try persisted catalog first (may have been updated by refresh)
    const loaded = await this.loadFile(this.persistPath)
    if (loaded) return

    // Fall back to shipped default catalog
    await this.loadFile(this.defaultPath)
  }

  private async loadFile(filePath: string): Promise<boolean> {
    try {
      const data = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(data) as CatalogData
      if (!parsed.entries || !Array.isArray(parsed.entries)) return false
      this.distros = {}
      for (const entry of parsed.entries) {
        if (entry.name && (entry.url || entry.format === 'flake')) {
          this.distros[entry.name] = entry
        }
      }
      return true
    } catch {
      return false
    }
  }

  /** Fetch catalog from remote URL and persist locally. Returns true if catalog changed. */
  async refresh(): Promise<boolean> {
    if (!this.remoteUrl) {
      throw new Error('No remote URL configured')
    }

    validateExternalUrl(this.remoteUrl)
    const response = await fetch(this.remoteUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching catalog from ${this.remoteUrl}`)
    }

    const data = await response.json() as CatalogData
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid catalog format: missing entries array')
    }

    const oldKeys = Object.keys(this.distros).sort().join(',')

    this.distros = {}
    for (const entry of data.entries) {
      if (entry.name && (entry.url || entry.format === 'flake')) {
        this.distros[entry.name] = entry
      }
    }

    const newKeys = Object.keys(this.distros).sort().join(',')
    const changed = oldKeys !== newKeys

    // Persist to local file
    await mkdir(dirname(this.persistPath), { recursive: true })
    await writeFile(this.persistPath, JSON.stringify(data, null, 2), 'utf-8')

    return changed
  }

  hasRemoteUrl(): boolean {
    return this.remoteUrl !== null
  }

  getAll(): Record<string, CatalogDistro> {
    return { ...this.distros }
  }

  get(name: string): CatalogDistro | null {
    return this.distros[name] ?? null
  }

  has(name: string): boolean {
    return name in this.distros
  }

  names(): string[] {
    return Object.keys(this.distros)
  }

  /** Convert catalog distros to ImageManager source format (skips flake entries — they don't use ImageManager for downloads) */
  toImageSources(): Record<string, DistroImageSource> {
    const sources: Record<string, DistroImageSource> = {}
    for (const [name, d] of Object.entries(this.distros)) {
      sources[name] = { url: d.url ?? '', format: d.format, cloudInit: d.cloudInit, guestOs: d.guestOs }
    }
    return sources
  }
}
