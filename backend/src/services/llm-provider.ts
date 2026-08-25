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
      // Set EXPLICITLY, because omitting it stopped being neutral. Every current model
      // runs adaptive thinking when `thinking` is absent — the retired claude-sonnet-4-5 default
      // did not — so a bare model-id swap would have added billed thinking tokens to every
      // customer's usage without anyone deciding to. The key is the operator's own
      // (`services.weaver.aiApiKey`), so that bill is theirs.
      //
      // effort 'medium' bounds it for what this agent does: short, host-scoped workload tasks
      // under a per-tier rate limit. Raise it per-install via AGENT_MODEL + a config change, not
      // here.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
    })

    for await (const event of stream) {
      // Only text is surfaced. Thinking arrives as its own block type and is skipped — deliberate:
      // the caller streams to a UI, and a summarised chain of thought is not what it asked for.
      // The tokens are still billed, which is why effort is pinned above rather than left default.
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

// --- Provider Factory ---

export type LlmVendor = 'anthropic'

// UNDATED ids only, by convention. A dated snapshot is how this went stale for months: it named a
// superseded model and nothing failed, because a model id is just a string to the API.
const DEFAULT_MODELS: Record<LlmVendor, string> = {
  anthropic: 'claude-sonnet-5',
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
