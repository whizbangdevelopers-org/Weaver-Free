// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface StoreSignature {
  name: string
  file: string
  state: string[]
  getters: string[]
  actions: string[]
  persist: string
}

interface StoreSignaturesResult {
  stores: StoreSignature[]
  warnings: string[]
}

function extractBlock(content: string, blockName: string): string {
  // Match: blockName: () => ({ ... }) OR blockName: { ... }
  const regex = new RegExp(`${blockName}\\s*:\\s*(?:\\(\\)\\s*=>\\s*)?[({]`, 'g')
  const match = regex.exec(content)
  if (!match) return ''

  // The regex ends with the opening delimiter — start scanning from there
  const openChar = match[0].slice(-1) as '(' | '{'
  const closeChar = openChar === '(' ? ')' : '}'
  const start = match.index + match[0].length
  let depth = 1

  for (let i = start; i < content.length; i++) {
    const ch = content[i]
    if (ch === openChar) {
      depth++
    } else if (ch === closeChar) {
      depth--
      if (depth === 0) {
        return content.slice(start, i).trim()
      }
    }
  }
  return ''
}

function extractMembers(block: string): string[] {
  const members: string[] = []
  let depth = 0
  const lines = block.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Track brace depth — only extract members at top level (depth 0)
    if (depth === 0 && trimmed) {
      // Skip empty lines, comments, spread operators
      if (!trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('...')) {
        // Match: propertyName: type, propertyName(params), or async methodName(params)
        const propMatch = trimmed.match(/^(?:async\s+)?(\w+)\s*[:(]/)
        if (propMatch) {
          const sig = trimmed
            .replace(/,\s*$/, '')
            .replace(/\{[\s\S]*$/, '')
            .trim()
          if (sig.length < 200) {
            members.push(sig)
          }
        }
      }
    }

    // Update depth for the entire line
    for (const ch of line) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
  }
  return members
}

export async function getStoreSignatures(
  projectRoot: string,
  filterStore?: string
): Promise<StoreSignaturesResult> {
  const warnings: string[] = []
  const storesDir = resolve(projectRoot, 'src/stores')
  const allFiles = await listFiles(storesDir, '.ts')

  const stores: StoreSignature[] = []

  for (const filePath of allFiles) {
    const name = basename(filePath, '.ts')
    if (name === 'index') continue

    if (filterStore && !name.includes(filterStore)) continue

    const content = await safeReadFile(filePath)
    if (!content) {
      warnings.push(`Could not read ${name}.ts`)
      continue
    }

    // Extract store name from defineStore('name', {
    const storeNameMatch = content.match(/defineStore\s*\(\s*['"](\w+)['"]/)
    const storeName = storeNameMatch ? storeNameMatch[1] : name

    // Extract state block — state: () => ({...}) wraps properties in extra braces
    let stateBlock = extractBlock(content, 'state')
    // If the block starts with { (inner object from arrow function), unwrap it
    const braceStart = stateBlock.indexOf('{')
    const braceEnd = stateBlock.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd > braceStart) {
      stateBlock = stateBlock.slice(braceStart + 1, braceEnd).trim()
    }
    const state = extractMembers(stateBlock)

    // Extract getters block
    const gettersBlock = extractBlock(content, 'getters')
    const getters = extractMembers(gettersBlock)

    // Extract actions block
    const actionsBlock = extractBlock(content, 'actions')
    const actions = extractMembers(actionsBlock)

    // Check for persist
    const persistMatch = content.match(/persist\s*:\s*(true|{[^}]*})/)
    const persist = persistMatch ? persistMatch[1] : 'false'

    stores.push({
      name: storeName,
      file: `src/stores/${basename(filePath)}`,
      state,
      getters,
      actions,
      persist,
    })
  }

  return { stores, warnings }
}
