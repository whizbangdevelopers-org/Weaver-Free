// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import Anthropic from '@anthropic-ai/sdk'

// --- Provider Interface ---

export interface LlmStreamOptions {
  model: string
  maxTokens: number
  prompt: string
}

export interface LlmProvider {
  readonly name: string
  stream(opts: LlmStreamOptions): AsyncIterable<string>
}

// --- Anthropic Provider ---

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic'
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async *stream(opts: LlmStreamOptions): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: [{ role: 'user', content: opts.prompt }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

// --- Provider Factory ---

export type LlmVendor = 'anthropic'

const DEFAULT_MODELS: Record<LlmVendor, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
}

export function getDefaultModel(vendor: LlmVendor): string {
  return process.env.AGENT_MODEL || DEFAULT_MODELS[vendor] || DEFAULT_MODELS.anthropic
}

export function createProvider(vendor: LlmVendor, apiKey: string): LlmProvider {
  switch (vendor) {
    case 'anthropic':
      return new AnthropicProvider(apiKey)
    default:
      throw new Error(`Unsupported LLM vendor: ${vendor}`)
  }
}

// --- Server-level defaults ---

const SERVER_VENDOR = (process.env.AGENT_VENDOR || 'anthropic') as LlmVendor
const SERVER_API_KEY = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || ''

let serverProvider: LlmProvider | null = null

export function getServerProvider(): LlmProvider | null {
  if (!SERVER_API_KEY) return null
  if (!serverProvider) serverProvider = createProvider(SERVER_VENDOR, SERVER_API_KEY)
  return serverProvider
}

export function resolveProvider(vendor?: LlmVendor, apiKey?: string): LlmProvider | null {
  // BYOK/BYOV: caller-provided credentials take precedence
  if (apiKey && vendor) return createProvider(vendor, apiKey)
  if (apiKey) return createProvider('anthropic', apiKey)
  // Fall back to server-configured provider
  return getServerProvider()
}
