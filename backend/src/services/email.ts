// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { createTransport, type Transporter } from 'nodemailer'
import { TIERS } from '../constants/vocabularies.js'

// ---------------------------------------------------------------------------
// SMTP configuration
// ---------------------------------------------------------------------------

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  replyTo: string
}

// ---------------------------------------------------------------------------
// Email service — transactional emails (license delivery, etc.)
// ---------------------------------------------------------------------------

export class EmailService {
  private transporter: Transporter
  private from: string

  private replyTo: string

  constructor(config: SmtpConfig) {
    this.from = config.from
    this.replyTo = config.replyTo
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })
  }

  /** Verify SMTP connection is reachable. */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch {
      return false
    }
  }

  /** Send the license key to the customer after Stripe checkout completes. */
  async sendLicenseKey(opts: {
    to: string
    licenseKey: string
    tier: string
    expiresAt: string
    foundingMember: boolean
    siteUrl: string
  }): Promise<void> {
    const tierLabel = opts.tier === TIERS.FABRICK ? 'FabricK' : 'Weaver'
    const fmBadge = opts.foundingMember ? ' (Founding Member)' : ''
    const subject = `Your ${tierLabel} License Key${fmBadge}`

    const html = buildLicenseEmailHtml({
      licenseKey: opts.licenseKey,
      tierLabel,
      foundingMember: opts.foundingMember,
      expiresAt: opts.expiresAt,
      siteUrl: opts.siteUrl,
    })

    const text = buildLicenseEmailText({
      licenseKey: opts.licenseKey,
      tierLabel,
      foundingMember: opts.foundingMember,
      expiresAt: opts.expiresAt,
      siteUrl: opts.siteUrl,
    })

    await this.transporter.sendMail({
      from: this.from,
      replyTo: this.replyTo,
      to: opts.to,
      subject,
      html,
      text,
    })
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface LicenseEmailData {
  licenseKey: string
  tierLabel: string
  foundingMember: boolean
  expiresAt: string
  siteUrl: string
}

function buildLicenseEmailHtml(data: LicenseEmailData): string {
  const fmSection = data.foundingMember
    ? `<p style="color: #FF6B35; font-weight: bold;">🎉 Thank you for being a Founding Member! Your pricing is locked for life.</p>`
    : ''

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Welcome to ${escapeHtml(data.tierLabel)}</h1>
  ${fmSection}
  <p>Your license key is ready. Use it to activate your Weaver instance.</p>

  <div style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 24px 0; font-family: monospace; font-size: 16px; word-break: break-all;">
    ${escapeHtml(data.licenseKey)}
  </div>

  <table style="border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 6px 16px 6px 0; font-weight: bold; color: #555;">Tier</td>
      <td style="padding: 6px 0;">${escapeHtml(data.tierLabel)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; font-weight: bold; color: #555;">Expires</td>
      <td style="padding: 6px 0;">${escapeHtml(new Date(data.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</td>
    </tr>
  </table>

  <h2 style="font-size: 18px; margin-top: 32px;">Activation</h2>
  <ol style="line-height: 1.8;">
    <li>Set <code>LICENSE_KEY</code> in your Weaver environment (or <code>LICENSE_KEY_FILE</code> for sops-nix)</li>
    <li>Set <code>LICENSE_HMAC_SECRET</code> to the HMAC secret from your account</li>
    <li>Restart Weaver — the license tier activates automatically</li>
  </ol>

  <p style="margin-top: 24px;">
    <a href="${escapeHtml(data.siteUrl)}/docs/activation" style="display: inline-block; background: #FF6B35; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Activation Guide</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;" />
  <p style="color: #888; font-size: 13px;">
    Keep this key confidential. If you believe it has been compromised, visit your
    <a href="${escapeHtml(data.siteUrl)}/account" style="color: #FF6B35;">account portal</a> to rotate it.
  </p>
  <p style="color: #888; font-size: 13px;">
    &copy; ${new Date().getFullYear()} WhizBang Developers LLC &mdash; <a href="${escapeHtml(data.siteUrl)}" style="color: #FF6B35;">${escapeHtml(data.siteUrl)}</a>
  </p>
</div>`.trim()
}

function buildLicenseEmailText(data: LicenseEmailData): string {
  const fmLine = data.foundingMember
    ? 'Thank you for being a Founding Member! Your pricing is locked for life.\n\n'
    : ''
  const expires = new Date(data.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return [
    `Welcome to ${data.tierLabel}`,
    '='.repeat(30),
    '',
    fmLine,
    'Your license key:',
    '',
    `  ${data.licenseKey}`,
    '',
    `Tier: ${data.tierLabel}`,
    `Expires: ${expires}`,
    '',
    'Activation',
    '-'.repeat(20),
    '1. Set LICENSE_KEY in your Weaver environment (or LICENSE_KEY_FILE for sops-nix)',
    '2. Set LICENSE_HMAC_SECRET to the HMAC secret from your account',
    '3. Restart Weaver — the license tier activates automatically',
    '',
    `Full guide: ${data.siteUrl}/docs/activation`,
    '',
    'Keep this key confidential. If you believe it has been compromised,',
    `visit ${data.siteUrl}/account to rotate it.`,
    '',
    `© ${new Date().getFullYear()} WhizBang Developers LLC — ${data.siteUrl}`,
  ].join('\n')
}
