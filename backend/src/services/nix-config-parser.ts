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

/**
 * A `microvm.vms.<name>` guest as DECLARED, for adoption into the registry.
 *
 * Every field but `name` is optional and that is the contract, not laziness: a declaration is
 * hand-written Nix and may set none of them, or set them through a `let` binding, an import, or a
 * module this line-based reader cannot follow. `undefined` means "not stated here", which the
 * caller must be able to tell apart from `0` — a guest with `mem = 0` does not exist, but one
 * whose memory is defined in an imported module very much does.
 */
export interface DeclaredMicrovm {
  name: string
  mem?: number
  vcpu?: number
  hypervisor?: string
  ip?: string
}

/** Hypervisors microvm.nix can run. A declaration naming anything else is left `undefined`. */
const KNOWN_HYPERVISORS = ['qemu', 'cloud-hypervisor', 'crosvm', 'kvmtool', 'firecracker', 'stratovirt', 'alioth']

/**
 * Parse the guests DECLARED in a NixOS configuration, for adoption.
 *
 * This reads the DECLARATION; `readMicrovmSpecs()` in microvm.ts reads the GENERATED RUN SCRIPT of
 * a guest that has already been built. They answer different questions and neither replaces the
 * other: the run script is authoritative for what is actually running, and exists only after a
 * rebuild — so a guest declared this morning is invisible to it. That gap is what this closes, and
 * it is the gap the provisioner's own error message walks the user around by hand ("declare the
 * guest in your host's configuration.nix using microvm.nix, rebuild, then run a workload scan").
 *
 * Line-based, like the rest of this file, and for the same stated reason — we are a viewer, not a
 * validator. The consequence is worth being explicit about: a value that is not a literal on the
 * same line is NOT read, and comes back `undefined` rather than guessed at. A wrong 512 is worse
 * than an absent one, because the absent one is visibly absent.
 */
export function parseMicrovmDeclarations(rawContent: string): DeclaredMicrovm[] {
  const lines = rawContent.split('\n')
  return extractMicrovmBlocks(lines).map(block => {
    const body = block.rawNix
    const out: DeclaredMicrovm = { name: block.name }

    const num = (re: RegExp): number | undefined => {
      const m = re.exec(body)
      if (!m) return undefined
      const n = Number(m[1])
      // A declared 0 is meaningless for both fields and is far more likely to be a parse artefact
      // than an operator's intent, so it is dropped rather than stored as a real value.
      return Number.isInteger(n) && n > 0 ? n : undefined
    }

    // `(?:^|\s)` rather than `^\s*`: extractBlocks treats `prefix.name = { ... };` written on ONE
    // line as a one-line block, and a line-start anchor cannot see anything inside it. The
    // whitespace boundary still refuses `config.microvm.mem`, which a bare substring would match.
    out.mem = num(/(?:^|\s)microvm\.mem\s*=\s*(\d+)\s*;/m)
    out.vcpu = num(/(?:^|\s)microvm\.vcpu\s*=\s*(\d+)\s*;/m)

    const hv = /(?:^|\s)microvm\.hypervisor\s*=\s*"([^"]+)"\s*;/m.exec(body)
    if (hv && KNOWN_HYPERVISORS.includes(hv[1]!)) out.hypervisor = hv[1]!

    // networking.interfaces.<if>.ipv4.addresses = [ { address = "10.0.0.5"; prefixLength = 24; } ];
    // Only the FIRST address is taken: the registry holds one `ip`, and silently picking among
    // several would make which one arbitrary.
    const ip = /address\s*=\s*"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"/.exec(body)
    if (ip) out.ip = ip[1]!

    return out
  })
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

