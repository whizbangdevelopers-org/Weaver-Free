// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import {
  cpus, totalmem, freemem, hostname, arch, release, uptime, loadavg,
  networkInterfaces as osNetworkInterfaces,
} from 'node:os'
import { promisify } from 'node:util'
import type {
  BasicHostInfo, BasicLiveMetrics, DetailedHostInfo, CpuTopology, DiskUsage, NetworkInterface,
} from '../schemas/host.js'
import { TIERS } from '../constants/vocabularies.js'

const execFileAsync = promisify(execFile)

export interface HostInfoConfig {
  lscpuBin: string
  dfBin: string
  ipBin: string
  nixosVersionBin: string
  isDemo: boolean
}

// ── Parser functions (exported for unit testing) ──────────────────────

export function parseLscpu(stdout: string): CpuTopology {
  const lines = new Map<string, string>()
  for (const line of stdout.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    lines.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
  }

  const toInt = (key: string): number | null => {
    const v = lines.get(key)
    if (!v) return null
    const n = parseInt(v, 10)
    return Number.isNaN(n) ? null : n
  }

  return {
    sockets: toInt('Socket(s)'),
    coresPerSocket: toInt('Core(s) per socket'),
    threadsPerCore: toInt('Thread(s) per core'),
    virtualizationType: lines.get('Virtualization') ?? null,
    l1dCache: lines.get('L1d cache') ?? null,
    l1iCache: lines.get('L1i cache') ?? null,
    l2Cache: lines.get('L2 cache') ?? null,
    l3Cache: lines.get('L3 cache') ?? null,
  }
}

const FILTERED_FS = new Set(['tmpfs', 'devtmpfs', 'efivarfs', 'none'])

export function parseDf(stdout: string): DiskUsage[] {
  const lines = stdout.trim().split('\n')
  if (lines.length < 2) return []

  const result: DiskUsage[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/)
    if (parts.length < 6) continue
    const filesystem = parts[0]
    if (FILTERED_FS.has(filesystem)) continue

    const pctStr = parts[4].replace('%', '')
    const pct = parseInt(pctStr, 10)
    result.push({
      filesystem,
      sizeHuman: parts[1],
      usedHuman: parts[2],
      availHuman: parts[3],
      usePercent: Number.isNaN(pct) ? 0 : pct,
      mountPoint: parts[5],
    })
  }
  return result
}

const FILTERED_IFACE = new Set(['lo'])
const FILTERED_IFACE_PREFIX = ['tap-', 'veth']

export function parseIpLink(stdout: string): NetworkInterface[] {
  const result: NetworkInterface[] = []
  const blocks = stdout.split(/(?=^\d+:)/m)

  for (const block of blocks) {
    if (!block.trim()) continue

    // Line format: "2: eth0: <FLAGS> mtu 1500 qdisc fq state UP ..."
    const nameMatch = block.match(/^\d+:\s+(\S+?):\s+<([^>]*)>/)
    if (!nameMatch) continue

    const name = nameMatch[1]
    if (FILTERED_IFACE.has(name)) continue
    if (FILTERED_IFACE_PREFIX.some(p => name.startsWith(p))) continue

    // State may appear anywhere in the first line after the flags
    const stateMatch = block.match(/\bstate\s+(\S+)/i)
    const stateStr = stateMatch?.[1]?.toUpperCase() ?? 'UNKNOWN'
    const state = stateStr === 'UP' ? 'UP'
      : stateStr === 'DOWN' ? 'DOWN'
      : 'UNKNOWN'

    const macMatch = block.match(/link\/ether\s+([0-9a-f:]+)/i)

    result.push({
      name,
      state,
      macAddress: macMatch?.[1] ?? null,
    })
  }
  return result
}

/** Return the first non-internal IPv4 address, or null. */
function getPrimaryIp(): string | null {
  const ifaces = osNetworkInterfaces()
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return null
}

// ── Mock data for demo mode ───────────────────────────────────────────

const MOCK_BASIC: BasicHostInfo = {
  hostname: 'demo-host',
  ipAddress: '192.168.1.100',
  arch: 'x86_64',
  cpuModel: 'Intel Core i7-12700K (demo)',
  cpuCount: 16,
  totalMemMb: 32768,
  kernelVersion: '6.1.0-nixos',
  uptimeSeconds: 604800,
  kvmAvailable: true,
  liveMetrics: {
    cpuUsagePercent: 34,
    freeMemMb: 10240,
    rootDiskUsedGb: 120,
    rootDiskTotalGb: 500,
    rootDiskUsedPercent: 24,
    netRxBytesPerSec: 12_400_000,
    netTxBytesPerSec: 3_100_000,
    loadAvg1: 1.24,
    loadAvg5: 0.98,
    loadAvg15: 0.72,
  },
}

const MOCK_DETAILED: DetailedHostInfo = {
  nixosVersion: '25.11.717285 (demo)',
  cpuTopology: {
    sockets: 1, coresPerSocket: 8, threadsPerCore: 2,
    virtualizationType: 'VT-x',
    l1dCache: '384 KiB', l1iCache: '256 KiB', l2Cache: '12 MiB', l3Cache: '25 MiB',
  },
  diskUsage: [
    { filesystem: '/dev/sda1', sizeHuman: '100G', usedHuman: '42G', availHuman: '58G', usePercent: 42, mountPoint: '/' },
    { filesystem: '/dev/sdb1', sizeHuman: '500G', usedHuman: '180G', availHuman: '320G', usePercent: 36, mountPoint: '/var' },
  ],
  networkInterfaces: [
    { name: 'eth0', state: 'UP', macAddress: 'aa:bb:cc:dd:ee:ff' },
    { name: 'br-microvm', state: 'UP', macAddress: '02:00:00:00:00:01' },
  ],
  liveMetrics: { freeMemMb: 18432, loadAvg1: 1.2, loadAvg5: 0.9, loadAvg15: 0.7 },
}

// ── Service ───────────────────────────────────────────────────────────

interface ProcStatSample { busy: number; total: number }
interface NetSample { rxBytes: number; txBytes: number; timestamp: number }

export class HostInfoService {
  private config: HostInfoConfig
  private staticCache: Omit<BasicHostInfo, 'uptimeSeconds' | 'kvmAvailable' | 'liveMetrics'> | null = null
  private detailedCache: { data: DetailedHostInfo; expiresAt: number } | null = null
  private prevCpuSample: ProcStatSample | null = null
  private prevNetSample: NetSample | null = null

  constructor(config: HostInfoConfig) {
    this.config = config
  }

  async getBasicInfo(): Promise<BasicHostInfo> {
    if (this.config.isDemo) return { ...MOCK_BASIC }

    // Cache static fields (only change on reboot)
    if (!this.staticCache) {
      const cpuList = cpus()
      this.staticCache = {
        hostname: hostname(),
        ipAddress: getPrimaryIp(),
        arch: arch() === 'x64' ? 'x86_64' : arch(),
        cpuModel: cpuList[0]?.model?.trim() ?? 'Unknown',
        cpuCount: cpuList.length,
        totalMemMb: Math.round(totalmem() / 1024 / 1024),
        kernelVersion: release(),
      }
    }

    const kvmAvailable = await access('/dev/kvm').then(() => true).catch(() => false)
    const liveMetrics = await this.getLiveMetrics()

    return {
      ...this.staticCache,
      uptimeSeconds: Math.floor(uptime()),
      kvmAvailable,
      liveMetrics,
    }
  }

  private async getLiveMetrics(): Promise<BasicLiveMetrics> {
    const [cpuUsagePercent, rootDisk, netRates] = await Promise.all([
      this.getCpuPercent(),
      this.getRootDisk(),
      this.getNetRates(),
    ])
    const [load1, load5, load15] = loadavg()
    return {
      cpuUsagePercent,
      freeMemMb: Math.round(freemem() / 1024 / 1024),
      rootDiskUsedGb: rootDisk.usedGb,
      rootDiskTotalGb: rootDisk.totalGb,
      rootDiskUsedPercent: rootDisk.usedPercent,
      netRxBytesPerSec: netRates.rxBytesPerSec,
      netTxBytesPerSec: netRates.txBytesPerSec,
      loadAvg1: Math.round(load1 * 100) / 100,
      loadAvg5: Math.round(load5 * 100) / 100,
      loadAvg15: Math.round(load15 * 100) / 100,
    }
  }

  private async getCpuPercent(): Promise<number> {
    try {
      const content = await readFile('/proc/stat', 'utf8')
      const line = content.split('\n')[0] ?? ''
      const parts = line.trim().split(/\s+/)
      // cpu user nice system idle iowait irq softirq steal
      const user    = parseInt(parts[1] ?? '0', 10) || 0
      const nice    = parseInt(parts[2] ?? '0', 10) || 0
      const system  = parseInt(parts[3] ?? '0', 10) || 0
      const idle    = parseInt(parts[4] ?? '0', 10) || 0
      const iowait  = parseInt(parts[5] ?? '0', 10) || 0
      const irq     = parseInt(parts[6] ?? '0', 10) || 0
      const softirq = parseInt(parts[7] ?? '0', 10) || 0
      const steal   = parseInt(parts[8] ?? '0', 10) || 0
      const busy = user + nice + system + irq + softirq + steal
      const total = busy + idle + iowait
      const prev = this.prevCpuSample
      this.prevCpuSample = { busy, total }
      if (!prev || total === prev.total) return 0
      const deltaBusy = busy - prev.busy
      const deltaTotal = total - prev.total
      if (deltaTotal <= 0) return 0
      return Math.min(100, Math.round((deltaBusy / deltaTotal) * 100))
    } catch {
      return 0
    }
  }

  private async getRootDisk(): Promise<{ usedGb: number; totalGb: number; usedPercent: number }> {
    try {
      const { stdout } = await execFileAsync(this.config.dfBin, ['-k', '/'], { timeout: 5_000 })
      const lines = stdout.trim().split('\n')
      if (lines.length < 2) return { usedGb: 0, totalGb: 0, usedPercent: 0 }
      const parts = lines[1].split(/\s+/)
      // df -k: Filesystem 1K-blocks Used Available Use% Mounted
      const totalKb = parseInt(parts[1] ?? '0', 10) || 0
      const usedKb  = parseInt(parts[2] ?? '0', 10) || 0
      const pctStr  = (parts[4] ?? '0').replace('%', '')
      return {
        totalGb: Math.round(totalKb / 1024 / 1024),
        usedGb:  Math.round(usedKb  / 1024 / 1024),
        usedPercent: parseInt(pctStr, 10) || 0,
      }
    } catch {
      return { usedGb: 0, totalGb: 0, usedPercent: 0 }
    }
  }

  private async getNetRates(): Promise<{ rxBytesPerSec: number; txBytesPerSec: number }> {
    try {
      const content = await readFile('/proc/net/dev', 'utf8')
      let totalRx = 0, totalTx = 0
      for (const line of content.split('\n').slice(2)) {
        if (!line.trim()) continue
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) continue
        const iface = line.slice(0, colonIdx).trim()
        if (iface === 'lo') continue
        const parts = line.slice(colonIdx + 1).trim().split(/\s+/)
        totalRx += parseInt(parts[0] ?? '0', 10) || 0
        totalTx += parseInt(parts[8] ?? '0', 10) || 0
      }
      const now = Date.now()
      const prev = this.prevNetSample
      this.prevNetSample = { rxBytes: totalRx, txBytes: totalTx, timestamp: now }
      if (!prev) return { rxBytesPerSec: 0, txBytesPerSec: 0 }
      const elapsedSec = (now - prev.timestamp) / 1000
      if (elapsedSec <= 0) return { rxBytesPerSec: 0, txBytesPerSec: 0 }
      return {
        rxBytesPerSec: Math.round((totalRx - prev.rxBytes) / elapsedSec),
        txBytesPerSec: Math.round((totalTx - prev.txBytes) / elapsedSec),
      }
    } catch {
      return { rxBytesPerSec: 0, txBytesPerSec: 0 }
    }
  }

  async getDetailedInfo(): Promise<DetailedHostInfo> {
    if (this.config.isDemo) return { ...MOCK_DETAILED }

    const now = Date.now()
    if (this.detailedCache && now < this.detailedCache.expiresAt) {
      return this.detailedCache.data
    }

    const [nixosVersion, cpuTopology, diskUsage, networkInterfaces] = await Promise.allSettled([
      this.getNixosVersion(),
      this.getLscpuTopology(),
      this.getDiskUsage(),
      this.getNetworkInterfaces(),
    ])

    const [load1, load5, load15] = loadavg()

    const data: DetailedHostInfo = {
      nixosVersion: nixosVersion.status === 'fulfilled' ? nixosVersion.value : null,
      cpuTopology: cpuTopology.status === 'fulfilled' ? cpuTopology.value : null,
      diskUsage: diskUsage.status === 'fulfilled' ? diskUsage.value : [],
      networkInterfaces: networkInterfaces.status === 'fulfilled' ? networkInterfaces.value : [],
      liveMetrics: {
        freeMemMb: Math.round(freemem() / 1024 / 1024),
        loadAvg1: load1,
        loadAvg5: load5,
        loadAvg15: load15,
      },
    }

    this.detailedCache = { data, expiresAt: now + 60_000 }
    return data
  }

  private async getNixosVersion(): Promise<string> {
    const { stdout } = await execFileAsync(this.config.nixosVersionBin, [], { timeout: 5_000 })
    return stdout.trim()
  }

  private async getLscpuTopology(): Promise<CpuTopology> {
    const { stdout } = await execFileAsync(this.config.lscpuBin, [], { timeout: 5_000 })
    return parseLscpu(stdout)
  }

  private async getDiskUsage(): Promise<DiskUsage[]> {
    const { stdout } = await execFileAsync(this.config.dfBin, ['-h'], { timeout: 5_000 })
    return parseDf(stdout)
  }

  private async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    const { stdout } = await execFileAsync(this.config.ipBin, ['link', 'show'], { timeout: 5_000 })
    return parseIpLink(stdout)
  }
}
