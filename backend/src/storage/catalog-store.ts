// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, mkdir } from 'node:fs/promises'
import { atomicWriteJson } from './lib/atomic-write.js'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { DistroImageSource } from '../services/image-manager.js'
import { validateExternalUrl } from '../validate-url.js'

// Max size of a catalog payload we'll accept from a remote URL (1 MiB).
// Real catalogs are a few KB; anything remotely close to this is either
// malicious or misconfigured. Cap prevents DoS / disk-fill.
const MAX_REMOTE_CATALOG_BYTES = 1 * 1024 * 1024

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

// Zod schemas mirror the explicit interfaces above. Parse-don't-validate:
// `catalogDataSchema.parse(rawJson)` throws on any shape mismatch and
// yields a typed CatalogData value, so downstream code (including the
// file write below) receives provably-shaped data — not just unverified
// network JSON coerced via `as CatalogData`. Interfaces remain the source
// of truth for types (per the feedback rule "never z.infer at scale");
// the schemas are runtime validators kept manually in sync.
const catalogDistroSchema: z.ZodType<CatalogDistro> = z.object({
  name: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  label: z.string().min(1).max(256),
  description: z.string().max(1024).optional(),
  url: z.string().url().max(2048).optional(),
  format: z.enum(['qcow2', 'raw', 'iso', 'flake']),
  cloudInit: z.boolean(),
  guestOs: z.enum(['linux', 'windows']).optional(),
  license: z.string().max(128).optional(),
})

const catalogDataSchema: z.ZodType<CatalogData> = z.object({
  version: z.number().int().nonnegative(),
  entries: z.array(catalogDistroSchema).max(1000),
})

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
      // Lenient load: accept a structurally-valid catalog (object with an
      // entries array) and filter semantically-invalid entries. Stricter
      // schema validation applies to network-fetched catalogs in refresh()
      // — local-disk files are trusted to the extent that their origin
      // was validated when they were written.
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

    // Read as text with a hard size cap BEFORE JSON.parse. Reject oversized
    // payloads — catch both malicious and misconfigured endpoints that could
    // otherwise disk-fill via the persist step below. 1 MiB comfortably covers
    // catalogs with hundreds of distro entries.
    const raw = await response.text()
    if (raw.length > MAX_REMOTE_CATALOG_BYTES) {
      throw new Error(
        `Catalog payload exceeds ${MAX_REMOTE_CATALOG_BYTES} bytes — refusing to persist`,
      )
    }

    // Parse + validate against the schema. Invalid shape throws with a
    // useful message; caller sees a structured error, not a coerced-null.
    let data: CatalogData
    try {
      data = catalogDataSchema.parse(JSON.parse(raw))
    } catch (err) {
      throw new Error(
        `Invalid catalog format from ${this.remoteUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
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
    await atomicWriteJson(this.persistPath, data)

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
