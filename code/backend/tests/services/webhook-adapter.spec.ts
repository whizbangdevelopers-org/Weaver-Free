// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebhookAdapter } from '../../src/services/weaver/adapters/webhook-adapter.js'
import type { NotificationEvent } from '../../src/models/notification.js'

const testEvent: NotificationEvent = {
  id: 'evt-1',
  timestamp: '2024-01-15T10:30:00Z',
  event: 'vm:failed',
  vmName: 'web-nginx',
  severity: 'error',
  message: 'web-nginx failed',
  details: { previousStatus: 'running', newStatus: 'failed' },
}

describe('WebhookAdapter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('json format', () => {
    it('should send JSON payload', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'POST',
        format: 'json',
      })

      await adapter.send(testEvent)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, opts] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://webhook.example.com/hook')
      expect(opts.method).toBe('POST')

      const body = JSON.parse(opts.body)
      expect(body.source).toBe('weaver')
      expect(body.event).toBe('vm:failed')
      expect(body.vmName).toBe('web-nginx')
      expect(body.severity).toBe('error')
    })

    it('should include custom headers', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'POST',
        headers: { 'X-Custom': 'value' },
        format: 'json',
      })

      await adapter.send(testEvent)

      const [, opts] = fetchSpy.mock.calls[0]
      expect(opts.headers['X-Custom']).toBe('value')
      expect(opts.headers['Content-Type']).toBe('application/json')
    })

    it('should use PUT method when configured', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'PUT',
        format: 'json',
      })

      await adapter.send(testEvent)

      const [, opts] = fetchSpy.mock.calls[0]
      expect(opts.method).toBe('PUT')
    })
  })

  describe('slack format', () => {
    it('should format as Slack attachment', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://hooks.slack.com/services/test',
        method: 'POST',
        format: 'slack',
      })

      await adapter.send(testEvent)

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.attachments).toHaveLength(1)
      expect(body.attachments[0].fallback).toBe('web-nginx failed')
      expect(body.attachments[0].fields).toBeDefined()
      expect(body.attachments[0].color).toBe('#F44336') // error = red
    })
  })

  describe('discord format', () => {
    it('should format as Discord embed', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://discord.com/api/webhooks/test',
        method: 'POST',
        format: 'discord',
      })

      await adapter.send(testEvent)

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.embeds).toHaveLength(1)
      expect(body.embeds[0].description).toBe('web-nginx failed')
      expect(body.embeds[0].timestamp).toBe('2024-01-15T10:30:00Z')
    })
  })

  describe('pagerduty format', () => {
    it('should format as PagerDuty event', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://events.pagerduty.com/v2/enqueue',
        method: 'POST',
        headers: { 'X-Routing-Key': 'my-routing-key' },
        format: 'pagerduty',
      })

      await adapter.send(testEvent)

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.routing_key).toBe('my-routing-key')
      expect(body.event_action).toBe('trigger') // error -> trigger
      expect(body.payload.summary).toBe('web-nginx failed')
      expect(body.payload.severity).toBe('critical')
    })

    it('should set resolve action for success events', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://events.pagerduty.com/v2/enqueue',
        method: 'POST',
        format: 'pagerduty',
      })

      const successEvent: NotificationEvent = {
        ...testEvent,
        event: 'vm:recovered',
        severity: 'success',
        message: 'web-nginx recovered',
      }
      await adapter.send(successEvent)

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.event_action).toBe('resolve')
    })
  })

  describe('error handling', () => {
    it('should throw on non-OK response', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })

      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'POST',
        format: 'json',
      })

      await expect(adapter.send(testEvent)).rejects.toThrow('Webhook request failed: 500')
    })

    it('test() should return false on failure', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'))

      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'POST',
        format: 'json',
      })

      expect(await adapter.test()).toBe(false)
    })

    it('test() should return true on success', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'POST',
        format: 'json',
      })

      expect(await adapter.test()).toBe(true)
    })
  })

  describe('security events (no vmName)', () => {
    it('should handle events without vmName', async () => {
      const adapter = new WebhookAdapter({
        url: 'https://webhook.example.com/hook',
        method: 'POST',
        format: 'json',
      })

      const securityEvent: NotificationEvent = {
        id: 'evt-2',
        timestamp: '2024-01-15T10:30:00Z',
        event: 'security:auth-failure',
        severity: 'error',
        message: 'Authentication failure detected',
      }

      await adapter.send(securityEvent)

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.vmName).toBeUndefined()
      expect(body.event).toBe('security:auth-failure')
    })
  })
})
