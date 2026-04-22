// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Skill Sync Helper
 *
 * For every skill declared scope: both, copy from the canonical source
 * to the other location so both copies stay byte-identical.
 *
 * Usage:
 *   npx tsx scripts/sync-skills.ts --canonical user    # user -> project
 *   npx tsx scripts/sync-skills.ts --canonical project # project -> user
 *   npx tsx scripts/sync-skills.ts --check             # dry-run (no writes)
 *
 * Invoked from pre-commit hook when .claude/skills/** is staged.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, cpSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const USER_SKILLS = resolve(homedir(), '.claude', 'skills')
const PROJECT_SKILLS = resolve(PROJECT_ROOT, '.claude', 'skills')

function extractScope(content: string): 'user' | 'project' | 'both' | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null
  const fm = fmMatch[1]!
  const m = fm.match(/^\s*scope:\s*(user|project|both)\s*$/m)
  return m ? (m[1] as 'user' | 'project' | 'both') : null
}

function listBothSkills(base: string): string[] {
  if (!existsSync(base)) return []
  const names: string[] = []
  for (const entry of readdirSync(base)) {
    const sub = resolve(base, entry)
    if (!statSync(sub).isDirectory()) continue
    const skillFile = resolve(sub, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    const content = readFileSync(skillFile, 'utf8')
    if (extractScope(content) === 'both') names.push(entry)
  }
  return names
}

function main(): void {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const canonicalArg = args.find((a) => a.startsWith('--canonical'))
  const canonical = canonicalArg
    ? canonicalArg.includes('=')
      ? canonicalArg.split('=')[1]
      : args[args.indexOf(canonicalArg) + 1]
    : null

  if (!check && canonical !== 'user' && canonical !== 'project') {
    console.error('Usage: sync-skills --canonical (user|project) OR --check')
    process.exit(1)
  }

  const userBoth = new Set(listBothSkills(USER_SKILLS))
  const projectBoth = new Set(listBothSkills(PROJECT_SKILLS))
  const allBoth = new Set([...userBoth, ...projectBoth])

  let changes = 0
  let drift = 0

  for (const name of allBoth) {
    const userPath = resolve(USER_SKILLS, name, 'SKILL.md')
    const projectPath = resolve(PROJECT_SKILLS, name, 'SKILL.md')
    const userExists = existsSync(userPath)
    const projectExists = existsSync(projectPath)

    const userContent = userExists ? readFileSync(userPath, 'utf8') : null
    const projectContent = projectExists ? readFileSync(projectPath, 'utf8') : null

    if (userContent !== projectContent) {
      drift++
      if (check) {
        console.log(`DRIFT: ${name}`)
        console.log(`  user:    ${userExists ? 'present' : 'MISSING'}`)
        console.log(`  project: ${projectExists ? 'present' : 'MISSING'}`)
        if (userExists && projectExists) {
          console.log(`  (content differs)`)
        }
        continue
      }

      const src = canonical === 'user' ? userPath : projectPath
      const dst = canonical === 'user' ? projectPath : userPath
      const srcExists = canonical === 'user' ? userExists : projectExists

      if (!srcExists) {
        console.error(
          `Cannot sync ${name}: canonical (${canonical}) copy does not exist.`,
        )
        process.exit(1)
      }

      const dstDir = dirname(dst)
      if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })

      // Copy the entire skill directory, not just SKILL.md, so any
      // referenced scripts / templates / fixtures also mirror.
      const srcDir = dirname(src)
      const dstSkillDir = dirname(dst)
      cpSync(srcDir, dstSkillDir, { recursive: true, force: true })
      console.log(`SYNCED: ${name} (${canonical} -> ${canonical === 'user' ? 'project' : 'user'})`)
      changes++
    }
  }

  if (check) {
    if (drift === 0) {
      console.log('All scope: both skills in sync.')
      process.exit(0)
    }
    console.log(`\n${drift} skill(s) drifted. Run with --canonical user or --canonical project to fix.`)
    process.exit(1)
  }

  console.log(`\n${changes} skill(s) synced.`)
  process.exit(0)
}

main()
