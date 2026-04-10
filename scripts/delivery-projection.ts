// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Proprietary and confidential. Do not distribute.
/**
 * delivery-projection.ts
 *
 * Reads forge/DELIVERY.json and outputs a projected delivery timeline as Markdown.
 * Each version's start date = previous version's end date.
 * Change one week estimate → everything downstream shifts automatically.
 *
 * Usage (from project root):
 *   npx tsx scripts/delivery-projection.ts
 *   npx tsx scripts/delivery-projection.ts --output forge/DELIVERY-PROJECTION.md
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

// ── Types ────────────────────────────────────────────────────────────────────

export interface VersionEntry {
  version: string
  name: string
  weeks: number
  status: 'shipped' | 'in-progress' | 'planned'
  shipped?: string
}

export interface DeliveryConfig {
  product: string
  repo: string
  startDate: string
  versions: VersionEntry[]
  lastUpdated: string
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + weeks * 7)
  return result
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Projection ───────────────────────────────────────────────────────────────

export function buildProjection(config: DeliveryConfig): Array<{
  version: string
  name: string
  start: string
  target: string
  weeks: number
  status: string
}> {
  const rows = []
  let cursor = new Date(config.startDate)

  for (const v of config.versions) {
    const start = fmt(cursor)

    if (v.status === 'shipped' && v.shipped) {
      rows.push({ version: v.version, name: v.name, start, target: v.shipped, weeks: v.weeks, status: v.status })
      cursor = new Date(v.shipped)
    } else if (v.weeks === 0) {
      rows.push({ version: v.version, name: v.name, start, target: start, weeks: 0, status: v.status })
    } else {
      const end = addWeeks(cursor, v.weeks)
      rows.push({ version: v.version, name: v.name, start, target: fmt(end), weeks: v.weeks, status: v.status })
      cursor = end
    }
  }

  return rows
}

export function renderMarkdown(config: DeliveryConfig): string {
  const rows = buildProjection(config)
  const statusIcon = (s: string) =>
    s === 'shipped' ? '✓' : s === 'in-progress' ? '⟳' : '·'

  const lines: string[] = []
  lines.push(`## ${config.product} — Delivery Projection`)
  lines.push(``)
  lines.push(`| Version | Name | Target | Wks | Status |`)
  lines.push(`|---------|------|--------|-----|--------|`)
  for (const r of rows) {
    const wks = r.weeks === 0 ? '—' : String(r.weeks)
    lines.push(`| v${r.version} | ${r.name} | ${r.target} | ${wks} | ${statusIcon(r.status)} ${r.status} |`)
  }
  lines.push(``)
  lines.push(`_Last updated: ${config.lastUpdated}_`)
  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function loadDelivery(projectRoot: string): DeliveryConfig {
  const path = resolve(projectRoot, 'forge', 'DELIVERY.json')
  return JSON.parse(readFileSync(path, 'utf-8')) as DeliveryConfig
}

const config = loadDelivery(PROJECT_ROOT)

// ── --codegen: emit delivery-versions.ts for the frontend build ───────────────

if (process.argv.includes('--codegen')) {
  const rows = buildProjection(config)
  const entries = rows.map(r => `  '${r.version}': '${r.target}',`).join('\n')
  const content = [
    `// AUTO-GENERATED — do not edit manually.`,
    `// Source: forge/DELIVERY.json`,
    `// Regenerate: npm run generate:versions  (runs automatically on build/dev)`,
    `export const DELIVERY_TARGET_DATES: Record<string, string> = {`,
    entries,
    `}`,
    ``,
  ].join('\n')
  const outPath = resolve(PROJECT_ROOT, 'code', 'src', 'config', 'delivery-versions.ts')
  writeFileSync(outPath, content, 'utf-8')
  process.stderr.write(`Generated ${outPath}\n`)
  process.exit(0)
}

// ── default: Markdown to stdout (or --output file) ───────────────────────────

const output = renderMarkdown(config)

const outArg = process.argv.indexOf('--output')
if (outArg !== -1 && process.argv[outArg + 1]) {
  const outPath = resolve(PROJECT_ROOT, process.argv[outArg + 1])
  writeFileSync(outPath, output + '\n', 'utf-8')
  console.error(`Written to ${outPath}`)
} else {
  console.log(output)
}
