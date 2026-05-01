// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractSection(markdown: string, heading: string): string | null {
  const regex = new RegExp(`^(#{1,6})\\s+${escapeRegex(heading)}\\s*$`, 'm')
  const match = regex.exec(markdown)
  if (!match) return null

  const start = match.index + match[0].length
  const headingLevel = match[1].length

  // Find next heading of same or higher level
  const nextHeading = new RegExp(`^#{1,${headingLevel}}\\s+`, 'm')
  const rest = markdown.slice(start)
  const nextMatch = nextHeading.exec(rest)

  return rest.slice(0, nextMatch?.index ?? rest.length).trim()
}

export function parseMarkdownTable(section: string): Array<Record<string, string>> {
  const lines = section.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return []

  const headers = lines[0]
    .split('|')
    .map(h => h.trim())
    .filter(Boolean)

  // Skip separator row (lines[1])
  return lines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    return row
  })
}
