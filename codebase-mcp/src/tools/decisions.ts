// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'
import { extractSection, parseMarkdownTable } from '../utils/markdown-parser.js'

interface DecisionsResult {
  decisions: Array<Record<string, string>>
  source: string
  warnings: string[]
}

export async function getDecisions(projectParent: string): Promise<DecisionsResult> {
  const warnings: string[] = []
  const filePath = resolve(projectParent, 'MASTER-PLAN.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    return { decisions: [], source: filePath, warnings: ['Could not read MASTER-PLAN.md'] }
  }

  const section = extractSection(content, 'Decisions Resolved')
  if (!section) {
    return { decisions: [], source: filePath, warnings: ['Could not find Decisions Resolved section'] }
  }

  const decisions = parseMarkdownTable(section)
  if (decisions.length === 0) {
    warnings.push('Decisions Resolved section found but no table rows parsed')
  }

  return { decisions, source: filePath, warnings }
}
