// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { homedir } from 'node:os'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface RuleFrontmatter {
  paths?: string[]
  description?: string
  metadata?: Record<string, string>
}

interface RuleFile {
  /** Project-root-relative path, e.g. '.claude/rules/testing.md' */
  sourcePath: string
  /**
   * 'global'  = ~/.claude/CLAUDE.md (cross-project vocabulary, engineering principles)
   * 'project' = fabrick-weaver-project/.claude/rules
   * 'code'    = code/.claude/rules
   * 'claude'  = code/CLAUDE.md (top-level project instructions)
   * 'skill'   = fabrick-weaver-project/.claude/skills/<name>/SKILL.md
   */
  scope: 'global' | 'project' | 'code' | 'claude' | 'skill'
  /** Filename without .md, e.g. 'testing' */
  name: string
  frontmatter: RuleFrontmatter
  /** Markdown content, frontmatter stripped */
  content: string
}

interface ProjectRulesResult {
  files: RuleFile[]
  /** All available rule names — use for reference when filtering */
  availableFiles: string[]
  warnings: string[]
}

function parseFrontmatter(raw: string): { frontmatter: RuleFrontmatter; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!fmMatch) return { frontmatter: {}, body: raw }

  const fmText = fmMatch[1]
  const body = raw.slice(fmMatch[0].length)

  const frontmatter: RuleFrontmatter = {}

  // description: single-line value
  const descMatch = fmText.match(/^description:\s*(.+)$/m)
  if (descMatch) frontmatter.description = descMatch[1].trim().replace(/^['"]|['"]$/g, '')

  // paths: YAML sequence (list items starting with "  - ")
  const pathsBlockMatch = fmText.match(/^paths:\s*\n((?:\s+-\s+.+\n?)+)/m)
  if (pathsBlockMatch) {
    frontmatter.paths = pathsBlockMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }

  // metadata: simple key-value block (used in skill files)
  const metaBlockMatch = fmText.match(/^metadata:\s*\n((?:\s+\S+:\s*.+\n?)+)/m)
  if (metaBlockMatch) {
    frontmatter.metadata = {}
    for (const line of metaBlockMatch[1].split('\n')) {
      const kv = line.match(/^\s+(\S+):\s*(.+)$/)
      if (kv) frontmatter.metadata[kv[1]] = kv[2].trim()
    }
  }

  return { frontmatter, body }
}

async function loadRulesDir(
  dir: string,
  scope: 'project' | 'code',
  projectParent: string,
  codeRoot: string,
  filter?: string
): Promise<{ files: RuleFile[]; warnings: string[] }> {
  const warnings: string[] = []
  const filePaths = await listFiles(dir, '.md')

  const files: RuleFile[] = []
  for (const filePath of filePaths) {
    const name = basename(filePath, '.md')
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue

    const raw = await safeReadFile(filePath)
    if (!raw) {
      warnings.push(`Could not read ${filePath}`)
      continue
    }

    const { frontmatter, body } = parseFrontmatter(raw)
    const base = scope === 'project' ? projectParent : codeRoot
    const sourcePath = relative(projectParent, filePath)

    files.push({ sourcePath, scope, name, frontmatter, content: body.trim() })
  }

  return { files, warnings }
}

/**
 * Read all .claude/rules/*.md files from both the project root and code/ levels,
 * plus code/CLAUDE.md (project instructions) and ~/.claude/CLAUDE.md (global
 * vocabulary, engineering principles, Forge/Foundry definitions).
 *
 * @param codeRoot      Absolute path to the code/ directory (PROJECT_ROOT in index.ts)
 * @param projectParent Absolute path to the project root (PROJECT_PARENT in index.ts)
 * @param file          Optional filter — rule name fragment, e.g. 'testing', 'security', 'global'
 */
export async function getProjectRules(
  codeRoot: string,
  projectParent: string,
  file?: string
): Promise<ProjectRulesResult> {
  const projectRulesDir = resolve(projectParent, '.claude/rules')
  const codeRulesDir = resolve(codeRoot, '.claude/rules')

  const [projectResult, codeResult] = await Promise.all([
    loadRulesDir(projectRulesDir, 'project', projectParent, codeRoot, file),
    loadRulesDir(codeRulesDir, 'code', projectParent, codeRoot, file),
  ])

  const allFiles = [...projectResult.files, ...codeResult.files]
  const warnings = [...projectResult.warnings, ...codeResult.warnings]

  // Include ~/.claude/CLAUDE.md as scope 'global' — cross-project vocabulary,
  // engineering principles, Forge/Foundry definitions, decision-making style.
  // Claude Desktop does not load this automatically (only Claude Code CLI does).
  const globalClaudeMdPath = resolve(homedir(), '.claude', 'CLAUDE.md')
  const globalMatch = !file || 'global'.includes(file.toLowerCase()) || 'CLAUDE'.toLowerCase().includes(file.toLowerCase())
  if (globalMatch) {
    const raw = await safeReadFile(globalClaudeMdPath)
    if (raw) {
      const { frontmatter, body } = parseFrontmatter(raw)
      allFiles.unshift({
        sourcePath: '~/.claude/CLAUDE.md',
        scope: 'global',
        name: 'global-CLAUDE',
        frontmatter,
        content: body.trim(),
      })
    } else {
      warnings.push('Could not read ~/.claude/CLAUDE.md')
    }
  }

  // Also include code/CLAUDE.md as scope 'claude' — top-level project instructions
  const claudeMdPath = resolve(codeRoot, 'CLAUDE.md')
  const claudeMdMatch = !file || 'CLAUDE'.toLowerCase().includes(file.toLowerCase()) || 'claude'.includes(file.toLowerCase())
  if (claudeMdMatch) {
    const raw = await safeReadFile(claudeMdPath)
    if (raw) {
      const { frontmatter, body } = parseFrontmatter(raw)
      allFiles.push({
        sourcePath: 'code/CLAUDE.md',
        scope: 'claude',
        name: 'CLAUDE',
        frontmatter,
        content: body.trim(),
      })
    } else {
      warnings.push('Could not read code/CLAUDE.md')
    }
  }

  // Load skills: .claude/skills/<name>/SKILL.md (each skill is a subdirectory)
  const skillsDir = resolve(projectParent, '.claude/skills')
  const skillDirs = await listDirs(skillsDir)
  const skillNames: string[] = []
  for (const skillDir of skillDirs) {
    const skillName = basename(skillDir)
    skillNames.push(`skill: ${skillName}`)
    const skillFile = resolve(skillDir, 'SKILL.md')
    if (file && !skillName.toLowerCase().includes(file.toLowerCase())) continue
    const raw = await safeReadFile(skillFile)
    if (!raw) {
      warnings.push(`Could not read ${skillFile}`)
      continue
    }
    const { frontmatter, body } = parseFrontmatter(raw)
    allFiles.push({
      sourcePath: relative(projectParent, skillFile),
      scope: 'skill',
      name: skillName,
      frontmatter,
      content: body.trim(),
    })
  }

  // Build available list from unfiltered scan for reference
  const allProjectFiles = await listFiles(projectRulesDir, '.md')
  const allCodeFiles = await listFiles(codeRulesDir, '.md')
  const availableFiles = [
    'global: global-CLAUDE',
    ...allProjectFiles.map(f => `project: ${basename(f, '.md')}`),
    ...allCodeFiles.map(f => `code: ${basename(f, '.md')}`),
    'claude: CLAUDE',
    ...skillNames,
  ]

  if (allFiles.length === 0 && file) {
    warnings.push(
      `No rules matched filter "${file}". Available: ${availableFiles.join(', ')}`
    )
  }

  return { files: allFiles, availableFiles, warnings }
}
