// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AuditStore } from '../../src/storage/audit-store.js'
import { AuditService } from '../../src/services/audit.js'

describe('AuditService', () => {
  let testDir: string
  let auditStore: AuditStore
  let auditService: AuditService

  beforeEach(async () => {
    testDir = join(tmpdir(), `audit-service-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    auditStore = new AuditStore(join(testDir, 'audit-log.json'))
    await auditStore.init()
    auditService = new AuditService(auditStore)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('log', () => {
    it('should create an audit entry with all fields', async () => {
      const entry = await auditService.log({
        userId: 'user-1',
        username: 'admin',
        action: 'vm.start',
        resource: 'web-nginx',
        details: { reason: 'manual' },
        ip: '192.168.1.1',
        success: true,
      })

      expect(entry.id).toBeDefined()
      expect(entry.timestamp).toBeDefined()
      expect(entry.userId).toBe('user-1')
      expect(entry.username).toBe('admin')
      expect(entry.action).toBe('vm.start')
      expect(entry.resource).toBe('web-nginx')
      expect(entry.details).toEqual({ reason: 'manual' })
      expect(entry.ip).toBe('192.168.1.1')
      expect(entry.success).toBe(true)
    })

    it('should create entry with null userId for failed logins', async () => {
      const entry = await auditService.log({
        userId: null,
        username: 'baduser',
        action: 'user.login',
        ip: '10.0.0.1',
        success: false,
      })

      expect(entry.userId).toBeNull()
      expect(entry.success).toBe(false)
    })

    it('should generate unique IDs', async () => {
      const entry1 = await auditService.log({
        userId: 'user-1',
        username: 'admin',
        action: 'vm.start',
        success: true,
      })

      const entry2 = await auditService.log({
        userId: 'user-1',
        username: 'admin',
        action: 'vm.stop',
        success: true,
      })

      expect(entry1.id).not.toBe(entry2.id)
    })

    it('should generate ISO 8601 timestamps', async () => {
      const entry = await auditService.log({
        userId: 'user-1',
        username: 'admin',
        action: 'vm.start',
        success: true,
      })

      // Should be valid ISO 8601
      const parsed = new Date(entry.timestamp)
      expect(parsed.toISOString()).toBe(entry.timestamp)
    })

    it('should persist entries to the store', async () => {
      await auditService.log({
        userId: 'user-1',
        username: 'admin',
        action: 'vm.start',
        success: true,
      })

      expect(auditStore.count()).toBe(1)
    })
  })

  describe('query', () => {
    it('should delegate to store query', async () => {
      await auditService.log({
        userId: 'user-1',
        username: 'admin',
        action: 'vm.start',
        resource: 'web-nginx',
        success: true,
      })

      await auditService.log({
        userId: 'user-2',
        username: 'operator',
        action: 'vm.stop',
        resource: 'dev-node',
        success: true,
      })

      const result = auditService.query({ userId: 'user-1' })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].username).toBe('admin')
    })

    it('should return paginated results', async () => {
      for (let i = 0; i < 5; i++) {
        await auditService.log({
          userId: 'user-1',
          username: 'admin',
          action: 'vm.start',
          success: true,
        })
      }

      const result = auditService.query({ limit: 2, offset: 0 })
      expect(result.entries).toHaveLength(2)
      expect(result.total).toBe(5)
    })
  })
})
