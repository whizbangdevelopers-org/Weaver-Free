// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, mkdir } from 'node:fs/promises'
import { atomicWriteJson } from './lib/atomic-write.js'
import { dirname } from 'node:path'
import type { DistroImageSource } from '../services/image-manager.js'
import { ownRecord, ownValue } from './lib/own-keys.js'

export interface CustomDistro {
  name: string
  label: string
  url: string
  format: 'qcow2' | 'raw' | 'iso' | 'flake'
  cloudInit: boolean
  guestOs?: 'linux' | 'windows'
  /** SPDX license identifier for the OS/software (e.g., 'GPL-2.0-only', 'MIT', 'proprietary') */
  license?: string
}

export class DistroStore {
  private filePath: string
  private distros: Record<string, CustomDistro> = ownRecord()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      this.distros = ownRecord(JSON.parse(data) as Record<string, CustomDistro>)
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  getAll(): Record<string, CustomDistro> {
    return { ...this.distros }
  }

  get(name: string): CustomDistro | null {
    return ownValue(this.distros, name)
  }

  has(name: string): boolean {
    return Object.hasOwn(this.distros, name)
  }

  names(): string[] {
    return Object.keys(this.distros)
  }

  async add(distro: CustomDistro): Promise<boolean> {
    if (Object.hasOwn(this.distros, distro.name)) return false
    this.distros[distro.name] = distro
    await this.persist()
    return true
  }

  async update(name: string, fields: Partial<Omit<CustomDistro, 'name'>>): Promise<boolean> {
    if (!Object.hasOwn(this.distros, name)) return false
    this.distros[name] = { ...this.distros[name], ...fields, name }
    await this.persist()
    return true
  }

  async remove(name: string): Promise<boolean> {
    if (!Object.hasOwn(this.distros, name)) return false
    delete this.distros[name]
    await this.persist()
    return true
  }

  /** Convert custom distros to ImageManager source format */
  toImageSources(): Record<string, DistroImageSource> {
    const sources: Record<string, DistroImageSource> = {}
    for (const [name, d] of Object.entries(this.distros)) {
      sources[name] = { url: d.url, format: d.format, cloudInit: d.cloudInit, guestOs: d.guestOs }
    }
    return sources
  }

  private async persist(): Promise<void> {
    await atomicWriteJson(this.filePath, this.distros)
  }
}
