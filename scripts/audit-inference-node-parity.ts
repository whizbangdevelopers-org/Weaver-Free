// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Inference Node Parity Auditor — Decision #152
 *
 * Verifies that the `forge-foundry` and `weaver-inference-node` NixOS
 * profiles in code/nixos/weaver-inference-node/ share their load-bearing
 * modules. Drift between the profiles is a compliance-parity failure:
 * the customer SKU is "what runs at Forge Foundry, minus agent execution
 * bits, plus ops vocabulary."
 *
 * Load-bearing shared modules (must appear in both profiles):
 *   - Ollama / llama.cpp-server derivation
 *   - Base model loader
 *   - LoRA pipeline module
 *   - MCP retrieval service module
 *   - cgroup partition policy
 *
 * Behaviour when flake is absent (pre-v1.1.0):
 *   Exits 0 with an advisory note. The flake is scheduled for v1.1.0;
 *   enforcement begins once the directory is present.
 *
 * Behaviour when flake is present:
 *   Parses the three overlay files (forge-foundry.nix, weaver-inference-node.nix,
 *   dev-parity.nix) and verifies all SHARED_MODULE_MARKERS appear in both
 *   forge-foundry and weaver-inference-node. Fails if any are absent from
 *   either profile.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const FLAKE_DIR = join(ROOT, 'nixos', 'weaver-inference-node')
// The auditor activates once the profile files exist (v1.1.0+).
// The directory and stub flake.nix exist from the Decision #152 scaffold
// but enforcement waits until the actual profile overlays are written.
const SENTINEL_PROFILE = join(FLAKE_DIR, 'profiles', 'forge-foundry.nix')

// Canonical identifiers that must appear in both forge-foundry and
// weaver-inference-node profiles. These are the load-bearing shared modules
// defined in Decision #152. Update this list when the flake is implemented.
const SHARED_MODULE_MARKERS: string[] = [
  'ollama',          // Ollama / llama.cpp-server serving
  'baseModelLoader', // base model loader module
  'loraPipeline',    // LoRA pipeline
  'mcpRetrieval',    // MCP retrieval service
  'cgroupPolicy',    // cgroup partition policy
]

const PROFILES: Array<{ name: string; file: string }> = [
  { name: 'forge-foundry', file: 'profiles/forge-foundry.nix' },
  { name: 'weaver-inference-node', file: 'profiles/weaver-inference-node.nix' },
]

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function run(): void {
  console.log(`${BOLD}Inference Node Parity Audit${RESET}`)
  console.log(`${DIM}Verifies forge-foundry / weaver-inference-node profiles share load-bearing modules (Decision #152)${RESET}\n`)

  if (!existsSync(SENTINEL_PROFILE)) {
    console.log(`${YELLOW}⚠ profiles/forge-foundry.nix not yet present${RESET}`)
    console.log(`  Enforcement begins at v1.1.0 when the profile overlays are implemented.`)
    console.log(`  Skipping — no findings.\n`)
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} (pre-v1.1.0: profile overlays not yet implemented)`)
    process.exit(0)
  }

  const findings: string[] = []

  for (const marker of SHARED_MODULE_MARKERS) {
    const absentFrom: string[] = []
    for (const profile of PROFILES) {
      const profilePath = join(FLAKE_DIR, profile.file)
      if (!existsSync(profilePath)) {
        absentFrom.push(`${profile.name} (file missing: ${profile.file})`)
        continue
      }
      const content = readFileSync(profilePath, 'utf8')
      if (!content.includes(marker)) {
        absentFrom.push(profile.name)
      }
    }
    if (absentFrom.length > 0) {
      findings.push(`Shared module marker "${marker}" absent from: ${absentFrom.join(', ')}`)
    }
  }

  if (findings.length === 0) {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — all ${SHARED_MODULE_MARKERS.length} shared module markers present in both profiles\n`)
    process.exit(0)
  }

  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — profile drift detected\n`)
  console.log(`Drift between forge-foundry and weaver-inference-node profiles breaks the`)
  console.log(`compliance-parity invariant: the customer SKU must share all load-bearing modules`)
  console.log(`with the Forge Foundry dogfood profile. (Decision #152)\n`)
  for (const f of findings) {
    console.log(`  ${RED}✗${RESET} ${f}`)
  }
  console.log()
  process.exit(1)
}

run()
