// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface CogneeEndpoint {
  name: string
  method: string
  path: string
  purpose: string
  requestShape?: string
  responseShape?: string
}

interface CogneeDataset {
  name: string
  purpose: string
  availableFrom: string
}

export interface CogneeIntegrationResult {
  apiEndpoints: CogneeEndpoint[]
  datasets: CogneeDataset[]
  sessionLifecycle: string
  typescriptClient: string
  defaultPort: number
  vaultIntegration: string
  warnings: string[]
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`## ${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`)
  const m = regex.exec(content)
  return m ? m[1].trim() : ''
}

function parseEndpoints(content: string): CogneeEndpoint[] {
  const section = extractSection(content, 'REST API Endpoints')
  if (!section) return []

  const endpoints: CogneeEndpoint[] = []
  // Split on ### headings
  const parts = section.split(/\n(?=### )/)
  for (const part of parts) {
    const headingMatch = part.match(/^### ([A-Z]+) (\/\S+) — (.+)/)
    if (!headingMatch) continue
    const method = headingMatch[1]
    const path = headingMatch[2]
    const purpose = headingMatch[3]
    const name = `${method} ${path}`

    const reqMatch = part.match(/\*\*Request:\*\*\s*```json\n([\s\S]*?)```/)
    const resMatch = part.match(/\*\*Response:\*\*\s*```json\n([\s\S]*?)```/)

    endpoints.push({
      name,
      method,
      path,
      purpose,
      requestShape: reqMatch ? reqMatch[1].trim() : undefined,
      responseShape: resMatch ? resMatch[1].trim() : undefined,
    })
  }
  return endpoints
}

function parseDatasets(content: string): CogneeDataset[] {
  const section = extractSection(content, 'Dataset Naming Convention')
  if (!section) return []

  const datasets: CogneeDataset[] = []
  // Parse markdown table rows (skip header and separator)
  const rows = section.match(/^\| `[^`]+`[^|]*\|[^|]*\|[^|]*\|[^|]*\|/gm) ?? []
  for (const row of rows) {
    const cells = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 4) continue
    datasets.push({
      name: cells[0].replace(/`/g, ''),
      purpose: cells[1],
      availableFrom: cells[3],
    })
  }
  return datasets
}

function extractPort(content: string): number {
  const m = content.match(/Default:\s*`http:\/\/localhost:(\d+)`/)
  return m ? parseInt(m[1], 10) : 8765
}

export async function getCogneeIntegration(projectRoot: string): Promise<CogneeIntegrationResult> {
  const warnings: string[] = []
  const filePath = resolve(projectRoot, 'docs/ai-ops/COGNEE-INTEGRATION.md')
  const content = await safeReadFile(filePath)

  if (!content) {
    return {
      apiEndpoints: [],
      datasets: [],
      sessionLifecycle: '',
      typescriptClient: '',
      defaultPort: 8765,
      vaultIntegration: '',
      warnings: ['Could not read docs/ai-ops/COGNEE-INTEGRATION.md'],
    }
  }

  const apiEndpoints = parseEndpoints(content)
  if (apiEndpoints.length === 0) warnings.push('No API endpoints parsed from COGNEE-INTEGRATION.md')

  const datasets = parseDatasets(content)
  if (datasets.length === 0) warnings.push('No datasets parsed from COGNEE-INTEGRATION.md')

  const sessionLifecycle = extractSection(content, 'Session / Graph Lifecycle')
  const vaultIntegration = extractSection(content, 'Vault Integration')

  // Extract TypeScript client contract (the full code block under ## TypeScript Client Contract)
  const tsSection = extractSection(content, 'TypeScript Client Contract')
  const tsBlockMatch = tsSection.match(/```typescript\n([\s\S]*?)```/)
  const typescriptClient = tsBlockMatch ? tsBlockMatch[1].trim() : tsSection

  const defaultPort = extractPort(content)

  return {
    apiEndpoints,
    datasets,
    sessionLifecycle,
    typescriptClient,
    defaultPort,
    vaultIntegration,
    warnings,
  }
}
