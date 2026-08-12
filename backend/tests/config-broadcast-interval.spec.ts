// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// WS_BROADCAST_INTERVAL_MS parsing.
//
// This value goes straight into setInterval on the server's status loop, so the failure modes are
// not "wrong number" — they are "the host is now a load generator" and "the service will not
// boot". Both come from coercion, and both are invisible in review because the guard reads as
// complete.
import { describe, it, expect } from 'vitest'
import {
  parseBroadcastInterval,
  DEFAULT_WS_BROADCAST_INTERVAL_MS,
  MIN_WS_BROADCAST_INTERVAL_MS,
  MAX_WS_BROADCAST_INTERVAL_MS,
} from '../src/config.js'

describe('parseBroadcastInterval', () => {
  it('defaults when the variable is unset', () => {
    expect(parseBroadcastInterval(undefined)).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
  })

  it('accepts a value inside the band', () => {
    expect(parseBroadcastInterval('5000')).toBe(5000)
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseBroadcastInterval('  5000  ')).toBe(5000)
  })

  it('rounds a fractional value — setInterval takes integers', () => {
    expect(parseBroadcastInterval('2500.7')).toBe(2501)
  })

  // --- the coercion cases ---

  it('defaults on an EMPTY string rather than treating it as 0', () => {
    // Number('') is 0, not NaN. A 0 reaching setInterval schedules immediately-repeating work,
    // which pins a core for as long as the process lives. An unset-but-present env var — the
    // shape you get from `WS_BROADCAST_INTERVAL_MS=` in a unit file — is exactly this input.
    expect(parseBroadcastInterval('')).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
    expect(parseBroadcastInterval('   ')).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
  })

  it('defaults on unparseable input rather than NaN', () => {
    // setInterval(fn, NaN) is treated as setInterval(fn, 0) by the runtime — the same busy loop,
    // reached by a different route.
    expect(parseBroadcastInterval('abc')).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
    expect(parseBroadcastInterval('2s')).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
  })

  it('defaults on zero and negatives', () => {
    expect(parseBroadcastInterval('0')).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
    expect(parseBroadcastInterval('-500')).toBe(DEFAULT_WS_BROADCAST_INTERVAL_MS)
  })

  // --- clamping, not rejecting ---

  it('clamps a too-small value to the floor instead of refusing to start', () => {
    // This knob is reached for by an operator whose dashboard is already struggling. A typo that
    // would set 5ms must not be honoured — but neither should it stop the host booting, which is
    // the worst possible moment to hand someone a config error.
    expect(parseBroadcastInterval('5')).toBe(MIN_WS_BROADCAST_INTERVAL_MS)
  })

  it('clamps a too-large value to the ceiling', () => {
    // Past a minute the UI stops feeling live, which is the entire point of the socket.
    expect(parseBroadcastInterval('600000')).toBe(MAX_WS_BROADCAST_INTERVAL_MS)
  })

  it('has a coherent band', () => {
    expect(MIN_WS_BROADCAST_INTERVAL_MS).toBeLessThan(DEFAULT_WS_BROADCAST_INTERVAL_MS)
    expect(DEFAULT_WS_BROADCAST_INTERVAL_MS).toBeLessThan(MAX_WS_BROADCAST_INTERVAL_MS)
  })

  it('keeps the documented 2s default — the WebSocket contract states it', () => {
    // The published WebSocket protocol documentation states "every 2 seconds" as the default.
    // Changing this constant silently makes that documentation wrong.
    expect(DEFAULT_WS_BROADCAST_INTERVAL_MS).toBe(2000)
  })
})
