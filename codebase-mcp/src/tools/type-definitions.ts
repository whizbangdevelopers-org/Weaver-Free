// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface TypeFileResult {
  file: string
  types: string[]
  content: string
}

interface TypeDefinitionsResult {
  files: TypeFileResult[]
  warnings: string[]
}

export async function getTypeDefinitions(
  projectRoot: string,
  filterFiles?: string[]
): Promise<TypeDefinitionsResult> {
  const warnings: string[] = []
  const typesDir = resolve(projectRoot, 'src/types')
  const allFiles = await listFiles(typesDir, '.ts')

  if (allFiles.length === 0) {
    return { files: [], warnings: ['No .ts files found in src/types/'] }
  }

  const results: TypeFileResult[] = []

  for (const filePath of allFiles) {
    const name = basename(filePath)

    // Skip if filter specified and this file isn't in the list
    if (filterFiles && filterFiles.length > 0) {
      if (!filterFiles.some(f => name === f || name === `${f}.ts`)) continue
    }

    const content = await safeReadFile(filePath)
    if (!content) {
      warnings.push(`Could not read ${name}`)
      continue
    }

    // Extract exported type/interface/enum names
    const types: string[] = []
    const exportRegex = /export\s+(?:type|interface|enum)\s+(\w+)/g
    let match: RegExpExecArray | null
    while ((match = exportRegex.exec(content)) !== null) {
      types.push(match[1])
    }

    results.push({
      file: `src/types/${name}`,
      types,
      content,
    })
  }

  return { files: results, warnings }
}
