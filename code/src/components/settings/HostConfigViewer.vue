<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered>
    <q-expansion-item
      icon="mdi-file-code-outline"
      label="Host Configuration"
      caption="NixOS configuration.nix — workload definitions"
      header-class="text-h6"
    >
    <q-card-section>

      <!-- Loading -->
      <div v-if="loading" class="row justify-center q-pa-lg">
        <q-spinner color="primary" size="32px" />
      </div>

      <!-- Unavailable -->
      <q-banner
        v-else-if="hostConfig && !hostConfig.available"
        rounded
        class="bg-blue-grey-1 text-blue-grey-9"
      >
        <template #avatar>
          <q-icon name="mdi-information-outline" color="blue-grey" />
        </template>
        <div class="text-body2">{{ hostConfig.error ?? 'NixOS configuration file unavailable' }}</div>
        <div class="text-caption q-mt-xs text-grey-7">Path: {{ hostConfig.configPath }}</div>
      </q-banner>

      <!-- Viewer -->
      <template v-else-if="hostConfig?.available && hostConfig.rawContent">
        <div class="text-caption text-grey-6 q-mb-md">
          {{ hostConfig.configPath }}
          <span class="q-ml-sm">— {{ visibleSections.length }} section{{ visibleSections.length !== 1 ? 's' : '' }} detected</span>
        </div>

        <div class="row q-gutter-sm" style="min-height: 400px">
          <!-- Sidebar: section list -->
          <div style="width: 220px; flex-shrink: 0">
            <q-list dense separator bordered rounded>
              <q-item-label header class="text-caption text-uppercase text-grey-6 q-py-xs">Sections</q-item-label>

              <q-item
                v-for="section in visibleSections"
                :key="section.id"
                clickable
                :active="selectedSectionId === section.id"
                active-class="bg-primary text-white"
                @click="selectSection(section.id)"
              >
                <q-item-section side>
                  <q-icon :name="sectionIcon(section.type)" :color="selectedSectionId === section.id ? 'white' : sectionColor(section.type)" size="16px" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-caption ellipsis">{{ section.label }}</q-item-label>
                  <q-item-label caption class="text-grey-6">
                    <span v-if="selectedSectionId !== section.id">L{{ section.lineStart }}–{{ section.lineEnd }}</span>
                  </q-item-label>
                </q-item-section>
              </q-item>

              <q-item v-if="visibleSections.length === 0">
                <q-item-section>
                  <q-item-label caption class="text-grey-5">No workload sections detected</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Code view -->
          <div class="col" style="overflow: hidden">
            <q-card flat bordered style="height: 100%; overflow: auto">
              <q-card-section class="q-pa-xs">
                <!-- sast-ignore[v-html-xss]: content passed through escapeHtml() in highlightNix() before span injection -->
                <pre
                  ref="codeEl"
                  class="host-config-code q-ma-none"
                  v-html="highlightedContent"
                />
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Section type legend -->
        <div class="row q-gutter-sm q-mt-sm">
          <q-chip v-for="t in SECTION_TYPES" :key="t.type" dense outline :color="t.color" :icon="t.icon" :label="t.label" size="sm" />
        </div>
      </template>
    </q-card-section>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'

import { hostConfigApiService } from 'src/services/api'
import { isDemoMode, getDemoHostConfig } from 'src/config/demo'
import { useAppStore } from 'src/stores/app'
import type { NixConfigResponse, NixConfigSectionType } from 'src/types/host-config'

const appStore = useAppStore()

const loading = ref(true)
const hostConfig = ref<NixConfigResponse | null>(null)
const selectedSectionId = ref<string | null>(null)
const codeEl = ref<HTMLPreElement | null>(null)

// ── Section type metadata ──────────────────────────────────────────────────

const SECTION_TYPES = [
  { type: 'microvm' as NixConfigSectionType, label: 'MicroVM', color: 'primary', icon: 'mdi-server' },
  { type: 'oci-container' as NixConfigSectionType, label: 'OCI Container', color: 'teal', icon: 'mdi-docker' },
  { type: 'slurm' as NixConfigSectionType, label: 'Slurm', color: 'amber-9', icon: 'mdi-chart-gantt' },
  { type: 'infrastructure' as NixConfigSectionType, label: 'Infrastructure', color: 'grey-7', icon: 'mdi-lan' },
]

/** Tier-gated section types — Slurm only visible at Fabrick tier */
const FABRICK_ONLY_TYPES: NixConfigSectionType[] = ['slurm']

const visibleSections = computed(() => {
  if (!hostConfig.value) return []
  if (appStore.isFabrick) return hostConfig.value.sections
  return hostConfig.value.sections.filter(s => !FABRICK_ONLY_TYPES.includes(s.type))
})

function sectionColor(type: NixConfigSectionType): string {
  return SECTION_TYPES.find(t => t.type === type)?.color ?? 'grey'
}

function sectionIcon(type: NixConfigSectionType): string {
  return SECTION_TYPES.find(t => t.type === type)?.icon ?? 'mdi-code-braces'
}

// ── Syntax highlighting ────────────────────────────────────────────────────

const NIX_KEYWORDS = /\b(let|in|with|import|if|then|else|true|false|null|rec|inherit|assert|or|and|builtins)\b/g
const NIX_STRINGS_DQ = /"(?:[^"\\]|\\.)*"/g
const NIX_STRINGS_SQ = /''\s[\s\S]*?''/g
const NIX_COMMENTS = /#[^\n]*/g
const NIX_ATTR_PATH = /\b([\w-]+(?:\.[\w-]+)+)\s*(?==)/g

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightNix(code: string): string {
  const escaped = escapeHtml(code)

  // Multi-pass tokenizer: we replace non-overlapping regions in order of precedence.
  // Simple approach: build token stream per line.
  return escaped
    .replace(NIX_COMMENTS, m => `<span class="nix-comment">${m}</span>`)
    .replace(NIX_STRINGS_DQ, m => `<span class="nix-string">${m}</span>`)
    .replace(NIX_STRINGS_SQ, m => `<span class="nix-string">${m}</span>`)
    .replace(NIX_ATTR_PATH, m => `<span class="nix-attr">${m}</span>`)
    .replace(NIX_KEYWORDS, m => `<span class="nix-keyword">${m}</span>`)
}

const highlightedContent = computed(() => {
  if (!hostConfig.value?.rawContent) return ''
  const content = selectedSectionId.value
    ? (hostConfig.value.sections.find(s => s.id === selectedSectionId.value)?.rawNix ?? hostConfig.value.rawContent)
    : hostConfig.value.rawContent
  return highlightNix(content)
})

// ── Section selection ──────────────────────────────────────────────────────

function selectSection(id: string) {
  selectedSectionId.value = selectedSectionId.value === id ? null : id
  void nextTick(() => {
    codeEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

// ── Data fetching ──────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    if (isDemoMode()) {
      hostConfig.value = getDemoHostConfig(appStore.effectiveTier, appStore.demoVersion)
    } else {
      hostConfig.value = await hostConfigApiService.getConfig()
    }
  } catch {
    hostConfig.value = {
      available: false,
      rawContent: null,
      sections: [],
      configPath: '/etc/nixos/configuration.nix',
      readAt: new Date().toISOString(),
      error: 'Failed to load host configuration',
    }
  } finally {
    loading.value = false
  }
})

// Rebuild config when tier or version changes in demo mode
if (isDemoMode()) {
  watch(
    () => [appStore.effectiveTier, appStore.demoVersion] as const,
    ([tier, version]) => {
      hostConfig.value = getDemoHostConfig(tier, version)
      selectedSectionId.value = null
    },
  )
}
</script>

<style scoped>
.host-config-code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  padding: 8px;
  min-height: 360px;
}

:deep(.nix-keyword) {
  color: #7c3aed;
  font-weight: 600;
}

:deep(.nix-string) {
  color: #16a34a;
}

:deep(.nix-comment) {
  color: #6b7280;
  font-style: italic;
}

:deep(.nix-attr) {
  color: #0284c7;
}

/* Dark mode overrides */
.body--dark :deep(.nix-keyword) { color: #a78bfa; }
.body--dark :deep(.nix-string)  { color: #4ade80; }
.body--dark :deep(.nix-comment) { color: #9ca3af; }
.body--dark :deep(.nix-attr)    { color: #38bdf8; }
</style>
