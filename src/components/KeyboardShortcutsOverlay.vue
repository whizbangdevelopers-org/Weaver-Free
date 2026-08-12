<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog
    :model-value="uiStore.shortcutOverlayOpen"
    data-testid="shortcut-overlay"
    @update:model-value="uiStore.setShortcutOverlay($event)"
  >
    <q-card style="min-width: 340px; max-width: 560px">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="mdi-keyboard" size="24px" class="q-mr-sm" />
        <div class="text-h6">Keyboard Shortcuts</div>
        <q-space />
        <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Close" />
      </q-card-section>

      <q-separator />

      <!--
        A plain scrolling div, not a q-scroll-area: inside an auto-height dialog card a
        q-scroll-area has no deterministic height to measure and collapses to zero, hiding
        everything. Same reason the log panels use this shape.
      -->
      <div style="max-height: 60vh; overflow: auto">
        <template v-for="group in grouped" :key="group.context">
          <q-card-section class="q-pb-none">
            <div class="text-caption text-uppercase text-weight-bold text-grey-7">{{ group.context }}</div>
          </q-card-section>
          <q-list dense>
            <q-item v-for="row in group.rows" :key="row.keys">
              <q-item-section>{{ row.description }}</q-item-section>
              <q-item-section side>
                <span class="shortcut-key">{{ row.keys }}</span>
              </q-item-section>
            </q-item>
          </q-list>
        </template>
      </div>

      <q-separator />

      <q-card-section class="row items-center q-py-sm">
        <div class="text-caption text-grey-7">
          Shortcuts are ignored while you are typing.
        </div>
        <q-space />
        <q-btn
          v-close-popup
          flat
          dense
          no-caps
          color="primary"
          icon="mdi-help-circle-outline"
          label="Full Help"
          data-testid="shortcut-overlay-help-link"
          @click="router.push('/help')"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from 'src/stores/ui-store'
import { SHORTCUTS, type ShortcutRow } from 'src/composables/useKeyboardShortcuts'

const uiStore = useUiStore()
const router = useRouter()

/**
 * Grouped FROM the shortcut table the handler itself reads — never a second list.
 *
 * The whole point of importing SHORTCUTS is that a shortcut cannot exist without appearing here,
 * and cannot appear here without existing. A hand-maintained panel drifts silently, and this is
 * the one surface where the user finds out what the keys do.
 */
const grouped = computed<{ context: ShortcutRow['context']; rows: ShortcutRow[] }[]>(() => {
  const order: ShortcutRow['context'][] = ['Global', 'Workload list', 'Focused workload']
  return order
    .map(context => ({ context, rows: SHORTCUTS.filter(s => s.context === context) }))
    .filter(g => g.rows.length > 0)
})
</script>

<style scoped>
.shortcut-key {
  font-family: monospace;
  font-size: 0.85em;
  padding: 2px 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  opacity: 0.75;
  white-space: nowrap;
}
</style>
