// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { access, readFile, stat } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { totalmem, arch } from 'node:os'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import type { DashboardConfig } from '../config.js'
import type { HostInfoService } from './host-info.js'

const execFileAsync = promisify(execFile)

// ── Types ────────────────────────────────────────────────────────────

interface DoctorCheck {
  check: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
  remediation: string | null
}

interface DoctorResult {
  timestamp: string
  durationMs: number
  summary: {
    total: number
    passed: number
    warned: number
    failed: number
    result: 'pass' | 'warn' | 'fail'
  }
  checks: DoctorCheck[]
}

// ── Mock data for demo mode ──────────────────────────────────────────

const MOCK_RESULT: DoctorResult = {
  timestamp: new Date().toISOString(),
  durationMs: 42,
  summary: { total: 14, passed: 12, warned: 2, failed: 0, result: 'warn' },
  checks: [
    { check: 'Architecture', status: 'pass', detail: 'x86_64', remediation: null },
    { check: 'CPU virtualization', status: 'pass', detail: 'Intel VT-x detected', remediation: null },
    { check: 'KVM module', status: 'pass', detail: 'Loaded (kvm_intel, kvm)', remediation: null },
    { check: '/dev/kvm', status: 'pass', detail: 'Accessible (read/write)', remediation: null },
    { check: 'IOMMU', status: 'warn', detail: 'Not detected (device passthrough unavailable)', remediation: 'Enable VT-d in BIOS' },
    { check: 'RAM', status: 'pass', detail: '32768 MB (minimum: 2048 MB)', remediation: null },
    { check: 'Disk space', status: 'pass', detail: '58000 MB available on /', remediation: null },
    { check: 'NixOS version', status: 'pass', detail: '25.11.717285 (demo)', remediation: null },
    { check: 'Bridge module', status: 'pass', detail: 'Loaded', remediation: null },
    { check: 'QEMU', status: 'pass', detail: 'QEMU emulator version 8.2.0', remediation: null },
    { check: 'IP forwarding', status: 'pass', detail: 'Enabled', remediation: null },
    { check: 'Data directory', status: 'pass', detail: 'Writable', remediation: null },
    { check: 'Bridge interface', status: 'warn', detail: 'br-microvm not found (demo mode)', remediation: 'Configure bridge networking' },
    { check: 'License', status: 'pass', detail: 'Weaver (valid)', remediation: null },
  ],
}

// ── Service ──────────────────────────────────────────────────────────

export interface DoctorConfig {
  dashboardConfig: DashboardConfig
  hostInfoService: HostInfoService
  isDemo: boolean
}

export class DoctorService {
  private config: DoctorConfig

  constructor(config: DoctorConfig) {
    this.config = config
  }

  async runDiagnostics(): Promise<DoctorResult> {
    if (this.config.isDemo) {
      return { ...MOCK_RESULT, timestamp: new Date().toISOString() }
    }

    const startTime = Date.now()
    const checks: DoctorCheck[] = []
    const dc = this.config.dashboardConfig

    // Run all checks
    await Promise.all([
      this.checkArchitecture(checks),
      this.checkCpuVirtualization(checks),
      this.checkKvmModule(checks),
      this.checkDevKvm(checks),
      this.checkIommu(checks),
      this.checkRam(checks),
      this.checkDiskSpace(checks),
      this.checkNixosVersion(dc, checks),
      this.checkBridgeModule(checks),
      this.checkQemu(dc, checks),
      this.checkIpForwarding(checks),
      // Weaver-specific checks
      this.checkDataDirectory(dc, checks),
      this.checkBridgeInterface(dc, checks),
      this.checkLicense(dc, checks),
    ])

    const durationMs = Date.now() - startTime
    const passed = checks.filter(c => c.status === 'pass').length
    const warned = checks.filter(c => c.status === 'warn').length
    const failed = checks.filter(c => c.status === 'fail').length

    return {
      timestamp: new Date().toISOString(),
      durationMs,
      summary: {
        total: checks.length,
        passed,
        warned,
        failed,
        result: failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass',
      },
      checks,
    }
  }

  // ── Hardware Checks ──────────────────────────────────────────────

  private async checkArchitecture(checks: DoctorCheck[]): Promise<void> {
    const a = arch() === 'x64' ? 'x86_64' : arch()
    if (a === 'x86_64') {
      checks.push({ check: 'Architecture', status: 'pass', detail: a, remediation: null })
    } else if (a === 'arm64' || a === 'aarch64') {
      checks.push({ check: 'Architecture', status: 'warn', detail: `${a} (experimental)`, remediation: 'aarch64 dashboard works; MicroVM provisioning is experimental' })
    } else {
      checks.push({ check: 'Architecture', status: 'fail', detail: `${a} (unsupported)`, remediation: 'Weaver requires x86_64 or aarch64' })
    }
  }

  private async checkCpuVirtualization(checks: DoctorCheck[]): Promise<void> {
    try {
      const cpuinfo = await readFile('/proc/cpuinfo', 'utf8')
      const vmxCount = (cpuinfo.match(/vmx/g) || []).length
      const svmCount = (cpuinfo.match(/\bsvm\b/g) || []).length
      if (vmxCount > 0) {
        checks.push({ check: 'CPU virtualization', status: 'pass', detail: `Intel VT-x detected (${vmxCount} logical CPUs)`, remediation: null })
      } else if (svmCount > 0) {
        checks.push({ check: 'CPU virtualization', status: 'pass', detail: `AMD-V (SVM) detected (${svmCount} logical CPUs)`, remediation: null })
      } else {
        checks.push({ check: 'CPU virtualization', status: 'fail', detail: 'VT-x/AMD-V not detected', remediation: 'Enable virtualization in BIOS. See docs/COMPATIBILITY.md § BIOS Configuration' })
      }
    } catch {
      checks.push({ check: 'CPU virtualization', status: 'fail', detail: '/proc/cpuinfo not readable', remediation: 'Ensure /proc is mounted' })
    }
  }

  private async checkKvmModule(checks: DoctorCheck[]): Promise<void> {
    try {
      const modules = await readFile('/proc/modules', 'utf8')
      const kvmModules = modules.split('\n')
        .filter(line => line.startsWith('kvm'))
        .map(line => line.split(' ')[0])
      if (kvmModules.length > 0) {
        checks.push({ check: 'KVM module', status: 'pass', detail: `Loaded (${kvmModules.join(', ')})`, remediation: null })
      } else {
        // Check if /dev/kvm exists (built-in module)
        const kvmExists = await access('/dev/kvm').then(() => true).catch(() => false)
        if (kvmExists) {
          checks.push({ check: 'KVM module', status: 'pass', detail: 'Built-in (/dev/kvm exists)', remediation: null })
        } else {
          checks.push({ check: 'KVM module', status: 'fail', detail: 'Not loaded', remediation: 'Run: modprobe kvm_intel (Intel) or modprobe kvm_amd (AMD)' })
        }
      }
    } catch {
      checks.push({ check: 'KVM module', status: 'warn', detail: 'Cannot read /proc/modules', remediation: null })
    }
  }

  private async checkDevKvm(checks: DoctorCheck[]): Promise<void> {
    try {
      await access('/dev/kvm')
      checks.push({ check: '/dev/kvm', status: 'pass', detail: 'Accessible', remediation: null })
    } catch {
      checks.push({ check: '/dev/kvm', status: 'fail', detail: 'Not accessible', remediation: 'Add weaver user to kvm group or load KVM module' })
    }
  }

  private async checkIommu(checks: DoctorCheck[]): Promise<void> {
    try {
      const entries = readdirSync('/sys/class/iommu')
      if (entries.length > 0) {
        let groupCount = 0
        try {
          groupCount = readdirSync('/sys/kernel/iommu_groups').length
        } catch { /* ignore */ }
        checks.push({ check: 'IOMMU', status: 'pass', detail: `Active (${groupCount} groups)`, remediation: null })
      } else {
        checks.push({ check: 'IOMMU', status: 'warn', detail: 'Not detected (device passthrough unavailable)', remediation: 'Enable VT-d/AMD-Vi in BIOS, add intel_iommu=on to kernel params, then reboot' })
      }
    } catch {
      checks.push({ check: 'IOMMU', status: 'warn', detail: 'Cannot check /sys/class/iommu', remediation: 'Not required for basic VM provisioning' })
    }
  }

  private async checkRam(checks: DoctorCheck[]): Promise<void> {
    const totalMb = Math.round(totalmem() / 1024 / 1024)
    if (totalMb >= 2048) {
      checks.push({ check: 'RAM', status: 'pass', detail: `${totalMb} MB (minimum: 2048 MB for provisioning)`, remediation: null })
    } else if (totalMb >= 1024) {
      checks.push({ check: 'RAM', status: 'warn', detail: `${totalMb} MB (dashboard OK, provisioning needs 2048+ MB)`, remediation: 'Add more RAM for MicroVM provisioning' })
    } else {
      checks.push({ check: 'RAM', status: 'fail', detail: `${totalMb} MB (minimum: 1024 MB)`, remediation: 'Weaver requires at least 1 GB RAM' })
    }
  }

  private async checkDiskSpace(checks: DoctorCheck[]): Promise<void> {
    try {
      const dc = this.config.dashboardConfig
      const { stdout } = await execFileAsync(dc.dfBin, ['-m', '/'], { timeout: 5_000 })
      const lines = stdout.trim().split('\n')
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/)
        const availMb = parseInt(parts[3] ?? '0', 10)
        if (availMb >= 5120) {
          checks.push({ check: 'Disk space', status: 'pass', detail: `${availMb} MB available on /`, remediation: null })
        } else if (availMb >= 500) {
          checks.push({ check: 'Disk space', status: 'warn', detail: `${availMb} MB available (low for VM images)`, remediation: 'Consider 10+ GB free for provisioning' })
        } else {
          checks.push({ check: 'Disk space', status: 'fail', detail: `${availMb} MB available (minimum: 500 MB)`, remediation: 'Free up disk space' })
        }
      }
    } catch {
      checks.push({ check: 'Disk space', status: 'warn', detail: 'Cannot determine', remediation: null })
    }
  }

  private async checkNixosVersion(dc: DashboardConfig, checks: DoctorCheck[]): Promise<void> {
    try {
      const { stdout } = await execFileAsync(dc.nixosVersionBin, [], { timeout: 5_000 })
      const version = stdout.trim()
      const match = version.match(/^(\d+)\.(\d+)/)
      if (match) {
        const major = parseInt(match[1], 10)
        const minor = parseInt(match[2], 10)
        if (major > 25 || (major === 25 && minor >= 11)) {
          checks.push({ check: 'NixOS version', status: 'pass', detail: `${version} (minimum: 25.11)`, remediation: null })
        } else {
          checks.push({ check: 'NixOS version', status: 'fail', detail: `${version} (minimum: 25.11)`, remediation: 'Upgrade to NixOS 25.11+' })
        }
      } else {
        checks.push({ check: 'NixOS version', status: 'warn', detail: `${version} (could not parse)`, remediation: null })
      }
    } catch {
      checks.push({ check: 'NixOS version', status: 'warn', detail: 'Not a NixOS system or nixos-version not available', remediation: 'Weaver requires NixOS — see PRODUCTION-DEPLOYMENT.md' })
    }
  }

  private async checkBridgeModule(checks: DoctorCheck[]): Promise<void> {
    try {
      const modules = await readFile('/proc/modules', 'utf8')
      if (modules.includes('bridge ')) {
        checks.push({ check: 'Bridge module', status: 'pass', detail: 'Loaded', remediation: null })
      } else {
        checks.push({ check: 'Bridge module', status: 'warn', detail: 'Not loaded (may be built-in)', remediation: 'Auto-loaded when bridge interface is created' })
      }
    } catch {
      checks.push({ check: 'Bridge module', status: 'warn', detail: 'Cannot check', remediation: null })
    }
  }

  private async checkQemu(dc: DashboardConfig, checks: DoctorCheck[]): Promise<void> {
    try {
      const { stdout } = await execFileAsync(dc.qemuBin, ['--version'], { timeout: 5_000 })
      const version = stdout.split('\n')[0] ?? 'unknown'
      checks.push({ check: 'QEMU', status: 'pass', detail: version, remediation: null })
    } catch {
      if (dc.provisioningEnabled) {
        checks.push({ check: 'QEMU', status: 'fail', detail: `Not found at ${dc.qemuBin}`, remediation: 'QEMU is required for provisioning. Install via NixOS module or set QEMU_BIN' })
      } else {
        checks.push({ check: 'QEMU', status: 'warn', detail: 'Not found (provisioning not enabled)', remediation: 'QEMU only needed if provisioning MicroVMs' })
      }
    }
  }

  private async checkIpForwarding(checks: DoctorCheck[]): Promise<void> {
    try {
      const value = (await readFile('/proc/sys/net/ipv4/ip_forward', 'utf8')).trim()
      if (value === '1') {
        checks.push({ check: 'IP forwarding', status: 'pass', detail: 'Enabled', remediation: null })
      } else {
        checks.push({ check: 'IP forwarding', status: 'warn', detail: 'Disabled', remediation: 'NixOS: boot.kernel.sysctl."net.ipv4.ip_forward" = 1;' })
      }
    } catch {
      checks.push({ check: 'IP forwarding', status: 'warn', detail: 'Cannot determine', remediation: null })
    }
  }

  // ── Weaver-Specific Checks ───────────────────────────────────────

  private async checkDataDirectory(dc: DashboardConfig, checks: DoctorCheck[]): Promise<void> {
    try {
      const info = await stat(dc.dataDir)
      if (info.isDirectory()) {
        // Try writing a test file
        const testPath = resolve(dc.dataDir, '.doctor-probe')
        const { writeFile, unlink } = await import('node:fs/promises')
        await writeFile(testPath, 'probe')
        await unlink(testPath)
        checks.push({ check: 'Data directory', status: 'pass', detail: `${dc.dataDir} (writable)`, remediation: null })
      } else {
        checks.push({ check: 'Data directory', status: 'fail', detail: `${dc.dataDir} is not a directory`, remediation: 'Create the data directory or set DATA_DIR' })
      }
    } catch {
      checks.push({ check: 'Data directory', status: 'fail', detail: `${dc.dataDir} not accessible`, remediation: 'Create the data directory and ensure the weaver user has write access' })
    }
  }

  private async checkBridgeInterface(dc: DashboardConfig, checks: DoctorCheck[]): Promise<void> {
    if (!dc.provisioningEnabled) {
      checks.push({ check: 'Bridge interface', status: 'pass', detail: `${dc.bridgeInterface} (provisioning not enabled, check skipped)`, remediation: null })
      return
    }
    try {
      const { stdout } = await execFileAsync(dc.ipBin, ['link', 'show', dc.bridgeInterface], { timeout: 5_000 })
      if (stdout.includes('state UP')) {
        checks.push({ check: 'Bridge interface', status: 'pass', detail: `${dc.bridgeInterface} is UP`, remediation: null })
      } else {
        checks.push({ check: 'Bridge interface', status: 'warn', detail: `${dc.bridgeInterface} exists but not UP`, remediation: `Run: ip link set ${dc.bridgeInterface} up` })
      }
    } catch {
      checks.push({ check: 'Bridge interface', status: 'fail', detail: `${dc.bridgeInterface} not found`, remediation: 'Configure bridge networking. See docs/platforms/nixos/SETUP-COMMON.md' })
    }
  }

  private async checkLicense(dc: DashboardConfig, checks: DoctorCheck[]): Promise<void> {
    const tier = dc.tier
    if (dc.licenseGraceMode) {
      checks.push({ check: 'License', status: 'warn', detail: `${tier} (grace mode — license expired)`, remediation: 'Renew your license key to restore full functionality' })
    } else if (dc.licenseExpiry && dc.licenseExpiry.getTime() < Date.now()) {
      checks.push({ check: 'License', status: 'fail', detail: `${tier} (expired)`, remediation: 'License has expired. Renew at weaver.dev or contact support' })
    } else {
      checks.push({ check: 'License', status: 'pass', detail: `${tier} (valid)`, remediation: null })
    }
  }
}
