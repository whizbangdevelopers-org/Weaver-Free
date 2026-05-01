// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getApiEndpoints } from './tools/api-endpoints.js'
import { getTypeDefinitions } from './tools/type-definitions.js'
import { getStoreSignatures } from './tools/store-signatures.js'
import { getComponentTree } from './tools/component-tree.js'
import { getConfigSchema } from './tools/config-schema.js'
import { getPortLayout } from './tools/port-layout.js'
import { getTierModel } from './tools/tier-model.js'
import { getDecisions } from './tools/decisions.js'
import { getPhaseStatus } from './tools/phase-status.js'
import { getStorageAdapters } from './tools/storage-adapters.js'
import { getE2eConventions } from './tools/e2e-conventions.js'
import { getSecurityRules } from './tools/security-rules.js'
import { getTestingBlindSpots } from './tools/testing-blind-spots.js'
import { getKnownGotchas } from './tools/known-gotchas.js'
import { getE2eFailurePatterns } from './tools/e2e-failure-patterns.js'
import { getTierGatingPattern } from './tools/tier-gating-pattern.js'
import { getWebSocketConventions } from './tools/websocket-conventions.js'
import { getHooksInventory } from './tools/hooks-inventory.js'
import { getServiceArchitecture } from './tools/service-architecture.js'
import { getMiddlewareOrder } from './tools/middleware-order.js'
import { getComplianceScripts } from './tools/compliance-scripts.js'
import { getLessonsLearned } from './tools/lessons-learned.js'
import { getFormValidationRules } from './tools/form-validation-rules.js'
import { getProjectRules } from './tools/project-rules.js'
import { getAgentCatalog } from './tools/agent-catalog.js'
import { getWorkflowImportChecklist } from './tools/workflow-import-checklist.js'
import { getCogneeIntegration } from './tools/cognee-integration.js'
import { cogStatus, cogRecall, cogRemember } from './tools/cognee-memory.js'

// Resolve paths relative to this file: mcp-server/src/index.ts -> ../../
const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
// Parent project directory where MASTER-PLAN.md and plans/ live
const PROJECT_PARENT = resolve(PROJECT_ROOT, '..', '..')

const server = new McpServer({
  name: 'weaver',
  version: '0.1.0',
})

// --- Tools ---

server.tool(
  'getApiEndpoints',
  'List all backend API routes with method, path, auth requirements, rate limits, and tier gates',
  {},
  async () => {
    const result = await getApiEndpoints(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getTypeDefinitions',
  'Return all exported TypeScript interfaces and types from src/types/',
  {
    files: z.array(z.string()).optional().describe('Filter to specific files (e.g. ["vm.ts"]). Omit for all.'),
  },
  async ({ files }) => {
    const result = await getTypeDefinitions(PROJECT_ROOT, files)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getStoreSignatures',
  'Extract state, getters, and actions from all Pinia stores in src/stores/',
  {
    store: z.string().optional().describe('Filter to a specific store name (e.g. "vm-store")'),
  },
  async ({ store }) => {
    const result = await getStoreSignatures(PROJECT_ROOT, store)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getComponentTree',
  'Scan Vue components, pages, and layouts with their imports and composable usage',
  {},
  async () => {
    const result = await getComponentTree(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getConfigSchema',
  'Return DashboardConfig interface and all environment variables from backend config',
  {},
  async () => {
    const result = await getConfigSchema(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getPortLayout',
  'Return port assignments for dev, E2E, and NixOS service environments',
  {},
  async () => {
    const result = await getPortLayout(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getTierModel',
  'Return the 4-tier feature matrix (demo/free/premium/enterprise) from MASTER-PLAN.md',
  {},
  async () => {
    const result = await getTierModel(PROJECT_PARENT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getDecisions',
  'Return all resolved architecture decisions from MASTER-PLAN.md',
  {},
  async () => {
    const result = await getDecisions(PROJECT_PARENT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getPhaseStatus',
  'Return phase progress, current phase, and next phase from EXECUTION-ROADMAP.md',
  {},
  async () => {
    const result = await getPhaseStatus(PROJECT_PARENT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getStorageAdapters',
  'Return storage adapter interfaces, implementations, and standalone stores from backend',
  {},
  async () => {
    const result = await getStorageAdapters(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getE2eConventions',
  'Return E2E test conventions: shared users, helpers, storage state shape, Docker config, spec inventory',
  {},
  async () => {
    const result = await getE2eConventions(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getSecurityRules',
  'Scan backend routes for requireRole, requireTier, and rateLimit enforcement with compliance summary',
  {},
  async () => {
    const result = await getSecurityRules(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getTestingBlindSpots',
  'Identify tier-based test coverage gaps — features untestable at E2E tier, missing env vars, spec coverage',
  {},
  async () => {
    const result = await getTestingBlindSpots(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getKnownGotchas',
  'Return known gotchas from KNOWN-GOTCHAS.md, structured by section (Frontend, Backend, Testing, NixOS). Each gotcha includes title, problem, fix, and rule.',
  {
    section: z.string().optional().describe('Filter to a specific section, e.g. "Frontend", "Backend", "Testing", "NixOS". Omit for all sections.'),
  },
  async ({ section }) => {
    const result = await getKnownGotchas(PROJECT_ROOT, section)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getE2eFailurePatterns',
  'Return the 5 root cause categories for E2E test failures (environment mismatch, shared state contamination, tier gate change, auth plumbing, race conditions) with symptom→fix mapping, shared state rules, and the parallel-workers single-session bypass pattern',
  {},
  async () => {
    const result = await getE2eFailurePatterns(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getTierGatingPattern',
  'Return the implementation recipe for adding tier gates: useTierFeature composable pattern (with defineAsyncComponent gotcha), backend requireTier() usage, dynamic import pattern for premium code, and tier-matrix.json update requirement. Includes live call site scan.',
  {},
  async () => {
    const result = await getTierGatingPattern(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getWebSocketConventions',
  'Return WebSocket protocol conventions: all message types with payload shapes, producers, and consumers; multiplexing pattern (all types share /ws/status); ACL filtering; auth via query param token; agent operation rate limiting',
  {},
  async () => {
    const result = await getWebSocketConventions(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getHooksInventory',
  'Return all Claude Code hooks in .claude/hooks/: event type (PreToolUse/PostToolUse/PreCompact), what each hook blocks or injects, trigger conditions, and bypass mechanisms',
  {},
  async () => {
    const result = await getHooksInventory(PROJECT_ROOT, PROJECT_PARENT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getServiceArchitecture',
  'Scan backend/src/services/ and return exported classes, constructor params, public methods, emitted events, storage dependencies, and initialization order for all backend services',
  {
    service: z.string().optional().describe('Filter to a specific service by name fragment (e.g. "auth", "notification", "provisioner")'),
  },
  async ({ service }) => {
    const result = await getServiceArchitecture(PROJECT_ROOT, service)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getMiddlewareOrder',
  'Return Fastify plugin registration order, hook registrations (auth onRequest, security onResponse), route registration order with prefixes and injected services, FastifyRequest augmentation shape, public routes, and error handling behavior',
  {},
  async () => {
    const result = await getMiddlewareOrder(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getComplianceScripts',
  'Return the compliance script inventory: what each of the 14 audit scripts checks, what causes failures, which pipeline chains include it, and the test:precommit → test:prepush → test:compliance → test:prerelease chain structure',
  {
    chain: z.string().optional().describe('Filter to scripts in a specific chain (e.g. "test:compliance", "test:prepush")'),
  },
  async ({ chain }) => {
    const result = await getComplianceScripts(PROJECT_ROOT, chain)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getLessonsLearned',
  'Return lessons from docs/development/LESSONS-LEARNED.md filtered by category section and/or keyword. Categories include DevOps, AI Agent, Authentication, Tier Gating, Notifications, Security, E2E, and more.',
  {
    category: z.string().optional().describe('Filter by section name (e.g. "Security", "E2E", "Authentication", "Tier"). Case-insensitive partial match.'),
    keyword: z.string().optional().describe('Filter lessons by keyword in title or content'),
  },
  async ({ category, keyword }) => {
    const result = await getLessonsLearned(PROJECT_ROOT, category, keyword)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getFormValidationRules',
  'Scan backend Zod request schemas and frontend q-input :rules for form validation parity. Returns Zod field constraints, frontend rule expressions, lazy-rules/validate() compliance, and parity gaps. Run npm run audit:forms for the authoritative full report.',
  {
    route: z.string().optional().describe('Filter to a specific route file fragment (e.g. "auth", "workloads")'),
    component: z.string().optional().describe('Filter to a specific Vue component name fragment (e.g. "CreateVm", "Bridge")'),
  },
  async ({ route, component }) => {
    const result = await getFormValidationRules(PROJECT_ROOT, route, component)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getAgentCatalog',
  'List all .claude/agents/*.md sub-agent definitions from both project and code scopes. Returns name, description, tools, model, maxTurns, and full instructions for each agent. Use to discover which sub-agents exist and how to brief or spawn them.',
  {
    name: z.string().optional().describe('Filter by agent filename fragment (e.g. "e2e", "security", "release")'),
    scope: z.enum(['project', 'code']).optional().describe('Limit to project-level or code-level agents only'),
  },
  async ({ name, scope }) => {
    const result = await getAgentCatalog(PROJECT_ROOT, PROJECT_PARENT, name, scope)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getProjectRules',
  'Read all .claude/rules/*.md files from both the project root and code/ levels. Returns rule content, frontmatter (paths:, description:), and scope. Use to surface the Universal Rule, security rules, testing conventions, terminology, and any other behavioral rules to sub-agents that lack Claude Code context.',
  {
    file: z.string().optional().describe('Filter to a specific rule file name fragment (e.g. "testing", "security", "terminology"). Omit for all rules.'),
  },
  async ({ file }) => {
    const result = await getProjectRules(PROJECT_ROOT, PROJECT_PARENT, file)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getWorkflowImportChecklist',
  'Return the structured checklist for reviewing a workflow file inherited from the template. Covers architecture match (stateful vs stateless demo, sync target, CI role), path and secret validity, trigger scope, and the confirming question. Use when adding, keeping, or auditing any .github/workflows/*.yml file.',
  {},
  async () => {
    const result = await getWorkflowImportChecklist(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'getCogneeIntegration',
  'Return the cognee sidecar API shape, dataset naming convention, session/graph lifecycle, and TypeScript AiMemoryService client contract. Use when implementing ai-memory.service.ts or the cognee NixOS module.',
  {},
  async () => {
    const result = await getCogneeIntegration(PROJECT_ROOT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'cogStatus',
  'Check if the cognee sidecar is running and return available datasets. Returns { available: false } if sidecar not reachable — safe to call on developer workstations.',
  {},
  async () => {
    const result = await cogStatus()
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'cogRecall',
  'Query the cognee knowledge graph for fleet-memory context. Returns { available: false } if sidecar not running. Use GRAPH_COMPLETION for structured recall (LLM-synthesised answer); SUMMARIES or CHUNKS for raw data.',
  {
    query: z.string().describe('What to recall — e.g. "deployment patterns for web-nginx workload"'),
    dataset: z.string().optional().describe('Dataset name (e.g. "workload_web-nginx_behavior"). Omit to search all.'),
    searchType: z.enum(['GRAPH_COMPLETION', 'SUMMARIES', 'CHUNKS']).optional().describe('Default: GRAPH_COMPLETION'),
  },
  async ({ query, dataset, searchType }) => {
    const result = await cogRecall(query, dataset, searchType)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'cogRemember',
  'Store knowledge in the cognee graph. Use to persist patterns or context discovered during a coding session. Returns { available: false } if sidecar not running.',
  {
    text: z.string().describe('Content to remember'),
    dataset: z.string().describe('Dataset name to store in (e.g. "host_foundry_patterns")'),
  },
  async ({ text, dataset }) => {
    const result = await cogRemember(text, dataset)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

// --- Start server ---
// Default: stdio (Claude Code). Pass --http for HTTP transport (local MCP clients).
//
// HTTP client options:
//   Claude Desktop  → connect directly to http://127.0.0.1:<port> (localhost reachable)
//   claude.ai web   → requires a public HTTPS tunnel (ngrok, Cloudflare) — not air-gap safe
//   LAN clients     → put nginx in front for HTTPS termination, then point at http://127.0.0.1:<port>
//   Air-gapped      → use stdio (Claude Code) — no tunnel needed

if (process.argv.includes('--http')) {
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  )
  const { createServer } = await import('node:http')
  const MCP_HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT ?? '4110', 10)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const httpServer = createServer(async (req, res) => {
    await transport.handleRequest(req, res)
  })
  httpServer.listen(MCP_HTTP_PORT, '127.0.0.1', () => {
    console.error(`[mcp] Weaver MCP HTTP server listening on http://127.0.0.1:${MCP_HTTP_PORT}`)
    console.error('[mcp] Claude Desktop: use this URL directly')
    console.error('[mcp] LAN / air-gapped: put nginx in front for HTTPS — see docs/DEVELOPER-GUIDE.md § MCP HTTP Transport')
    console.error('[mcp] claude.ai web: requires a public tunnel (ngrok / Cloudflare) — not air-gap safe')
    console.error('[mcp] Claude Code (stdio): stop this process and use .mcp.json instead')
  })
  await server.connect(transport)
} else {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[mcp] Weaver MCP server started (stdio)')
}
