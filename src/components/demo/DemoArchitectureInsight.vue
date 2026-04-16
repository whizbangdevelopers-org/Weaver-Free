<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Version Milestone modal — shows product architecture progression at key
  version milestones. Auto-fires when investors step through versions in the
  private demo version switcher (via useMilestoneModal composable).

  Nine milestones trace the full product journey from Core Platform (v1.0)
  to Architecture Complete (v3.3).

  Private demo only (investor/QA tool).
-->
<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card v-if="milestone" style="min-width: 380px; max-width: 640px; width: 100%">

      <!-- Header -->
      <q-card-section class="row items-center no-wrap q-pb-none">
        <q-icon name="mdi-flag-checkered" size="28px" color="primary" class="q-mr-sm" />
        <div class="col">
          <div class="text-h6">{{ milestone.title }}</div>
          <div class="text-caption text-grey-7">
            v{{ milestone.version }}.0 &middot; {{ milestone.tier }}
          </div>
        </div>
        <q-btn flat round dense icon="mdi-close" @click="emit('update:modelValue', false)" />
      </q-card-section>

      <!-- Progression bar -->
      <q-card-section class="q-pt-sm q-pb-sm">
        <div class="text-overline text-grey-7 q-mb-xs">
          Product Journey &mdash; {{ milestone.step }} of {{ milestone.totalSteps }}
        </div>
        <div class="row q-gutter-xs">
          <div
            v-for="i in milestone.totalSteps"
            :key="i"
            class="col"
            style="height: 6px; border-radius: 3px"
            :class="i <= milestone.step ? 'bg-primary' : 'bg-grey-3'"
          />
        </div>
        <div class="row justify-between q-mt-xs">
          <span class="text-caption text-grey-6">Foundation</span>
          <span class="text-caption text-grey-6">Architecture Complete</span>
        </div>
      </q-card-section>

      <q-separator />

      <!-- Tagline -->
      <q-card-section class="q-pb-xs">
        <div class="text-h5 text-italic text-weight-medium text-primary">
          &ldquo;{{ milestone.tagline }}&rdquo;
        </div>
      </q-card-section>

      <!-- What shipped -->
      <q-card-section class="q-pt-xs">
        <div class="text-subtitle2 q-mb-xs">What shipped</div>
        <q-list dense class="text-body2 text-grey-8">
          <q-item v-for="(item, i) in milestone.whatShipped" :key="i" class="q-pl-none" style="min-height: 28px">
            <q-item-section avatar style="min-width: 24px">
              <q-icon name="mdi-check" size="16px" color="positive" />
            </q-item-section>
            <q-item-section>{{ item }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- Business impact -->
      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 q-mb-xs">Why it matters</div>
        <q-list dense class="text-body2 text-grey-8">
          <q-item v-for="(item, i) in milestone.businessImpact" :key="i" class="q-pl-none" style="min-height: 28px">
            <q-item-section avatar style="min-width: 24px">
              <q-icon name="mdi-arrow-right-bold" size="14px" color="primary" />
            </q-item-section>
            <q-item-section>{{ item }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- Tier upgrade callout -->
      <q-card-section v-if="milestone.tierUpgrade" class="q-pt-none">
        <q-banner rounded class="bg-amber-1 text-amber-10">
          <template #avatar>
            <q-icon name="mdi-arrow-up-bold-circle" color="amber-9" />
          </template>
          <span class="text-weight-medium">Tier upgrade:</span> {{ milestone.tierUpgrade.from }} &rarr; {{ milestone.tierUpgrade.to }}
        </q-banner>
      </q-card-section>

      <!-- Bottom padding -->
      <q-card-section class="q-pt-none q-pb-sm" />

    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import type { VersionMilestone } from 'src/config/demo'

defineProps<{
  modelValue: boolean
  milestone: VersionMilestone | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
