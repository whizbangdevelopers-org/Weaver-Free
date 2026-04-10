// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * E2E Selector Parity Auditor
 *
 * Extracts interactive-element selectors from E2E spec files and verifies
 * that each selector has a matching element in the Vue component templates.
 *
 * Catches the case where a UI element (button, link, input) is removed from
 * a Vue component but E2E specs still reference it — a silent test breakage
 * that only surfaces when E2E actually runs.
 *
 * Selector types checked:
 *   - getByRole('button', { name: /pattern/ })  → q-btn label= or <button> content
 *   - getByRole('textbox', { name: 'Label' })   → q-input label= or <input> with label
 *   - getByText('Text')                          → text content in templates
 *   - locator('.class', { hasText: 'Text' })     → CSS class + text content
 *   - locator('[data-testid="id"]')              → data-testid attributes
 *
 * Usage:
 *   npx tsx scripts/verify-e2e-selectors.ts          # Console report
 *   npx tsx scripts/verify-e2e-selectors.ts --json    # JSON output
 */

import { readFileSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// ANSI colors
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedSelector {
  type: 'getByRole' | 'getByText' | 'locator-class' | 'locator-testid' | 'locator-hasText'
  raw: string           // The full selector expression as written in the spec
  role?: string         // For getByRole: 'button', 'textbox', 'tab', etc.
  name?: string         // For getByRole: the name option (string or regex pattern)
  text?: string         // For getByText or hasText: the text content
  cssClass?: string     // For locator('.class'): the CSS class
  testId?: string       // For data-testid selectors
  file: string          // E2E spec file (relative path)
  line: number          // Line number
}

interface SelectorResult {
  selector: ExtractedSelector
  status: 'found' | 'missing' | 'exempt'
  matchedIn: string[]   // Vue files where the selector was matched
}

// ---------------------------------------------------------------------------
// Exemptions — selectors that are dynamic or framework-generated
// ---------------------------------------------------------------------------

const EXEMPT_PATTERNS: RegExp[] = [
  // Quasar framework elements (always present when Quasar is loaded)
  /\.q-dialog$/,
  /\.q-notification$/,
  /\.q-menu$/,
  /\.q-drawer$/,
  /\.q-page$/,
  /\.q-tab-panel$/,
  /\.q-btn-dropdown$/,
  // Dynamic selectors with variable interpolation
  /\$\{/,
  // Pricing values rendered from constants (src/constants/pricing.ts)
  /getByText\(\s*['"]\\?\$\d/,
  // Generic structural selectors
  /^button$/,
  /^input$/,
  /^label$/,
]

function isExempt(selector: ExtractedSelector): boolean {
  const raw = selector.raw
  for (const pattern of EXEMPT_PATTERNS) {
    if (pattern.test(raw)) return true
  }
  // locator('.q-*') — Quasar framework classes
  if (selector.cssClass?.startsWith('q-')) return true
  return false
}

// ---------------------------------------------------------------------------
// Step 1: Extract selectors from E2E specs
// ---------------------------------------------------------------------------

function extractSelectors(): ExtractedSelector[] {
  const specDir = resolve(rootDir, 'testing/e2e')
  const specFiles = globSync(resolve(specDir, '*.spec.ts'))
  const selectors: ExtractedSelector[] = []

  for (const specFile of specFiles) {
    const content = readFileSync(specFile, 'utf-8')
    const lines = content.split('\n')
    const relPath = relative(rootDir, specFile)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip comments
      if (line.trim().startsWith('//')) continue

      // getByRole('type', { name: /pattern/i }) or { name: 'string' }
      const roleMatch = line.match(
        /getByRole\(\s*['"](\w+)['"]\s*,\s*\{\s*name:\s*(?:\/([^/]+)\/\w*|['"]([^'"]+)['"])/,
      )
      if (roleMatch) {
        selectors.push({
          type: 'getByRole',
          raw: roleMatch[0],
          role: roleMatch[1],
          name: roleMatch[2] || roleMatch[3], // regex pattern or string
          file: relPath,
          line: i + 1,
        })
      }

      // getByText('text') or getByText(/regex/)
      const getByTextMatch = line.match(
        /getByText\(\s*(?:['"]([^'"]+)['"]|\/([^/]+)\/)/,
      )
      if (getByTextMatch) {
        selectors.push({
          type: 'getByText',
          raw: getByTextMatch[0],
          text: getByTextMatch[1] || getByTextMatch[2],
          file: relPath,
          line: i + 1,
        })
      }

      // locator('.css-class') — project-specific classes (not Quasar q- classes)
      const classMatch = line.match(
        /locator\(\s*['"]\.([a-z][\w-]+)['"]/,
      )
      if (classMatch) {
        selectors.push({
          type: 'locator-class',
          raw: classMatch[0],
          cssClass: classMatch[1],
          file: relPath,
          line: i + 1,
        })
      }

      // locator('.class', { hasText: 'text' })
      const hasTextMatch = line.match(
        /locator\(\s*['"][^'"]+['"]\s*,\s*\{\s*hasText:\s*['"]([^'"]+)['"]/,
      )
      if (hasTextMatch) {
        selectors.push({
          type: 'locator-hasText',
          raw: hasTextMatch[0],
          text: hasTextMatch[1],
          file: relPath,
          line: i + 1,
        })
      }

      // data-testid selectors
      const testIdMatch = line.match(
        /(?:getByTestId|data-testid[=])\s*\(?\s*['"]([^'"]+)['"]/,
      )
      if (testIdMatch) {
        selectors.push({
          type: 'locator-testid',
          raw: testIdMatch[0],
          testId: testIdMatch[1],
          file: relPath,
          line: i + 1,
        })
      }
    }
  }

  return selectors
}

// ---------------------------------------------------------------------------
// Step 2: Load all Vue template content
// ---------------------------------------------------------------------------

function loadVueTemplates(): Map<string, string> {
  const vueFiles = globSync(resolve(rootDir, 'src/**/*.vue'))
  const templates = new Map<string, string>()

  for (const vueFile of vueFiles) {
    const content = readFileSync(vueFile, 'utf-8')
    // Extract template section (between <template> and </template>)
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/)
    if (templateMatch) {
      const relPath = relative(rootDir, vueFile)
      templates.set(relPath, templateMatch[1])
    }
  }

  return templates
}

// ---------------------------------------------------------------------------
// Step 3: Match selectors against templates
// ---------------------------------------------------------------------------

function matchSelector(
  selector: ExtractedSelector,
  templates: Map<string, string>,
): string[] {
  const matched: string[] = []

  for (const [file, template] of templates) {
    let found = false

    switch (selector.type) {
      case 'getByRole': {
        // For all role types, search the full SFC content (template + script)
        // Role-accessible names can come from label props, text content, or reactive data
        const namePattern = selector.name
        if (namePattern) {
          const fullContent = readFileSync(resolve(rootDir, file), 'utf-8')
          try {
            const re = new RegExp(namePattern, 'i')
            if (re.test(fullContent)) found = true
          } catch {
            if (fullContent.toLowerCase().includes(namePattern.toLowerCase())) found = true
          }
        }
        break
      }

      case 'getByText': {
        if (selector.text) {
          // Search full SFC — try literal match first (handles special chars like @*)
          const fullContent = readFileSync(resolve(rootDir, file), 'utf-8')
          if (fullContent.toLowerCase().includes(selector.text.toLowerCase())) {
            found = true
          } else {
            try {
              const re = new RegExp(selector.text, 'i')
              if (re.test(fullContent)) found = true
            } catch { /* invalid regex, literal already tried */ }
          }
        }
        break
      }

      case 'locator-class': {
        if (selector.cssClass && !selector.cssClass.startsWith('q-')) {
          // Check full SFC for class usage (template class=, :class=, CSS)
          const fullContent = readFileSync(resolve(rootDir, file), 'utf-8')
          if (fullContent.includes(selector.cssClass)) found = true
        }
        break
      }

      case 'locator-hasText': {
        if (selector.text) {
          // Check both template text content and the full Vue SFC content
          // (hasText matches rendered text which can come from script data too)
          const fullContent = readFileSync(resolve(rootDir, file), 'utf-8')
          if (fullContent.toLowerCase().includes(selector.text.toLowerCase())) found = true
        }
        break
      }

      case 'locator-testid': {
        if (selector.testId) {
          const fullContent = readFileSync(resolve(rootDir, file), 'utf-8')
          // Exact match
          if (fullContent.includes(`data-testid="${selector.testId}"`)) found = true
          if (fullContent.includes(`data-testid='${selector.testId}'`)) found = true
          // Dynamic testid — check if a template literal prefix matches
          // e.g., :data-testid="`delete-user-${...}`" matches "delete-user-e2e-admin"
          const dynamicTestIds = [...fullContent.matchAll(/:data-testid="`([^$`]+)\$\{/g)]
          for (const m of dynamicTestIds) {
            if (selector.testId.startsWith(m[1])) { found = true; break }
          }
        }
        break
      }
    }

    if (found) matched.push(file)
  }

  return matched
}

function checkSelectors(
  selectors: ExtractedSelector[],
  templates: Map<string, string>,
): SelectorResult[] {
  const results: SelectorResult[] = []

  // Deduplicate selectors by raw + type (same selector used multiple times is one check)
  const seen = new Set<string>()
  const unique: ExtractedSelector[] = []
  for (const s of selectors) {
    const key = `${s.type}:${s.name || s.text || s.cssClass || s.testId || s.raw}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(s)
    }
  }

  for (const selector of unique) {
    if (isExempt(selector)) {
      results.push({ selector, status: 'exempt', matchedIn: [] })
      continue
    }

    const matchedIn = matchSelector(selector, templates)
    results.push({
      selector,
      status: matchedIn.length > 0 ? 'found' : 'missing',
      matchedIn,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

function formatConsoleReport(results: SelectorResult[]): string {
  const lines: string[] = []
  const found = results.filter(r => r.status === 'found')
  const missing = results.filter(r => r.status === 'missing')
  const exempt = results.filter(r => r.status === 'exempt')

  lines.push(`${BOLD}E2E Selector Parity Report${RESET}`)
  lines.push('==========================')
  lines.push(`Total unique selectors: ${results.length}`)
  lines.push(`${GREEN}Matched in templates: ${found.length}${RESET}`)
  lines.push(`${exempt.length > 0 ? YELLOW : DIM}Exempt (framework/dynamic): ${exempt.length}${RESET}`)
  lines.push(`${missing.length > 0 ? RED : GREEN}Missing from templates: ${missing.length}${RESET}`)
  lines.push('')

  if (missing.length > 0) {
    lines.push(`${RED}${BOLD}MISSING — selectors with no matching UI element:${RESET}`)
    lines.push('')

    // Group by spec file
    const byFile = new Map<string, SelectorResult[]>()
    for (const r of missing) {
      const list = byFile.get(r.selector.file) || []
      list.push(r)
      byFile.set(r.selector.file, list)
    }

    for (const [file, fileResults] of byFile) {
      lines.push(`  ${BOLD}${file}${RESET}`)
      for (const r of fileResults) {
        const s = r.selector
        const desc = s.name || s.text || s.cssClass || s.testId || s.raw
        lines.push(`    ${RED}✘${RESET} ${s.type}: ${desc} ${DIM}(line ${s.line})${RESET}`)
      }
      lines.push('')
    }
  }

  if (found.length > 0) {
    lines.push(`${GREEN}MATCHED:${RESET}`)
    lines.push('')

    // Group by spec file
    const byFile = new Map<string, SelectorResult[]>()
    for (const r of found) {
      const list = byFile.get(r.selector.file) || []
      list.push(r)
      byFile.set(r.selector.file, list)
    }

    for (const [file, fileResults] of byFile) {
      lines.push(`  ${DIM}${file}${RESET}`)
      for (const r of fileResults) {
        const s = r.selector
        const desc = s.name || s.text || s.cssClass || s.testId || s.raw
        lines.push(`    ${GREEN}✓${RESET} ${s.type}: ${desc} ${DIM}→ ${r.matchedIn[0]}${RESET}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const startTime = Date.now()
const jsonMode = process.argv.includes('--json')

const selectors = extractSelectors()
const templates = loadVueTemplates()
const results = checkSelectors(selectors, templates)

const found = results.filter(r => r.status === 'found').length
const missing = results.filter(r => r.status === 'missing').length
const exempt = results.filter(r => r.status === 'exempt').length

saveReport({
  reportName: 'e2e-selectors',
  timestamp: new Date().toISOString(),
  durationMs: Date.now() - startTime,
  result: missing > 0 ? 'fail' : 'pass',
  summary: {
    totalSelectors: results.length,
    found,
    missing,
    exempt,
  },
  data: results,
})

if (jsonMode) {
  console.log(JSON.stringify(results, null, 2))
} else {
  console.log(formatConsoleReport(results))
  if (missing > 0) {
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} (${missing} selector(s) reference UI elements not found in templates)`)
    console.log(`${DIM}Fix: update E2E specs to use current UI elements, or add the element to the component.${RESET}`)
    process.exit(1)
  } else {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} (${found} matched, ${exempt} exempt)`)
  }
}
