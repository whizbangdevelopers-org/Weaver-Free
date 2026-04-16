// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendMail = vi.fn().mockResolvedValue({ messageId: '<test@example.com>' })
const mockVerify = vi.fn().mockResolvedValue(true)

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}))

import { EmailService } from '../../src/services/email.js'
import { createTransport } from 'nodemailer'

const testSmtpConfig = {
  host: 'smtp.test.local',
  port: 587,
  secure: false,
  user: 'testuser',
  pass: 'testpass',
  from: 'Weaver <licenses@test.local>',
  replyTo: 'Weaver Support <support@test.local>',
}

describe('EmailService', () => {
  let service: EmailService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new EmailService(testSmtpConfig)
  })

  describe('constructor', () => {
    it('creates nodemailer transporter with SMTP config', () => {
      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.local',
        port: 587,
        secure: false,
        auth: {
          user: 'testuser',
          pass: 'testpass',
        },
      })
    })
  })

  describe('verify', () => {
    it('returns true when SMTP connection succeeds', async () => {
      expect(await service.verify()).toBe(true)
      expect(mockVerify).toHaveBeenCalledOnce()
    })

    it('returns false when SMTP connection fails', async () => {
      mockVerify.mockRejectedValueOnce(new Error('Connection refused'))
      expect(await service.verify()).toBe(false)
    })
  })

  describe('sendLicenseKey', () => {
    const baseLicenseOpts = {
      to: 'customer@example.com',
      licenseKey: 'WVR-WVS-ABCD1234EFGH-X1Y2',
      tier: 'weaver',
      expiresAt: '2027-04-08T00:00:00.000Z',
      foundingMember: false,
      siteUrl: 'https://whizbangdevelopers.com',
    }

    it('sends email with correct recipient and from address', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      expect(mockSendMail).toHaveBeenCalledOnce()
      const call = mockSendMail.mock.calls[0][0]
      expect(call.from).toBe('Weaver <licenses@test.local>')
      expect(call.replyTo).toBe('Weaver Support <support@test.local>')
      expect(call.to).toBe('customer@example.com')
    })

    it('includes license key in HTML body', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).toContain('WVR-WVS-ABCD1234EFGH-X1Y2')
    })

    it('includes license key in plain text body', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.text).toContain('WVR-WVS-ABCD1234EFGH-X1Y2')
    })

    it('uses Weaver label for weaver tier', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.subject).toBe('Your Weaver License Key')
      expect(call.html).toContain('Welcome to Weaver')
      expect(call.text).toContain('Welcome to Weaver')
    })

    it('uses FabricK label for fabrick tier', async () => {
      await service.sendLicenseKey({ ...baseLicenseOpts, tier: 'fabrick' })

      const call = mockSendMail.mock.calls[0][0]
      expect(call.subject).toBe('Your FabricK License Key')
      expect(call.html).toContain('Welcome to FabricK')
    })

    it('includes Founding Member badge in subject and body', async () => {
      await service.sendLicenseKey({ ...baseLicenseOpts, foundingMember: true })

      const call = mockSendMail.mock.calls[0][0]
      expect(call.subject).toBe('Your Weaver License Key (Founding Member)')
      expect(call.html).toContain('Founding Member')
      expect(call.html).toContain('locked for life')
      expect(call.text).toContain('Founding Member')
    })

    it('omits Founding Member section when not FM', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).not.toContain('locked for life')
    })

    it('includes activation instructions', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).toContain('LICENSE_KEY')
      expect(call.html).toContain('LICENSE_HMAC_SECRET')
      expect(call.html).toContain('Restart Weaver')
      expect(call.text).toContain('LICENSE_KEY')
    })

    it('includes site URL links', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).toContain('https://whizbangdevelopers.com/docs/activation')
      expect(call.html).toContain('https://whizbangdevelopers.com/account')
      expect(call.text).toContain('https://whizbangdevelopers.com/docs/activation')
    })

    it('includes expiry date in human-readable format', async () => {
      await service.sendLicenseKey(baseLicenseOpts)

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).toContain('April')
      expect(call.html).toContain('2027')
      expect(call.text).toContain('April')
    })

    it('escapes HTML in license key', async () => {
      await service.sendLicenseKey({
        ...baseLicenseOpts,
        licenseKey: 'WVR-<script>alert(1)</script>',
      })

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).not.toContain('<script>')
      expect(call.html).toContain('&lt;script&gt;')
    })

    it('propagates transporter errors', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP timeout'))

      await expect(service.sendLicenseKey(baseLicenseOpts)).rejects.toThrow('SMTP timeout')
    })
  })
})
