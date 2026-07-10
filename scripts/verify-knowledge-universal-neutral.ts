// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Universal-Neutrality Auditor (WVR-196)
 *
 * A `scope: universal` knowledge entry is, by definition, true for any project on
 * any stack and product-neutral — because it PROJECTS into every scaffolding
 * template (quasar-project-template, nixos-project-template, …) as a generated
 * view of `structured_entries WHERE scope='universal'`. If its body names this
 * product, a universal entry drags Weaver into a template that has nothing to do
 * with Weaver.
 *
 * This auditor is the mechanical form of what template-sync's "generic-content
 * filter" used to do by agent judgment (retired per WVR-196). It fails when a
 * universal entry's BODY prose leaks:
 *   - a product proper noun (Weaver, Fabrick, MicroVM, …), or
 *   - a `WVR-<n>` decision reference (there is no MASTER-PLAN downstream for it to
 *     resolve against — audit:decision-refs would fail in the template).
 *
 * SCOPE OF THIS CHECK — body prose only. Structural placement fields
 * (`since_version`, `project`, `related` targets outside the universal slice) are
 * neutralized by the PROJECTION GENERATOR at build time (it strips since_version
 * and filters related[] to same-slice targets), not enforced here — those are
 * mechanical, this is the irreducible human-judgment part.
 *
 * DELIBERATELY NARROW DENYLIST. Product vocabulary that collides with ordinary
 * English — Loom, Ply, Shed, Strands, Draft, Shuttle — is EXCLUDED, because a
 * universal engineering lesson legitimately uses "apply", "shed light", "draft".
 * Flagging those would pressure an author to reword correct prose to dodge the
 * check — exactly the gaming this project forbids (~/.claude/rules/
 * never-game-auditors.md). We match only high-confidence, distinctive product
 * tokens with word boundaries; a rare real leak of an excluded term is caught in
 * review, not by mangling every author's vocabulary.
 *
 * Only `scope: universal` entries are checked. project/domain/language entries may
 * name the product freely — they never project to a template.
 *
 * Invocation:
 *   npx tsx scripts/verify-knowledge-universal-neutral.ts
 *   or: npm run audit:knowledge-universal-neutral
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')

// ── The denylist ────────────────────────────────────────────────────────────
// Each is a source regex fragment; matched case-sensitively with a word boundary
// where the token is a bare word. Distinctive product nouns + identifiers only.
const PRODUCT_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'Weaver',              re: /\bWeaver\b/ },
  { label: 'Fabrick / FabricK',  re: /\bFabricK?\b/ },
  { label: 'MicroVM',             re: /\bMicroVMs?\b/ },
  { label: 'Jacquard',            re: /\bJacquard\b/ },
  { label: 'Selvedge',            re: /\bSelvedge\b/ },
  { label: 'Rethread',            re: /\bRethreads?\b/ },
  { label: 'Smart Bridge',        re: /\bSmart Bridges?\b/ },
  { label: 'Live Provisioning',   re: /\bLive Provisioning\b/ },
  { label: 'microvm.nix',         re: /\bmicrovm\.nix\b/ },
  { label: 'services.weaver',     re: /\bservices\.weaver\b/ },
  { label: 'whizbangdevelopers',  re: /whizbangdevelopers/ },
  { label: 'Weaver-Dev / -Free',  re: /\bWeaver-(?:Dev|Free)\b/ },
  { label: 'weaver-dev.github.io', re: /weaver-dev\.github\.io/ },
  { label: 'WVR-<n> decision ref', re: /\bWVR-\d+/ },
  // Fleet identity — a host name is as un-portable as a product name. Only the
  // DISTINCTIVE fleet tokens are hard-failed here. Collision-prone hostnames
  // (king / bedrock / foundry / lab1) are DELIBERATELY EXCLUDED: "the bedrock of
  // the design", "a foundry pattern", "king of the hill" are legitimate English a
  // universal lesson may use, and a blocking rule that false-fires on them would
  // pressure an author to reword correct prose (~/.claude/rules/never-game-auditors.md).
  // Comprehensive host-name sweeping is a projection-time concern, not authoring-time.
  { label: 'weaver-lab (fleet host)', re: /\bweaver-lab\b/i },
  { label: 'antsle (fleet host)',     re: /\bantsle\b/i },
  { label: 'wriver4 (fleet repo)',    re: /\bwriver4\b/ },
  { label: '/home/mark path',         re: /\/home\/mark\b/ },
]

// ── Parsing (mirrors verify-knowledge-schema.ts) ────────────────────────────
const FRONTMATTER_RE = /---\n([\s\S]+?)\n---/

function parseScope(blockContent: string): string | null {
  const fm = blockContent.match(FRONTMATTER_RE)
  if (!fm) return null
  for (const line of fm[1]!.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    if (line.slice(0, idx).trim() === 'scope') return line.slice(idx + 1).trim()
  }
  return null
}

// The prose body = everything after the closing `---` of the frontmatter. We do
// NOT scan frontmatter (tags/domain legitimately hold words like 'licensing').
function bodyProse(blockContent: string): string {
  const fm = blockContent.match(FRONTMATTER_RE)
  if (!fm) return blockContent
  const end = (fm.index ?? 0) + fm[0].length
  return blockContent.slice(end)
}

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
    for (const name of names.sort()) files.push(resolve(dir, name))
  }
  return files
}

interface Violation { file: string; entryId: string; term: string; excerpt: string }

function auditFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  const content = readFileSync(filePath, 'utf8')
  const relPath = filePath.replace(resolve(CODE_ROOT, '..', '..') + '/', '')
  const entryBlockRe = /<!--\s*entry:([\w-]+)\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g
  let match: RegExpExecArray | null

  while ((match = entryBlockRe.exec(content)) !== null) {
    const entryId = match[1]!
    const block = match[2]!
    if (parseScope(block) !== 'universal') continue

    const prose = bodyProse(block)
    for (const { label, re } of PRODUCT_PATTERNS) {
      const m = prose.match(re)
      if (m) {
        const at = m.index ?? 0
        const excerpt = prose.slice(Math.max(0, at - 30), at + m[0].length + 30).replace(/\s+/g, ' ').trim()
        violations.push({ file: relPath, entryId, term: label, excerpt })
      }
    }
  }
  return violations
}

const files = collectCategoryFiles()
let all: Violation[] = []
for (const f of files) all = all.concat(auditFile(f))

if (all.length === 0) {
  console.log('audit:knowledge-universal-neutral PASS — every scope=universal entry body is product-neutral')
  process.exit(0)
} else {
  console.error(`audit:knowledge-universal-neutral FAIL — ${all.length} universal ${all.length === 1 ? 'entry leaks' : 'entries leak'} a product term:`)
  for (const v of all) {
    console.error(`  ${v.file} [${v.entryId}] — "${v.term}": …${v.excerpt}…`)
  }
  console.error('')
  console.error('A scope=universal entry projects into every scaffolding template. Either')
  console.error('neutralize the body prose (name the concept, not the product), or re-grade the')
  console.error('entry to project/domain if it is genuinely product-specific.')
  process.exit(1)
}
