// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref } from 'vue'
import { agentApiService } from 'src/services/agent-api'
import { useAgentStore } from 'src/stores/agent-store'
import { useAppStore } from 'src/stores/app'
import { useSettingsStore } from 'src/stores/settings-store'
import { isDemoMode } from 'src/config/demo-mode'
import type { AgentAction, LlmVendor } from 'src/types/agent'
import { extractErrorMessage } from 'src/utils/error'

export function useAgent() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const agentStore = useAgentStore()
  const appStore = useAppStore()
  const settingsStore = useSettingsStore()

  async function runAgent(
    resourceId: string,
    action: AgentAction,
    options?: { apiKey?: string; vendor?: LlmVendor },
    resourceType: 'vm' | 'container' = 'vm'
  ): Promise<string | null> {
    // Auto-inject saved API key/vendor when no explicit options provided.
    // When the server has a key but the tier can't use it, always send
    // the user's BYOK key (even if useServerKey is true in settings).
    let resolvedOptions: { apiKey?: string; vendor?: LlmVendor }
    if (options) {
      resolvedOptions = options
    } else if (appStore.hasServerKey && !appStore.serverKeyAllowed) {
      // Force BYOK: server has a key but tier can't use it
      resolvedOptions = {
        apiKey: settingsStore.llmApiKey || undefined,
        vendor: settingsStore.llmVendor,
      }
    } else {
      resolvedOptions = {
        apiKey: settingsStore.effectiveApiKey,
        vendor: settingsStore.effectiveVendor,
      }
    }

    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) {
        // Demo mode: simulate agent operation via mock WebSocket messages
        const mockOpId = `demo-${Date.now().toString(36)}`
        agentStore.startOperation(mockOpId, resourceId, action)
        return mockOpId
      }
      const result = await agentApiService.startAgent(resourceId, action, resolvedOptions, resourceType)
      agentStore.startOperation(result.operationId, resourceId, action)
      return result.operationId
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to start agent')
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, runAgent }
}
