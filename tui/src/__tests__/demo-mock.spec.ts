// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDemoApiClient, createDemoWsClient } from '../demo/mock.js'
import type { VmInfo } from '../types/vm.js'

describe('createDemoApiClient', () => {
  it('returns 6 demo VMs on listVms', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.listVms()
    expect(result.status).toBe(200)
    const vms = result.data as VmInfo[]
    expect(vms).toHaveLength(6)
  })

  it('finds VM by name on getVm', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getVm('web-nginx')
    expect(result.status).toBe(200)
    const vm = result.data as VmInfo
    expect(vm.name).toBe('web-nginx')
    expect(vm.status).toBe('running')
  })

  it('returns 404 for unknown VM', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getVm('nonexistent')
    expect(result.status).toBe(404)
  })

  it('startVm changes status to running', async () => {
    const api = createDemoApiClient('weaver')
    // ci-runner starts as idle
    const before = await api.getVm('ci-runner')
    expect((before.data as VmInfo).status).toBe('idle')

    await api.startVm('ci-runner')

    const after = await api.getVm('ci-runner')
    expect((after.data as VmInfo).status).toBe('running')
    expect((after.data as VmInfo).uptime).toBeTruthy()
  })

  it('stopVm changes status to stopped', async () => {
    const api = createDemoApiClient('weaver')
    await api.stopVm('web-nginx')

    const result = await api.getVm('web-nginx')
    expect((result.data as VmInfo).status).toBe('stopped')
    expect((result.data as VmInfo).uptime).toBeNull()
  })

  it('restartVm resets uptime', async () => {
    const api = createDemoApiClient('weaver')
    await api.restartVm('web-nginx')

    const result = await api.getVm('web-nginx')
    expect((result.data as VmInfo).status).toBe('running')
  })

  it('startAgent returns 202 for free tier (BYOK is free)', async () => {
    const api = createDemoApiClient('free')
    const result = await api.startAgent('my-webserver', 'diagnose')
    expect(result.status).toBe(202)
    expect((result.data as { operationId: string }).operationId).toMatch(/^demo-/)
  })

  it('startAgent returns 202 for weaver tier', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.startAgent('web-nginx', 'diagnose')
    expect(result.status).toBe(202)
    expect((result.data as { operationId: string }).operationId).toMatch(/^demo-/)
  })

  it('getHealth returns tier', async () => {
    const api = createDemoApiClient('fabrick')
    const result = await api.getHealth()
    expect(result.status).toBe(200)
    expect((result.data as { tier: string }).tier).toBe('fabrick')
  })

  it('getHealth returns host info', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getHealth()
    const data = result.data as { host: Record<string, unknown> }
    expect(data.host).toBeTruthy()
    expect(data.host.hostname).toBe('nixos-demo')
  })

  it('login always succeeds', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.login('any', 'any')
    expect(result.status).toBe(200)
  })

  // --- New: createVm ---
  it('createVm adds VM to list', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.createVm({ name: 'test-new', ip: '10.10.0.88', mem: 512, vcpu: 1, hypervisor: 'qemu' })
    expect(result.status).toBe(201)

    const list = await api.listVms()
    const vms = list.data as VmInfo[]
    expect(vms.find(v => v.name === 'test-new')).toBeTruthy()
    expect(vms).toHaveLength(7)
  })

  it('createVm returns 409 on duplicate name', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.createVm({ name: 'web-nginx', ip: '10.10.0.88', mem: 512, vcpu: 1, hypervisor: 'qemu' })
    expect(result.status).toBe(409)
  })

  // --- New: deleteVm ---
  it('deleteVm removes VM from list', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.deleteVm('ci-runner')
    expect(result.status).toBe(200)

    const list = await api.listVms()
    const vms = list.data as VmInfo[]
    expect(vms.find(v => v.name === 'ci-runner')).toBeUndefined()
    expect(vms).toHaveLength(5)
  })

  it('deleteVm returns 404 for unknown VM', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.deleteVm('nonexistent')
    expect(result.status).toBe(404)
  })

  // --- New: scanVms ---
  it('scanVms discovers a new VM', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.scanVms()
    expect(result.status).toBe(200)
    const data = result.data as { discovered: string[]; added: string[] }
    expect(data.discovered).toHaveLength(1)
    expect(data.added).toHaveLength(1)

    const list = await api.listVms()
    expect((list.data as VmInfo[]).length).toBe(7)
  })

  // --- New: register ---
  it('register returns 201 with token', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.register('newuser', 'password123')
    expect(result.status).toBe(201)
    const data = result.data as { token: string; user: { username: string } }
    expect(data.token).toBe('demo-token')
    expect(data.user.username).toBe('newuser')
  })

  // --- New: tier-gated weaver features ---
  it('getNetworkTopology returns data for weaver', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getNetworkTopology()
    expect(result.status).toBe(200)
    const data = result.data as { bridges: unknown[]; nodes: unknown[] }
    expect(data.bridges).toHaveLength(2)
    expect(data.nodes.length).toBeGreaterThan(0)
  })

  it('getNetworkTopology returns 403 for free tier', async () => {
    const api = createDemoApiClient('free')
    const result = await api.getNetworkTopology()
    expect(result.status).toBe(403)
  })

  it('getHostInfo returns data for weaver', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getHostInfo()
    expect(result.status).toBe(200)
    const data = result.data as { nixosVersion: string }
    expect(data.nixosVersion).toBe('25.11')
  })

  it('getHostInfo returns 403 for free tier', async () => {
    const api = createDemoApiClient('free')
    const result = await api.getHostInfo()
    expect(result.status).toBe(403)
  })

  it('listDistros returns data for free tier (read-only access)', async () => {
    const api = createDemoApiClient('free')
    const result = await api.listDistros()
    expect(result.status).toBe(200)
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
  })

  it('listDistros returns data for weaver', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.listDistros()
    expect(result.status).toBe(200)
    const data = result.data as unknown[]
    expect(data.length).toBeGreaterThan(0)
  })

  it('getNotifications returns data for weaver', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getNotifications()
    expect(result.status).toBe(200)
    const data = result.data as { notifications: unknown[] }
    expect(data.notifications.length).toBe(3)
  })

  // --- New: tier-gated fabrick features ---
  it('listUsers returns data for fabrick', async () => {
    const api = createDemoApiClient('fabrick')
    const result = await api.listUsers()
    expect(result.status).toBe(200)
    const data = result.data as unknown[]
    expect(data).toHaveLength(3)
  })

  it('listUsers returns 403 for weaver tier', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.listUsers()
    expect(result.status).toBe(403)
  })

  it('getAuditLog returns data for fabrick', async () => {
    const api = createDemoApiClient('fabrick')
    const result = await api.getAuditLog()
    expect(result.status).toBe(200)
    const data = result.data as { entries: unknown[]; total: number }
    expect(data.entries.length).toBeGreaterThan(0)
    expect(data.total).toBeGreaterThan(0)
  })

  it('getAuditLog returns 403 for weaver tier', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getAuditLog()
    expect(result.status).toBe(403)
  })

  it('getUserQuotas returns 403 for weaver tier', async () => {
    const api = createDemoApiClient('weaver')
    const result = await api.getUserQuotas('u2')
    expect(result.status).toBe(403)
  })

  it('getUserQuotas returns data for fabrick', async () => {
    const api = createDemoApiClient('fabrick')
    const result = await api.getUserQuotas('u2')
    expect(result.status).toBe(200)
    const data = result.data as { maxVms: number }
    expect(data.maxVms).toBe(10)
  })

  // --- New: demo tier shows all features ---
  it('demo tier allows all features', async () => {
    const api = createDemoApiClient('demo')
    expect((await api.getNetworkTopology()).status).toBe(200)
    expect((await api.getHostInfo()).status).toBe(200)
    expect((await api.listDistros()).status).toBe(200)
    expect((await api.getNotifications()).status).toBe(200)
    expect((await api.listUsers()).status).toBe(200)
    expect((await api.getAuditLog()).status).toBe(200)
    expect((await api.getUserQuotas('u1')).status).toBe(200)
  })
})

describe('createDemoWsClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fires connect handler after connect()', async () => {
    const ws = createDemoWsClient('weaver')
    const connected = vi.fn()
    ws.onConnect(connected)
    ws.connect('token')

    // Wait for the 50ms setTimeout in mock
    await new Promise(r => setTimeout(r, 100))
    expect(connected).toHaveBeenCalledOnce()
  })

  it('sends initial VM status after connect()', async () => {
    const ws = createDemoWsClient('weaver')
    const handler = vi.fn()
    ws.onVmStatus(handler)
    ws.connect('token')

    await new Promise(r => setTimeout(r, 100))
    expect(handler).toHaveBeenCalledOnce()
    const vms = handler.mock.calls[0][0] as VmInfo[]
    expect(vms.length).toBeGreaterThan(0)
  })

  it('unsubscribe removes handler', async () => {
    const ws = createDemoWsClient('weaver')
    const handler = vi.fn()
    const unsub = ws.onVmStatus(handler)
    unsub()
    ws.connect('token')

    await new Promise(r => setTimeout(r, 100))
    expect(handler).not.toHaveBeenCalled()
  })

  it('disconnect fires disconnect handler', async () => {
    const ws = createDemoWsClient('weaver')
    const disconnected = vi.fn()
    ws.onDisconnect(disconnected)
    ws.connect('token')

    await new Promise(r => setTimeout(r, 100))
    ws.disconnect()
    expect(disconnected).toHaveBeenCalledOnce()
  })
})
