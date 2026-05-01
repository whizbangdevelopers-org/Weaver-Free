// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface AgentFrontmatter {
  name?: string
  description?: string
  tools?: string[]
  disallowedTools?: string[]
  model?: string
  maxTurns?: number
}

interface AgentEntry {
  /** Project-root-relative path, e.g. '.claude/agents/release-prep.md' */
  sourcePath: string
  /** 'project' = fabrick-weaver-project/.claude/agents; 'code' = code/.claude/agents */
  scope: 'project' | 'code'
  /** Filename without .md, e.g. 'release-prep' */
  filename: string
  frontmatter: AgentFrontmatter
  /** Agent instructions body with frontmatter stripped */
  instructions: string
}

interface AgentCatalogResult {
  agents: AgentEntry[]
  /** All available agent filenames — use for reference when filtering */
  available: string[]
  warnings: string[]
}

function parseFrontmatter(raw: string): { frontmatter: AgentFrontmatter; body: string } {
  const fmMatch = raw.match(/^(?:<!--.*?-->\s*)*---\r?\n([\s\S]*?)\r?\n---\r?\n?/s)
  if (!fmMatch) return { frontmatter: {}, body: raw }

  const fmText = fmMatch[1]
  const body = raw.slice(fmMatch[0].length)
  const frontmatter: AgentFrontmatter = {}

  const nameMatch = fmText.match(/^name:\s*(.+)$/m)
  if (nameMatch) frontmatter.name = nameMatch[1].trim()

  const descMatch = fmText.match(/^description:\s*(.+)$/m)
  if (descMatch) frontmatter.description = descMatch[1].trim().replace(/^['"]|['"]$/g, '')

  const modelMatch = fmText.match(/^model:\s*(.+)$/m)
  if (modelMatch) frontmatter.model = modelMatch[1].trim()

  const maxTurnsMatch = fmText.match(/^maxTurns:\s*(\d+)$/m)
  if (maxTurnsMatch) frontmatter.maxTurns = parseInt(maxTurnsMatch[1], 10)

  const toolsMatch = fmText.match(/^tools:\s*(.+)$/m)
  if (toolsMatch) {
    frontmatter.tools = toolsMatch[1].split(',').map(t => t.trim()).filter(Boolean)
  }

  const disallowedMatch = fmText.match(/^disallowedTools:\s*(.+)$/m)
  if (disallowedMatch) {
    frontmatter.disallowedTools = disallowedMatch[1].split(',').map(t => t.trim()).filter(Boolean)
  }

  return { frontmatter, body: body.trim() }
}

async function loadAgentsDir(
  dir: string,
  scope: 'project' | 'code',
  projectParent: string,
  filter?: string
): Promise<{ agents: AgentEntry[]; warnings: string[] }> {
  const warnings: string[] = []
  const filePaths = await listFiles(dir, '.md')
  const agents: AgentEntry[] = []

  for (const filePath of filePaths) {
    const filename = basename(filePath, '.md')
    if (filter && !filename.toLowerCase().includes(filter.toLowerCase())) continue

    const raw = await safeReadFile(filePath)
    if (!raw) {
      warnings.push(`Could not read ${filePath}`)
      continue
    }

    const { frontmatter, body } = parseFrontmatter(raw)
    const sourcePath = relative(projectParent, filePath)
    agents.push({ sourcePath, scope, filename, frontmatter, instructions: body })
  }

  return { agents, warnings }
}

/**
 * Read all .claude/agents/*.md definitions from both the project root and code/ levels.
 *
 * @param codeRoot      Absolute path to code/ (PROJECT_ROOT in index.ts)
 * @param projectParent Absolute path to project root (PROJECT_PARENT in index.ts)
 * @param name          Optional filter — agent filename fragment, e.g. 'e2e', 'security'
 * @param scope         Optional scope filter — 'project' | 'code'
 */
export async function getAgentCatalog(
  codeRoot: string,
  projectParent: string,
  name?: string,
  scope?: 'project' | 'code'
): Promise<AgentCatalogResult> {
  const projectAgentsDir = resolve(projectParent, '.claude/agents')
  const codeAgentsDir = resolve(codeRoot, '.claude/agents')

  const [projectResult, codeResult] = await Promise.all([
    scope === 'code' ? Promise.resolve({ agents: [], warnings: [] })
      : loadAgentsDir(projectAgentsDir, 'project', projectParent, name),
    scope === 'project' ? Promise.resolve({ agents: [], warnings: [] })
      : loadAgentsDir(codeAgentsDir, 'code', projectParent, name),
  ])

  const allAgents = [...projectResult.agents, ...codeResult.agents]
  const warnings = [...projectResult.warnings, ...codeResult.warnings]

  // Build available list from unfiltered scan
  const [allProjectFiles, allCodeFiles] = await Promise.all([
    listFiles(projectAgentsDir, '.md'),
    listFiles(codeAgentsDir, '.md'),
  ])
  const available = [
    ...allProjectFiles.map(f => `project: ${basename(f, '.md')}`),
    ...allCodeFiles.map(f => `code: ${basename(f, '.md')}`),
  ]

  if (allAgents.length === 0 && (name || scope)) {
    warnings.push(`No agents matched filter name="${name ?? ''}" scope="${scope ?? 'any'}". Available: ${available.join(', ')}`)
  }

  return { agents: allAgents, available, warnings }
}
