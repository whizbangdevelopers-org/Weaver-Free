// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

const notificationEventSchema = z.enum([
  'vm:started',
  'vm:stopped',
  'vm:failed',
  'vm:recovered',
  'resource:high-cpu',
  'resource:high-memory',
  'security:auth-failure',
  'security:unauthorized-access',
  'security:permission-denied',
])

const channelBaseSchema = {
  enabled: z.boolean(),
  events: z.array(notificationEventSchema).min(1, 'At least one event is required'),
}

const inAppChannelSchema = z.object({
  ...channelBaseSchema,
  type: z.literal('in-app'),
})

const ntfyChannelSchema = z.object({
  ...channelBaseSchema,
  type: z.literal('ntfy'),
  url: z.string().url('Must be a valid URL'),
  topic: z.string().min(1, 'Topic is required'),
  token: z.string().optional(),
})

const emailChannelSchema = z.object({
  ...channelBaseSchema,
  type: z.literal('email'),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1, 'SMTP user is required'),
  smtpPass: z.string().min(1, 'SMTP password is required'),
  smtpSecure: z.boolean(),
  fromAddress: z.string().email('Must be a valid email address'),
  recipients: z.array(z.string().email('Must be a valid email address')).min(1, 'At least one recipient is required'),
})

const webhookChannelSchema = z.object({
  ...channelBaseSchema,
  type: z.literal('webhook'),
  url: z.string().url('Must be a valid URL'),
  method: z.enum(['POST', 'PUT']),
  headers: z.record(z.string()).optional(),
  format: z.enum(['json', 'slack', 'discord', 'pagerduty']),
})

const webPushChannelSchema = z.object({
  ...channelBaseSchema,
  type: z.literal('web-push'),
  vapidPublicKey: z.string().min(1, 'VAPID public key is required'),
  vapidPrivateKey: z.string().min(1, 'VAPID private key is required'),
  vapidSubject: z.string().min(1, 'VAPID subject is required'),
})

export const channelConfigSchema = z.discriminatedUnion('type', [
  inAppChannelSchema,
  ntfyChannelSchema,
  emailChannelSchema,
  webhookChannelSchema,
  webPushChannelSchema,
])

export const resourceAlertsSchema = z.object({
  cpuThresholdPercent: z.number().int().min(1).max(100).optional(),
  memoryThresholdPercent: z.number().int().min(1).max(100).optional(),
  checkIntervalSeconds: z.number().int().min(10).max(3600).optional(),
})

export const channelIdSchema = z.object({
  channelId: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Invalid channel ID'),
})
