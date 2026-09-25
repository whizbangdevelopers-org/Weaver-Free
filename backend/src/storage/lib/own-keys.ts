// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Name-keyed stores that cannot see inherited keys.
 *
 * A plain `{}` keyed by a user-supplied name walks the prototype chain on every lookup:
 * `constructor` (which passes the workload and distro name regexes) reads as an existing entry,
 * `get` returns a function, and a write to `__proto__` replaces the store's prototype. CodeQL
 * reports it as js/remote-property-injection; it fired on 2026-09-24, and the same shape sat in
 * every JSON-backed store here.
 *
 * Two tools, used together: a null-prototype record has no inherited members to find, and
 * `ownValue` states the intent at a lookup whose record you did not build.
 */

/** An empty record with no prototype, optionally filled from `from`'s own enumerable keys. */
export function ownRecord<T>(...from: Array<Record<string, T> | undefined>): Record<string, T> {
  // Object.assign onto a null-prototype target uses [[Set]], and with no prototype there is no
  // `__proto__` setter to trip, so a JSON-parsed own "__proto__" key lands as an ordinary key.
  return Object.assign(Object.create(null) as Record<string, T>, ...from)
}

/** `rec[key]` when `key` is the record's OWN property, otherwise null. */
export function ownValue<T>(rec: Record<string, T>, key: string): T | null {
  return Object.hasOwn(rec, key) ? (rec[key] ?? null) : null
}
