// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Knowledge Schema Auditor
 *
 * Validates that every <!-- entry:ID --> block in code/docs/knowledge/
 * has valid YAML frontmatter with all required fields and correct types.
 *
 * Passes trivially on category files with no entries — a new domain
 * file with only the header comment is always valid.
 *
 * Checks:
 *   - Opening and closing markers are balanced (<!-- entry:ID --> … <!-- /entry -->)
 *   - Each entry block contains a YAML frontmatter section (--- … ---)
 *   - All required fields are present: id, type, domain, tags, since_version,
 *     status, related, graduated_to
 *   - id matches the marker ID
 *   - type is "lesson" or "gotcha"
 *   - domain is one of the valid domains
 *   - status is one of: active, graduated, deprecated, historical
 *   - tags and related are array-shaped values
 *   - ID format matches: [LG]-{domain}-YYYY-MM-DD-NNN
 *
 * Invocation:
 *   npx tsx scripts/verify-knowledge-schema.ts
 *   or: npm run audit:knowledge-schema
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')

// ── Constants ─────────────────────────────────────────────────────────────────

// Vocab mirrors the structured_entries CHECK constraints (WVR-191 / §10 step 4):
// the markdown is now a generated projection of the DB, so its frontmatter speaks
// the DB's vocab. Old markdown-only vocab (transferable/transient, graduated/
// deprecated/historical) was mapped into this set at migration time (§10 step 4b).
const VALID_TYPES = new Set(['lesson', 'gotcha', 'pattern', 'rule'])
const VALID_DOMAINS = new Set([
  'frontend', 'backend', 'testing', 'nixos', 'security',
  'process', 'mcp', 'engram', 'devops', 'licensing', 'analysis',
  'python', 'rust',
])
const VALID_STATUSES = new Set(['active', 'superseded', 'retired'])
const VALID_SCOPES = new Set(['universal', 'language', 'language-version', 'domain', 'project', 'task'])
const VALID_LAYERS = new Set(['L1-dev', 'L2-product'])
const REQUIRED_FIELDS = ['id', 'type', 'domain', 'tags', 'since_version', 'status', 'scope', 'related', 'graduated_to']
const ID_RE = /^[LG]-[a-z]+(-[a-z]+)*-\d{4}-\d{2}-\d{2}-\d{3}$/

// ── Parsing helpers ───────────────────────────────────────────────────────────

// blockContent starts with \n--- (newline before opening ---), so no ^ anchor
const FRONTMATTER_RE = /---\n([\s\S]+?)\n---/

function parseFrontmatter(raw: string): Record<string, string> {
  const fm: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return fm
}

function looksLikeArray(val: string): boolean {
  return val.startsWith('[') && val.endsWith(']')
}

// ── File discovery ────────────────────────────────────────────────────────────

function collectCategoryFiles(): string[] {
  const files: string[] = []
  for (const type of ['lessons', 'gotchas']) {
    const dir = resolve(KNOWLEDGE_ROOT, type)
    let names: string[]
    try {
      names = readdirSync(dir).filter((f) => f.endsWith('.md'))
    } catch {
      continue
    }
    for (const name of names.sort()) {
      files.push(resolve(dir, name))
    }
  }
  return files
}

// ── Auditor ───────────────────────────────────────────────────────────────────

interface Violation {
  file: string
  entryId: string
  message: string
}

function auditFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  const content = readFileSync(filePath, 'utf8')
  const relPath = filePath.replace(resolve(CODE_ROOT, '..', '..') + '/', '')

  // Create regex fresh per file — global regexes with `g` flag carry state
  const entryBlockRe = /<!--\s*entry:([\w-]+)\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g
  let match: RegExpExecArray | null

  while ((match = entryBlockRe.exec(content)) !== null) {
    const markerId = match[1]!
    const blockContent = match[2]!

    const flag = (msg: string) => violations.push({ file: relPath, entryId: markerId, message: msg })

    // Must have frontmatter
    const fmMatch = blockContent.match(FRONTMATTER_RE)
    if (!fmMatch) {
      flag('missing YAML frontmatter (--- block)')
      continue
    }

    const fm = parseFrontmatter(fmMatch[1]!)

    // Required fields present
    for (const field of REQUIRED_FIELDS) {
      if (!(field in fm)) flag(`missing required field: ${field}`)
    }

    // id matches marker
    if (fm['id'] && fm['id'] !== markerId) {
      flag(`id field "${fm['id']}" does not match marker ID "${markerId}"`)
    }

    // id format
    if (fm['id'] && !ID_RE.test(fm['id'])) {
      flag(`id "${fm['id']}" does not match format [LG]-{domain}-YYYY-MM-DD-NNN`)
    }

    // type
    if (fm['type'] && !VALID_TYPES.has(fm['type'])) {
      flag(`invalid type "${fm['type']}"; valid: ${[...VALID_TYPES].join(', ')}`)
    }

    // domain
    if (fm['domain'] && !VALID_DOMAINS.has(fm['domain'])) {
      flag(`invalid domain "${fm['domain']}"; valid: ${[...VALID_DOMAINS].join(', ')}`)
    }

    // status
    if (fm['status'] && !VALID_STATUSES.has(fm['status'])) {
      flag(`invalid status "${fm['status']}"; valid: ${[...VALID_STATUSES].join(', ')}`)
    }

    // layer (WVR-191): present on generated entries; validate when set
    if (fm['layer'] !== undefined && fm['layer'] !== '' && !VALID_LAYERS.has(fm['layer'])) {
      flag(`invalid layer "${fm['layer']}"; valid: ${[...VALID_LAYERS].join(', ')}`)
    }

    // tags and related must look like arrays
    if (fm['tags'] !== undefined && !looksLikeArray(fm['tags'])) {
      flag(`tags must be array-shaped (e.g. [] or [a, b]); got: ${fm['tags']}`)
    }
    if (fm['related'] !== undefined && !looksLikeArray(fm['related'])) {
      flag(`related must be array-shaped (e.g. [] or [id1, id2]); got: ${fm['related']}`)
    }

    // graduated_to must be set when status=graduated
    if (fm['status'] === 'graduated' && !fm['graduated_to']) {
      flag('status is "graduated" but graduated_to is empty — add the destination path')
    }

    // scope is required (see REQUIRED_FIELDS) and must be one of VALID_SCOPES
    if (fm['scope'] !== undefined && fm['scope'] !== '' && !VALID_SCOPES.has(fm['scope'])) {
      flag(`invalid scope "${fm['scope']}"; valid: ${[...VALID_SCOPES].join(', ')}`)
    }
  }

  return violations
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = collectCategoryFiles()
let allViolations: Violation[] = []

for (const f of files) {
  allViolations = allViolations.concat(auditFile(f))
}

if (allViolations.length === 0) {
  console.log(`audit:knowledge-schema PASS — ${files.length} category files, 0 schema violations`)
  process.exit(0)
} else {
  console.error(`audit:knowledge-schema FAIL — ${allViolations.length} violation(s):`)
  for (const v of allViolations) {
    console.error(`  ${v.file} [${v.entryId}]: ${v.message}`)
  }
  process.exit(1)
}
