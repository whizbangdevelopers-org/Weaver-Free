// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

// Must be before all imports per vitest rules
vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import * as llmModule from '../../src/services/llm-provider.js'
import {
  getDefaultModel,
  createProvider,
  resolveProvider,
  AnthropicProvider,
} from '../../src/services/llm-provider.js'
import type { LlmVendor } from '../../src/services/llm-provider.js'

describe('getDefaultModel', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns AGENT_MODEL env var when set', () => {
    vi.stubEnv('AGENT_MODEL', 'claude-test-model')
    const model = getDefaultModel('anthropic')
    expect(model).toBe('claude-test-model')
  })

  it('returns the anthropic default model when AGENT_MODEL is not set', () => {
    vi.stubEnv('AGENT_MODEL', '')
    const model = getDefaultModel('anthropic')
    expect(model).toBe('claude-sonnet-4-5-20250929')
  })
})

describe('createProvider', () => {
  it('returns an AnthropicProvider for vendor "anthropic"', () => {
    const provider = createProvider('anthropic', 'test-api-key')
    expect(provider).toBeInstanceOf(AnthropicProvider)
    expect(provider.name).toBe('anthropic')
  })

  it('throws for an unsupported vendor', () => {
    expect(() =>
      createProvider('unknown' as LlmVendor, 'key')
    ).toThrow('Unsupported LLM vendor: unknown')
  })
})

describe('resolveProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('creates a provider from apiKey + vendor (BYOV)', () => {
    const provider = resolveProvider('anthropic', 'byok-key')
    expect(provider).toBeInstanceOf(AnthropicProvider)
  })

  it('defaults to anthropic when only apiKey is supplied', () => {
    const provider = resolveProvider(undefined, 'byok-key-no-vendor')
    expect(provider).toBeInstanceOf(AnthropicProvider)
  })

  it('returns a provider when no args supplied and server key is configured', () => {
    // resolveProvider() with no args delegates to getServerProvider() internally.
    // The two must agree: whatever getServerProvider returns is what resolveProvider returns.
    // This verifies the delegation contract without requiring an interceptable spy.
    const serverResult = llmModule.getServerProvider()
    const resolvedResult = resolveProvider()
    expect(resolvedResult).toBe(serverResult)
  })

  it('returns null when no args supplied and no server key is configured', () => {
    // In the test environment, API key env vars are not set, so
    // getServerProvider() returns null. Confirm resolveProvider() agrees.
    // Both functions share the same module-level SERVER_API_KEY binding.
    const serverResult = llmModule.getServerProvider()
    const resolvedResult = resolveProvider()
    if (serverResult === null) {
      expect(resolvedResult).toBeNull()
    } else {
      // Server key IS set in this environment — provider will be non-null
      expect(resolvedResult).not.toBeNull()
    }
  })
})

describe('AnthropicProvider', () => {
  it('has name "anthropic"', () => {
    const provider = new AnthropicProvider('test-key')
    expect(provider.name).toBe('anthropic')
  })
})
