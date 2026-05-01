// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface PhaseEntry {
  name: string
  version: string
  progress: number
  status: string
}

interface PhaseStatusResult {
  phases: PhaseEntry[]
  current: string
  nextUp: string
  source: string
  warnings: string[]
}

export async function getPhaseStatus(projectParent: string): Promise<PhaseStatusResult> {
  const warnings: string[] = []
  const filePath = resolve(projectParent, 'plans/EXECUTION-ROADMAP.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    return { phases: [], current: '', nextUp: '', source: filePath, warnings: ['Could not read EXECUTION-ROADMAP.md'] }
  }

  const phases: PhaseEntry[] = []

  // Parse progress lines — handles several formats:
  //   Phase 1:  VM Registration CRUD (v0.1.0)  ████ 100%  COMPLETE
  //   Phase 5d: Mobile / Responsive Polish      ████ 100%  COMPLETE   (no version)
  //   Phase 6:  Production Ready (v1.0.0)       ░░░░       PLANNED    (no percentage)
  //   Scope A:  AI Agent Diagnostics (v0.3.0)   ████ 100%  COMPLETE
  const phaseRegex = /^((?:Phase|Scope)\s+\w+:\s+[^(█░\n]+?)(?:\(([^)]+)\))?\s*[█░]*\s*(?:(\d+)%\s+)?(\w+)\s*$/gm
  let match: RegExpExecArray | null
  while ((match = phaseRegex.exec(content)) !== null) {
    phases.push({
      name: match[1].trim(),
      version: match[2]?.trim() ?? '',
      progress: match[3] ? parseInt(match[3], 10) : 0,
      status: match[4].trim(),
    })
  }

  if (phases.length === 0) {
    warnings.push('No phase progress lines found in expected format')
  }

  // Identify current and next
  const currentPhase = phases.find(p => p.status !== 'COMPLETE') ?? phases[phases.length - 1]
  const currentIdx = phases.indexOf(currentPhase)
  const nextPhase = currentIdx >= 0 && currentIdx + 1 < phases.length ? phases[currentIdx + 1] : null

  return {
    phases,
    current: currentPhase ? `${currentPhase.name} (${currentPhase.version})` : '',
    nextUp: nextPhase ? `${nextPhase.name} (${nextPhase.version})` : '',
    source: filePath,
    warnings,
  }
}
