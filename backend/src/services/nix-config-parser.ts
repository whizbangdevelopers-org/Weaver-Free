// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * nix-config-parser.ts — Parse NixOS configuration.nix into categorized workload sections.
 *
 * Uses a line-by-line brace-depth tracker rather than a full Nix AST parser.
 * This is intentional: we are a viewer, not a validator. Inexact boundary
 * detection is acceptable because users see the raw Nix regardless.
 *
 * All parser functions are exported for unit testing.
 */

import type { NixConfigSection } from '../schemas/host-config.js'

// ── Types ──────────────────────────────────────────────────────────────────

interface ParsedBlock {
  name: string
  lineStart: number  // 1-indexed
  lineEnd: number
  rawNix: string
}

// ── Core block extractor ───────────────────────────────────────────────────

/**
 * Extract attribute-set blocks matching a given attribute path prefix.
 *
 * Matches both forms:
 *   prefix.name = { ... };          ← multi-line block
 *   prefix.name = "value";          ← single-line value (treated as 1-line block)
 */
export function extractBlocks(lines: string[], attrPrefix: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []

  // Regex: attrPrefix.<name> = (optionally opening brace on same line)
  const prefixRe = new RegExp(
    `^\\s*${escapeRegex(attrPrefix)}\\.([\\w-]+)\\s*=\\s*(.*)$`
  )

  let i = 0
  while (i < lines.length) {
    const match = prefixRe.exec(lines[i])
    if (!match) { i++; continue }

    const name = match[1]
    const rest = match[2].trimEnd()
    const blockStart = i  // 0-indexed, convert to 1-indexed on output

    // Count braces from this line onward
    let depth = 0
    let end = i

    // Walk from the matched line until braces balance to zero
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }

      // Single-line value (no braces): ends on the same line
      if (depth === 0 && !rest.startsWith('{')) {
        end = j
        break
      }

      // Block closed
      if (depth === 0 && rest.startsWith('{')) {
        end = j
        break
      }

      // Depth went negative (malformed) — bail at current line
      if (depth < 0) {
        end = j
        break
      }
    }

    // If we ran off the end without closing, claim the rest of the file
    if (depth > 0) end = lines.length - 1

    const rawNix = lines.slice(blockStart, end + 1).join('\n')
    blocks.push({ name, lineStart: blockStart + 1, lineEnd: end + 1, rawNix })

    // Advance past this block
    i = end + 1
  }

  return blocks
}

// ── Workload-type extractors ───────────────────────────────────────────────

export function extractMicrovmBlocks(lines: string[]): ParsedBlock[] {
  return extractBlocks(lines, 'microvm.vms')
}

export function extractOciContainerBlocks(lines: string[]): ParsedBlock[] {
  return extractBlocks(lines, 'virtualisation.oci-containers.containers')
}

export function extractSlurmBlocks(lines: string[]): ParsedBlock[] {
  // services.slurm.* has many single-line keys; group them as one block
  // by finding the first and last matching line
  const slurmRe = /^\s*services\.slurm\./
  const matchingLines: number[] = []

  lines.forEach((line, idx) => {
    if (slurmRe.test(line)) matchingLines.push(idx)
  })

  if (matchingLines.length === 0) return []

  const first = matchingLines[0]
  const last = matchingLines[matchingLines.length - 1]
  const rawNix = lines.slice(first, last + 1).join('\n')

  return [{ name: 'slurm', lineStart: first + 1, lineEnd: last + 1, rawNix }]
}

// ── Infrastructure block ───────────────────────────────────────────────────

/**
 * Everything that isn't a recognized workload definition is considered infrastructure.
 * Returns the full file as an infrastructure section if no workload blocks were found
 * on the same lines, or returns null if the content is empty.
 */
export function buildInfrastructureSection(
  lines: string[],
  workloadBlocks: NixConfigSection[]
): NixConfigSection | null {
  if (lines.length === 0) return null

  // Collect line ranges covered by workload blocks
  const workloadLines = new Set<number>()
  for (const block of workloadBlocks) {
    for (let l = block.lineStart; l <= block.lineEnd; l++) {
      workloadLines.add(l)
    }
  }

  // Infrastructure lines are everything else that isn't blank
  const infraLines: number[] = []
  lines.forEach((line, idx) => {
    const lineNum = idx + 1  // 1-indexed
    if (!workloadLines.has(lineNum) && line.trim() !== '') {
      infraLines.push(lineNum)
    }
  })

  if (infraLines.length === 0) return null

  const first = infraLines[0]
  const last = infraLines[infraLines.length - 1]

  // Build raw Nix from contiguous non-workload content
  const rawLines: string[] = []
  lines.forEach((line, idx) => {
    if (!workloadLines.has(idx + 1)) rawLines.push(line)
  })

  return {
    id: 'infrastructure',
    label: 'Infrastructure',
    type: 'infrastructure',
    lineStart: first,
    lineEnd: last,
    rawNix: rawLines.join('\n').trim(),
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Parse raw NixOS configuration.nix content into categorized sections.
 */
export function parseNixConfig(rawContent: string): NixConfigSection[] {
  const lines = rawContent.split('\n')
  const sections: NixConfigSection[] = []

  // Extract each workload type
  const microvmBlocks = extractMicrovmBlocks(lines)
  const ociBlocks = extractOciContainerBlocks(lines)
  const slurmBlocks = extractSlurmBlocks(lines)

  for (const block of microvmBlocks) {
    sections.push({
      id: `microvm-${block.name}`,
      label: `${block.name} (MicroVM)`,
      type: 'microvm',
      lineStart: block.lineStart,
      lineEnd: block.lineEnd,
      rawNix: block.rawNix,
    })
  }

  for (const block of ociBlocks) {
    sections.push({
      id: `oci-${block.name}`,
      label: `${block.name} (OCI Container)`,
      type: 'oci-container',
      lineStart: block.lineStart,
      lineEnd: block.lineEnd,
      rawNix: block.rawNix,
    })
  }

  for (const block of slurmBlocks) {
    sections.push({
      id: `slurm-${block.name}`,
      label: block.name === 'slurm' ? 'Slurm Node Config' : `${block.name} (Slurm)`,
      type: 'slurm',
      lineStart: block.lineStart,
      lineEnd: block.lineEnd,
      rawNix: block.rawNix,
    })
  }

  // Infrastructure: everything not covered by workload sections
  const infraSection = buildInfrastructureSection(lines, sections)
  if (infraSection) sections.push(infraSection)

  return sections
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

