// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Shared report persistence utility.
 *
 * Every audit/test script calls saveReport() to write a timestamped JSON
 * report to reports/<name>/. Reports are gitignored but persist on disk
 * so results are always reviewable after a run.
 *
 * Convention:
 *   reports/<name>/<name>-YYYY-MM-DDTHH-MM-SS.json   (timestamped)
 *   reports/<name>/latest.json                         (symlink to newest)
 */

import { mkdirSync, writeFileSync, symlinkSync, unlinkSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPORTS_DIR = resolve(__dirname, '..', '..', 'reports')

export interface ReportEnvelope {
  reportName: string
  timestamp: string
  durationMs: number
  result: 'pass' | 'fail' | 'warn'
  summary: Record<string, unknown>
  data: unknown
}

export function saveReport(envelope: ReportEnvelope): string {
  const dir = resolve(REPORTS_DIR, envelope.reportName)
  mkdirSync(dir, { recursive: true })

  // Timestamp suitable for filenames (no colons)
  const ts = envelope.timestamp.replace(/:/g, '-').replace(/\.\d{3}Z$/, '')
  const filename = `${envelope.reportName}-${ts}.json`
  const filepath = resolve(dir, filename)
  const latestPath = resolve(dir, 'latest.json')

  writeFileSync(filepath, JSON.stringify(envelope, null, 2) + '\n')

  // Update latest.json symlink
  try {
    if (existsSync(latestPath)) unlinkSync(latestPath)
    symlinkSync(filename, latestPath)
  } catch {
    // Symlinks may not work on all filesystems — copy instead
    writeFileSync(latestPath, JSON.stringify(envelope, null, 2) + '\n')
  }

  const relPath = filepath.replace(resolve(REPORTS_DIR, '..') + '/', '')
  // Use stderr so JSON-to-stdout scripts (--json mode) aren't polluted
  process.stderr.write(`\nReport saved: ${relPath}\n`)
  return filepath
}
