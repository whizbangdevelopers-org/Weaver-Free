// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import { parseLscpu, parseDf, parseIpLink, HostInfoService } from '../../src/services/host-info.js'

describe('parseLscpu', () => {
  it('should parse typical x86_64 lscpu output', () => {
    const output = `Architecture:            x86_64
CPU op-mode(s):          32-bit, 64-bit
Byte Order:              Little Endian
CPU(s):                  16
On-line CPU(s) list:     0-15
Socket(s):               1
Core(s) per socket:      8
Thread(s) per core:      2
Virtualization:          VT-x
L1d cache:               384 KiB
L1i cache:               256 KiB
L2 cache:                12 MiB
L3 cache:                25 MiB`

    const result = parseLscpu(output)
    expect(result.sockets).toBe(1)
    expect(result.coresPerSocket).toBe(8)
    expect(result.threadsPerCore).toBe(2)
    expect(result.virtualizationType).toBe('VT-x')
    expect(result.l1dCache).toBe('384 KiB')
    expect(result.l1iCache).toBe('256 KiB')
    expect(result.l2Cache).toBe('12 MiB')
    expect(result.l3Cache).toBe('25 MiB')
  })

  it('should parse AMD-V virtualization', () => {
    const output = `Socket(s):               2
Core(s) per socket:      32
Thread(s) per core:      2
Virtualization:          AMD-V`

    const result = parseLscpu(output)
    expect(result.sockets).toBe(2)
    expect(result.coresPerSocket).toBe(32)
    expect(result.virtualizationType).toBe('AMD-V')
  })

  it('should return null for missing fields', () => {
    const output = `Architecture:            x86_64
CPU(s):                  4`

    const result = parseLscpu(output)
    expect(result.sockets).toBeNull()
    expect(result.coresPerSocket).toBeNull()
    expect(result.threadsPerCore).toBeNull()
    expect(result.virtualizationType).toBeNull()
    expect(result.l1dCache).toBeNull()
    expect(result.l3Cache).toBeNull()
  })

  it('should handle empty output', () => {
    const result = parseLscpu('')
    expect(result.sockets).toBeNull()
    expect(result.virtualizationType).toBeNull()
  })
})

describe('parseDf', () => {
  it('should parse typical df -h output and filter tmpfs', () => {
    const output = `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   20G   30G  40% /
tmpfs           7.8G     0  7.8G   0% /dev/shm
devtmpfs        7.8G     0  7.8G   0% /dev
/dev/sdb1       500G  180G  320G  36% /var`

    const result = parseDf(output)
    expect(result).toHaveLength(2)
    expect(result[0].filesystem).toBe('/dev/sda1')
    expect(result[0].sizeHuman).toBe('50G')
    expect(result[0].usedHuman).toBe('20G')
    expect(result[0].availHuman).toBe('30G')
    expect(result[0].usePercent).toBe(40)
    expect(result[0].mountPoint).toBe('/')
    expect(result[1].filesystem).toBe('/dev/sdb1')
    expect(result[1].usePercent).toBe(36)
    expect(result[1].mountPoint).toBe('/var')
  })

  it('should handle 100% disk usage', () => {
    const output = `Filesystem  Size Used Avail Use% Mounted on
/dev/sda1   10G   10G    0  100% /`

    const result = parseDf(output)
    expect(result).toHaveLength(1)
    expect(result[0].usePercent).toBe(100)
  })

  it('should filter efivarfs', () => {
    const output = `Filesystem  Size Used Avail Use% Mounted on
efivarfs    128K   64K   64K  50% /sys/firmware/efi/efivars
/dev/sda1   50G   20G   30G  40% /`

    const result = parseDf(output)
    expect(result).toHaveLength(1)
    expect(result[0].filesystem).toBe('/dev/sda1')
  })

  it('should handle empty output', () => {
    const result = parseDf('')
    expect(result).toHaveLength(0)
  })

  it('should handle header-only output', () => {
    const result = parseDf('Filesystem  Size Used Avail Use% Mounted on')
    expect(result).toHaveLength(0)
  })
})

describe('parseIpLink', () => {
  it('should parse interfaces and filter loopback', () => {
    const output = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq state UP
    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff`

    const result = parseIpLink(output)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('eth0')
    expect(result[0].state).toBe('UP')
    expect(result[0].macAddress).toBe('aa:bb:cc:dd:ee:ff')
  })

  it('should filter tap and veth interfaces', () => {
    const output = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP
    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff
3: tap-vm1: <BROADCAST,MULTICAST,UP> mtu 1500 state UP
    link/ether 02:00:00:00:00:01 brd ff:ff:ff:ff:ff:ff
4: veth123: <BROADCAST,MULTICAST,UP> mtu 1500 state UP
    link/ether 02:00:00:00:00:02 brd ff:ff:ff:ff:ff:ff`

    const result = parseIpLink(output)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('eth0')
  })

  it('should handle DOWN state', () => {
    const output = `2: wlan0: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN
    link/ether 11:22:33:44:55:66 brd ff:ff:ff:ff:ff:ff`

    const result = parseIpLink(output)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('wlan0')
    expect(result[0].state).toBe('DOWN')
    expect(result[0].macAddress).toBe('11:22:33:44:55:66')
  })

  it('should handle interfaces without MAC address', () => {
    const output = `5: tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1500 state UNKNOWN
    link/none`

    const result = parseIpLink(output)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('tun0')
    expect(result[0].macAddress).toBeNull()
  })

  it('should handle empty output', () => {
    const result = parseIpLink('')
    expect(result).toHaveLength(0)
  })
})

describe('HostInfoService (demo mode)', () => {
  const demoService = new HostInfoService({
    lscpuBin: '', dfBin: '', ipBin: '', nixosVersionBin: '',
    isDemo: true,
  })

  it('should return mock basic info', async () => {
    const info = await demoService.getBasicInfo()
    expect(info.hostname).toBe('demo-host')
    expect(info.arch).toBe('x86_64')
    expect(info.cpuCount).toBe(16)
    expect(info.totalMemMb).toBe(32768)
    expect(info.kvmAvailable).toBe(true)
  })

  it('should return mock detailed info', async () => {
    const info = await demoService.getDetailedInfo()
    expect(info.nixosVersion).toContain('demo')
    expect(info.cpuTopology).not.toBeNull()
    expect(info.cpuTopology?.virtualizationType).toBe('VT-x')
    expect(info.diskUsage.length).toBeGreaterThan(0)
    expect(info.networkInterfaces.length).toBeGreaterThan(0)
    expect(info.liveMetrics.freeMemMb).toBeGreaterThan(0)
  })
})

describe('HostInfoService (real mode)', () => {
  const realService = new HostInfoService({
    lscpuBin: 'lscpu', dfBin: 'df', ipBin: 'ip', nixosVersionBin: 'nixos-version',
    isDemo: false,
  })

  it('should return basic host info from os module', async () => {
    const info = await realService.getBasicInfo()
    expect(info.hostname).toBeTruthy()
    expect(info.arch).toBeTruthy()
    expect(info.cpuModel).toBeTruthy()
    expect(info.cpuCount).toBeGreaterThan(0)
    expect(info.totalMemMb).toBeGreaterThan(0)
    expect(info.kernelVersion).toBeTruthy()
    expect(info.uptimeSeconds).toBeGreaterThan(0)
    expect(typeof info.kvmAvailable).toBe('boolean')
  })

  it('should cache static fields across calls', async () => {
    const info1 = await realService.getBasicInfo()
    const info2 = await realService.getBasicInfo()
    expect(info1.hostname).toBe(info2.hostname)
    expect(info1.cpuModel).toBe(info2.cpuModel)
    expect(info1.cpuCount).toBe(info2.cpuCount)
    expect(info1.totalMemMb).toBe(info2.totalMemMb)
  })
})
