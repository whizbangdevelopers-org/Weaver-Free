// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * MCP Coverage Manifest
 *
 * Declares the knowledge sources the MCP server is expected to cover. The
 * `audit:mcp-coverage` auditor enforces parity between this manifest and
 * the on-disk knowledge surface. Drift fails pre-push.
 *
 * Add a path here when:
 *   - a new `.claude/rules/*.md` file lands
 *   - a new `docs/development/*.md` institutional-memory file lands
 *   - a new top-level CLAUDE.md subsection is added that warrants its own tool
 *
 * If a knowledge source is intentionally NOT covered (scratch notes, user-
 * facing product docs, etc.) add it to INTENTIONALLY_UNCOVERED with a reason.
 *
 * When this manifest changes, invoke `/umcp` to let an agent propose MCP tool
 * updates for newly-added sources. Human reviews before merge.
 */

/**
 * Paths the MCP server is expected to surface as queryable knowledge.
 *
 * Paths are project-root-relative (NOT codebase-mcp-relative). The auditor
 * runs from project root, matching the rest of the compliance chain.
 */
export const KNOWLEDGE_SOURCES: readonly string[] = [
  // Project-level rules (apply across the whole project)
  '.claude/rules/backend.md',
  '.claude/rules/copyright.md',
  '.claude/rules/decisions.md',
  '.claude/rules/demo-content-propagation.md',
  '.claude/rules/dev-workflow.md',
  '.claude/rules/frontend.md',
  '.claude/rules/nixos.md',
  '.claude/rules/notes.md',
  '.claude/rules/security.md',
  '.claude/rules/single-source-generated.md',
  '.claude/rules/terminology.md',
  '.claude/rules/testing.md',
  '.claude/rules/versioning.md',
  '.claude/rules/workflow-review.md',

  // Code-level rules (apply within code/)
  'code/.claude/rules/backend.md',
  'code/.claude/rules/frontend.md',
  'code/.claude/rules/navigation.md',
  'code/.claude/rules/nixos.md',
  'code/.claude/rules/provisioning.md',
  'code/.claude/rules/scripts.md',
  'code/.claude/rules/security.md',
  'code/.claude/rules/testing.md',

  // Project-level agent definitions
  '.claude/agents/capture.md',
  '.claude/agents/forge-sync.md',
  '.claude/agents/plan-reviewer.md',
  '.claude/agents/release-prep.md',
  '.claude/agents/template-gap.md',
  '.claude/agents/template-sync.md',

  // Code-level agent definitions
  'code/.claude/agents/baseline-refresh-guide.md',
  'code/.claude/agents/distro-catalog-tester.md',
  'code/.claude/agents/e2e-runner.md',
  'code/.claude/agents/e2e-test-writer.md',
  'code/.claude/agents/gtm-content.md',
  'code/.claude/agents/gtm-demo.md',
  'code/.claude/agents/manual-test-guide.md',
  'code/.claude/agents/post-release-verifier.md',
  'code/.claude/agents/screenshot-capture.md',
  'code/.claude/agents/security-reviewer.md',
  'code/.claude/agents/test-runner.md',
  'code/.claude/agents/tui-tester.md',

  // Skills
  '.claude/skills/clean-sweep/SKILL.md',
  '.claude/skills/vocabulary-preflight/SKILL.md',

  // Institutional memory
  'code/docs/development/KNOWN-GOTCHAS.md',
  'code/docs/development/LESSONS-LEARNED.md',
  'code/docs/development/PORT-ALLOCATION.md',

  // AI-ops design references
  'code/docs/ai-ops/COGNEE-INTEGRATION.md',

  // Top-level Claude instructions
  'code/CLAUDE.md',
] as const

/**
 * Maps each knowledge source to the tool file (basename of codebase-mcp/src/tools/<name>.ts)
 * that covers it. The auditor uses this to enforce that each source is actually read at
 * runtime — not just acknowledged in the manifest.
 *
 * A source in KNOWLEDGE_SOURCES without an entry here causes a WARNING (not failure)
 * so legacy tools aren't broken while new sources are being wired up. A source WITH
 * an entry that maps to a tool that doesn't read it causes a FAILURE.
 *
 * The "path hint" is a string that must appear literally in the tool source — used to
 * confirm the tool actually reaches the source. For directory-scanned sources (all
 * .claude/rules/*.md files), the hint is the directory segment rather than the filename.
 */
export const SOURCE_TO_TOOL: Record<string, { tool: string; hint: string }> = {
  // Project-level rules — all read via .claude/rules directory scan in project-rules.ts
  '.claude/rules/backend.md':                    { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/copyright.md':                  { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/decisions.md':                   { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/demo-content-propagation.md':   { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/dev-workflow.md':               { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/frontend.md':                   { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/nixos.md':                      { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/notes.md':                      { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/security.md':                   { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/single-source-generated.md':    { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/terminology.md':                { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/testing.md':                    { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/versioning.md':                 { tool: 'project-rules.ts', hint: '.claude/rules' },
  '.claude/rules/workflow-review.md':            { tool: 'workflow-import-checklist.ts', hint: 'workflow-review.md' },

  // Code-level rules — read via code/.claude/rules directory scan in project-rules.ts
  'code/.claude/rules/backend.md':     { tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/frontend.md':    { tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/navigation.md':  { tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/nixos.md':       { tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/provisioning.md':{ tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/scripts.md':     { tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/security.md':    { tool: 'project-rules.ts', hint: '.claude/rules' },
  'code/.claude/rules/testing.md':     { tool: 'project-rules.ts', hint: '.claude/rules' },

  // Institutional memory — dedicated parsers read each file by exact path
  'code/docs/development/KNOWN-GOTCHAS.md':  { tool: 'known-gotchas.ts',       hint: 'KNOWN-GOTCHAS.md' },
  'code/docs/development/LESSONS-LEARNED.md':{ tool: 'lessons-learned.ts',     hint: 'LESSONS-LEARNED.md' },
  'code/docs/development/PORT-ALLOCATION.md':{ tool: 'port-layout.ts',          hint: 'PORT-ALLOCATION.md' },

  // AI-ops design references
  'code/docs/ai-ops/COGNEE-INTEGRATION.md':  { tool: 'cognee-integration.ts',  hint: 'COGNEE-INTEGRATION.md' },

  // Top-level project instructions — read by project-rules.ts alongside .claude/rules
  'code/CLAUDE.md': { tool: 'project-rules.ts', hint: 'CLAUDE.md' },

  // Agent definitions — all read via .claude/agents directory scan in agent-catalog.ts
  '.claude/agents/capture.md':          { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  '.claude/agents/forge-sync.md':       { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  '.claude/agents/plan-reviewer.md':    { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  '.claude/agents/release-prep.md':     { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  '.claude/agents/template-gap.md':     { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  '.claude/agents/template-sync.md':    { tool: 'agent-catalog.ts', hint: '.claude/agents' },

  'code/.claude/agents/baseline-refresh-guide.md': { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/distro-catalog-tester.md':  { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/e2e-runner.md':             { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/e2e-test-writer.md':        { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/gtm-content.md':            { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/gtm-demo.md':               { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/manual-test-guide.md':      { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/post-release-verifier.md':  { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/screenshot-capture.md':     { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/security-reviewer.md':      { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/test-runner.md':            { tool: 'agent-catalog.ts', hint: '.claude/agents' },
  'code/.claude/agents/tui-tester.md':             { tool: 'agent-catalog.ts', hint: '.claude/agents' },

  // Skills — read via .claude/skills/<name>/SKILL.md in project-rules.ts
  '.claude/skills/clean-sweep/SKILL.md':           { tool: 'project-rules.ts', hint: '.claude/skills' },
  '.claude/skills/vocabulary-preflight/SKILL.md':  { tool: 'project-rules.ts', hint: '.claude/skills' },
}

/**
 * Paths matching the scan globs but intentionally NOT exposed via MCP.
 * Key: project-root-relative path. Value: human-readable reason.
 */
export const INTENTIONALLY_UNCOVERED: Record<string, string> = {
  'code/docs/ai-ops/INFERENCE-NODE-SPEC.md': 'provisional benchmark stub — not institutional knowledge until v1.1.0 benchmarks land',
}

/**
 * Glob patterns the auditor scans for knowledge sources. Any file matching
 * these globs MUST appear in either KNOWLEDGE_SOURCES or INTENTIONALLY_UNCOVERED.
 *
 * Keep this list aligned with the locations where institutional knowledge
 * is authored. Adding a new location here widens the auditor's net.
 */
export const KNOWLEDGE_SCAN_GLOBS: readonly string[] = [
  '.claude/rules/*.md',
  '.claude/agents/*.md',
  'code/.claude/rules/*.md',
  'code/.claude/agents/*.md',
  'code/docs/development/*.md',
  'code/docs/ai-ops/*.md',
  'code/CLAUDE.md',
] as const
