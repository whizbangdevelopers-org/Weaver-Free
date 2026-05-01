// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'
import { extractSection, parseMarkdownTable } from '../utils/markdown-parser.js'

interface TierModelResult {
  tiers: Array<Record<string, string>>
  source: string
  warnings: string[]
}

export async function getTierModel(projectParent: string): Promise<TierModelResult> {
  const warnings: string[] = []
  const filePath = resolve(projectParent, 'MASTER-PLAN.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    return { tiers: [], source: filePath, warnings: ['Could not read MASTER-PLAN.md'] }
  }

  const section = extractSection(content, 'Tier Model (updated)')
    ?? extractSection(content, 'Tier Model')

  if (!section) {
    return { tiers: [], source: filePath, warnings: ['Could not find Tier Model section'] }
  }

  const tiers = parseMarkdownTable(section)
  if (tiers.length === 0) {
    warnings.push('Tier Model section found but no table rows parsed')
  }

  return { tiers, source: filePath, warnings }
}
