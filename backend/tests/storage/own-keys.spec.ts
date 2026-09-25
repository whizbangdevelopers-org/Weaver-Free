// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import { ownRecord, ownValue } from '../../src/storage/lib/own-keys.js'

const INHERITED = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']

describe('ownRecord', () => {
  it.each(INHERITED)('an empty record has no %j', (key) => {
    const rec = ownRecord<number>()
    expect(key in rec).toBe(false)
    expect(rec[key]).toBeUndefined()
  })

  it('a JSON-parsed "__proto__" key lands as an ordinary own key, not a prototype', () => {
    const parsed = JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}') as Record<string, unknown>
    const rec = ownRecord(parsed)
    expect(Object.keys(rec).sort()).toEqual(['__proto__', 'a'])
    expect(Object.getPrototypeOf(rec)).toBeNull()
    expect((rec as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('merges sources left to right, later keys winning', () => {
    expect(ownRecord({ a: 1, b: 1 }, undefined, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('round-trips through JSON.stringify', () => {
    expect(JSON.stringify(ownRecord({ x: 1 }))).toBe('{"x":1}')
  })
})

describe('ownValue', () => {
  it.each(INHERITED)('%j on an ORDINARY object is null, not an inherited member', (key) => {
    expect(ownValue({ a: 1 } as Record<string, number>, key)).toBeNull()
  })

  it('returns an own value, including a falsy one', () => {
    expect(ownValue({ a: 1, z: 0 }, 'a')).toBe(1)
    expect(ownValue({ a: 1, z: 0 }, 'z')).toBe(0)
  })
})
