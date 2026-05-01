// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface PortEntry {
  purpose: string
  frontend: number | null
  backend: number | null
  envOverride: string
}

interface PortLayoutResult {
  ports: PortEntry[]
  envVars: Array<{ name: string; default: string; description: string }>
  /** Raw content of docs/development/PORT-ALLOCATION.md — authoritative reference */
  rawAllocation: string | null
  warnings: string[]
}

export async function getPortLayout(projectRoot: string): Promise<PortLayoutResult> {
  const warnings: string[] = []

  // Known port layout from project conventions
  const ports: PortEntry[] = [
    { purpose: 'NixOS service (production)', frontend: null, backend: 3100, envOverride: 'PORT' },
    { purpose: 'Development', frontend: 9010, backend: 3110, envOverride: 'QUASAR_DEV_PORT / PORT' },
    { purpose: 'E2E testing', frontend: 9020, backend: 3120, envOverride: 'QUASAR_DEV_PORT / PORT' },
    { purpose: 'E2E live', frontend: null, backend: 3130, envOverride: 'PORT' },
    { purpose: 'Public demo (local testing)', frontend: 9030, backend: null, envOverride: 'QUASAR_DEV_PORT' },
    { purpose: 'Private demo (local testing)', frontend: 9040, backend: null, envOverride: 'QUASAR_DEV_PORT' },
  ]

  // Verify from quasar.config.cjs
  const quasarConfig = await safeReadFile(resolve(projectRoot, 'quasar.config.cjs'))
  if (quasarConfig) {
    const portMatch = quasarConfig.match(/port:\s*(?:Number\()?process\.env\.QUASAR_DEV_PORT\)?\s*\|\|\s*(\d+)/)
    if (portMatch) {
      const parsed = parseInt(portMatch[1], 10)
      if (parsed !== 9010) warnings.push(`quasar.config.cjs default port is ${parsed}, expected 9010`)
    }

    const proxyMatch = quasarConfig.match(/QUASAR_API_PORT\s*\|\|\s*(\d+)/)
    if (proxyMatch) {
      const parsed = parseInt(proxyMatch[1], 10)
      if (parsed !== 3110) warnings.push(`quasar.config.cjs proxy port is ${parsed}, expected 3110`)
    }
  } else {
    warnings.push('Could not read quasar.config.cjs')
  }

  const envVars = [
    { name: 'QUASAR_DEV_PORT', default: '9010', description: 'Quasar dev server port' },
    { name: 'QUASAR_API_PORT', default: '3110', description: 'Backend API port (used by Quasar proxy)' },
    { name: 'PORT', default: '3110', description: 'Fastify backend listen port' },
    { name: 'HOST', default: '0.0.0.0', description: 'Fastify backend bind address' },
  ]

  const rawAllocation = await safeReadFile(resolve(projectRoot, 'docs/development/PORT-ALLOCATION.md'))
  if (!rawAllocation) warnings.push('Could not read docs/development/PORT-ALLOCATION.md')

  return { ports, envVars, rawAllocation, warnings }
}
