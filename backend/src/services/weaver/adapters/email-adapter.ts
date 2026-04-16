// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { createTransport, type Transporter } from 'nodemailer'
import type { NotificationAdapter } from '../../adapters/notification-adapter.js'
import type { NotificationEvent } from '../../../models/notification.js'

export interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  fromAddress: string
  recipients: string[]
}

const SEVERITY_EMOJI: Record<string, string> = {
  info: '\u2139\uFE0F',
  success: '\u2705',
  error: '\u274C',
}

export class EmailAdapter implements NotificationAdapter {
  readonly name = 'email'
  private transporter: Transporter
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
    this.transporter = createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    })
  }

  // SEC-013: escape HTML to prevent injection via VM names, messages, etc.
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  async send(event: NotificationEvent): Promise<void> {
    const emoji = SEVERITY_EMOJI[event.severity] || ''
    const subject = `${emoji} Weaver: ${event.message}`

    const e = this.escapeHtml.bind(this)
    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #1976D2;">Weaver Notification</h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; font-weight: bold;">Event</td><td style="padding: 8px;">${e(event.event)}</td></tr>
          ${event.vmName ? `<tr><td style="padding: 8px; font-weight: bold;">VM</td><td style="padding: 8px;">${e(event.vmName)}</td></tr>` : ''}
          <tr><td style="padding: 8px; font-weight: bold;">Severity</td><td style="padding: 8px;">${e(event.severity)}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Message</td><td style="padding: 8px;">${e(event.message)}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${e(event.timestamp)}</td></tr>
        </table>
        ${event.details ? `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${e(JSON.stringify(event.details, null, 2))}</pre>` : ''}
      </div>
    `.trim()

    await this.transporter.sendMail({
      from: this.config.fromAddress,
      to: this.config.recipients.join(', '),
      subject,
      html,
    })
  }

  async test(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch {
      return false
    }
  }
}
