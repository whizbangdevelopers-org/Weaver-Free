// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface ComponentInfo {
  name: string
  file: string
  category: 'component' | 'page' | 'layout'
  imports: string[]
  composables: string[]
}

interface ComponentTreeResult {
  components: ComponentInfo[]
  summary: { components: number; pages: number; layouts: number }
  warnings: string[]
}

async function scanDir(
  dir: string,
  category: ComponentInfo['category'],
  relPrefix: string
): Promise<{ items: ComponentInfo[]; warnings: string[] }> {
  const warnings: string[] = []
  const items: ComponentInfo[] = []
  const files = await listFiles(dir, '.vue')

  for (const filePath of files) {
    const name = basename(filePath, '.vue')
    const content = await safeReadFile(filePath)

    if (!content) {
      warnings.push(`Could not read ${name}.vue`)
      items.push({ name, file: `${relPrefix}/${basename(filePath)}`, category, imports: [], composables: [] })
      continue
    }

    // Extract script section
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    const script = scriptMatch ? scriptMatch[1] : ''

    // Find imported components (from 'components/' or 'src/components/')
    const imports: string[] = []
    const importRegex = /import\s+(\w+)\s+from\s+['"](?:components|src\/components|\.\.\/components)\/(\w+)\.vue['"]/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(script)) !== null) {
      imports.push(match[1])
    }

    // Also check for defineAsyncComponent or dynamic imports of components
    const asyncRegex = /defineAsyncComponent\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"](?:components|src\/components)\/(\w+)\.vue['"]/g
    while ((match = asyncRegex.exec(script)) !== null) {
      imports.push(match[1])
    }

    // Find composable usage
    const composables: string[] = []
    const composableRegex = /import\s+\{\s*([^}]+)\}\s+from\s+['"](?:composables|src\/composables|stores|src\/stores)\//g
    while ((match = composableRegex.exec(script)) !== null) {
      const names = match[1].split(',').map(s => s.trim()).filter(Boolean)
      composables.push(...names)
    }

    items.push({
      name,
      file: `${relPrefix}/${basename(filePath)}`,
      category,
      imports,
      composables,
    })
  }

  return { items, warnings }
}

export async function getComponentTree(projectRoot: string): Promise<ComponentTreeResult> {
  const allWarnings: string[] = []

  const [components, pages, layouts] = await Promise.all([
    scanDir(resolve(projectRoot, 'src/components'), 'component', 'src/components'),
    scanDir(resolve(projectRoot, 'src/pages'), 'page', 'src/pages'),
    scanDir(resolve(projectRoot, 'src/layouts'), 'layout', 'src/layouts'),
  ])

  allWarnings.push(...components.warnings, ...pages.warnings, ...layouts.warnings)

  const all = [...layouts.items, ...pages.items, ...components.items]

  return {
    components: all,
    summary: {
      components: components.items.length,
      pages: pages.items.length,
      layouts: layouts.items.length,
    },
    warnings: allWarnings,
  }
}
