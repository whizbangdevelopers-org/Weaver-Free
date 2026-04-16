// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotificationService } from '../../src/services/notification.js'
import type { NotificationStore } from '../../src/storage/notification-store.js'
import type { NotificationEvent } from '../../src/models/notification.js'
import { STATUSES } from '../../src/constants/vocabularies.js'

function makeStore(): NotificationStore {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getRecent: vi.fn().mockReturnValue([]),
  } as unknown as NotificationStore
}

describe('NotificationService', () => {
  let store: NotificationStore
  let svc: NotificationService

  beforeEach(() => {
    store = makeStore()
    svc = new NotificationService(store)
  })

  // ── detectChanges ──────────────────────────────────────────────────────────

  describe('detectChanges()', () => {
    it('returns no events on first call (sets baseline only)', async () => {
      const events = await svc.detectChanges([
        { name: 'web-nginx', status: STATUSES.RUNNING } as never,
      ])
      expect(events).toHaveLength(0)
      expect(store.add).not.toHaveBeenCalled()
    })

    it('returns no events when status is unchanged', async () => {
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      const events = await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      expect(events).toHaveLength(0)
    })

    it('emits vm:failed when running → failed', async () => {
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      const events = await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.FAILED } as never])
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('vm:failed')
      expect(events[0].severity).toBe('error')
      expect(events[0].vmName).toBe('web-nginx')
    })

    it('emits vm:recovered when failed → running', async () => {
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.FAILED } as never])
      const events = await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('vm:recovered')
      expect(events[0].severity).toBe('success')
    })

    it('emits vm:started when stopped → running', async () => {
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.STOPPED } as never])
      const events = await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('vm:started')
    })

    it('emits vm:stopped when running → stopped', async () => {
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      const events = await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.STOPPED } as never])
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('vm:stopped')
    })

    it('calls store.add for each emitted event', async () => {
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.RUNNING } as never])
      await svc.detectChanges([{ name: 'web-nginx', status: STATUSES.FAILED } as never])
      expect(store.add).toHaveBeenCalledTimes(1)
    })

    it('handles multiple VMs in a single call', async () => {
      const vms = [
        { name: 'web-nginx', status: STATUSES.RUNNING },
        { name: 'web-app', status: STATUSES.STOPPED },
      ] as never[]
      await svc.detectChanges(vms)

      const vms2 = [
        { name: 'web-nginx', status: STATUSES.FAILED },
        { name: 'web-app', status: STATUSES.RUNNING },
      ] as never[]
      const events = await svc.detectChanges(vms2)
      expect(events).toHaveLength(2)
    })
  })

  // ── emitSecurityEvent ──────────────────────────────────────────────────────

  describe('emitSecurityEvent()', () => {
    it('creates event with correct severity for auth-failure', async () => {
      const captured: NotificationEvent[] = []
      svc.onNotification(e => captured.push(e))
      await svc.emitSecurityEvent('security:auth-failure')
      expect(store.add).toHaveBeenCalledTimes(1)
      const evt = (store.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationEvent
      expect(evt.event).toBe('security:auth-failure')
      expect(evt.severity).toBe('error')
      expect(evt.message).toBe('Authentication failure detected')
    })

    it('creates event with correct severity for unauthorized-access', async () => {
      await svc.emitSecurityEvent('security:unauthorized-access')
      const evt = (store.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationEvent
      expect(evt.event).toBe('security:unauthorized-access')
      expect(evt.severity).toBe('error')
    })

    it('creates event with correct severity for permission-denied', async () => {
      await svc.emitSecurityEvent('security:permission-denied')
      const evt = (store.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationEvent
      expect(evt.event).toBe('security:permission-denied')
      expect(evt.severity).toBe('info')
    })

    it('passes details to the stored event', async () => {
      await svc.emitSecurityEvent('security:auth-failure', { ip: '1.2.3.4' })
      const evt = (store.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationEvent
      expect(evt.details).toEqual({ ip: '1.2.3.4' })
    })
  })

  // ── listener management ────────────────────────────────────────────────────

  describe('onNotification / offNotification', () => {
    it('calls registered listener when event is emitted', async () => {
      const listener = vi.fn()
      svc.onNotification(listener)
      await svc.emitSecurityEvent('security:auth-failure')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does not call removed listener', async () => {
      const listener = vi.fn()
      svc.onNotification(listener)
      svc.offNotification(listener)
      await svc.emitSecurityEvent('security:auth-failure')
      expect(listener).not.toHaveBeenCalled()
    })

    it('calls multiple listeners', async () => {
      const l1 = vi.fn()
      const l2 = vi.fn()
      svc.onNotification(l1)
      svc.onNotification(l2)
      await svc.emitSecurityEvent('security:auth-failure')
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
    })
  })

  // ── sendTestNotification ───────────────────────────────────────────────────

  describe('sendTestNotification()', () => {
    it('returns empty sent/failed when no adapters loaded', async () => {
      const result = await svc.sendTestNotification()
      expect(result.sent).toEqual([])
      expect(result.failed).toEqual([])
    })

    it('reports sent channels for adapters that succeed', async () => {
      // Inject a mock adapter directly via the private map
      const adapter = { send: vi.fn().mockResolvedValue(undefined), test: vi.fn().mockResolvedValue(true) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(svc as any).adapters.set('ntfy', adapter)
      const result = await svc.sendTestNotification()
      expect(result.sent).toContain('ntfy')
      expect(result.failed).toHaveLength(0)
    })

    it('reports failed channels for adapters that throw', async () => {
      const adapter = { send: vi.fn().mockRejectedValue(new Error('network error')), test: vi.fn() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(svc as any).adapters.set('webhook', adapter)
      const result = await svc.sendTestNotification()
      expect(result.failed).toContain('webhook')
      expect(result.sent).toHaveLength(0)
    })
  })

  // ── testChannel ────────────────────────────────────────────────────────────

  describe('testChannel()', () => {
    it('returns null for unknown channel', async () => {
      const result = await svc.testChannel('no-such-channel')
      expect(result).toBeNull()
    })

    it('calls adapter.test() and returns result for known channel', async () => {
      const adapter = { send: vi.fn(), test: vi.fn().mockResolvedValue(true) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(svc as any).adapters.set('ntfy', adapter)
      const result = await svc.testChannel('ntfy')
      expect(adapter.test).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ success: true, channelId: 'ntfy' })
    })

    it('returns success: false when adapter.test() returns false', async () => {
      const adapter = { send: vi.fn(), test: vi.fn().mockResolvedValue(false) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(svc as any).adapters.set('email', adapter)
      const result = await svc.testChannel('email')
      expect(result).toEqual({ success: false, channelId: 'email' })
    })
  })

  // ── shouldBroadcastInApp ───────────────────────────────────────────────────

  describe('shouldBroadcastInApp()', () => {
    it('returns true by default when no channel config is loaded', () => {
      expect(svc.shouldBroadcastInApp('vm:started')).toBe(true)
      expect(svc.shouldBroadcastInApp('vm:failed')).toBe(true)
    })

    it('returns true when in-app channel subscribes to the event type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(svc as any).channelEvents.set('in-app', ['vm:started', 'vm:failed'])
      expect(svc.shouldBroadcastInApp('vm:started')).toBe(true)
    })

    it('returns false when in-app channel does not subscribe to event type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(svc as any).channelEvents.set('in-app', ['vm:started'])
      expect(svc.shouldBroadcastInApp('vm:failed')).toBe(false)
    })
  })

  // ── getRecentNotifications ─────────────────────────────────────────────────

  describe('getRecentNotifications()', () => {
    it('delegates to store.getRecent with no limit', () => {
      svc.getRecentNotifications()
      expect(store.getRecent).toHaveBeenCalledWith(undefined)
    })

    it('delegates to store.getRecent with provided limit', () => {
      svc.getRecentNotifications(10)
      expect(store.getRecent).toHaveBeenCalledWith(10)
    })

    it('returns whatever the store returns', () => {
      const fakeEvents = [{ id: 'abc', event: 'vm:started' }] as NotificationEvent[]
      ;(store.getRecent as ReturnType<typeof vi.fn>).mockReturnValue(fakeEvents)
      const result = svc.getRecentNotifications()
      expect(result).toBe(fakeEvents)
    })
  })
})
