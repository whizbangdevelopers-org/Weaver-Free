// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, relative } from 'node:path'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface ZodField {
  name: string
  constraints: string[]
  required: boolean
}

interface ZodSchema {
  schemaName: string
  endpoint?: string
  method?: string
  file: string
  fields: ZodField[]
}

interface FrontendRule {
  field: string
  component: string
  rules: string[]
  hasLazyRules: boolean
  hasValidateGate: boolean
}

interface FormValidationResult {
  schemas: ZodSchema[]
  frontendRules: FrontendRule[]
  parityIssues: string[]
  pattern: string
  warnings: string[]
}

function parseZodConstraints(fieldDef: string): string[] {
  const constraints: string[] = []
  if (/\.min\s*\(\s*1\s*\)/.test(fieldDef) || /nonempty/.test(fieldDef)) constraints.push('required (non-empty)')
  if (/\.min\s*\(\s*(\d+)\s*\)/.test(fieldDef)) {
    const m = fieldDef.match(/\.min\s*\(\s*(\d+)\s*\)/)
    if (m && m[1] !== '1') constraints.push(`min length: ${m[1]}`)
  }
  if (/\.max\s*\(\s*(\d+)\s*\)/.test(fieldDef)) {
    const m = fieldDef.match(/\.max\s*\(\s*(\d+)\s*\)/)
    if (m) constraints.push(`max length: ${m[1]}`)
  }
  if (/\.regex/.test(fieldDef)) constraints.push('regex pattern')
  if (/\.email/.test(fieldDef)) constraints.push('email format')
  if (/\.url/.test(fieldDef)) constraints.push('URL format')
  if (/\.int/.test(fieldDef)) constraints.push('integer')
  if (/\.optional/.test(fieldDef)) constraints.push('optional')
  if (/\.enum\s*\(/.test(fieldDef)) {
    const m = fieldDef.match(/\.enum\s*\(\s*\[([^\]]+)\]/)
    if (m) constraints.push(`enum: [${m[1]}]`)
  }
  if (/coerce/.test(fieldDef)) constraints.push('coerced (string→number)')
  return constraints
}

async function scanZodSchemas(projectRoot: string, routeFile?: string): Promise<ZodSchema[]> {
  const routesDir = resolve(projectRoot, 'backend/src/routes')
  const topFiles = await listFiles(routesDir, '.ts')
  const subDirs = await listDirs(routesDir)
  const subFiles: string[] = []
  for (const dir of subDirs) {
    const files = await listFiles(resolve(routesDir, dir), '.ts')
    subFiles.push(...files)
  }

  const allRouteFiles = [...topFiles, ...subFiles]
  const schemas: ZodSchema[] = []

  for (const filePath of allRouteFiles) {
    if (routeFile && !filePath.includes(routeFile)) continue

    const content = await safeReadFile(filePath)
    if (!content || !content.includes('z.object')) continue

    const relFile = relative(projectRoot, filePath)

    // Find z.object({ ... }) schema declarations
    // Match: const schemaName = z.object({...})
    const schemaRegex = /const\s+(\w+)\s*=\s*z\.object\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs
    let m: RegExpExecArray | null

    while ((m = schemaRegex.exec(content)) !== null) {
      const schemaName = m[1]
      const body = m[2]

      // Skip response schemas (usually named with 'Response' or 'Schema')
      if (schemaName.toLowerCase().includes('response') || schemaName.toLowerCase().includes('result')) continue

      // Extract fields
      const fieldRegex = /^\s+(\w+)\s*:\s*(.+?)(?=,?\n\s+\w+\s*:|,?\n\s*\})/gms
      const fields: ZodField[] = []
      let fm: RegExpExecArray | null

      while ((fm = fieldRegex.exec(body)) !== null) {
        const fieldName = fm[1]
        const fieldDef = fm[2].trim()
        const constraints = parseZodConstraints(fieldDef)
        const required = !fieldDef.includes('.optional') && !fieldDef.includes('optional()')
        fields.push({ name: fieldName, constraints, required })
      }

      if (fields.length === 0) continue

      // Find associated endpoint
      let endpoint: string | undefined
      let method: string | undefined
      const schemaUseIndex = content.indexOf(schemaName, m.index + m[0].length)
      if (schemaUseIndex > 0) {
        const context = content.slice(Math.max(0, schemaUseIndex - 300), schemaUseIndex)
        const routeMatch = context.match(/(?:app|fastify|router)\.(get|post|put|patch|delete)\s*\(\s*\n?\s*['"]([^'"]+)['"]/)
        if (routeMatch) {
          method = routeMatch[1].toUpperCase()
          endpoint = routeMatch[2]
        }
      }

      schemas.push({ schemaName, endpoint, method, file: relFile, fields })
    }
  }

  return schemas
}

async function scanFrontendRules(projectRoot: string, component?: string): Promise<FrontendRule[]> {
  const dirs = [
    resolve(projectRoot, 'src/components'),
    resolve(projectRoot, 'src/pages'),
  ]

  const vueFiles: string[] = []
  for (const dir of dirs) {
    const files = await listFiles(dir, '.vue')
    vueFiles.push(...files)
    // Recurse one level
    const subDirs = await listDirs(dir)
    for (const sub of subDirs) {
      const subFiles = await listFiles(resolve(dir, sub), '.vue')
      vueFiles.push(...subFiles)
    }
  }

  const rules: FrontendRule[] = []

  for (const filePath of vueFiles) {
    if (component && !filePath.includes(component)) continue

    const content = await safeReadFile(filePath)
    if (!content || !content.includes(':rules') || !content.includes('q-input')) continue

    const relFile = relative(projectRoot, filePath)

    // Find q-input elements with :rules
    const inputRegex = /<q-input[^>]*:rules\s*=\s*"([^"]+)"[^>]*(?:label\s*=\s*"([^"]+)")?/g
    let m: RegExpExecArray | null

    while ((m = inputRegex.exec(content)) !== null) {
      const rulesExpr = m[1]
      const label = m[2] || '(unlabeled)'

      // Check for lazy-rules on the same element
      const elementEnd = content.indexOf('>', m.index) + 1
      const elementStr = content.slice(m.index, elementEnd)
      const hasLazyRules = elementStr.includes('lazy-rules')

      rules.push({
        field: label,
        component: relFile,
        rules: [rulesExpr],
        hasLazyRules,
        hasValidateGate: content.includes('.validate()'),
      })
    }
  }

  return rules
}

export async function getFormValidationRules(
  projectRoot: string,
  route?: string,
  component?: string
): Promise<FormValidationResult> {
  const warnings: string[] = []

  const [schemas, frontendRules] = await Promise.all([
    scanZodSchemas(projectRoot, route),
    scanFrontendRules(projectRoot, component),
  ])

  // Basic parity issues: look for schemas with required fields that have no frontend rules
  const parityIssues: string[] = []

  // Check forms pattern: each schema should have a corresponding Vue component with :rules
  for (const schema of schemas) {
    const requiredFields = schema.fields.filter(f => f.required && f.constraints.length > 0)
    if (requiredFields.length === 0) continue

    // See if any frontend component has rules for these field names
    const matchingRules = frontendRules.filter(r =>
      requiredFields.some(f => r.field.toLowerCase().includes(f.name.toLowerCase()))
    )

    if (matchingRules.length === 0 && schema.endpoint) {
      parityIssues.push(
        `${schema.method ?? 'UNKNOWN'} ${schema.endpoint} (${schema.schemaName}): ` +
        `${requiredFields.length} required field(s) — no frontend :rules found. ` +
        `Run 'npm run audit:forms' for detailed parity report.`
      )
    }

    for (const rule of matchingRules) {
      if (!rule.hasLazyRules) {
        parityIssues.push(`${rule.component} field "${rule.field}": has :rules but missing lazy-rules (validates on every keystroke)`)
      }
      if (!rule.hasValidateGate) {
        parityIssues.push(`${rule.component}: has :rules but may be missing validate() gate on submit button — run 'npm run audit:forms'`)
      }
    }
  }

  return {
    schemas,
    frontendRules,
    parityIssues,
    pattern: [
      'Every q-dialog with q-input fields MUST have:',
      '1. Inline :rules on every input mirroring the backend Zod constraint (required, pattern, min, max)',
      '2. lazy-rules on each validated input (validates on blur/submit, not every keystroke)',
      '3. ref + validate() gate on submit — call field.validate() on all refs, abort if hasError',
      '4. $q.notify in catch block as fallback for server-side errors that bypass client rules',
      'See BridgeManager.vue for the reference implementation of this pattern.',
      'Run npm run audit:forms for the authoritative parity report (verify-form-rules.ts).',
    ].join('\n'),
    warnings,
  }
}
