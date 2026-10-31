// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Which arrays and records a request can reach without a bound, read from the JSON Schema a route's
 * input becomes, so no validator internals are read.
 *
 * GHSA-mrhx-c7xc-m3w5: zod collects one issue for every failing element of an array, and from
 * 4.6.6 stops at a length bound. Measured 2026-10-23 in a sibling product on 4.6.7: an array with
 * `.max()` answers one issue at once; one without still collects 524,288 issues for a 1 MiB body. A
 * record collects one per failing value the same way (100,000 for 100,000 keys), and zod has no
 * bound for a record, so a record is safe only when its keys come from a closed set or its values
 * cannot fail.
 *
 *   array   bounded by `maxItems`, or a tuple (`prefixItems` with no further items)
 *   record  `additionalProperties` a schema: bounded when `propertyNames` names a closed set
 *           (`enum` or `const`), when the values accept anything (`{}`), or by `maxProperties`
 */

export interface Unbounded {
  kind: 'array' | 'record'
  /** Where it sits: the route, the request part, and the path inside it. */
  where: string
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

function typesOf(s: Json): string[] {
  const t = s.type
  return Array.isArray(t) ? (t as string[]) : typeof t === 'string' ? [t] : []
}

/** Every unbounded array or record inside `schema`. */
export function unboundedIn(schema: unknown, where: string): Unbounded[] {
  const out: Unbounded[] = []
  const walk = (node: unknown, at: string): void => {
    if (!isObject(node)) return
    const types = typesOf(node)
    if (types.includes('array') || 'items' in node || 'prefixItems' in node) {
      const tuple = Array.isArray(node.prefixItems) && node.items === false
      if (!tuple && typeof node.maxItems !== 'number') out.push({ kind: 'array', where: at })
      if (isObject(node.items)) walk(node.items, `${at}[]`)
      if (Array.isArray(node.prefixItems)) {
        node.prefixItems.forEach((p, i) => walk(p, `${at}[${i}]`))
      }
    }
    if (isObject(node.properties)) {
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${at}.${k}`)
    }
    if (isObject(node.additionalProperties)) {
      const names = isObject(node.propertyNames) ? node.propertyNames : {}
      const closedKeys = Array.isArray(names.enum) || 'const' in names
      const anyValue = Object.keys(node.additionalProperties).length === 0
      const counted = typeof node.maxProperties === 'number'
      if (!closedKeys && !anyValue && !counted) out.push({ kind: 'record', where: at })
      walk(node.additionalProperties, `${at}{}`)
    }
    for (const comb of ['anyOf', 'oneOf', 'allOf'] as const) {
      if (Array.isArray(node[comb])) (node[comb] as unknown[]).forEach(s => walk(s, at))
    }
  }
  walk(schema, where)
  return out
}
