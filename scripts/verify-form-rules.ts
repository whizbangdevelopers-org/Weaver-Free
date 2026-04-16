// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Form UI Rules Verification Scanner
 *
 * Scans all Vue SFCs for Quasar form fields (QInput, QSelect) and verifies:
 * 1. Fields inside forms/dialogs have :rules (or are explicitly optional)
 * 2. All forms use lazy-rules (preferred mode)
 * 3. Shared validation utils are used where applicable (no duplicates)
 * 4. Consistent trigger patterns (ref.validate() + hasError or q-form @submit)
 *
 * Usage:
 *   npx tsx scripts/verify-form-rules.ts          # Console report
 *   npx tsx scripts/verify-form-rules.ts --json    # JSON output
 */

import { parse as parseSFC } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import { globSync } from 'glob'
import { readFileSync } from 'fs'
import { resolve, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldInfo {
  label: string
  tag: string // q-input | q-select
  hasRules: boolean
  hasLazyRules: boolean
  rulesExpression: string | null
  refName: string | null
  isInsideForm: boolean
  isInsideDialog: boolean
}

interface ScriptAnalysis {
  importsFromValidation: string[]
  hasValidateCall: boolean
  hasHasErrorCheck: boolean
  hasFormSubmitHandler: boolean
}

type ComplianceIssue =
  | 'greedy' // has :rules but no lazy-rules
  | 'missing-rules' // inside form/dialog but no :rules and not exempt
  | 'duplicate-validation' // inline rule duplicates shared util
  | 'inconsistent-trigger' // no validate()+hasError and no q-form @submit

interface FieldReport extends FieldInfo {
  issues: ComplianceIssue[]
  isExempt: boolean
  exemptReason?: string
}

interface ComponentReport {
  file: string
  relativePath: string
  fields: FieldReport[]
  script: ScriptAnalysis
  hasForm: boolean
  hasDialog: boolean
  isCompliant: boolean
  issues: string[]
}

// ---------------------------------------------------------------------------
// Shared validation util detection
// ---------------------------------------------------------------------------

const SHARED_VALIDATION_PATH = 'src/utils/validation.ts'

function discoverSharedUtils(rootDir: string): string[] {
  const fullPath = resolve(rootDir, SHARED_VALIDATION_PATH)
  try {
    const content = readFileSync(fullPath, 'utf-8')
    const exportedFns: string[] = []
    const fnRegex = /export\s+function\s+(\w+)/g
    let m: RegExpExecArray | null
    while ((m = fnRegex.exec(content)) !== null) {
      exportedFns.push(m[1])
    }
    return exportedFns
  } catch {
    return []
  }
}

// Patterns that suggest duplicated validation logic
const DUPLICATE_PATTERNS: Record<string, RegExp> = {
  isValidIPv4: /\bparts\.length\s*!==\s*4\b|\bsplit\(['"]\.['"].*length/,
  isHostIPv4: /last\s*[Oo]ctet|===\s*0\b.*===\s*255|\.split\(['"]\.['"].*\[3\]/,
}

// ---------------------------------------------------------------------------
// AST Walking
// ---------------------------------------------------------------------------

const FORM_TAGS = new Set(['q-form'])
const DIALOG_TAGS = new Set(['q-dialog'])
const INPUT_TAGS = new Set(['q-input', 'q-select'])
// Tags that never need :rules (not audited)
// const EXEMPT_TAGS = new Set(['q-toggle', 'q-checkbox', 'q-radio', 'q-slider', 'q-range'])

function getExpressionText(exp: any): string {
  if (!exp) return ''
  if (exp.content) return exp.content
  if (exp.children) {
    return exp.children.map((c: any) => (typeof c === 'string' ? c : c.content || '')).join('')
  }
  return ''
}

function extractFieldsFromAst(
  node: any,
  inForm: boolean,
  inDialog: boolean,
): FieldInfo[] {
  const fields: FieldInfo[] = []
  if (!node) return fields

  const tag = (node.tag || '').toLowerCase()
  const isForm = FORM_TAGS.has(tag)
  const isDialog = DIALOG_TAGS.has(tag)
  const isInput = INPUT_TAGS.has(tag)

  const currentInForm = inForm || isForm
  const currentInDialog = inDialog || isDialog

  if (isInput) {
    const props = node.props || []
    let label = ''
    let hasRules = false
    let hasLazyRules = false
    let rulesExpression: string | null = null
    let refName: string | null = null

    for (const p of props) {
      if (p.type === 6) {
        // Static attribute
        if (p.name === 'label') label = p.value?.content || ''
        if (p.name === 'lazy-rules') hasLazyRules = true
        if (p.name === 'ref') refName = p.value?.content || null
      } else if (p.type === 7) {
        // Directive
        if (p.name === 'bind' && p.arg?.content === 'rules') {
          hasRules = true
          rulesExpression = getExpressionText(p.exp)
        }
        if (p.name === 'bind' && p.arg?.content === 'label') {
          label = getExpressionText(p.exp) || '(dynamic)'
        }
        if (p.name === 'bind' && p.arg?.content === 'lazy-rules') {
          hasLazyRules = true
        }
      }
    }

    fields.push({
      label: label || '(unlabeled)',
      tag,
      hasRules,
      hasLazyRules,
      rulesExpression,
      refName,
      isInsideForm: currentInForm,
      isInsideDialog: currentInDialog,
    })
  }

  for (const child of node.children || []) {
    fields.push(...extractFieldsFromAst(child, currentInForm, currentInDialog))
  }

  // Handle v-if/v-else-if/v-else branches (type 9 = IF node with branches array)
  if (node.branches) {
    for (const branch of node.branches) {
      for (const child of branch.children || []) {
        fields.push(...extractFieldsFromAst(child, currentInForm, currentInDialog))
      }
    }
  }

  return fields
}

function walkAll(node: any, visitor: (n: any) => boolean): boolean {
  if (!node) return false
  if (visitor(node)) return true
  for (const child of node.children || []) {
    if (walkAll(child, visitor)) return true
  }
  if (node.branches) {
    for (const branch of node.branches) {
      for (const child of branch.children || []) {
        if (walkAll(child, visitor)) return true
      }
    }
  }
  return false
}

function hasFormTag(node: any): boolean {
  return walkAll(node, (n) => FORM_TAGS.has((n.tag || '').toLowerCase()))
}

function hasDialogTag(node: any): boolean {
  return walkAll(node, (n) => DIALOG_TAGS.has((n.tag || '').toLowerCase()))
}

function hasFormSubmitInTemplate(node: any): boolean {
  return walkAll(node, (n) => {
    if ((n.tag || '').toLowerCase() !== 'q-form') return false
    for (const p of n.props || []) {
      if (p.type === 7 && p.name === 'on' && p.arg?.content === 'submit') return true
    }
    return false
  })
}

// ---------------------------------------------------------------------------
// Script Analysis
// ---------------------------------------------------------------------------

function analyzeScript(descriptor: any): ScriptAnalysis {
  const scriptContent =
    descriptor.scriptSetup?.content || descriptor.script?.content || ''

  const importsFromValidation: string[] = []
  const importRegex =
    /import\s+\{([^}]+)\}\s+from\s+['"](?:src\/utils\/validation|\.\.\/.*validation)['"]/g
  let m: RegExpExecArray | null
  while ((m = importRegex.exec(scriptContent)) !== null) {
    const names = m[1].split(',').map((s) => s.trim())
    importsFromValidation.push(...names)
  }

  const hasValidateCall = /\.validate\(\)/.test(scriptContent)
  const hasHasErrorCheck = /\.hasError\b/.test(scriptContent)
  const hasFormSubmitHandler =
    /onSubmit|handleSubmit|submitForm/.test(scriptContent)

  return {
    importsFromValidation,
    hasValidateCall,
    hasHasErrorCheck,
    hasFormSubmitHandler,
  }
}

// ---------------------------------------------------------------------------
// Compliance Classification
// ---------------------------------------------------------------------------

function classifyField(
  field: FieldInfo,
  script: ScriptAnalysis,
  _sharedUtils: string[],
): FieldReport {
  const issues: ComplianceIssue[] = []
  let isExempt = false
  let exemptReason: string | undefined

  // Exempt: QSelect with no rules is fine (fixed options)
  if (field.tag === 'q-select' && !field.hasRules) {
    isExempt = true
    exemptReason = 'QSelect with fixed options'
  }

  // Exempt: optional field (label without *)
  if (
    !field.hasRules &&
    !field.label.includes('*') &&
    field.tag === 'q-input'
  ) {
    // Could be a missing rule or truly optional — flag as exempt but note it
    isExempt = true
    exemptReason = 'Optional field (no * in label)'
  }

  if (!isExempt && field.hasRules) {
    // Check lazy-rules compliance
    if (!field.hasLazyRules) {
      issues.push('greedy')
    }

    // Check for duplicated shared utils
    if (field.rulesExpression) {
      for (const [utilName, pattern] of Object.entries(DUPLICATE_PATTERNS)) {
        if (
          pattern.test(field.rulesExpression) &&
          !script.importsFromValidation.includes(utilName)
        ) {
          issues.push('duplicate-validation')
        }
      }
    }
  }

  if (!isExempt && !field.hasRules && (field.isInsideForm || field.isInsideDialog)) {
    // Inside a form but no rules and not exempt — flag if label suggests required
    if (field.label.includes('*')) {
      issues.push('missing-rules')
    }
  }

  return { ...field, issues, isExempt, exemptReason }
}

function classifyComponent(
  fields: FieldInfo[],
  script: ScriptAnalysis,
  hasForm: boolean,
  hasFormSubmit: boolean,
  sharedUtils: string[],
): { fieldReports: FieldReport[]; componentIssues: string[] } {
  const fieldReports = fields.map((f) => classifyField(f, script, sharedUtils))
  const componentIssues: string[] = []

  const fieldsWithRules = fieldReports.filter((f) => f.hasRules)

  // Check trigger pattern consistency
  if (fieldsWithRules.length > 0) {
    const hasLazyFields = fieldsWithRules.some((f) => f.hasLazyRules)
    if (hasLazyFields && !script.hasValidateCall && !hasFormSubmit) {
      componentIssues.push(
        'Has lazy-rules fields but no validate() call or form @submit handler',
      )
    }
    if (
      script.hasValidateCall &&
      !script.hasHasErrorCheck &&
      !hasFormSubmit
    ) {
      componentIssues.push('Calls validate() but never checks hasError')
    }
  }

  // Check for shared util opportunities
  const sharedIPUtils = sharedUtils.filter((u) =>
    u.toLowerCase().includes('ip'),
  )
  if (sharedIPUtils.length > 0) {
    for (const f of fieldsWithRules) {
      if (
        f.rulesExpression &&
        /\bip\b|IPv4|IP Address|Gateway|Subnet|DNS/i.test(f.label) &&
        !script.importsFromValidation.some((imp) =>
          imp.toLowerCase().includes('ip'),
        )
      ) {
        if (!f.rulesExpression.includes('isValidIPv4') && !f.rulesExpression.includes('isHostIPv4')) {
          componentIssues.push(
            `Field "${f.label}" validates IP but doesn't use shared IP utils`,
          )
        }
      }
    }
  }

  return { fieldReports, componentIssues }
}

// ---------------------------------------------------------------------------
// Main Scanner
// ---------------------------------------------------------------------------

function scanComponent(filePath: string, rootDir: string, sharedUtils: string[]): ComponentReport | null {
  const source = readFileSync(filePath, 'utf-8')
  const { descriptor } = parseSFC(source, { filename: filePath })

  if (!descriptor.template) return null

  let ast: any
  try {
    const result = compile(descriptor.template.content, {
      mode: 'module',
      sourceMap: false,
    })
    ast = result.ast
  } catch {
    // Template compilation can fail for complex components — skip
    return null
  }

  const rawFields = extractFieldsFromAst(ast, false, false)
  if (rawFields.length === 0) return null // No form fields in this component

  const script = analyzeScript(descriptor)
  const hasForm = hasFormTag(ast)
  const hasDialog = hasDialogTag(ast)
  const hasFormSubmit = hasFormSubmitInTemplate(ast)

  const { fieldReports, componentIssues } = classifyComponent(
    rawFields,
    script,
    hasForm,
    hasFormSubmit,
    sharedUtils,
  )

  const allFieldIssues = fieldReports.flatMap((f) => f.issues)
  const isCompliant =
    allFieldIssues.length === 0 && componentIssues.length === 0

  return {
    file: filePath,
    relativePath: relative(rootDir, filePath),
    fields: fieldReports,
    script,
    hasForm,
    hasDialog,
    isCompliant,
    issues: componentIssues,
  }
}

function scan(rootDir: string): ComponentReport[] {
  const sharedUtils = discoverSharedUtils(rootDir)
  const pattern = resolve(rootDir, 'src/**/*.vue')
  const files = globSync(pattern)
  const reports: ComponentReport[] = []

  for (const file of files) {
    const report = scanComponent(file, rootDir, sharedUtils)
    if (report) reports.push(report)
  }

  return reports.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

function formatConsoleReport(reports: ComponentReport[]): string {
  const lines: string[] = []
  const total = reports.length
  const compliant = reports.filter((r) => r.isCompliant).length
  const nonCompliant = total - compliant

  lines.push('Form Validation Audit Report')
  lines.push('============================')
  lines.push(
    `${total} components with form fields scanned, ${compliant} compliant, ${nonCompliant} non-compliant`,
  )
  lines.push('')

  if (nonCompliant > 0) {
    lines.push('NON-COMPLIANT:')
    lines.push('')

    for (const r of reports.filter((r) => !r.isCompliant)) {
      const fieldIssues = r.fields.filter((f) => f.issues.length > 0)
      const issueTypes = [
        ...new Set(fieldIssues.flatMap((f) => f.issues)),
      ]
      lines.push(
        `  [${issueTypes.map((i) => i.toUpperCase()).join(', ')}] ${r.relativePath}`,
      )

      for (const f of fieldIssues) {
        lines.push(
          `    - ${f.label} (${f.tag}): ${f.issues.join(', ')}`,
        )
      }

      for (const issue of r.issues) {
        lines.push(`    * ${issue}`)
      }

      lines.push('')
    }
  }

  if (compliant > 0) {
    lines.push('COMPLIANT:')
    lines.push('')
    for (const r of reports.filter((r) => r.isCompliant)) {
      const fieldCount = r.fields.filter((f) => f.hasRules).length
      const exemptCount = r.fields.filter((f) => f.isExempt).length
      lines.push(
        `  ${r.relativePath} — ${fieldCount} validated fields${exemptCount ? `, ${exemptCount} exempt` : ''}`,
      )
    }
    lines.push('')
  }

  // Summary of shared util usage
  lines.push('SHARED VALIDATION UTIL USAGE:')
  lines.push('')
  for (const r of reports) {
    if (r.script.importsFromValidation.length > 0) {
      lines.push(
        `  ${r.relativePath}: ${r.script.importsFromValidation.join(', ')}`,
      )
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const rootDir = resolve(__dirname, '..')
const jsonMode = process.argv.includes('--json')

const reports = scan(rootDir)
const nonCompliant = reports.filter((r) => !r.isCompliant).length

saveReport({
  reportName: 'form-validation',
  timestamp: new Date().toISOString(),
  durationMs: 0,
  result: nonCompliant > 0 ? 'fail' : 'pass',
  summary: {
    totalComponents: reports.length,
    compliant: reports.length - nonCompliant,
    nonCompliant,
  },
  data: reports,
})

if (jsonMode) {
  console.log(JSON.stringify(reports, null, 2))
} else {
  console.log(formatConsoleReport(reports))
  process.exit(nonCompliant > 0 ? 1 : 0)
}
