// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface ChecklistQuestion {
  number: number
  category: string
  question: string
  detail: string
}

interface WorkflowImportChecklistResult {
  questions: ChecklistQuestion[]
  confirmingQuestion: string
  demoResetLesson: string
  warnings: string[]
}

export async function getWorkflowImportChecklist(
  projectRoot: string,
): Promise<WorkflowImportChecklistResult> {
  const warnings: string[] = []
  // Rule file lives two levels above code/ root
  const filePath = resolve(projectRoot, '..', '..', '.claude', 'rules', 'workflow-review.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    warnings.push('Could not read .claude/rules/workflow-review.md')
    return { questions: [], confirmingQuestion: '', demoResetLesson: '', warnings }
  }

  const questions: ChecklistQuestion[] = []
  let confirmingQuestion = ''
  let demoResetLesson = ''
  let currentCategory = ''
  let questionNum = 0

  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Category heading (## Architecture match, ## Path and secret validity, ## Trigger scope)
    const catMatch = line.match(/^## (.+)$/)
    if (catMatch && !catMatch[1].startsWith('The confirming')) {
      currentCategory = catMatch[1].trim()
      i++
      continue
    }

    // Confirming question section
    if (line.match(/^## The confirming question/)) {
      // Grab the paragraph that follows
      i++
      const parts: string[] = []
      while (i < lines.length && !lines[i].startsWith('#')) {
        if (lines[i].trim()) parts.push(lines[i].trim())
        i++
      }
      confirmingQuestion = parts.join(' ').replace(/\*\*/g, '').replace(/\*/g, '')
      continue
    }

    // Numbered question (1. **Question text** ...)
    const qMatch = line.match(/^(\d+)\.\s+\*\*([^*]+)\*\*\s*(.*)/)
    if (qMatch) {
      questionNum++
      const header = qMatch[2].trim()
      const rest = qMatch[3].trim()

      // Collect continuation lines (indented or blank continuation)
      const detailParts: string[] = []
      if (rest) detailParts.push(rest)
      i++
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].match(/^\d+\./) &&
        !lines[i].startsWith('#')
      ) {
        detailParts.push(lines[i].trim())
        i++
      }

      // Extract the demo-reset lesson from Q1's detail
      const detail = detailParts.join(' ').replace(/\*\*/g, '').replace(/\*/g, '')
      if (questionNum === 1 && detail.includes('demo-reset')) {
        // Split header from the embedded lesson
        const lessonStart = detail.indexOf('The demo-reset lesson')
        if (lessonStart !== -1) {
          demoResetLesson = detail.slice(lessonStart)
        }
      }

      questions.push({
        number: questionNum,
        category: currentCategory,
        question: header,
        detail,
      })
      continue
    }

    i++
  }

  return { questions, confirmingQuestion, demoResetLesson, warnings }
}
