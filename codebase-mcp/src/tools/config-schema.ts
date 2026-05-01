// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface EnvVarInfo {
  name: string
  configField: string
  default: string
  description: string
  source: string
}

interface ConfigSchemaResult {
  interface: string
  envVars: EnvVarInfo[]
  supportedTypes: Record<string, string[]>
  warnings: string[]
}

export async function getConfigSchema(projectRoot: string): Promise<ConfigSchemaResult> {
  const warnings: string[] = []
  const configPath = resolve(projectRoot, 'backend/src/config.ts')
  const content = await safeReadFile(configPath)

  if (!content) {
    return { interface: '', envVars: [], supportedTypes: {}, warnings: ['Could not read backend/src/config.ts'] }
  }

  // Extract DashboardConfig interface
  const interfaceMatch = content.match(/(export\s+)?interface\s+DashboardConfig\s*\{[\s\S]*?\n\}/)
  const interfaceText = interfaceMatch ? interfaceMatch[0] : ''

  // Extract env vars from config.ts
  const envVars = extractEnvVars(content, 'config.ts')

  // Also scan index.ts for env vars defined outside the config module
  // (e.g. INITIAL_ADMIN_PASSWORD, STATIC_DIR)
  const indexPath = resolve(projectRoot, 'backend/src/index.ts')
  const indexContent = await safeReadFile(indexPath)
  if (indexContent) {
    const indexVars = extractEnvVars(indexContent, 'index.ts')
    const seen = new Set(envVars.map(v => v.name))
    for (const v of indexVars) {
      if (!seen.has(v.name)) {
        envVars.push(v)
        seen.add(v.name)
      }
    }
  }

  // Sort by name for consistent output
  envVars.sort((a, b) => a.name.localeCompare(b.name))

  const supportedTypes: Record<string, string[]> = {
    tier: ['demo', 'free', 'weaver', 'fabrick'],
    storageBackend: ['json', 'sqlite'],
    sessionStoreType: ['memory', 'sqlite'],
  }

  return { interface: interfaceText, envVars, supportedTypes, warnings }
}

function extractEnvVars(content: string, source: string): EnvVarInfo[] {
  const envVars: EnvVarInfo[] = []
  const envRegex = /process\.env\.(\w+)/g
  let match: RegExpExecArray | null
  const seen = new Set<string>()

  while ((match = envRegex.exec(content)) !== null) {
    const name = match[1]
    if (seen.has(name)) continue
    // Skip NODE_ENV — it's a runtime standard, not a config var
    if (name === 'NODE_ENV') { seen.add(name); continue }
    seen.add(name)

    // Get the line containing this env var reference
    const lineStart = content.lastIndexOf('\n', match.index) + 1
    const lineEnd = content.indexOf('\n', match.index)
    const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()

    // Try to find the default value: process.env.X ?? 'val' or process.env.X || 'val'
    const defaultMatch = line.match(new RegExp(`process\\.env\\.${name}\\s*(?:\\)\\s*)?(?:\\|\\||\\?\\?)\\s*['"]?([^'",\\s)]+)['"]?`))
    // Filter out false matches where default is another process.env reference
    const rawDefault = defaultMatch ? defaultMatch[1] : ''
    const defaultVal = rawDefault.startsWith('process.env') ? '' : rawDefault

    // Try to map to config field from assignment patterns:
    // Pattern 1: "fieldName: process.env.X" (return object)
    // Pattern 2: "const fieldName = process.env.X" (standalone)
    let configField = ''
    const objectFieldMatch = line.match(/(\w+)\s*:\s*(?:\([^)]*\)\s*)?process\.env/)
    const constFieldMatch = line.match(/(?:const|let)\s+(\w+)\s*=/)
    if (objectFieldMatch) {
      configField = objectFieldMatch[1]
    } else if (constFieldMatch) {
      configField = constFieldMatch[1]
    }

    envVars.push({
      name,
      configField,
      default: defaultVal,
      description: '',
      source: `backend/src/${source}`,
    })
  }

  return envVars
}
