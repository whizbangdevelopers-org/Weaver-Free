// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, writeFile, access, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createWriteStream } from 'node:fs'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { get as httpsGet } from 'node:https'
import { get as httpGet } from 'node:http'
import type { IncomingMessage } from 'node:http'
import type { WorkloadDefinition } from '../storage/workload-registry.js'
import type { DashboardConfig } from '../config.js'
import { validateExternalUrl } from '../validate-url.js'

const execFileAsync = promisify(execFile)

export interface DistroImageSource {
  url: string
  format: 'qcow2' | 'raw' | 'iso' | 'flake'
  cloudInit: boolean
  guestOs?: 'linux' | 'windows'
}

const DISTRO_IMAGES: Record<string, DistroImageSource> = {
  // CirrOS is listed first — it's the default smoke test distro (~20 MB, no cloud-init)
  cirros: {
    url: 'http://download.cirros-cloud.net/0.6.2/cirros-0.6.2-x86_64-disk.img',
    format: 'qcow2',
    cloudInit: false,
  },
  arch: {
    url: 'https://geo.mirror.pkgbuild.com/images/latest/Arch-Linux-x86_64-cloudimg.qcow2',
    format: 'qcow2',
    cloudInit: true,
  },
  fedora: {
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/42/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2',
    format: 'qcow2',
    cloudInit: true,
  },
  ubuntu: {
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
    format: 'qcow2',
    cloudInit: true,
  },
  debian: {
    url: 'https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2',
    format: 'qcow2',
    cloudInit: true,
  },
  alpine: {
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/generic_alpine-3.22.3-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    cloudInit: true,
  },
}

export interface ImageManagerConfig {
  dataDir: string
  microvmsDir: string
  qemuImgBin: string
  bridgeGateway: string | null
}

export class ImageManager {
  private imagesDir: string
  private microvmsDir: string
  private qemuImgBin: string
  private bridgeGateway: string | null
  private catalogSources: Record<string, DistroImageSource> = {}
  private customSources: Record<string, DistroImageSource> = {}

  constructor(config: ImageManagerConfig) {
    this.imagesDir = join(config.dataDir, 'images')
    this.microvmsDir = config.microvmsDir
    this.qemuImgBin = config.qemuImgBin
    this.bridgeGateway = config.bridgeGateway
  }

  /** Register catalog distro image sources (from curated catalog) */
  setCatalogSources(sources: Record<string, DistroImageSource>): void {
    this.catalogSources = sources
  }

  /** Register additional distro image sources (from custom distro store) */
  setCustomSources(sources: Record<string, DistroImageSource>): void {
    this.customSources = sources
  }

  /** Get all known image sources (built-in + catalog + custom; custom overrides catalog overrides built-in) */
  getAllSources(): Record<string, DistroImageSource> {
    return { ...DISTRO_IMAGES, ...this.catalogSources, ...this.customSources }
  }

  /** Get the built-in URL for a distro (ignoring catalog/custom overrides) */
  static builtinUrl(distro: string): string | null {
    return DISTRO_IMAGES[distro]?.url ?? null
  }

  /** Get the full built-in source metadata for a distro */
  static builtinSource(distro: string): DistroImageSource | null {
    return DISTRO_IMAGES[distro] ?? null
  }

  /** Get built-in non-NixOS distro names */
  static builtinDistros(): string[] {
    return Object.keys(DISTRO_IMAGES)
  }

  /** Get supported non-NixOS distro names (built-in + custom) */
  supportedDistros(): string[] {
    return Object.keys(this.getAllSources())
  }

  /** Check if a distro is a flake-based NixOS distro (provisioned via microvm.nix, no image download) */
  isFlakeDistro(distro?: string): boolean {
    if (!distro) return false
    const source = this.getAllSources()[distro]
    return !!source && source.format === 'flake'
  }

  /** Check if a distro is a cloud-image distro (not NixOS, not flake) — instance method checks built-in + custom */
  isCloudDistro(distro?: string): boolean {
    if (!distro || distro === 'nixos') return false
    const source = this.getAllSources()[distro]
    if (source && source.format === 'flake') return false
    return distro in this.getAllSources()
  }

  /** Check if a distro is an ISO-format install (boot from CDROM, blank disk) */
  isIsoDistro(distro?: string): boolean {
    if (!distro) return false
    const source = this.getAllSources()[distro]
    return !!source && source.format === 'iso'
  }

  /** Shorthand: is this a QEMU-managed VM (cloud-init or ISO)? */
  isQemuVm(distro?: string): boolean {
    return this.isCloudDistro(distro) || this.isIsoDistro(distro)
  }

  /** Get the distro source metadata (for guestOs lookup etc.) */
  getDistroSource(distro: string): DistroImageSource | null {
    return this.getAllSources()[distro] ?? null
  }

  /** Ensure a base image exists, downloading if needed. Returns path to base image. */
  async ensureImage(distro: string): Promise<string> {
    const source = this.getAllSources()[distro]
    if (!source) throw new Error(`Unsupported distro: ${distro}`)

    await mkdir(this.imagesDir, { recursive: true })
    const ext = source.format === 'qcow2' ? 'qcow2' : source.format
    const imagePath = join(this.imagesDir, `${distro}-base.${ext}`)

    try {
      await access(imagePath)
      const info = await stat(imagePath)
      if (info.size > 0) return imagePath
    } catch {
      // File doesn't exist, download it
    }

    await this.downloadImage(source.url, imagePath)
    return imagePath
  }

  /** Ensure a base image exists from an ad-hoc URL (for 'other' distro).
   *  Uses VM name as cache key — each ad-hoc VM gets its own base image.
   *  Reuses downloadImage() for http/https/file:// handling. */
  async ensureImageFromUrl(vmName: string, url: string, format: 'qcow2' | 'raw' | 'iso'): Promise<string> {
    await mkdir(this.imagesDir, { recursive: true })
    const ext = format === 'qcow2' ? 'qcow2' : format
    const imagePath = join(this.imagesDir, `adhoc-${vmName}-base.${ext}`)

    try {
      await access(imagePath)
      const info = await stat(imagePath)
      if (info.size > 0) return imagePath
    } catch {
      // File doesn't exist, download it
    }

    // Validate before downloading — prevents SSRF via user-supplied URL in workload definition.
    // file:// is rejected by validateExternalUrl (http/https only) but handled separately above.
    validateExternalUrl(url)
    await this.downloadImage(url, imagePath)
    return imagePath
  }

  /** Create a copy-on-write overlay disk for a specific VM.
   *  @param diskSizeGB — Disk size in GB (default: 10) */
  async createOverlay(name: string, baseImage: string, diskSizeGB = 10): Promise<string> {
    const vmDir = join(this.microvmsDir, name)
    await mkdir(vmDir, { recursive: true })
    const overlayPath = join(vmDir, 'disk.qcow2')

    // qemu-img resolves -b paths relative to the overlay, not CWD — use absolute path
    const absBaseImage = resolve(baseImage)
    await execFileAsync(this.qemuImgBin, [
      'create', '-f', 'qcow2', '-F', 'qcow2', '-b', absBaseImage, overlayPath,
    ])

    // Resize to give VMs usable disk space
    await execFileAsync(this.qemuImgBin, [
      'resize', overlayPath, `${diskSizeGB}G`,
    ])

    return overlayPath
  }

  /** Create a blank qcow2 disk for ISO-install VMs (no backing image) */
  async createBlankDisk(name: string, sizeGB: number): Promise<string> {
    const vmDir = join(this.microvmsDir, name)
    await mkdir(vmDir, { recursive: true })
    const diskPath = join(vmDir, 'disk.qcow2')

    await execFileAsync(this.qemuImgBin, [
      'create', '-f', 'qcow2', diskPath, `${sizeGB}G`,
    ])

    return diskPath
  }

  /** Generate a cloud-init ISO for VM configuration */
  async generateCloudInit(vm: WorkloadDefinition): Promise<string> {
    if (!this.bridgeGateway) {
      throw new Error('Cannot generate cloud-init: BRIDGE_GATEWAY not configured')
    }
    const vmDir = join(this.microvmsDir, vm.name)
    await mkdir(vmDir, { recursive: true })

    const metaData = `instance-id: ${vm.name}\nlocal-hostname: ${vm.name}\n`

    const networkConfig = `version: 2
ethernets:
  eth0:
    addresses:
      - ${vm.ip}/24
    gateway4: ${this.bridgeGateway}
    nameservers:
      addresses:
        - 1.1.1.1
        - 8.8.8.8
`

    const userData = `#cloud-config
hostname: ${vm.name}
manage_etc_hosts: true
ssh_pwauth: true
chpasswd:
  expire: false
  users:
    - name: root
      password: ${randomBytes(16).toString('base64url')}
      type: text
`

    const metaPath = join(vmDir, 'meta-data')
    const userPath = join(vmDir, 'user-data')
    const networkPath = join(vmDir, 'network-config')
    await writeFile(metaPath, metaData, 'utf-8')
    await writeFile(userPath, userData, 'utf-8')
    await writeFile(networkPath, networkConfig, 'utf-8')

    // Generate cloud-init ISO using genisoimage or mkisofs
    const isoPath = join(vmDir, 'cloud-init.iso')
    try {
      await execFileAsync('genisoimage', [
        '-output', isoPath,
        '-volid', 'cidata',
        '-joliet', '-rock',
        metaPath, userPath, networkPath,
      ])
    } catch {
      // Fallback to mkisofs if genisoimage not available
      await execFileAsync('mkisofs', [
        '-output', isoPath,
        '-volid', 'cidata',
        '-joliet', '-rock',
        metaPath, userPath, networkPath,
      ])
    }

    return isoPath
  }

  /** Allocate a deterministic console port for a VM (base 4000 + hash % 1000) */
  static allocateConsolePort(vmName: string, consoleType?: 'serial' | 'vnc'): number {
    let hash = 0
    for (let i = 0; i < vmName.length; i++) {
      hash = ((hash << 5) - hash + vmName.charCodeAt(i)) | 0
    }
    // VNC requires display = port - 5900 (must be >= 0), so desktop VMs use 5900-6899
    // Serial consoles use raw TCP ports in 4000-4999
    const base = consoleType === 'vnc' ? 5900 : 4000
    return base + (Math.abs(hash) % 1000)
  }

  /** Build QEMU command-line arguments for a QEMU VM */
  generateQemuArgs(vm: WorkloadDefinition, opts: {
    diskPath: string
    bootIso?: string
    cloudInitIso?: string
    qemuBin: string
    tapInterface: string
    macAddress: string
  }): { bin: string; args: string[] } {
    const isWindows = vm.guestOs === 'windows'

    const args = [
      '-name', vm.name,
      '-machine', 'q35,accel=kvm',
      '-cpu', 'host',
      '-m', String(vm.mem),
      '-smp', String(vm.vcpu),
    ]

    // Disk: IDE for Windows (no driver needed), VirtIO for Linux
    if (isWindows) {
      args.push('-drive', `file=${opts.diskPath},format=qcow2,if=ide`)
    } else {
      args.push('-drive', `file=${opts.diskPath},format=qcow2,if=virtio`)
    }

    // Cloud-init ISO (cloud-image path only)
    if (opts.cloudInitIso) {
      args.push('-drive', `file=${opts.cloudInitIso},format=raw,if=virtio,media=cdrom`)
    }

    // Boot ISO (ISO-install path: Linux ISOs, Windows ISOs)
    if (opts.bootIso) {
      args.push('-cdrom', opts.bootIso)
    }

    // Network: e1000 for Windows (no driver needed), VirtIO for Linux
    args.push('-netdev', `tap,id=net0,ifname=${opts.tapInterface},script=no,downscript=no`)
    if (isWindows) {
      args.push('-device', `e1000,netdev=net0,mac=${opts.macAddress}`)
    } else {
      args.push('-device', `virtio-net-pci,netdev=net0,mac=${opts.macAddress}`)
    }

    // Display: desktop (VGA+VNC) or server (serial console)
    if (vm.vmType === 'desktop') {
      const vncPort = vm.consolePort || ImageManager.allocateConsolePort(vm.name, 'vnc')
      args.push('-vga', 'virtio', '-vnc', `:${vncPort - 5900}`)
    } else {
      // Server mode: serial console via TCP socket for interactive access
      const port = vm.consolePort || ImageManager.allocateConsolePort(vm.name)
      args.push('-nographic', '-serial', `tcp:127.0.0.1:${port},server,nowait`)
    }

    return { bin: opts.qemuBin, args }
  }

  /** Download a file from URL to disk, or copy from local file:// path */
  private async downloadImage(url: string, dest: string): Promise<void> {
    if (url.startsWith('file://')) {
      const localPath = url.slice(7) // strip file://
      await access(localPath)
      const readStream = createReadStream(localPath)
      const writeStream = createWriteStream(dest)
      await pipeline(readStream, writeStream)
      return
    }
    const response = await this.followRedirects(url, 5)
    const fileStream = createWriteStream(dest)
    await pipeline(response, fileStream)
  }

  private followRedirects(url: string, maxRedirects: number): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const get = url.startsWith('https') ? httpsGet : httpGet
      get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'))
            return
          }
          this.followRedirects(res.headers.location, maxRedirects - 1)
            .then(resolve)
            .catch(reject)
          return
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
          return
        }
        resolve(res)
      }).on('error', reject)
    })
  }
}

export function createImageManager(config: DashboardConfig): ImageManager {
  return new ImageManager({
    dataDir: config.dataDir,
    microvmsDir: config.microvmsDir,
    qemuImgBin: config.qemuImgBin,
    bridgeGateway: config.bridgeGateway,
  })
}
