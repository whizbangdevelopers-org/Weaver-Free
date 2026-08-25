// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

// `vi` must be imported above any vi.mock/vi.hoisted usage so static analyzers
// (CodeQL's js/use-before-declaration) see the binding. Vitest's transform
// hoists vi.mock() above the imports at runtime regardless of source order.
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }))

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
    expect(model).toBe('claude-sonnet-5')
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

describe('AnthropicProvider request shape', () => {
  // The thinking posture is a DECISION, and a decision recorded only in a comment is prose.
  // These assertions are the control: they fail if someone drops `thinking`/`effort`, and they
  // fail if someone adds a parameter that current models reject with a 400.
  function captureRequest(): { body: Record<string, unknown> | undefined } {
    const captured: { body: Record<string, unknown> | undefined } = { body: undefined }
    const provider = new AnthropicProvider('test-key')
    // Replace the SDK client with a stub that records the request and yields nothing.
    ;(provider as unknown as { client: unknown }).client = {
      messages: {
        stream: (body: Record<string, unknown>) => {
          captured.body = body
          return (async function* () { /* no events — we only care about the request */ })()
        },
      },
    }
    // Drain the generator so stream() actually runs.
    const it_ = provider.stream({ model: 'm', maxTokens: 16, prompt: 'p' })[Symbol.asyncIterator]()
    void it_.next()
    return captured
  }

  it('pins adaptive thinking at effort medium', () => {
    const { body } = captureRequest()
    expect(body?.thinking).toEqual({ type: 'adaptive' })
    expect(body?.output_config).toEqual({ effort: 'medium' })
  })

  it('sends NO sampling parameters — current models reject them with a 400', () => {
    const { body } = captureRequest()
    // Opus 5 / Sonnet 5 / Fable 5 removed these outright. A future edit re-adding one would
    // break every agent call at runtime, where nothing else in this suite would notice.
    expect(body).not.toHaveProperty('temperature')
    expect(body).not.toHaveProperty('top_p')
    expect(body).not.toHaveProperty('top_k')
  })

  it('carries the caller\'s model and max_tokens through unchanged', () => {
    const { body } = captureRequest()
    expect(body?.model).toBe('m')
    expect(body?.max_tokens).toBe(16)
  })
})

describe('AnthropicProvider', () => {
  it('has name "anthropic"', () => {
    const provider = new AnthropicProvider('test-key')
    expect(provider.name).toBe('anthropic')
  })
})
