// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const cidrPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/

function ipToNum(ip: string): number {
  const p = ip.split('.').map(Number)
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0
}

const hostIp = z.string().regex(ipv4Pattern, 'Must be IPv4 address').refine(
  (ip) => { const last = Number(ip.split('.')[3]); return last !== 0 && last !== 255 },
  'Last octet cannot be 0 (network) or 255 (broadcast)',
)

export const bridgeNameSchema = z.object({
  name: z.string().min(1).max(16).regex(/^[a-zA-Z][a-zA-Z0-9-]*$/, 'Invalid bridge name'),
})

export const createBridgeSchema = z.object({
  name: z.string().min(1).max(16).regex(/^[a-zA-Z][a-zA-Z0-9-]*$/, 'Invalid bridge name'),
  subnet: z.string().regex(cidrPattern, 'Must be CIDR notation (e.g. 10.10.0.0/24)'),
  gateway: z.string().regex(ipv4Pattern, 'Must be IPv4 address'),
})

export const ipPoolSchema = z.object({
  start: hostIp,
  end: hostIp,
  allocated: z.array(z.string().regex(ipv4Pattern)).default([]),
}).refine(
  (data) => ipToNum(data.start) <= ipToNum(data.end),
  { message: 'Start IP must be less than or equal to end IP', path: ['end'] },
)

export const firewallRuleSchema = z.object({
  source: z.string().regex(ipv4Pattern, 'Must be IPv4 address').or(z.string().regex(cidrPattern, 'Must be CIDR notation')),
  destination: z.string().regex(ipv4Pattern, 'Must be IPv4 address').or(z.string().regex(cidrPattern, 'Must be CIDR notation')),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']),
  action: z.enum(['allow', 'deny']),
})

export const firewallRuleIdSchema = z.object({
  id: z.string().uuid(),
})

export const vmNameSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid VM name'),
})

const optionalIpv4 = z.union([z.literal(''), z.string().regex(ipv4Pattern, 'Must be IPv4 address')]).optional()

export const vmNetworkConfigSchema = z.object({
  ip: optionalIpv4,
  bridge: z.string().optional(),
  gateway: optionalIpv4,
  dns: optionalIpv4,
})
