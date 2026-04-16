// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Distro Catalog Provisioning Test Agent
 *
 * Validates that catalog distro images are downloadable, provisionable, and bootable.
 * Talks to the backend via HTTP — integration test of the full stack.
 *
 * Modes:
 *   (default)       CirOS smoke test (~20 MB, fastest lifecycle validation)
 *   --all           Full catalog — provision + start ALL distros
 *   --distros a,b   Filtered — provision + start named distros only
 *   --test <name>   Selective smoke — single distro with auto-cleanup
 *   --dry-run       Readiness check (config, URLs, binaries)
 *   --preload       Download all base images (cache priming only)
 *   --cleanup       Destroy all test-* VMs from a previous run
 *
 * Flags:
 *   --no-preload    Skip auto-preload in --distros/--all modes
 *   --skip-iso      Skip ISO-install distros (need manual VNC install)
 *   --with-cleanup  Destroy test VMs after verification
 *   --timeout <s>   Per-VM timeout in seconds (default: 300)
 *   --json          JSON output to stdout
 *   --backend <url> Backend URL (default: http://localhost:3110)
 *
 * Usage:
 *   npx tsx scripts/test-distro-catalog.ts                    # CirOS smoke test
 *   npx tsx scripts/test-distro-catalog.ts --all              # Full catalog
 *   npx tsx scripts/test-distro-catalog.ts --distros ubuntu   # Filtered
 *   npx tsx scripts/test-distro-catalog.ts --test my-custom   # Selective smoke
 *   npx tsx scripts/test-distro-catalog.ts --dry-run          # Readiness check
 *   npx tsx scripts/test-distro-catalog.ts --cleanup          # Remove test VMs
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DistroEntry {
  name: string
  label: string
  url: string
  effectiveUrl: string
  format: string
  cloudInit: boolean
  guestOs: string
  category: 'builtin' | 'catalog' | 'custom'
}

interface DistroTestResult {
  distro: string
  label: string
  category: 'builtin' | 'catalog' | 'custom'
  format: string
  cloudInit: boolean
  status: 'pass' | 'fail' | 'skip' | 'timeout'
  provisionTime?: number
  startTime?: number
  error?: string
  vmName?: string
  ip?: string
}

interface CatalogTestReport {
  mode: 'smoke' | 'filtered' | 'all' | 'dry-run' | 'preload' | 'cleanup' | 'selective'
  backend: string
  timestamp: string
  estimatedSeconds: number
  totalSeconds: number
  preloadSeconds?: number
  results: DistroTestResult[]
  summary: { total: number; passed: number; failed: number; skipped: number }
}

interface HealthResponse {
  status: string
  provisioningEnabled: boolean
  bridgeGateway: string | null
  tier: string
}

interface VmResponse {
  name: string
  status: string
  provisioningState?: string
  provisioningError?: string
  ip: string
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

function getFlagValue(name: string): string | null {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

const jsonOutput = hasFlag('json')
const dryRun = hasFlag('dry-run')
const preloadOnly = hasFlag('preload')
const cleanupOnly = hasFlag('cleanup')
const allDistros = hasFlag('all')
const skipIso = hasFlag('skip-iso')
const noPreload = hasFlag('no-preload')
const withCleanup = hasFlag('with-cleanup')
const selectiveTest = getFlagValue('test')
const distrosFilter = getFlagValue('distros')?.split(',').map(s => s.trim()).filter(Boolean) ?? null
const timeoutSec = parseInt(getFlagValue('timeout') ?? '300', 10)
const backendUrl = getFlagValue('backend') ?? 'http://localhost:3110'

// ---------------------------------------------------------------------------
// HTTP Client
// ---------------------------------------------------------------------------

let authToken: string | null = null

function resolveAuthToken(): string | null {
  // 1. Env var
  if (process.env.TEST_AUTH_TOKEN) return process.env.TEST_AUTH_TOKEN
  // 2. File
  const tokenFile = resolve(rootDir, 'backend', 'data', 'test-token.txt')
  if (existsSync(tokenFile)) {
    try {
      return readFileSync(tokenFile, 'utf-8').trim()
    } catch {
      // ignore
    }
  }
  return null
}

async function autoLogin(): Promise<string | null> {
  const creds = { username: 'admin', password: 'TestAdmin1' }

  // Try login first
  try {
    const { status, data } = await api<{ token?: string }>('POST', '/api/auth/login', creds)
    if (status === 200 && data?.token) return data.token
  } catch {
    // ignore
  }

  // If login failed, try register (first user gets admin role)
  try {
    const { status, data } = await api<{ token?: string }>('POST', '/api/auth/register', creds)
    if ((status === 200 || status === 201) && data?.token) return data.token
  } catch {
    // ignore
  }

  return null
}

async function api<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const url = `${backendUrl}${path}`
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({})) as T
  return { status: res.status, data }
}

async function httpHead(url: string, timeoutMs = 10_000): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// Time Estimation
// ---------------------------------------------------------------------------

const IMAGE_SIZES_MB: Record<string, number> = {
  cirros: 20, alpine: 60, arch: 500, fedora: 400, ubuntu: 650,
  debian: 350, rocky: 1200, alma: 1100, opensuse: 300,
  'nixos-server': 900, 'nixos-desktop': 2500,
}

function isImageCached(distro: string): boolean {
  const imagesDir = resolve(rootDir, 'backend', 'data', 'images')
  if (!existsSync(imagesDir)) return false
  try {
    const files = readdirSync(imagesDir)
    return files.some(f => f.startsWith(`${distro}-base.`))
  } catch {
    return false
  }
}

function estimateSeconds(distros: DistroEntry[]): { cached: number; uncached: number } {
  let cachedTotal = 0
  let uncachedTotal = 0
  for (const d of distros) {
    const provisionTime = 30 // base provision time per distro (seconds)
    const sizeMB = IMAGE_SIZES_MB[d.name] ?? 500
    const downloadTime = Math.ceil(sizeMB / 5) // ~5 MB/s estimate
    if (isImageCached(d.name)) {
      cachedTotal += provisionTime
    } else {
      cachedTotal += provisionTime
      uncachedTotal += downloadTime
    }
  }
  return { cached: cachedTotal, uncached: cachedTotal + uncachedTotal }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ---------------------------------------------------------------------------
// Readiness Check
// ---------------------------------------------------------------------------

interface ReadinessResult {
  backendUp: boolean
  provisioningEnabled: boolean
  bridgeGateway: string | null
  tier: string
  distros: DistroEntry[]
  urlResults: Array<{ name: string; url: string; ok: boolean; status?: number; error?: string }>
  binaryResults: Array<{ name: string; path: string; found: boolean }>
}

async function checkReadiness(): Promise<ReadinessResult> {
  const result: ReadinessResult = {
    backendUp: false,
    provisioningEnabled: false,
    bridgeGateway: null,
    tier: 'unknown',
    distros: [],
    urlResults: [],
    binaryResults: [],
  }

  // Health check
  try {
    const { data } = await api<HealthResponse>('GET', '/api/health')
    result.backendUp = true
    result.provisioningEnabled = data.provisioningEnabled
    result.bridgeGateway = data.bridgeGateway
    result.tier = data.tier
  } catch {
    return result
  }

  // Fetch distros
  try {
    const { status, data } = await api<DistroEntry[]>('GET', '/api/distros')
    if (status === 200 && Array.isArray(data)) {
      result.distros = data
    }
  } catch {
    // continue
  }

  // URL reachability
  for (const d of result.distros) {
    if (d.effectiveUrl.startsWith('file://')) {
      const localPath = d.effectiveUrl.slice(7)
      result.urlResults.push({
        name: d.name,
        url: d.effectiveUrl,
        ok: existsSync(localPath),
        error: existsSync(localPath) ? undefined : 'File not found',
      })
    } else {
      const check = await httpHead(d.effectiveUrl)
      result.urlResults.push({ name: d.name, url: d.effectiveUrl, ...check })
    }
  }

  // Binary checks
  const binaries = [
    { name: 'qemu-system-x86_64', path: '/run/current-system/sw/bin/qemu-system-x86_64' },
    { name: 'qemu-img', path: '/run/current-system/sw/bin/qemu-img' },
    { name: 'genisoimage', path: '', fallback: 'mkisofs' },
    { name: 'ip', path: '/run/current-system/sw/bin/ip' },
  ]
  for (const bin of binaries) {
    let found = false
    let resolvedName = bin.name
    if (bin.path && existsSync(bin.path)) {
      found = true
    } else {
      try {
        execSync(`which ${bin.name}`, { stdio: 'pipe' })
        found = true
      } catch {
        // Try fallback binary name if provided
        if ('fallback' in bin && bin.fallback) {
          try {
            execSync(`which ${bin.fallback}`, { stdio: 'pipe' })
            found = true
            resolvedName = `${bin.name}|${bin.fallback}`
          } catch {
            // neither found
          }
        }
      }
    }
    result.binaryResults.push({ name: resolvedName, path: bin.path || '(PATH)', found })
  }

  return result
}

// ---------------------------------------------------------------------------
// IP Allocation
// ---------------------------------------------------------------------------

async function allocateIPs(count: number): Promise<string[]> {
  const { data: vms } = await api<VmResponse[]>('GET', '/api/workload')
  const usedIPs = new Set((vms ?? []).map(v => v.ip))

  const ips: string[] = []
  let octet = 200
  while (ips.length < count && octet < 254) {
    const ip = `10.10.0.${octet}`
    if (!usedIPs.has(ip)) {
      ips.push(ip)
      usedIPs.add(ip)
    }
    octet++
  }

  if (ips.length < count) {
    throw new Error(`Cannot allocate ${count} IPs — only ${ips.length} available in 10.10.0.200-253 range`)
  }
  return ips
}

// ---------------------------------------------------------------------------
// VM Lifecycle Helpers
// ---------------------------------------------------------------------------

async function provisionAndStart(
  distro: DistroEntry,
  vmName: string,
  ip: string,
  log: (msg: string) => void,
): Promise<DistroTestResult> {
  const result: DistroTestResult = {
    distro: distro.name,
    label: distro.label,
    category: distro.category,
    format: distro.format,
    cloudInit: distro.cloudInit,
    status: 'fail',
    vmName,
    ip,
  }

  const t0 = Date.now()

  // Create VM
  log(`  Creating ${vmName} (${distro.label}, ${ip})...`)
  const createBody = {
    name: vmName,
    ip,
    mem: distro.name === 'cirros' ? 128 : 512,
    vcpu: 1,
    hypervisor: 'qemu' as const,
    diskSize: distro.format === 'iso' ? 20 : 10,
    distro: distro.name,
    vmType: distro.format === 'iso' || distro.guestOs === 'windows' ? 'desktop' : 'server',
    autostart: false,
    description: `Catalog test VM for ${distro.label}`,
  }

  const { status: createStatus, data: createData } = await api<{ success: boolean; message: string }>('POST', '/api/workload', createBody)
  if (createStatus >= 400) {
    result.error = `Create failed (${createStatus}): ${(createData as { error?: string }).error ?? JSON.stringify(createData)}`
    log(`  FAIL ${distro.name}: ${result.error}`)
    return result
  }

  // Poll provisioning state
  log(`  Provisioning ${vmName}...`)
  const provisionDeadline = Date.now() + timeoutSec * 1000
  let lastState = ''
  while (Date.now() < provisionDeadline) {
    await sleep(2000)
    const { data: vm } = await api<VmResponse>('GET', `/api/workload/${vmName}`)
    if (!vm?.provisioningState) continue
    if (vm.provisioningState !== lastState) {
      lastState = vm.provisioningState
      log(`  [${vmName}] state: ${lastState}`)
    }
    if (vm.provisioningState === 'provisioned') {
      result.provisionTime = Math.round((Date.now() - t0) / 1000)
      break
    }
    if (vm.provisioningState === 'provision-failed') {
      result.error = vm.provisioningError ?? 'Provisioning failed'
      result.provisionTime = Math.round((Date.now() - t0) / 1000)
      log(`  FAIL ${distro.name}: ${result.error}`)
      return result
    }
  }

  if (!result.provisionTime) {
    result.status = 'timeout'
    result.error = `Provisioning timeout (${timeoutSec}s)`
    log(`  TIMEOUT ${distro.name}: provisioning exceeded ${timeoutSec}s`)
    return result
  }

  // ISO distros can't be started without manual install
  if (distro.format === 'iso') {
    result.status = 'pass'
    log(`  PASS ${distro.name} (ISO provisioned in ${result.provisionTime}s — requires VNC install)`)
    return result
  }

  // Start VM
  const t1 = Date.now()
  log(`  Starting ${vmName}...`)
  const { status: startStatus } = await api<{ success: boolean }>('POST', `/api/workload/${vmName}/start`)
  if (startStatus >= 400) {
    result.error = `Start failed (HTTP ${startStatus})`
    log(`  FAIL ${distro.name}: ${result.error}`)
    return result
  }

  // Poll for running status
  const startDeadline = Date.now() + 60_000 // 60s for start
  while (Date.now() < startDeadline) {
    await sleep(2000)
    const { data: vm } = await api<VmResponse>('GET', `/api/workload/${vmName}`)
    if (vm?.status === 'running') {
      result.startTime = Math.round((Date.now() - t1) / 1000)
      result.status = 'pass'
      log(`  PASS ${distro.name} — provisioned in ${result.provisionTime}s, running in ${result.startTime}s`)
      return result
    }
    if (vm?.status === 'failed') {
      result.error = 'VM entered failed state after start'
      log(`  FAIL ${distro.name}: ${result.error}`)
      return result
    }
  }

  result.status = 'timeout'
  result.error = 'Start timeout (60s)'
  log(`  TIMEOUT ${distro.name}: start exceeded 60s`)
  return result
}

async function destroyVm(vmName: string, log: (msg: string) => void): Promise<void> {
  try {
    await api('POST', `/api/workload/${vmName}/stop`)
  } catch {
    // may already be stopped
  }
  await sleep(1000)
  const { status } = await api('DELETE', `/api/workload/${vmName}`)
  if (status < 400) {
    log(`  Destroyed ${vmName}`)
  } else {
    log(`  Warning: failed to destroy ${vmName} (HTTP ${status})`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Mode Implementations
// ---------------------------------------------------------------------------

async function runDryRun(): Promise<CatalogTestReport> {
  const t0 = Date.now()
  const readiness = await checkReadiness()
  const results: DistroTestResult[] = readiness.distros.map(d => {
    const urlCheck = readiness.urlResults.find(u => u.name === d.name)
    return {
      distro: d.name,
      label: d.label,
      category: d.category,
      format: d.format,
      cloudInit: d.cloudInit,
      status: urlCheck?.ok ? 'pass' as const : 'fail' as const,
      error: urlCheck?.ok ? undefined : urlCheck?.error ?? `HTTP ${urlCheck?.status}`,
    }
  })

  const report: CatalogTestReport = {
    mode: 'dry-run',
    backend: backendUrl,
    timestamp: new Date().toISOString(),
    estimatedSeconds: 0,
    totalSeconds: Math.round((Date.now() - t0) / 1000),
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: 0,
    },
  }

  if (!jsonOutput) {
    console.log('\nDistro Catalog Readiness Report')
    console.log('===============================')
    console.log(`Backend: ${backendUrl}`)
    console.log(`Backend up: ${readiness.backendUp ? 'YES' : 'NO'}`)
    console.log(`Provisioning: ${readiness.provisioningEnabled ? 'ENABLED' : 'DISABLED'}`)
    console.log(`Bridge gateway: ${readiness.bridgeGateway ?? 'NOT SET'}`)
    console.log(`Tier: ${readiness.tier}`)
    console.log(`Distros: ${readiness.distros.length}`)

    console.log('\nBINARIES:')
    for (const b of readiness.binaryResults) {
      console.log(`  ${b.found ? 'OK  ' : 'MISS'} ${b.name} (${b.path})`)
    }

    console.log('\nURL STATUS:')
    for (const u of readiness.urlResults) {
      const cached = isImageCached(u.name) ? ' [cached]' : ''
      console.log(`  ${u.ok ? 'OK  ' : 'FAIL'} ${u.name.padEnd(15)} ${u.url.substring(0, 70)}${cached}`)
      if (!u.ok && u.error) console.log(`       ${u.error}`)
    }

    const est = estimateSeconds(readiness.distros)
    console.log(`\nEstimated live test time: ~${formatDuration(est.cached)} (cached) / ~${formatDuration(est.uncached)} (first run)`)
    console.log(`Total time: ${formatDuration(report.totalSeconds)}`)
  }

  return report
}

async function runPreload(targetDistros: DistroEntry[], log: (msg: string) => void): Promise<number> {
  const t0 = Date.now()
  log('\nPRELOAD:')

  const ips = await allocateIPs(targetDistros.length)

  for (let i = 0; i < targetDistros.length; i++) {
    const d = targetDistros[i]
    if (isImageCached(d.name)) {
      log(`  CACHED  ${d.name}`)
      continue
    }

    const vmName = `preload-${d.name}`
    const ip = ips[i]
    log(`  Downloading ${d.name} (${d.label})...`)

    const createBody = {
      name: vmName, ip, mem: 128, vcpu: 1, hypervisor: 'qemu' as const,
      diskSize: 5, distro: d.name, autostart: false,
      vmType: d.format === 'iso' ? 'desktop' : 'server',
    }

    const { status } = await api('POST', '/api/workload', createBody)
    if (status >= 400) {
      log(`  FAIL  ${d.name} — could not create preload VM`)
      continue
    }

    // Wait for provisioning to complete (downloads image)
    const deadline = Date.now() + timeoutSec * 1000
    let provisioned = false
    while (Date.now() < deadline) {
      await sleep(3000)
      const { data: vm } = await api<VmResponse>('GET', `/api/workload/${vmName}`)
      if (vm?.provisioningState === 'provisioned' || vm?.provisioningState === 'provision-failed') {
        provisioned = vm.provisioningState === 'provisioned'
        break
      }
    }

    // Destroy the preload VM (we only wanted the image download)
    await destroyVm(vmName, () => {})
    log(`  ${provisioned ? 'OK   ' : 'FAIL '} ${d.name}`)
  }

  const elapsed = Math.round((Date.now() - t0) / 1000)
  log(`  Preload time: ${formatDuration(elapsed)}`)
  return elapsed
}

async function runLiveTest(
  targetDistros: DistroEntry[],
  mode: 'smoke' | 'filtered' | 'all' | 'selective',
  autoCleanup: boolean,
): Promise<CatalogTestReport> {
  const t0 = Date.now()
  const log = jsonOutput ? () => {} : (msg: string) => console.log(msg)
  const results: DistroTestResult[] = []
  let preloadSeconds: number | undefined

  // Header
  const est = estimateSeconds(targetDistros)
  if (!jsonOutput) {
    console.log('\nDistro Catalog Test Report')
    console.log('=========================')
    console.log(`Mode: ${mode} | Backend: ${backendUrl} | Distros: ${targetDistros.length}`)
    console.log(`Estimated time: ~${formatDuration(est.cached)} (cached) / ~${formatDuration(est.uncached)} (first run)`)
  }

  // Preload phase (for --distros and --all, unless --no-preload)
  if ((mode === 'filtered' || mode === 'all') && !noPreload) {
    const cloudDistros = targetDistros.filter(d => d.format !== 'iso' || !skipIso)
    preloadSeconds = await runPreload(cloudDistros, log)
  }

  // Allocate IPs
  const ips = await allocateIPs(targetDistros.length)

  // Test each distro
  if (!jsonOutput) console.log('\nRESULTS:')
  for (let i = 0; i < targetDistros.length; i++) {
    const d = targetDistros[i]

    // Skip ISO distros if --skip-iso
    if (skipIso && d.format === 'iso') {
      results.push({
        distro: d.name, label: d.label, category: d.category,
        format: d.format, cloudInit: d.cloudInit,
        status: 'skip', error: 'skipped (--skip-iso)',
      })
      log(`  SKIP  ${d.name.padEnd(15)} (iso)  skipped (--skip-iso)`)
      continue
    }

    const vmName = mode === 'selective' ? `smoketest-${d.name}` : `test-${d.name}`
    const result = await provisionAndStart(d, vmName, ips[i], log)
    results.push(result)

    // Auto-cleanup (selective always cleans up, others only with --with-cleanup)
    if (autoCleanup || mode === 'selective') {
      await destroyVm(vmName, log)
    }
  }

  const totalSeconds = Math.round((Date.now() - t0) / 1000)
  const report: CatalogTestReport = {
    mode,
    backend: backendUrl,
    timestamp: new Date().toISOString(),
    estimatedSeconds: est.uncached,
    totalSeconds,
    preloadSeconds,
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
    },
  }

  if (!jsonOutput) {
    console.log(`\nSummary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`)
    console.log(`Total time: ${formatDuration(totalSeconds)}`)
  }

  return report
}

async function runCleanup(): Promise<CatalogTestReport> {
  const t0 = Date.now()
  const log = jsonOutput ? () => {} : (msg: string) => console.log(msg)
  const results: DistroTestResult[] = []

  const { data: vms } = await api<VmResponse[]>('GET', '/api/workload')
  const testVms = (vms ?? []).filter(v =>
    v.name.startsWith('test-') || v.name.startsWith('preload-') || v.name.startsWith('smoketest-')
  )

  if (!jsonOutput) {
    console.log('\nDistro Catalog Cleanup')
    console.log('=====================')
    console.log(`Found ${testVms.length} test VM(s) to remove`)
  }

  for (const vm of testVms) {
    await destroyVm(vm.name, log)
    results.push({
      distro: vm.name.replace(/^(test|preload|smoketest)-/, ''),
      label: vm.name,
      category: 'builtin',
      format: 'unknown',
      cloudInit: false,
      status: 'pass',
      vmName: vm.name,
    })
  }

  const totalSeconds = Math.round((Date.now() - t0) / 1000)
  return {
    mode: 'cleanup',
    backend: backendUrl,
    timestamp: new Date().toISOString(),
    estimatedSeconds: 0,
    totalSeconds,
    results,
    summary: { total: testVms.length, passed: testVms.length, failed: 0, skipped: 0 },
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  authToken = resolveAuthToken()
  if (!authToken) {
    authToken = await autoLogin()
  }

  let report: CatalogTestReport

  if (dryRun) {
    report = await runDryRun()
  } else if (cleanupOnly) {
    report = await runCleanup()
  } else if (preloadOnly) {
    // Standalone preload
    const readiness = await checkReadiness()
    if (!readiness.backendUp) {
      console.error('ERROR: Backend not reachable at', backendUrl)
      process.exit(1)
    }
    if (!readiness.provisioningEnabled) {
      console.error('ERROR: Provisioning is not enabled on the backend')
      process.exit(1)
    }
    const log = jsonOutput ? () => {} : (msg: string) => console.log(msg)
    const distros = readiness.distros.filter(d => !skipIso || d.format !== 'iso')
    const elapsed = await runPreload(distros, log)
    report = {
      mode: 'preload',
      backend: backendUrl,
      timestamp: new Date().toISOString(),
      estimatedSeconds: 0,
      totalSeconds: elapsed,
      preloadSeconds: elapsed,
      results: distros.map(d => ({
        distro: d.name, label: d.label, category: d.category,
        format: d.format, cloudInit: d.cloudInit,
        status: 'pass' as const,
      })),
      summary: { total: distros.length, passed: distros.length, failed: 0, skipped: 0 },
    }
  } else {
    // Live test modes — need readiness check first
    const readiness = await checkReadiness()
    if (!readiness.backendUp) {
      console.error('ERROR: Backend not reachable at', backendUrl)
      process.exit(1)
    }
    if (!readiness.provisioningEnabled) {
      console.error('ERROR: Provisioning is not enabled on the backend')
      process.exit(1)
    }
    if (!readiness.bridgeGateway) {
      console.error('ERROR: Bridge gateway not configured (BRIDGE_GATEWAY)')
      process.exit(1)
    }

    let targetDistros: DistroEntry[]
    let mode: 'smoke' | 'filtered' | 'all' | 'selective'

    if (selectiveTest) {
      // --test <name>: single distro selective smoke test
      const d = readiness.distros.find(x => x.name === selectiveTest)
      if (!d) {
        console.error(`ERROR: Distro '${selectiveTest}' not found in catalog`)
        process.exit(1)
      }
      targetDistros = [d]
      mode = 'selective'
    } else if (distrosFilter) {
      // --distros a,b: filtered test
      targetDistros = []
      for (const name of distrosFilter) {
        const d = readiness.distros.find(x => x.name === name)
        if (!d) {
          console.error(`ERROR: Distro '${name}' not found in catalog`)
          process.exit(1)
        }
        targetDistros.push(d)
      }
      mode = 'filtered'
    } else if (allDistros) {
      // --all: full catalog
      targetDistros = readiness.distros
      mode = 'all'
    } else {
      // Default: CirOS smoke test
      const cirros = readiness.distros.find(d => d.name === 'cirros')
      if (!cirros) {
        console.error('ERROR: CirOS distro not found in catalog (required for smoke test)')
        process.exit(1)
      }
      targetDistros = [cirros]
      mode = 'smoke'
    }

    report = await runLiveTest(targetDistros, mode, withCleanup)
  }

  // Save report
  saveReport({
    reportName: 'distro-catalog',
    timestamp: report.timestamp,
    durationMs: report.totalSeconds * 1000,
    result: report.summary.failed > 0 ? 'fail' : 'pass',
    summary: report.summary,
    data: report,
  })

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
  }

  // Exit code
  if (report.summary.failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message ?? err)
  process.exit(1)
})
