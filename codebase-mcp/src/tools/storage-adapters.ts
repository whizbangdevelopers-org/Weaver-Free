// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface AdapterInfo {
  interface: string
  file: string
  methods: string[]
  implementations: Array<{ class: string; file: string }>
}

interface StorageAdaptersResult {
  adapters: AdapterInfo[]
  standaloneStores: Array<{ class: string; file: string; methods: string[] }>
  warnings: string[]
}

export async function getStorageAdapters(projectRoot: string): Promise<StorageAdaptersResult> {
  const warnings: string[] = []

  // Collect all storage files (top-level + subdirectories)
  const storageDir = resolve(projectRoot, 'backend/src/storage')
  const storageDirFiles = await listFiles(storageDir, '.ts')

  const storageSubs = await listDirs(storageDir)
  for (const sub of storageSubs) {
    const subFiles = await listFiles(resolve(storageDir, sub), '.ts')
    storageDirFiles.push(...subFiles)
  }

  // Also check services/adapters/
  const adaptersDir = resolve(projectRoot, 'backend/src/services/adapters')
  const adapterFiles = await listFiles(adaptersDir, '.ts')

  const allFiles = [...storageDirFiles, ...adapterFiles]

  const adapters: AdapterInfo[] = []
  const standaloneStores: StorageAdaptersResult['standaloneStores'] = []
  const interfaceMap = new Map<string, AdapterInfo>()

  // First pass: find interfaces and abstract classes
  for (const filePath of allFiles) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(resolve(projectRoot), filePath)

    // Find exported interfaces — use brace-counting for nested bodies
    const interfaceStarts = [...content.matchAll(/export\s+interface\s+(\w+)[^{]*\{/g)]
    for (const start of interfaceStarts) {
      const name = start[1]
      const body = extractBraceBody(content, start.index! + start[0].length - 1)
      const methods = extractMethodNames(body)

      const info: AdapterInfo = { interface: name, file: relFile, methods, implementations: [] }
      interfaceMap.set(name, info)
      adapters.push(info)
    }

    // Find abstract classes (also serve as interfaces)
    const abstractStarts = [...content.matchAll(/export\s+abstract\s+class\s+(\w+)[^{]*\{/g)]
    for (const start of abstractStarts) {
      const name = start[1]
      const body = extractBraceBody(content, start.index! + start[0].length - 1)
      const methods = extractMethodNames(body)

      const info: AdapterInfo = { interface: name, file: relFile, methods, implementations: [] }
      interfaceMap.set(name, info)
      adapters.push(info)
    }
  }

  // Second pass: find implementations
  for (const filePath of allFiles) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(resolve(projectRoot), filePath)

    // Find classes — may implement/extend one or more interfaces
    const classStarts = [...content.matchAll(/export\s+class\s+(\w+)(?:\s+(?:extends|implements)\s+([^{]+))?\s*\{/g)]
    for (const start of classStarts) {
      const className = start[1]
      const parentClause = start[2]?.trim()

      let matched = false
      if (parentClause) {
        // Parse "implements Foo, Bar" or "extends Foo implements Bar"
        // Split on implements/extends keywords, then by commas
        const parentNames = parentClause
          .replace(/extends|implements/g, ',')
          .split(',')
          .map(s => s.trim().replace(/<.*>$/, ''))  // strip generic params
          .filter(Boolean)

        for (const parentName of parentNames) {
          if (interfaceMap.has(parentName)) {
            interfaceMap.get(parentName)!.implementations.push({ class: className, file: relFile })
            matched = true
          }
        }
      }

      if (!matched) {
        // Standalone class (store without known interface)
        const body = extractBraceBody(content, start.index! + start[0].length - 1)
        const methods = extractMethodNames(body)
        standaloneStores.push({ class: className, file: relFile, methods })
      }
    }
  }

  return { adapters, standaloneStores, warnings }
}

/** Extract the content inside matching braces, starting at the opening brace position */
function extractBraceBody(content: string, openBraceIndex: number): string {
  let depth = 0
  let i = openBraceIndex
  const start = i + 1

  for (; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) return content.slice(start, i)
    }
  }

  // If no matching brace found, return everything after the opening brace
  return content.slice(start)
}

function extractMethodNames(body: string): string[] {
  const methods: string[] = []
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Match method signatures: methodName(params): returnType
    // Also match abstract methods and interface method declarations
    const methodMatch = trimmed.match(/^(?:abstract\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^{;]+)/)
    if (methodMatch) {
      const name = methodMatch[1]
      // Skip constructor
      if (name === 'constructor') continue
      const params = methodMatch[2].trim()
      const ret = methodMatch[3].trim()
      methods.push(`${name}(${params}): ${ret}`)
    }
  }
  return methods
}
