// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, writeFile, access, stat, rm } from 'node:fs/promises'
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
import {
  assertChecksumUrl,
  hashFile,
  normaliseExpected,
  parseChecksumFile,
  resolveRedirect,
  type DigestSpec,
} from './image-digest.js'
import { resolveGuestDevices, machineFlags, pflashArgs, tpmArgs, type FirmwarePlan, type TpmPaths } from './firmware.js'

const execFileAsync = promisify(execFile)

export interface DistroImageSource {
  url: string
  format: 'qcow2' | 'raw' | 'iso' | 'flake'
  cloudInit: boolean
  guestOs?: 'linux' | 'windows'
  /**
   * How this image's integrity is established.
   *
   * **Required, deliberately** — there is no optional-digest branch, because an entry that omits
   * it would download unverified while every sibling reported a successful verification, and
   * nothing in the output would distinguish the two. `flake` distros are the only exception and
   * they never reach this code: microvm.nix builds them, nothing is downloaded.
   */
  digest?: DigestSpec
}

/**
 * The distro catalog.
 *
 * Every downloadable entry carries a `digest`. Five read the checksum file the distro publishes
 * beside the image — it moves when the image is rebuilt, so it stays valid against the three URLs
 * that point at a moving target (`latest` / `current`). CirrOS is pinned instead, because its URL
 * names an immutable release and because CirrOS publishes only MD5SUMS, which is not an integrity
 * control against a chosen-prefix attacker. See services/image-digest.ts for the trust model and
 * for why pinning everything was rejected.
 *
 * All six URLs were confirmed reachable on 2026-08-23, which is how the Fedora entry was found to
 * be dead — see its note.
 */
const DISTRO_IMAGES: Record<string, DistroImageSource> = {
  // CirrOS is listed first — it's the default smoke test distro (~20 MB, no cloud-init)
  cirros: {
    // Was `http://` until 2026-08-23. It is the only catalog entry that had no transport
    // protection at all, which is half of why "TLS covers the images" was not true.
    url: 'https://download.cirros-cloud.net/0.6.2/cirros-0.6.2-x86_64-disk.img',
    format: 'qcow2',
    cloudInit: false,
    digest: {
      kind: 'pinned',
      algorithm: 'sha256',
      value: '07e44a73e54c94d988028515403c1ed762055e01b83a767edf3c2b387f78ce00',
      reason:
        'The URL names an immutable release directory (0.6.2/), so a pinned digest cannot go ' +
        'stale. CirrOS publishes only MD5SUMS — MD5 is not an integrity control against a ' +
        'chosen-prefix attacker — so this value was computed locally from the downloaded image ' +
        'on 2026-08-23 rather than taken from upstream — then cross-checked: our MD5 of those ' +
        'bytes matches upstream MD5SUMS (c8fc8077…1906), so the file that was hashed is the ' +
        'one CirrOS published.',
    },
  },
  arch: {
    url: 'https://geo.mirror.pkgbuild.com/images/latest/Arch-Linux-x86_64-cloudimg.qcow2',
    format: 'qcow2',
    cloudInit: true,
    digest: {
      kind: 'published',
      algorithm: 'sha256',
      url: 'https://geo.mirror.pkgbuild.com/images/latest/Arch-Linux-x86_64-cloudimg.qcow2.SHA256',
      filename: 'Arch-Linux-x86_64-cloudimg.qcow2',
    },
  },
  fedora: {
    // Was Fedora 42, which 404s: 42 is EOL and its Cloud images have left the primary mirrors.
    // Measured while wiring image integrity — a user choosing Fedora got a failed
    // provision, and nothing in the catalog could have told anyone. 44-1.7 is current.
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/44/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-44-1.7.x86_64.qcow2',
    format: 'qcow2',
    cloudInit: true,
    digest: {
      kind: 'published',
      // PGP-clearsigned, in BSD `SHA256 (name) = hex` form. The signature is not checked yet;
      // verifying it is the natural upgrade from here (image-digest.ts documents the boundary).
      algorithm: 'sha256',
      url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/44/Cloud/x86_64/images/Fedora-Cloud-44-1.7-x86_64-CHECKSUM',
      filename: 'Fedora-Cloud-Base-Generic-44-1.7.x86_64.qcow2',
    },
  },
  ubuntu: {
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
    format: 'qcow2',
    cloudInit: true,
    digest: {
      kind: 'published',
      algorithm: 'sha256',
      url: 'https://cloud-images.ubuntu.com/noble/current/SHA256SUMS',
      filename: 'noble-server-cloudimg-amd64.img',
    },
  },
  debian: {
    url: 'https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2',
    format: 'qcow2',
    cloudInit: true,
    digest: {
      kind: 'published',
      algorithm: 'sha512',
      url: 'https://cloud.debian.org/images/cloud/bookworm/latest/SHA512SUMS',
      filename: 'debian-12-generic-amd64.qcow2',
    },
  },
  alpine: {
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/generic_alpine-3.22.3-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    cloudInit: true,
    digest: {
      kind: 'published',
      algorithm: 'sha512',
      url: 'https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/generic_alpine-3.22.3-x86_64-bios-cloudinit-r0.qcow2.sha512',
      filename: 'generic_alpine-3.22.3-x86_64-bios-cloudinit-r0.qcow2',
    },
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

    await this.downloadImage(source.url, imagePath, source.digest)
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
    /** BIOS by default; a UEFI plan carries the OVMF pair (see services/firmware.ts). */
    firmware?: FirmwarePlan
    /** Path to virtio-win.iso. Attached only when the guest device model asks for it. */
    virtioIso?: string
    /** Emulated-TPM socket paths, when one is backing this VM. */
    tpm?: TpmPaths
  }): { bin: string; args: string[] } {
    const plan: FirmwarePlan = opts.firmware ?? { mode: 'bios' }
    const devices = resolveGuestDevices({
      guestOs: vm.guestOs,
      virtioDrivers: vm.virtioDrivers,
    })

    const args = [
      '-name', vm.name,
      '-machine', machineFlags(plan),
      '-cpu', 'host',
      '-m', String(vm.mem),
      '-smp', String(vm.vcpu),
      // OVMF CODE/VARS, before any other drive — QEMU numbers pflash units by position.
      ...pflashArgs(plan),
      ...tpmArgs(opts.tpm ?? null),
    ]

    // Disk + NIC models come from the one seam, so "virtio disk" and "driver ISO attached" can
    // never disagree. See services/firmware.ts for why that pairing is an iff and not a default.
    args.push('-drive', `file=${opts.diskPath},format=qcow2,if=${devices.diskInterface}`)

    // Cloud-init ISO (cloud-image path only)
    if (opts.cloudInitIso) {
      args.push('-drive', `file=${opts.cloudInitIso},format=raw,if=virtio,media=cdrom`)
    }

    // Boot ISO (ISO-install path: Linux ISOs, Windows ISOs)
    if (opts.bootIso) {
      args.push('-cdrom', opts.bootIso)
    }

    // VirtIO driver ISO — a SECOND CDROM, so it cannot displace the install media on -cdrom.
    // Windows Setup reads its storage driver from here before it can see a virtio disk.
    if (devices.attachVirtioIso && opts.virtioIso) {
      args.push('-drive', `file=${opts.virtioIso},format=raw,if=ide,media=cdrom`)
    }

    args.push('-netdev', `tap,id=net0,ifname=${opts.tapInterface},script=no,downscript=no`)
    args.push('-device', `${devices.netDevice},netdev=net0,mac=${opts.macAddress}`)

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
  private async downloadImage(url: string, dest: string, digest?: DigestSpec): Promise<void> {
    if (url.startsWith('file://')) {
      const localPath = url.slice(7) // strip file://
      await access(localPath)
      const readStream = createReadStream(localPath)
      const writeStream = createWriteStream(dest)
      await pipeline(readStream, writeStream)
      if (digest) await this.verifyDigest(dest, digest, url)
      return
    }

    // Resolve the EXPECTED digest before spending the download. A published checksum file that
    // is unreachable or unparseable must stop the run here, not after several hundred MB — and
    // must never degrade into "download it anyway, unverified", which is how a verification step
    // becomes decorative.
    const expected = digest ? await this.resolveExpected(digest) : null

    const response = await this.followRedirects(url, 5)
    const fileStream = createWriteStream(dest)
    await pipeline(response, fileStream)

    if (digest && expected) {
      const actual = await hashFile(dest, digest.algorithm)
      if (actual !== expected) {
        // DELETE the file, and that is the load-bearing half of this branch.
        //
        // ensureImage() short-circuits on `access(imagePath)` + size > 0, so a rejected image
        // left on disk is not merely useless: the NEXT call finds it, skips the download, skips
        // this check with it, and boots a guest off bytes that already failed verification once.
        // A refusal that leaves its evidence behind is a refusal that only works once.
        await rm(dest, { force: true })
        throw new Error(
          `image integrity check FAILED for ${url} — expected ${digest.algorithm} ${expected}, ` +
            `got ${actual}. The downloaded file has been deleted.`,
        )
      }
    }
  }

  /** Resolve a DigestSpec to the expected lowercase hex digest. Throws rather than degrading. */
  private async resolveExpected(digest: DigestSpec): Promise<string> {
    if (digest.kind === 'pinned') return normaliseExpected(digest.value, digest.algorithm)

    assertChecksumUrl(digest.url)
    const res = await this.followRedirects(digest.url, 5)
    const chunks: Buffer[] = []
    for await (const chunk of res) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString('utf-8')

    const found = parseChecksumFile(text, digest.algorithm, digest.filename)
    if (!found) {
      throw new Error(
        `checksum file ${digest.url} contains no ${digest.algorithm} entry for ` +
          `"${digest.filename}" — refusing to download unverified`,
      )
    }
    return normaliseExpected(found, digest.algorithm)
  }

  /** Verify an already-present file (the file:// path, where nothing was streamed from network). */
  private async verifyDigest(dest: string, digest: DigestSpec, url: string): Promise<void> {
    const expected = await this.resolveExpected(digest)
    const actual = await hashFile(dest, digest.algorithm)
    if (actual !== expected) {
      await rm(dest, { force: true })
      throw new Error(
        `image integrity check FAILED for ${url} — expected ${digest.algorithm} ${expected}, ` +
          `got ${actual}. The copied file has been deleted.`,
      )
    }
  }

  private followRedirects(url: string, maxRedirects: number, previous?: URL): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      // Policy lives in resolveRedirect (services/image-digest.ts) so it can be unit-tested
      // without a live server — see its docblock for the two refusals and how each used to fail.
      let target: URL
      try {
        target = previous
          ? resolveRedirect(url, previous, validateExternalUrl)
          : validateExternalUrl(url)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      const get = target.protocol === 'https:' ? httpsGet : httpGet
      get(target.href, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'))
            return
          }
          res.resume() // drain, or the socket is held open by an unread body
          this.followRedirects(res.headers.location, maxRedirects - 1, target)
            .then(resolve)
            .catch(reject)
          return
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} downloading ${target.href}`))
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
