// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, mkdir, access, stat } from 'node:fs/promises'
import { atomicWriteJson } from '../storage/lib/atomic-write.js'
import { dirname, resolve } from 'node:path'
import { get as httpsGet } from 'node:https'
import { get as httpGet, type IncomingMessage } from 'node:http'
import type { ImageManager, DistroImageSource } from './image-manager.js'
import { STATUSES } from '../constants/vocabularies.js'

export interface UrlValidationResult {
  distro: string
  url: string
  status: 'valid' | 'invalid' | typeof STATUSES.UNKNOWN
  httpStatus?: number
  error?: string
  checkedAt: string
}

export interface UrlValidationData {
  results: Record<string, UrlValidationResult>
  lastRunAt: string | null
}

export class UrlValidationService {
  private filePath: string
  private imageManager: ImageManager
  private data: UrlValidationData = { results: {}, lastRunAt: null }
  private running = false
  /** Allowed root directories for file:// URLs (SSRF prevention) */
  private allowedFileRoots: string[]

  constructor(filePath: string, imageManager: ImageManager, allowedFileRoots: string[] = []) {
    this.filePath = filePath
    this.imageManager = imageManager
    this.allowedFileRoots = allowedFileRoots.map(r => resolve(r))
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.data = JSON.parse(raw) as UrlValidationData
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  getResults(): UrlValidationData {
    return { ...this.data, results: { ...this.data.results } }
  }

  /** Validate all distro URLs (skip flake-based distros). Returns results. */
  async validateAll(): Promise<UrlValidationData> {
    if (this.running) return this.getResults()
    this.running = true

    try {
      const sources = this.imageManager.getAllSources()
      const entries = Object.entries(sources).filter(
        ([, src]) => src.format !== 'flake'
      )

      // Process with concurrency limit of 3
      const results: Record<string, UrlValidationResult> = {}
      const queue = [...entries]

      const worker = async () => {
        while (queue.length > 0) {
          const entry = queue.shift()
          if (!entry) break
          const [distro, source] = entry
          results[distro] = await this.checkUrl(distro, source)
        }
      }

      await Promise.all([worker(), worker(), worker()])

      this.data.results = results
      this.data.lastRunAt = new Date().toISOString()
      await this.persist()
    } finally {
      this.running = false
    }

    return this.getResults()
  }

  /** Validate a single distro URL */
  async validateOne(distro: string): Promise<UrlValidationResult | null> {
    const sources = this.imageManager.getAllSources()
    const source = sources[distro]
    if (!source || source.format === 'flake') return null

    const result = await this.checkUrl(distro, source)
    this.data.results[distro] = result
    await this.persist()
    return result
  }

  private async checkUrl(distro: string, source: DistroImageSource): Promise<UrlValidationResult> {
    const base: Omit<UrlValidationResult, 'status' | 'httpStatus' | 'error'> = {
      distro,
      url: source.url,
      checkedAt: new Date().toISOString(),
    }

    // Local file:// paths — check file existence and size
    if (source.url.startsWith('file://')) {
      const localPath = resolve(source.url.slice(7))

      // SSRF prevention: restrict file:// access to allowed directories
      if (this.allowedFileRoots.length > 0) {
        const allowed = this.allowedFileRoots.some(root => localPath.startsWith(root + '/'))
        if (!allowed) {
          return { ...base, status: 'invalid', error: 'Path outside allowed directories' }
        }
      }

      try {
        await access(localPath)
        const info = await stat(localPath)
        if (info.size > 0) {
          return { ...base, status: 'valid' }
        }
        return { ...base, status: 'invalid', error: 'File is empty' }
      } catch {
        return { ...base, status: 'invalid', error: 'File not found' }
      }
    }

    try {
      const status = await this.headRequest(source.url)

      // Some servers return 405 Method Not Allowed for HEAD — retry with ranged GET
      if (status === 405) {
        const retryStatus = await this.rangedGetRequest(source.url)
        if (retryStatus >= 200 && retryStatus < 400) {
          return { ...base, status: 'valid', httpStatus: retryStatus }
        }
        return { ...base, status: 'invalid', httpStatus: retryStatus }
      }

      if (status >= 200 && status < 400) {
        return { ...base, status: 'valid', httpStatus: status }
      }
      return { ...base, status: 'invalid', httpStatus: status }
    } catch (err) {
      return {
        ...base,
        status: 'invalid',
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  private headRequest(url: string, maxRedirects = 5): Promise<number> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const mod = parsedUrl.protocol === 'https:' ? httpsGet : httpGet
      const req = mod(url, { method: 'HEAD', timeout: 15_000 }, (res: IncomingMessage) => {
        const code = res.statusCode ?? 0
        if (code >= 300 && code < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'))
            return
          }
          // Resolve relative redirects
          const next = new URL(res.headers.location, url).href
          this.headRequest(next, maxRedirects - 1).then(resolve).catch(reject)
          return
        }
        // Consume response body to free the socket
        res.resume()
        resolve(code)
      })
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timed out'))
      })
    })
  }

  private rangedGetRequest(url: string, maxRedirects = 5): Promise<number> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const mod = parsedUrl.protocol === 'https:' ? httpsGet : httpGet
      const req = mod(url, {
        headers: { Range: 'bytes=0-0' },
        timeout: 15_000,
      }, (res: IncomingMessage) => {
        const code = res.statusCode ?? 0
        if (code >= 300 && code < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'))
            return
          }
          const next = new URL(res.headers.location, url).href
          this.rangedGetRequest(next, maxRedirects - 1).then(resolve).catch(reject)
          return
        }
        res.resume()
        resolve(code)
      })
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timed out'))
      })
    })
  }

  private async persist(): Promise<void> {
    await atomicWriteJson(this.filePath, this.data)
  }
}
