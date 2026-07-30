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
 *   - type is one of the generated knowledge_types (FORGE-18 vocab, not hardcoded)
 *   - domain is one of the valid domains
 *   - status is one of: active, superseded, retired (WVR-191)
 *   - tags and related are array-shaped values
 *   - ID format matches: [LGH]-{domain}-YYYY-MM-DD-{NNN|ULID} (L lesson/pattern/rule, G gotcha, H heuristic; FORGE-23 suffix)
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

// ── Vocab (FORGE-18: read the generated vocab, never hardcode) ──────────────────
// The substrate vocabulary's single canonical source is engram's schema/engram.proto,
// projected to schema/vocab.generated.json by gen_from_proto.py. weaver is an offline TS
// repo that can't reach that file at commit time (unlike anvil, which reads $ENGRAM_VOCAB
// via the Nix devShell), so a byte-exact VENDORED mirror lives at scripts/data/. Reading it
// here is what stops this auditor from re-hardcoding a set that silently rots — the previous
// inline VALID_TYPES was already stale (missing 'heuristic', FORGE-20). Refresh the mirror
// with `npm run sync:engram-vocab`; audit:engram-vocab-fresh guards it against drift.
const VOCAB_PATH = resolve(__dirname, 'data/engram-vocab.generated.json')

interface EngramVocab {
  enums: Record<string, { target: string; values: string[]; symbols: Record<string, string> }>
  knowledge_types: string[]
  knowledge_categories: { subdir: string; label: string; types: string[] }[]
}

function loadVocab(): EngramVocab {
  let vocab: EngramVocab
  try {
    vocab = JSON.parse(readFileSync(VOCAB_PATH, 'utf8')) as EngramVocab
  } catch (e) {
    console.error(`audit:knowledge-schema FAIL — cannot read vendored vocab ${VOCAB_PATH}: ${(e as Error).message}`)
    console.error('  fix: npm run sync:engram-vocab  (copies schema/vocab.generated.json from the engram repo)')
    process.exit(1)
  }
  // Self-test: a malformed / empty vocab must FAIL LOUD, never silently accept everything
  // (an auditor that can't find its vocab is not the same as one that found no violations).
  if (!vocab.knowledge_types?.length || !vocab.knowledge_categories?.length
    || !vocab.enums?.Status?.values?.length || !vocab.enums?.Scope?.values?.length
    || !vocab.enums?.Layer?.values?.length) {
    console.error(`audit:knowledge-schema FAIL — vendored vocab ${VOCAB_PATH} is missing required enum sets`)
    console.error('  (need knowledge_types + knowledge_categories + enums.Status/Scope/Layer). fix: npm run sync:engram-vocab')
    process.exit(1)
  }
  return vocab
}

const VOCAB = loadVocab()

// Proto-derived sets (FORGE-18). VALID_DOMAINS is NOT proto-sourced — it mirrors engram's
// schema/knowledge_domains.sql, a separate source, so it stays inline until that grows its
// own generated projection.
const VALID_TYPES = new Set(VOCAB.knowledge_types)
const VALID_STATUSES = new Set(VOCAB.enums.Status.values)
const VALID_SCOPES = new Set(VOCAB.enums.Scope.values)
const VALID_LAYERS = new Set(VOCAB.enums.Layer.values)
const KNOWLEDGE_SUBDIRS = VOCAB.knowledge_categories.map((c) => c.subdir)
const VALID_DOMAINS = new Set([
  'frontend', 'backend', 'testing', 'nixos', 'security',
  'process', 'mcp', 'engram', 'devops', 'licensing', 'analysis',
  'python', 'rust',
])
const REQUIRED_FIELDS = ['id', 'type', 'domain', 'tags', 'since_version', 'status', 'scope', 'related', 'graduated_to']
// Prefixes: L (lesson/pattern/rule), G (gotcha), H (heuristic — FORGE-20, subdir heuristics/).
// Suffix (FORGE-23): legacy `-NNN` (mixed-scheme, immutable) OR a 26-char Crockford-base32 ULID
// (globally-unique + coordination-free — minted for new entries). Additive: both validate.
const ID_RE = /^[LGH]-[a-z]+(-[a-z]+)*-\d{4}-\d{2}-\d{2}-[0-9A-HJKMNP-TV-Z]{26}$/

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
  for (const type of KNOWLEDGE_SUBDIRS) {
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
      flag(`id "${fm['id']}" does not match format [LGH]-{domain}-YYYY-MM-DD-{NNN|ULID}`)
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
