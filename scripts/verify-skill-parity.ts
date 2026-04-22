// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Skill Parity Auditor
 *
 * Enforces the scope contract between user-level skills at
 * ~/.claude/skills/ and project-level skills at .claude/skills/.
 *
 * Each skill declares its scope in frontmatter metadata:
 *   metadata:
 *     scope: user    -> must live only in ~/.claude/skills/
 *     scope: project -> must live only in .claude/skills/
 *     scope: both    -> must live in BOTH and be SHA-equal
 *
 * Why this exists: Forge autonomous agents and SDK agents don't inherit
 * ~/.claude/skills/ (user-scoped). Skills that need to be agent-accessible
 * must be mirrored into the repo at .claude/skills/. Without an auditor,
 * one copy drifts from the other (bug fixed in user version, agent still
 * runs stale project version — or vice versa).
 *
 * Checks:
 *   1. Every skill declares scope in frontmatter metadata.
 *   2. scope: user    -> not present in project .claude/skills/.
 *   3. scope: project -> not present in user ~/.claude/skills/.
 *   4. scope: both    -> present in BOTH locations, byte-identical.
 *
 * Invocation:
 *   npx tsx scripts/verify-skill-parity.ts
 *   or: npm run audit:skill-parity
 *
 * Exit codes:
 *   0 pass, 1 fail.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { createHash } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const USER_SKILLS = resolve(homedir(), '.claude', 'skills')
const PROJECT_SKILLS = resolve(PROJECT_ROOT, '.claude', 'skills')

interface Skill {
  name: string
  path: string
  scope: 'user' | 'project' | 'both' | null
  sha: string
}

interface Violation {
  name: string
  detail: string
}

function listSkills(base: string): Skill[] {
  if (!existsSync(base)) return []
  const skills: Skill[] = []
  for (const entry of readdirSync(base)) {
    const sub = resolve(base, entry)
    if (!statSync(sub).isDirectory()) continue
    const skillFile = resolve(sub, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    const content = readFileSync(skillFile, 'utf8')
    const scope = extractScope(content)
    const sha = createHash('sha256').update(content).digest('hex').slice(0, 12)
    skills.push({ name: entry, path: skillFile, scope, sha })
  }
  return skills
}

function extractScope(content: string): 'user' | 'project' | 'both' | null {
  // Look inside frontmatter block. Match metadata.scope: <value>.
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null
  const fm = fmMatch[1]!
  // Match either top-level scope: (legacy) or metadata.scope: (correct).
  const topLevel = fm.match(/^scope:\s*(user|project|both)\s*$/m)
  if (topLevel) return topLevel[1] as 'user' | 'project' | 'both'
  const nested = fm.match(/^\s*scope:\s*(user|project|both)\s*$/m)
  if (nested) return nested[1] as 'user' | 'project' | 'both'
  return null
}

function main(): void {
  const GREEN = '\x1b[32m'
  const RED = '\x1b[31m'
  const YELLOW = '\x1b[33m'
  const BOLD = '\x1b[1m'
  const DIM = '\x1b[2m'
  const RESET = '\x1b[0m'

  console.log(`${BOLD}Skill Parity Audit${RESET}`)
  console.log(`${DIM}Enforces scope contract between user and project skills.${RESET}`)
  console.log()

  const userSkills = listSkills(USER_SKILLS)
  const projectSkills = listSkills(PROJECT_SKILLS)

  console.log(
    `  ${GREEN}✓${RESET} User skills (${USER_SKILLS}): ${userSkills.length}`,
  )
  console.log(
    `  ${GREEN}✓${RESET} Project skills (${PROJECT_SKILLS.replace(PROJECT_ROOT + '/', '')}): ${projectSkills.length}`,
  )

  const violations: Violation[] = []

  // Build name -> scope/path maps.
  const userMap = new Map<string, Skill>()
  const projectMap = new Map<string, Skill>()
  for (const s of userSkills) userMap.set(s.name, s)
  for (const s of projectSkills) projectMap.set(s.name, s)

  // Check 1: every skill must declare scope.
  for (const s of [...userSkills, ...projectSkills]) {
    if (s.scope === null) {
      violations.push({
        name: s.name,
        detail: `missing scope declaration in frontmatter metadata. Add 'metadata:\\n  scope: user|project|both' to ${s.path.replace(homedir(), '~')}`,
      })
    }
  }

  // Check 2-4: scope contract.
  const allNames = new Set([...userMap.keys(), ...projectMap.keys()])
  for (const name of allNames) {
    const u = userMap.get(name)
    const p = projectMap.get(name)

    // Determine declared scope. If present in both copies, the user copy is
    // authoritative for scope-declaration purposes; if declarations disagree
    // that's itself a violation.
    const declared = u?.scope ?? p?.scope ?? null

    if (declared === null) continue // already reported above

    if (u && p && u.scope !== p.scope) {
      violations.push({
        name,
        detail: `scope declarations disagree — user copy says '${u.scope}', project copy says '${p.scope}'`,
      })
      continue
    }

    if (declared === 'user') {
      if (p) {
        violations.push({
          name,
          detail: `scope: user but project copy exists at ${p.path.replace(PROJECT_ROOT + '/', '')}. Either change scope to 'both' (and ensure byte-equal copies) or delete the project copy.`,
        })
      }
    } else if (declared === 'project') {
      if (u) {
        violations.push({
          name,
          detail: `scope: project but user copy exists at ${u.path.replace(homedir(), '~')}. Either change scope to 'both' (and ensure byte-equal copies) or delete the user copy.`,
        })
      }
    } else if (declared === 'both') {
      if (!u || !p) {
        const missing = !u ? 'user copy (~/.claude/skills/)' : 'project copy (.claude/skills/)'
        violations.push({
          name,
          detail: `scope: both but ${missing} is missing. Run 'npm run skills:sync' to mirror.`,
        })
      } else if (u.sha !== p.sha) {
        violations.push({
          name,
          detail: `scope: both but copies have drifted (user SHA ${u.sha}, project SHA ${p.sha}). Run 'npm run skills:sync' after deciding which copy is canonical.`,
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(`  ${GREEN}✓${RESET} Every skill has scope declared`)
    console.log(`  ${GREEN}✓${RESET} scope: user skills absent from project`)
    console.log(`  ${GREEN}✓${RESET} scope: project skills absent from user`)
    console.log(`  ${GREEN}✓${RESET} scope: both skills present in both, byte-identical`)
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — skill parity intact`)
    process.exit(0)
  }

  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} ${v.name} — ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} violation(s)`)
  if (violations.some((v) => /scope: both but copies have drifted/.test(v.detail))) {
    console.log()
    console.log(`${YELLOW}Helper:${RESET} decide which copy is canonical, then:`)
    console.log(`  cp <canonical>/SKILL.md <stale>/SKILL.md`)
    console.log(`  or use 'npm run skills:sync -- --canonical user|project'`)
  }
  process.exit(1)
}

main()
