// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Vite aliases, DERIVED from tsconfig `compilerOptions.paths`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `@quasar/app-vite` 2 shipped `src`, `app`, `components`, `layouts`, `pages`, `assets`, `boot`
 * and `stores` as built-in Vite aliases. v3 ships only `@` and `#q-app` (see its
 * `quasar-config-file.js` -> `defaultAliases`). Every project scaffolded from this template
 * imports through those dropped prefixes, so after the v3 upgrade the DEV SERVER could not
 * resolve a single store, layout or component and the app failed to mount.
 *
 * It was invisible to every other gate, and that is the whole point of deriving it here:
 * tsconfig.json carries its OWN copy of the same map, so `vue-tsc` stayed green; the production
 * build resolves through the same tsconfig and was green too. Only the dev server disagreed, and
 * nothing ran the dev server. The real ladder is typecheck < build < dev server, and only E2E
 * exercises the last rung.
 *
 * So this module is not a second copy of the map. tsconfig.json is the single source and Vite's
 * aliases are generated from it — one file to edit, and no way for the two to disagree.
 *
 * WHY IT IS A SHARED MODULE AND NOT FOUR CONFIG SNIPPETS
 * -----------------------------------------------------
 * The derivation needs a JSONC reader, because a tsconfig may legitimately carry comments (a
 * plain `JSON.parse` throws on `//`, which is how the first attempted port of this fix broke a
 * sibling project outright). A comment-aware scanner replicated by hand into every
 * quasar.config.js is four chances to get string-boundary handling wrong, in a file whose
 * failure mode is silent. One module, one self-test, pinned across the portfolio.
 *
 * REFUSE, DON'T DEGRADE
 * ---------------------
 * Every failure here throws. An empty or partial alias map is precisely the state that shipped:
 * silent, and indistinguishable from working until something actually loads a module through an
 * alias. A fallback would restore exactly the failure this fixes.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Remove `//` line comments and block comments from JSONC, preserving string contents.
 *
 * Comment characters are replaced by spaces rather than deleted so byte offsets survive and
 * `JSON.parse`'s error positions still point at the right place. Newlines inside block comments
 * are preserved for the same reason.
 *
 * The string-state tracking is the part that matters: a `//` inside a string value (a URL, a
 * glob) is DATA, and a scanner that strips it truncates the value silently.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripJsonComments(source) {
  let out = ''
  let i = 0
  let inString = false

  while (i < source.length) {
    const c = source[i]

    if (inString) {
      if (c === '\\') {
        out += source.slice(i, i + 2)
        i += 2
        continue
      }
      if (c === '"') inString = false
      out += c
      i++
      continue
    }

    if (c === '"') {
      inString = true
      out += c
      i++
      continue
    }

    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' '
        i++
      }
      continue
    }

    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*' + '/', i + 2)
      if (end === -1) {
        throw new Error('unterminated block comment')
      }
      for (let k = i; k < end + 2; k++) out += source[k] === '\n' ? '\n' : ' '
      i = end + 2
      continue
    }

    out += c
    i++
  }

  return out
}

/**
 * Remove trailing commas before `}` or `]`, which tsconfig tolerates and JSON does not.
 *
 * Same string-state tracking as above, for the same reason: a comma inside a string is data.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripTrailingCommas(source) {
  let out = ''
  let inString = false

  for (let i = 0; i < source.length; i++) {
    const c = source[i]

    if (inString) {
      if (c === '\\') {
        out += source.slice(i, i + 2)
        i++
        continue
      }
      if (c === '"') inString = false
      out += c
      continue
    }

    if (c === '"') {
      inString = true
      out += c
      continue
    }

    if (c === ',') {
      let j = i + 1
      while (j < source.length && /\s/.test(source[j])) j++
      if (source[j] === '}' || source[j] === ']') {
        out += ' '
        continue
      }
    }

    out += c
  }

  return out
}

/**
 * Parse JSONC (JSON with comments and trailing commas), as tsconfig.json is allowed to be.
 *
 * @param {string} source
 * @param {string} label  what to name in an error message
 * @returns {unknown}
 */
export function parseJsonc(source, label = 'JSONC') {
  let cleaned
  try {
    cleaned = stripTrailingCommas(stripJsonComments(source))
  } catch (err) {
    throw new Error(`${label}: ${err.message}`)
  }
  try {
    return JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`${label}: not valid JSON after comment stripping — ${err.message}`)
  }
}

/**
 * Derive a Vite alias map from a tsconfig's `compilerOptions.paths`.
 *
 * Only wildcard entries (`"<alias>/*": ["./<dir>/*"]`) become aliases. Exact, non-wildcard
 * mappings are deliberately skipped: a Vite string alias matches by PREFIX, so an exact key
 * `foo` would also capture `foobar`. tsconfig's exact form has no safe Vite equivalent, and
 * silently widening it is worse than not carrying it.
 *
 * `#q-app` is skipped because app-vite owns that one itself.
 *
 * @param {string} appDir       absolute path to the Quasar app directory (where tsconfig lives)
 * @param {object} [options]
 * @param {string} [options.tsconfigFile='tsconfig.json']
 * @param {(path: string, enc: string) => string} [options.read]  injectable for the self-test
 * @returns {Record<string, string>}
 */
export function deriveViteAliases(appDir, options = {}) {
  const tsconfigFile = options.tsconfigFile ?? 'tsconfig.json'
  const read = options.read ?? readFileSync
  const tsconfigPath = join(appDir, tsconfigFile)

  let raw
  try {
    raw = read(tsconfigPath, 'utf-8')
  } catch (err) {
    throw new Error(
      `quasar.config: cannot read ${tsconfigPath} — ${err.message}. Vite aliases are derived ` +
        `from its compilerOptions.paths; without it, app-vite 3 provides only \`@\` and ` +
        `\`#q-app\` and every \`src/...\` import fails to resolve in the dev server.`
    )
  }

  const tsconfig = parseJsonc(raw, tsconfigFile) ?? {}
  const compilerOptions = tsconfig.compilerOptions ?? {}
  const paths = compilerOptions.paths ?? {}
  const base = join(appDir, compilerOptions.baseUrl ?? '.')

  const alias = {}

  for (const [key, targets] of Object.entries(paths)) {
    if (key === '#q-app' || key.startsWith('#q-app/')) continue
    if (!key.endsWith('/*')) continue

    const target = Array.isArray(targets) ? targets[0] : targets
    if (typeof target !== 'string') {
      throw new Error(
        `${tsconfigFile}: compilerOptions.paths["${key}"] has no string target — cannot derive ` +
          `a Vite alias from it.`
      )
    }
    if (!target.endsWith('/*')) {
      throw new Error(
        `${tsconfigFile}: compilerOptions.paths["${key}"] is a wildcard key mapped to the ` +
          `non-wildcard target "${target}". A Vite alias derived from it would silently ` +
          `truncate the target. Fix the mapping to "<dir>/*".`
      )
    }

    // `alias` is a local object literal that never escapes this function, and `key` comes from
    // THIS repo's own tsconfig.json compilerOptions.paths, read at build time — no request, no
    // user input, no network path. Reaching a `__proto__` key requires write access to the
    // tsconfig, which is control of the build already.
    // sast-ignore[prototype-pollution]: build-time key from this repo's own tsconfig, not input
    alias[key.slice(0, -2)] = join(base, target.slice(0, -2))
  }

  if (Object.keys(alias).length === 0) {
    throw new Error(
      `quasar.config: derived no Vite aliases from ${tsconfigFile} compilerOptions.paths. ` +
        `app-vite 3 provides only \`@\` and \`#q-app\`, so \`src/...\` imports would fail to ` +
        `resolve in the dev server while typecheck and the production build stayed green. ` +
        `Check that paths still uses the "<alias>/*": ["./<dir>/*"] form` +
        (tsconfig.extends
          ? `, and note that this reader does NOT follow \`extends\` — the paths must be ` +
            `declared in ${tsconfigFile} itself.`
          : `.`)
    )
  }

  return alias
}
