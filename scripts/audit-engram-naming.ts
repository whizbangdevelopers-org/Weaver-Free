// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Engram / Cognee Naming Auditor
 *
 * Enforces the vocabulary boundary established in Decision #157:
 *   - Engram  = the portfolio-wide knowledge graph SYSTEM NAME
 *   - Cognee  = the open-source TOOL / current implementation
 *
 * Flags:
 *   (A) "Cognee" used as a system name instead of "Engram" in prose docs
 *   (B) "Engram" used as a process/tool name (the running process is Cognee)
 *
 * Correct uses that are NOT flagged:
 *   - Package names: cognee-mcp, cognee-api, cognee-full, cognee-integrations
 *   - Code references: import cognee, cognee.add(), cognify, cogRemember()
 *   - Tool configuration: NixOS service config, Cognee HTTP API calls
 *   - Research/investigation files about Cognee tool behavior
 *   - Decision #157 itself (correctly uses both terms)
 *
 * Scans: all .md files in the project tree, excluding code source files,
 *   node_modules, tool-config directories, and research directories.
 *
 * Usage:
 *   npx tsx scripts/audit-engram-naming.ts
 *   npx tsx scripts/audit-engram-naming.ts --json
 */

import { readFileSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

// ANSI colours
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN  = '\x1b[32m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const RESET  = '\x1b[0m'

// ---------------------------------------------------------------------------
// Red-flag patterns — (A) Cognee used as system name
// Each pattern includes a human-readable reason for the violation.
// ---------------------------------------------------------------------------

interface Pattern {
  regex: RegExp
  kind: 'cognee-as-system' | 'engram-as-process'
  message: string
}

const PATTERNS: Pattern[] = [
  // A1: Explicit system-name nouns after "Cognee"
  {
    regex: /\bCognee\s+(?:system|platform|substrate|infrastructure|foundation|layer|stack)\b/i,
    kind: 'cognee-as-system',
    message: 'Cognee used as system name — the system is "Engram", the tool is "Cognee"',
  },
  // A2: Knowledge/memory system framing
  {
    regex: /\bCognee\s+(?:knowledge\s+graph|memory\s+system|memory\s+layer|knowledge\s+layer|knowledge\s+store)\b/i,
    kind: 'cognee-as-system',
    message: 'Cognee used as knowledge-system name — use "Engram knowledge graph" or just "Engram"',
  },
  // A3: "powered by / built on Cognee" in prose (not code)
  {
    regex: /(?:powered|built|runs|running)\s+(?:by|on)\s+Cognee\b/i,
    kind: 'cognee-as-system',
    message: 'Architecture built-on phrasing should name Engram, not Cognee (Cognee is the implementation)',
  },
  // A4: "Cognee is the <system descriptor>"
  {
    regex: /\bCognee\s+is\s+the\s+(?:foundation|substrate|core|backbone|basis|underlying|system|platform)\b/i,
    kind: 'cognee-as-system',
    message: 'Cognee positioned as THE system — use Engram for the system identity',
  },
  // A5: Jacquard or Forge described as built on Cognee
  {
    regex: /(?:Jacquard|Forge)\s+(?:is\s+)?(?:built|running|powered|based)\s+(?:on|by)\s+Cognee\b/i,
    kind: 'cognee-as-system',
    message: 'Jacquard/Forge are built on Engram, not Cognee (Cognee is Engram\'s current implementation)',
  },
  // A6: Future-tense system capability claims attributed to Cognee
  {
    regex: /\bCognee\s+will\s+(?:power|enable|provide|manage|handle|support)\b/i,
    kind: 'cognee-as-system',
    message: 'Future capability should be attributed to Engram, not Cognee',
  },
  // B: Engram misused as a process/tool name
  {
    regex: /\bEngram\s+sidecar\b/i,
    kind: 'engram-as-process',
    message: '"Engram sidecar" — the running process is the Cognee sidecar; Engram is the system concept',
  },
  {
    regex: /\bEngram\s+(?:server|process|daemon|service|port|endpoint)\b/i,
    kind: 'engram-as-process',
    message: '"Engram <process term>" — the running process is Cognee; Engram is the system name, not the process',
  },
  {
    regex: /\b(?:run|start|stop|restart|kill|launch)\s+Engram\b/i,
    kind: 'engram-as-process',
    message: 'Engram is a system name, not a process — "run/start/stop Cognee" for the process',
  },
  {
    regex: /\bEngram\s+(?:API|HTTP\s+API|REST\s+API)\b/i,
    kind: 'engram-as-process',
    message: '"Engram API" — the HTTP API belongs to the Cognee tool; reference it as "Cognee API" or "Engram\'s backing API"',
  },
  {
    regex: /\bEngram\s+is\s+(?:down|up|running|crashed|unreachable|not\s+responding)\b/i,
    kind: 'engram-as-process',
    message: 'Process health phrasing should use Cognee, not Engram',
  },
]

// ---------------------------------------------------------------------------
// Line-level exemptions — if a line matches any of these, skip it entirely.
// These catch legitimate Cognee tool references that look like red-flag phrases.
// ---------------------------------------------------------------------------

const LINE_EXEMPTIONS: RegExp[] = [
  // Package/module names
  /cognee-(?:mcp|api|full|integrations|nix|quasar)/i,
  // Code imports and API calls
  /\bimport\s+cognee\b/i,
  /\bcognee\.(?:add|search|config|cognify|remember|recall)\b/i,
  /\bcognify\b/i,
  /\bcogRemember|cogRecall|cogForget\b/,
  // This decision itself
  /Decision\s+#157/i,
  // Explicit tool references (correct framing)
  /Cognee\s+(?:tool|library|package|CLI|open.?source)\b/i,
  // The implementation note pattern we use in docs
  /Cognee\s+is\s+the\s+(?:current\s+)?implementation/i,
  /Cognee\s+(?:the\s+)?(?:open.?source|tool)\s+(?:was|is)/i,
  // npm script names using the engram: namespace (e.g. engram:ingest-knowledge) — the colon is a
  // word boundary so \bEngram\b would match "engram" within the script name. These correctly
  // use "engram" as the system name (the destination), not as a running process.
  /\bengram:[a-z]/i,
]

// ---------------------------------------------------------------------------
// File-level exemptions — skip these path fragments entirely.
// ---------------------------------------------------------------------------

const PATH_EXEMPTIONS: RegExp[] = [
  /node_modules/,
  /\.git\//,
  /cognee-nix/,
  /cognee-integrations/,
  /research\//,
  /\.q-cache/,
  /dist\//,
  /build\//,
]

// ---------------------------------------------------------------------------
// Scan targets — .md files from project root (includes docs, plans, agents,
// .claude/rules, business/, memory files co-located with the project).
// Code source files (.ts/.js/.vue/.py/.nix) are intentionally excluded —
// tool references in code are always correct usage.
// ---------------------------------------------------------------------------

function getFilesToScan(root: string): string[] {
  return globSync('**/*.md', {
    cwd: root,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/cognee-nix/**',
      '**/cognee-integrations/**',
      '**/research/**',
      '**/.q-cache/**',
      '**/dist/**',
      '**/build/**',
    ],
  })
}

// ---------------------------------------------------------------------------
// Finding type
// ---------------------------------------------------------------------------

interface Finding {
  file: string
  line: number
  text: string
  kind: Pattern['kind']
  message: string
}

// ---------------------------------------------------------------------------
// Scan a single file
// ---------------------------------------------------------------------------

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = []
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return findings
  }

  const lines = content.split('\n')
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]

    // Track fenced code blocks — skip pattern matching inside them
    if (/^```/.test(raw.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // Skip indented code lines (4-space / tab)
    if (/^(?:    |\t)/.test(raw)) continue

    // Apply line-level exemptions
    if (LINE_EXEMPTIONS.some((rx) => rx.test(raw))) continue

    // Test each red-flag pattern
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(raw)) {
        findings.push({
          file: filePath,
          line: i + 1,
          text: raw.trim(),
          kind: pattern.kind,
          message: pattern.message,
        })
        break // one finding per line
      }
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const jsonMode = process.argv.includes('--json')
  const rootIdx = process.argv.indexOf('--root')
  const scanRoot = rootIdx !== -1 ? resolve(process.argv[rootIdx + 1]) : PROJECT_ROOT
  const files = getFilesToScan(scanRoot)
  const allFindings: Finding[] = []

  for (const file of files) {
    if (PATH_EXEMPTIONS.some((rx) => rx.test(file))) continue
    allFindings.push(...scanFile(file))
  }

  if (jsonMode) {
    console.log(JSON.stringify({ pass: allFindings.length === 0, findings: allFindings }, null, 2))
    process.exit(allFindings.length > 0 ? 1 : 0)
  }

  const relPath = (f: string) => relative(scanRoot, f)

  if (allFindings.length === 0) {
    console.log(`${GREEN}✓ audit:engram-naming — PASS${RESET}`)
    console.log(`${DIM}  ${files.length} files scanned. No Engram/Cognee naming violations.${RESET}`)
    process.exit(0)
  }

  // Group by file for readable output
  const byFile = new Map<string, Finding[]>()
  for (const f of allFindings) {
    const key = f.file
    if (!byFile.has(key)) byFile.set(key, [])
    byFile.get(key)!.push(f)
  }

  console.log(`${RED}${BOLD}✗ audit:engram-naming — FAIL${RESET}`)
  console.log()

  const kindLabel: Record<Pattern['kind'], string> = {
    'cognee-as-system': `${YELLOW}[cognee-as-system]${RESET}`,
    'engram-as-process': `${YELLOW}[engram-as-process]${RESET}`,
  }

  for (const [file, findings] of byFile) {
    console.log(`${BOLD}${relPath(file)}${RESET}`)
    for (const f of findings) {
      console.log(`  ${DIM}L${f.line}${RESET} ${kindLabel[f.kind]}`)
      console.log(`       ${DIM}${f.text.slice(0, 120)}${RESET}`)
      console.log(`       ${f.message}`)
    }
    console.log()
  }

  const cogneeAsSystem = allFindings.filter((f) => f.kind === 'cognee-as-system').length
  const engramAsProcess = allFindings.filter((f) => f.kind === 'engram-as-process').length

  console.log(`${RED}${allFindings.length} violation(s)${RESET}  `
    + `${cogneeAsSystem} cognee-as-system  `
    + `${engramAsProcess} engram-as-process`)
  console.log()
  console.log(`${DIM}Decision #157: "Engram" = portfolio-wide system; "Cognee" = the open-source implementation tool.${RESET}`)

  process.exit(1)
}

main()
