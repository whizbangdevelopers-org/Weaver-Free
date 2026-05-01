// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface TestUser {
  role: string
  username: string
  storageStatePath: string
}

interface HelperFunction {
  name: string
  signature: string
  file: string
  doc: string
}

interface SpecFile {
  file: string
  describes: string[]
  testCount: number
  usesSerial: boolean
  storageStateOverrides: string[]
  imports: string[]
}

interface DockerConfig {
  envVars: Record<string, string>
  ports: { frontend: string; backend: string }
  entrypointFlags: string[]
}

interface StorageStateShape {
  localStorageKeys: string[]
  appStoreFields: string[]
}

interface E2eConventionsResult {
  testUsers: TestUser[]
  helpers: HelperFunction[]
  specs: SpecFile[]
  docker: DockerConfig
  storageState: StorageStateShape
  sharedStateRules: string[]
  warnings: string[]
}

export async function getE2eConventions(projectRoot: string): Promise<E2eConventionsResult> {
  const warnings: string[] = []

  // ── Test users from helpers/auth.ts ──────────────────────────────────────
  const testUsers: TestUser[] = []
  const authHelperPath = resolve(projectRoot, 'testing/e2e/helpers/auth.ts')
  const authContent = await safeReadFile(authHelperPath)
  if (authContent) {
    // Match: export const TEST_ADMIN = { username: 'e2e-admin', ... }
    const userRegex = /export\s+const\s+(TEST_\w+)\s*=\s*\{[^}]*username:\s*'([^']+)'/g
    let match: RegExpExecArray | null
    while ((match = userRegex.exec(authContent)) !== null) {
      const constName = match[1]
      const username = match[2]
      const role = constName.replace('TEST_', '').toLowerCase()

      // Find storage state path
      const stateMatch = authContent.match(new RegExp(`export\\s+const\\s+\\w*${role}\\w*STATE\\w*\\s*=\\s*'([^']+)'`, 'i'))
      const storageStatePath = stateMatch ? stateMatch[1] : (role === 'admin' ? '.auth/user.json' : `.auth/${role}.json`)

      testUsers.push({ role, username, storageStatePath })
    }
  } else {
    warnings.push('Could not read testing/e2e/helpers/auth.ts')
  }

  // ── Helper functions ────────────────────────────────────────────────────
  const helpers: HelperFunction[] = []
  const helperFiles = await listFiles(resolve(projectRoot, 'testing/e2e/helpers'), '.ts')

  for (const filePath of helperFiles) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(projectRoot, filePath)

    // Match exported functions and constants
    const funcRegex = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\n{]+))?/g
    let match: RegExpExecArray | null
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1]
      const params = match[2].trim()
      const ret = match[3]?.trim() || 'void'
      const signature = `${name}(${params}): ${ret}`

      // Get JSDoc comment above
      const beforeFunc = content.slice(0, match.index)
      const docMatch = beforeFunc.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/)
      const doc = docMatch
        ? docMatch[1].replace(/^\s*\*\s?/gm, '').trim().split('\n')[0]
        : ''

      helpers.push({ name, signature, file: relFile, doc })
    }

    // Match exported constants (like TEST_VM_NAME, API_BASE_URL)
    const constRegex = /export\s+const\s+(\w+)\s*(?::\s*\w+)?\s*=\s*([^\n]+)/g
    while ((match = constRegex.exec(content)) !== null) {
      const name = match[1]
      const value = match[2].trim().replace(/;$/, '')
      helpers.push({
        name,
        signature: `const ${name} = ${value}`,
        file: relFile,
        doc: '',
      })
    }

    // Match exported interfaces
    const ifaceRegex = /export\s+interface\s+(\w+)/g
    while ((match = ifaceRegex.exec(content)) !== null) {
      helpers.push({
        name: match[1],
        signature: `interface ${match[1]}`,
        file: relFile,
        doc: '',
      })
    }
  }

  // ── Spec files ──────────────────────────────────────────────────────────
  const specs: SpecFile[] = []
  const specFiles = await listFiles(resolve(projectRoot, 'testing/e2e'), '.spec.ts')

  for (const filePath of specFiles) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(projectRoot, filePath)

    // Extract describe blocks
    const describes: string[] = []
    const descRegex = /test\.describe(?:\.serial)?\s*\(\s*'([^']+)'/g
    let match: RegExpExecArray | null
    while ((match = descRegex.exec(content)) !== null) {
      describes.push(match[1])
    }

    // Count tests
    const testMatches = content.match(/\btest\s*\(\s*'/g) || []
    const testCount = testMatches.length

    // Check for serial mode
    const usesSerial = /test\.describe\.serial/.test(content)

    // Check for storageState overrides
    const storageStateOverrides: string[] = []
    const stateRegex = /test\.use\s*\(\s*\{\s*storageState:\s*(\w+)/g
    while ((match = stateRegex.exec(content)) !== null) {
      storageStateOverrides.push(match[1])
    }

    // Extract imports from helpers
    const imports: string[] = []
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*'\.\/helpers(?:\/\w+)?'/g
    while ((match = importRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim()).filter(Boolean)
      imports.push(...names)
    }

    specs.push({ file: relFile, describes, testCount, usesSerial, storageStateOverrides, imports })
  }

  // ── Docker config ──────────────────────────────────────────────────────
  const docker: DockerConfig = {
    envVars: {},
    ports: { frontend: '9020', backend: '3120' },
    entrypointFlags: [],
  }

  const composePath = resolve(projectRoot, 'testing/e2e-docker/docker-compose.yml')
  const composeContent = await safeReadFile(composePath)
  if (composeContent) {
    // Extract env vars from the main test runner service
    const envRegex = /^\s+-\s+(\w+)=(.+)$/gm
    let match: RegExpExecArray | null
    while ((match = envRegex.exec(composeContent)) !== null) {
      // Only capture from the first service block (playwright-tests)
      if (match.index > composeContent.indexOf('playwright-watch:')) break
      docker.envVars[match[1]] = match[2]
    }

    docker.ports.frontend = docker.envVars['E2E_DEV_PORT'] || '9020'
    docker.ports.backend = docker.envVars['E2E_API_PORT'] || '3120'
  } else {
    warnings.push('Could not read testing/e2e-docker/docker-compose.yml')
  }

  const entrypointPath = resolve(projectRoot, 'testing/e2e-docker/config/entrypoint.sh')
  const entrypointContent = await safeReadFile(entrypointPath)
  if (entrypointContent) {
    // Extract backend startup flags
    const flagLines = entrypointContent.match(/^\s+\w+=\S+\s*\\$/gm) || []
    docker.entrypointFlags = flagLines
      .map(l => l.trim().replace(/\\$/, '').trim())
      .filter(f => !f.startsWith('cd') && !f.startsWith('npx'))
  }

  // ── Storage state shape from global-setup.ts ────────────────────────────
  const storageState: StorageStateShape = { localStorageKeys: [], appStoreFields: [] }
  const setupPath = resolve(projectRoot, 'testing/e2e/global-setup.ts')
  const setupContent = await safeReadFile(setupPath)
  if (setupContent) {
    // Extract localStorage keys from the storageState builder
    const keyRegex = /name:\s*'([^']+)'/g
    let match: RegExpExecArray | null
    const seen = new Set<string>()
    while ((match = keyRegex.exec(setupContent)) !== null) {
      if (!seen.has(match[1])) {
        storageState.localStorageKeys.push(match[1])
        seen.add(match[1])
      }
    }

    // Extract app store fields from appStoreValue
    const appStoreMatch = setupContent.match(/appStoreValue\s*=\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s)
    if (appStoreMatch) {
      const fields = appStoreMatch[1].match(/^\s+(\w+)\s*:/gm) || []
      storageState.appStoreFields = fields.map(f => f.trim().replace(/:$/, ''))
    }
  } else {
    warnings.push('Could not read testing/e2e/global-setup.ts')
  }

  // ── Shared state rules (from doc comments in helpers) ──────────────────
  const sharedStateRules: string[] = []
  for (const filePath of helperFiles) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    // Extract SHARED STATE CONVENTION comments
    const conventionMatch = content.match(/SHARED STATE CONVENTION:\s*\n((?:\s*\*\s*-\s*.+\n)+)/)
    if (conventionMatch) {
      const rules = conventionMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s*\*\s*-\s*/, '').trim())
        .filter(Boolean)
      sharedStateRules.push(...rules)
    }
  }

  return { testUsers, helpers, specs, docker, storageState, sharedStateRules, warnings }
}
