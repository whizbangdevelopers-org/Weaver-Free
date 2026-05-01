// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface Lesson {
  title: string
  content: string
  hasRule: boolean
  rule?: string
}

interface LessonSection {
  category: string
  lessons: Lesson[]
}

interface LessonsLearnedResult {
  sections: LessonSection[]
  allCategories: string[]
  phaseHistory: Array<{ phase: string; description: string; status: string }>
  warnings: string[]
}

function parsePhaseHistory(content: string): Array<{ phase: string; description: string; status: string }> {
  const tableMatch = content.match(/## Phase History[\s\S]*?\|[-|]+\|\n([\s\S]*?)(?:\n---|\n##|$)/)
  if (!tableMatch) return []

  return tableMatch[1]
    .split('\n')
    .filter(l => l.startsWith('|') && !l.match(/^[|\s-]+$/))
    .map(l => {
      const cells = l.split('|').map(c => c.trim()).filter(Boolean)
      return { phase: cells[0] ?? '', description: cells[1] ?? '', status: cells[2] ?? '' }
    })
    .filter(r => r.phase)
}

function parseLessons(sectionText: string): Lesson[] {
  // Split on ### subsections
  const parts = sectionText.split(/\n(?=### )/)
  const lessons: Lesson[] = []

  for (const part of parts) {
    const headingMatch = part.match(/^### (.+)/)
    if (headingMatch) {
      const title = headingMatch[1].trim()
      const body = part.slice(headingMatch[0].length).trim()
      const ruleMatch = body.match(/\*\*Rule:\*\*\s*([^*\n]+(?:\n(?!\*\*)[^*\n]+)*)/)
      lessons.push({
        title,
        content: body,
        hasRule: !!ruleMatch,
        rule: ruleMatch?.[1]?.trim(),
      })
      continue
    }

    // No ### heading — this is a top-level section (## heading) with paragraphs
    // Each ## paragraph becomes a lesson with the first line as title
    const paragraphs = part.split(/\n\n+/).filter(p => p.trim())
    for (const para of paragraphs) {
      const lines = para.trim().split('\n')
      const firstLine = lines[0].trim()
      if (!firstLine || firstLine.startsWith('|') || firstLine.startsWith('-')) continue

      // Skip the phase history table and section dividers
      if (firstLine.startsWith('Phase') || firstLine === '---') continue

      const ruleMatch = para.match(/\*\*Rule:\*\*\s*([^*\n]+)/)
      lessons.push({
        title: firstLine.replace(/^#+\s*/, ''),
        content: para,
        hasRule: !!ruleMatch,
        rule: ruleMatch?.[1]?.trim(),
      })
    }
  }

  return lessons.filter(l => l.title && l.content.length > 20)
}

export async function getLessonsLearned(
  projectRoot: string,
  category?: string,
  keyword?: string
): Promise<LessonsLearnedResult> {
  const warnings: string[] = []
  const filePath = resolve(projectRoot, 'docs/development/LESSONS-LEARNED.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    return { sections: [], allCategories: [], phaseHistory: [], warnings: ['Could not read docs/development/LESSONS-LEARNED.md'] }
  }

  // Parse phase history table
  const phaseHistory = parsePhaseHistory(content)

  // Split on ## headings
  const parts = content.split(/\n(?=## )/)
  const sectionBlocks: Array<{ name: string; text: string }> = []

  for (const part of parts) {
    const headingMatch = part.match(/^## (.+)/)
    if (!headingMatch) continue
    const name = headingMatch[1].trim()
    if (name === 'Phase History') continue // handled separately
    const text = part.slice(headingMatch[0].length).trim()
    sectionBlocks.push({ name, text })
  }

  const allCategories = sectionBlocks.map(s => s.name)

  const sections: LessonSection[] = []
  for (const { name, text } of sectionBlocks) {
    // Category filter: match on section name
    if (category && !name.toLowerCase().includes(category.toLowerCase())) continue

    let lessons = parseLessons(text)

    // Keyword filter: match on title or content
    if (keyword) {
      const kw = keyword.toLowerCase()
      lessons = lessons.filter(l =>
        l.title.toLowerCase().includes(kw) ||
        l.content.toLowerCase().includes(kw)
      )
    }

    if (lessons.length > 0) {
      sections.push({ category: name, lessons })
    }
  }

  if (sections.length === 0) {
    if (category) warnings.push(`No sections matched category "${category}". Available: ${allCategories.join(', ')}`)
    if (keyword) warnings.push(`No lessons matched keyword "${keyword}"`)
  }

  return { sections, allCategories, phaseHistory, warnings }
}
