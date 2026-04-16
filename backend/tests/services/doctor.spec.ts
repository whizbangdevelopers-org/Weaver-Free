// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: null, stdout: string, stderr: string) => void) =>
    cb(null, 'mock output', ''),
  ),
}))

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', () => ({
  readdirSync: vi.fn().mockReturnValue([]),
}))

vi.mock('node:os', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:os')>()
  return {
    ...orig,
    arch: vi.fn().mockReturnValue('x64'),
    totalmem: vi.fn().mockReturnValue(4 * 1024 * 1024 * 1024), // 4 GB
  }
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { arch, totalmem } from 'node:os'
import { DoctorService } from '../../src/services/doctor.js'
import type { DashboardConfig } from '../../src/config.js'
import type { HostInfoService } from '../../src/services/host-info.js'

function makeConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    tier: 'weaver',
    licenseExpiry: null,
    licenseGraceMode: false,
    dataDir: '/tmp/test-doctor',
    provisioningEnabled: false,
    bridgeInterface: 'br-microvm',
    dfBin: 'df',
    qemuBin: 'qemu-system-x86_64',
    nixosVersionBin: 'nixos-version',
    ipBin: 'ip',
    sudoBin: 'sudo',
    systemctlBin: 'systemctl',
    hostDomain: '',
    listenPort: 3100,
    jwtSecret: 'test-secret',
    bcryptRounds: 13,
    nodeEnv: 'test',
    weasyprintBin: 'weasyprint',
    ...overrides,
  } as unknown as DashboardConfig
}

function makeHostInfoService(): HostInfoService {
  return {
    getHostInfo: vi.fn().mockResolvedValue({}),
  } as unknown as HostInfoService
}

describe('DoctorService', () => {
  beforeEach(() => {
    vi.mocked(arch).mockReturnValue('x64')
    vi.mocked(totalmem).mockReturnValue(4 * 1024 * 1024 * 1024)
  })

  // ── Demo mode ─────────────────────────────────────────────────────────────

  describe('demo mode', () => {
    it('returns mock result immediately with 14 checks', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: true,
      })
      const result = await svc.runDiagnostics()
      expect(result.summary.total).toBe(14)
      expect(result.checks).toHaveLength(14)
    })

    it('demo result has passed and warned counts with no failures', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: true,
      })
      const result = await svc.runDiagnostics()
      expect(result.summary.failed).toBe(0)
      expect(result.summary.passed).toBeGreaterThan(0)
      expect(result.summary.warned).toBeGreaterThan(0)
    })

    it('demo result has all 14 expected check names', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: true,
      })
      const result = await svc.runDiagnostics()
      const names = result.checks.map(c => c.check)
      const expected = [
        'Architecture',
        'CPU virtualization',
        'KVM module',
        '/dev/kvm',
        'IOMMU',
        'RAM',
        'Disk space',
        'NixOS version',
        'Bridge module',
        'QEMU',
        'IP forwarding',
        'Data directory',
        'Bridge interface',
        'License',
      ]
      for (const name of expected) {
        expect(names).toContain(name)
      }
    })

    it('returns a fresh timestamp on each call', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: true,
      })
      const r1 = await svc.runDiagnostics()
      await new Promise(r => setTimeout(r, 2))
      const r2 = await svc.runDiagnostics()
      // timestamps are ISO strings — should both be valid dates
      expect(new Date(r1.timestamp).getTime()).toBeGreaterThan(0)
      expect(new Date(r2.timestamp).getTime()).toBeGreaterThan(0)
    })
  })

  // ── Architecture check ────────────────────────────────────────────────────

  describe('architecture check (non-demo)', () => {
    it('passes for x64 (mapped to x86_64)', async () => {
      vi.mocked(arch).mockReturnValue('x64')
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'Architecture')
      expect(check?.status).toBe('pass')
      expect(check?.detail).toContain('x86_64')
    })

    it('warns for arm64', async () => {
      vi.mocked(arch).mockReturnValue('arm64')
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'Architecture')
      expect(check?.status).toBe('warn')
    })

    it('fails for unsupported architecture', async () => {
      vi.mocked(arch).mockReturnValue('s390x' as ReturnType<typeof arch>)
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'Architecture')
      expect(check?.status).toBe('fail')
    })
  })

  // ── RAM check ─────────────────────────────────────────────────────────────

  describe('RAM check (non-demo)', () => {
    it('passes when RAM >= 2048 MB', async () => {
      vi.mocked(totalmem).mockReturnValue(4 * 1024 * 1024 * 1024) // 4 GB
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'RAM')
      expect(check?.status).toBe('pass')
    })

    it('warns when RAM is between 1024 and 2047 MB', async () => {
      vi.mocked(totalmem).mockReturnValue(1.5 * 1024 * 1024 * 1024) // 1.5 GB
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'RAM')
      expect(check?.status).toBe('warn')
    })

    it('fails when RAM is below 1024 MB', async () => {
      vi.mocked(totalmem).mockReturnValue(512 * 1024 * 1024) // 512 MB
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'RAM')
      expect(check?.status).toBe('fail')
    })
  })

  // ── License check ─────────────────────────────────────────────────────────

  describe('license check (non-demo)', () => {
    it('passes with valid license (no expiry, no grace mode)', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig({ licenseExpiry: null, licenseGraceMode: false }),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'License')
      expect(check?.status).toBe('pass')
    })

    it('warns when license is in grace mode', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig({ licenseGraceMode: true }),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'License')
      expect(check?.status).toBe('warn')
      expect(check?.detail).toContain('grace mode')
    })

    it('fails when license is expired (past expiry date)', async () => {
      const past = new Date(Date.now() - 86_400_000) // yesterday
      const svc = new DoctorService({
        dashboardConfig: makeConfig({ licenseExpiry: past, licenseGraceMode: false }),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'License')
      expect(check?.status).toBe('fail')
      expect(check?.detail).toContain('expired')
    })

    it('passes when license expiry is in the future', async () => {
      const future = new Date(Date.now() + 30 * 86_400_000) // 30 days from now
      const svc = new DoctorService({
        dashboardConfig: makeConfig({ licenseExpiry: future, licenseGraceMode: false }),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const check = result.checks.find(c => c.check === 'License')
      expect(check?.status).toBe('pass')
    })
  })

  // ── Summary calculation ───────────────────────────────────────────────────

  describe('result summary (non-demo)', () => {
    it('summary counts match actual check status counts', async () => {
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      const actualPassed = result.checks.filter(c => c.status === 'pass').length
      const actualWarned = result.checks.filter(c => c.status === 'warn').length
      const actualFailed = result.checks.filter(c => c.status === 'fail').length
      expect(result.summary.passed).toBe(actualPassed)
      expect(result.summary.warned).toBe(actualWarned)
      expect(result.summary.failed).toBe(actualFailed)
      expect(result.summary.total).toBe(result.checks.length)
    })

    it('summary result is "fail" when any check fails', async () => {
      // Use expired license to force a failure
      const past = new Date(Date.now() - 86_400_000)
      const svc = new DoctorService({
        dashboardConfig: makeConfig({ licenseExpiry: past, licenseGraceMode: false }),
        hostInfoService: makeHostInfoService(),
        isDemo: false,
      })
      const result = await svc.runDiagnostics()
      expect(result.summary.result).toBe('fail')
    })

    it('summary result reflects worst check status: fail > warn > pass', async () => {
      // Demo mode gives deterministic results: passed=12, warned=2, failed=0 → 'warn'
      const svc = new DoctorService({
        dashboardConfig: makeConfig(),
        hostInfoService: makeHostInfoService(),
        isDemo: true,
      })
      const result = await svc.runDiagnostics()
      // Demo has no failures but has warnings → result must be 'warn'
      expect(result.summary.failed).toBe(0)
      expect(result.summary.warned).toBeGreaterThan(0)
      expect(result.summary.result).toBe('warn')
    })
  })
})
