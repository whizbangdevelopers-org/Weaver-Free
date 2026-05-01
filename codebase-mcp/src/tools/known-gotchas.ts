// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface Gotcha {
  title: string
  rawText: string
  problem?: string
  fix?: string
  rule?: string
  convention?: string
}

interface GotchaSection {
  name: string
  gotchas: Gotcha[]
}

interface KnownGotchasResult {
  sections: GotchaSection[]
  allSections: string[]
  warnings: string[]
}

function extractTaggedBlock(text: string, tag: string): string | undefined {
  // Match **Tag:** content up to next **Tag:**, code block, or end
  const regex = new RegExp(`\\*\\*${tag}:\\*\\*\\s*([\\s\\S]*?)(?=\\*\\*\\w[\\w /]*:\\*\\*|###|##|$)`)
  const m = regex.exec(text)
  return m ? m[1].trim() : undefined
}

function parseGotchas(sectionText: string): Gotcha[] {
  // Split on ### headings
  const parts = sectionText.split(/\n(?=### )/)
  const gotchas: Gotcha[] = []

  for (const part of parts) {
    const headingMatch = part.match(/^### (.+)/)
    if (!headingMatch) continue

    const title = headingMatch[1].trim()
    const body = part.slice(headingMatch[0].length).trim()

    const gotcha: Gotcha = { title, rawText: body }

    const problem = extractTaggedBlock(body, 'Problem')
    const fix = extractTaggedBlock(body, 'Fix')
    const rule = extractTaggedBlock(body, 'Rule')
    const convention = extractTaggedBlock(body, 'Convention')

    if (problem) gotcha.problem = problem
    if (fix) gotcha.fix = fix
    if (rule) gotcha.rule = rule
    if (convention) gotcha.convention = convention

    gotchas.push(gotcha)
  }

  return gotchas
}

export async function getKnownGotchas(projectRoot: string, section?: string): Promise<KnownGotchasResult> {
  const warnings: string[] = []
  const filePath = resolve(projectRoot, 'docs/development/KNOWN-GOTCHAS.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    return { sections: [], allSections: [], warnings: ['Could not read docs/development/KNOWN-GOTCHAS.md'] }
  }

  // Split on ## headings (top-level sections)
  const parts = content.split(/\n(?=## )/)
  const sectionBlocks: Array<{ name: string; text: string }> = []

  for (const part of parts) {
    const headingMatch = part.match(/^## (.+)/)
    if (!headingMatch) continue
    const name = headingMatch[1].trim()
    const text = part.slice(headingMatch[0].length).trim()
    sectionBlocks.push({ name, text })
  }

  const allSections = sectionBlocks.map(s => s.name)

  const sections: GotchaSection[] = []
  for (const { name, text } of sectionBlocks) {
    if (section && !name.toLowerCase().includes(section.toLowerCase())) continue
    const gotchas = parseGotchas(text)
    sections.push({ name, gotchas })
  }

  if (sections.length === 0 && section) {
    warnings.push(`No sections matched filter "${section}". Available: ${allSections.join(', ')}`)
  }

  return { sections, allSections, warnings }
}
