// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * SAST (Static Application Security Testing) Auditor
 *
 * Scans source code for common security anti-patterns:
 * - Command injection (child_process with unsanitized input)
 * - SQL injection (string concatenation in queries)
 * - XSS (innerHTML, v-html with user input)
 * - Path traversal (unsanitized path joins)
 * - Hardcoded secrets (API keys, passwords in source)
 * - Eval usage
 * - Prototype pollution patterns
 *
 * Uses regex scanning — no external dependencies required.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'

interface Finding {
  rule: string
  severity: 'error' | 'warning'
  file: string
  line: number
  match: string
}

interface Rule {
  id: string
  description: string
  severity: 'error' | 'warning'
  pattern: RegExp
  extensions: string[]
  /** Lines matching any exclude pattern are skipped */
  excludePatterns?: RegExp[]
  /** Files matching any of these paths are skipped */
  excludePaths?: RegExp[]
}

const rules: Rule[] = [
  {
    id: 'command-injection',
    description: 'Potential command injection — exec/spawn with template literal or concatenation',
    severity: 'error',
    pattern: /\b(exec|execSync|spawn|spawnSync)\s*\(\s*(`[^`]*\$\{|[^'"][^,)]*\+)/,
    extensions: ['.ts', '.js'],
    excludePaths: [/node_modules/, /\.spec\.ts$/, /scripts\/audit-sast\.ts$/],
  },
  {
    id: 'eval-usage',
    description: 'Use of eval() or Function() constructor',
    severity: 'error',
    pattern: /\b(eval|Function)\s*\(/,
    extensions: ['.ts', '.js', '.vue'],
    excludePatterns: [/\/\/.*\beval\b/, /['"]eval['"]/],
    excludePaths: [/node_modules/, /\.spec\.ts$/],
  },
  {
    id: 'innerhtml-xss',
    description: 'Direct innerHTML assignment — use textContent or sanitize',
    severity: 'warning',
    pattern: /\.innerHTML\s*=/,
    extensions: ['.ts', '.js', '.vue'],
    excludePaths: [/node_modules/, /\.spec\.ts$/],
  },
  {
    id: 'v-html-xss',
    description: 'v-html directive with dynamic binding — XSS risk if user-controlled',
    severity: 'warning',
    pattern: /v-html\s*=\s*"/,
    extensions: ['.vue'],
    excludePatterns: [/v-html="'[^']*'"/], // Static strings are fine
    excludePaths: [/node_modules/],
  },
  {
    id: 'sql-injection',
    description: 'String concatenation in SQL query — use parameterized queries',
    severity: 'error',
    pattern: /\b(query|execute|run)\s*\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+).*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i,
    extensions: ['.ts', '.js'],
    excludePaths: [/node_modules/, /\.spec\.ts$/],
  },
  {
    id: 'hardcoded-secret',
    description: 'Potential hardcoded secret or API key',
    severity: 'error',
    pattern: /(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{20,}['"]/i,
    extensions: ['.ts', '.js', '.vue', '.json'],
    excludePatterns: [/placeholder|example|mock|test|fake|dummy|e2e-test/i, /\/\/.*/],
    excludePaths: [/node_modules/, /\.spec\.ts$/, /mock/, /package(-lock)?\.json$/],
  },
  {
    id: 'path-traversal',
    description: 'Path join with user input without sanitization',
    severity: 'warning',
    pattern: /path\.(join|resolve)\s*\([^)]*req\.(params|query|body)/,
    extensions: ['.ts', '.js'],
    excludePaths: [/node_modules/, /\.spec\.ts$/],
  },
  {
    id: 'prototype-pollution',
    description: 'Bracket notation assignment with dynamic key — prototype pollution risk',
    severity: 'warning',
    pattern: /\[\s*(req\.(params|query|body)\.|input|key|prop)\s*[^\]]*\]\s*=/,
    extensions: ['.ts', '.js'],
    excludePaths: [/node_modules/, /\.spec\.ts$/],
  },
  {
    id: 'insecure-random',
    description: 'Math.random() used for security-sensitive operation — use crypto.randomUUID()',
    severity: 'warning',
    pattern: /Math\.random\(\)/,
    extensions: ['.ts', '.js'],
    excludePatterns: [/mock|demo|sample|test|color|animation|delay|jitter/i],
    excludePaths: [/node_modules/, /\.spec\.ts$/, /mock/, /demo/],
  },
]

function walkDir(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (entry === 'node_modules' || entry === 'dist' || entry === '.stryker-tmp' || entry === 'coverage') continue
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath, extensions))
    } else if (extensions.includes(extname(entry))) {
      files.push(fullPath)
    }
  }
  return files
}

function scanFile(filePath: string, rule: Rule): Finding[] {
  const relPath = relative(process.cwd(), filePath)

  if (rule.excludePaths?.some(p => p.test(relPath))) return []

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const findings: Finding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!rule.pattern.test(line)) continue
    if (rule.excludePatterns?.some(p => p.test(line))) continue

    // sast-ignore[<rule-id>] anywhere in the preceding 5 lines suppresses the finding
    // (5-line window handles multi-line HTML elements where the attribute is several lines below the comment)
    const lookback = lines.slice(Math.max(0, i - 5), i).join('\n')
    if (lookback.includes(`sast-ignore[${rule.id}]`)) continue

    findings.push({
      rule: rule.id,
      severity: rule.severity,
      file: relPath,
      line: i + 1,
      match: line.trim().substring(0, 120),
    })
  }

  return findings
}

function main() {
  const rootDir = process.cwd()
  const scanDirs = ['src', 'backend/src'].map(d => join(rootDir, d)).filter(d => {
    try { statSync(d); return true } catch { return false }
  })

  const allExtensions = [...new Set(rules.flatMap(r => r.extensions))]
  const allFiles = scanDirs.flatMap(d => walkDir(d, allExtensions))

  const findings: Finding[] = []
  for (const rule of rules) {
    const relevantFiles = allFiles.filter(f => rule.extensions.includes(extname(f)))
    for (const file of relevantFiles) {
      findings.push(...scanFile(file, rule))
    }
  }

  const errors = findings.filter(f => f.severity === 'error')
  const warnings = findings.filter(f => f.severity === 'warning')

  console.log(`\n  SAST Scan — ${allFiles.length} files, ${rules.length} rules\n`)

  if (findings.length === 0) {
    console.log('  ✓ No security findings\n')
    process.exit(0)
  }

  if (errors.length > 0) {
    console.log(`  ERRORS (${errors.length}):\n`)
    for (const f of errors) {
      console.log(`    ✗ [${f.rule}] ${f.file}:${f.line}`)
      console.log(`      ${f.match}\n`)
    }
  }

  if (warnings.length > 0) {
    console.log(`  WARNINGS (${warnings.length}):\n`)
    for (const f of warnings) {
      console.log(`    ⚠ [${f.rule}] ${f.file}:${f.line}`)
      console.log(`      ${f.match}\n`)
    }
  }

  console.log(`  Summary: ${errors.length} errors, ${warnings.length} warnings\n`)

  if (errors.length > 0) {
    process.exit(1)
  }
}

main()
