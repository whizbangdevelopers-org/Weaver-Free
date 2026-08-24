<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Service health — the whole section, rendered identically by the drawer panel and the detail page.

  ONE component rather than the same markup in both, because the two surfaces are the same claim
  about the same workload: what a colour means, when the Open button appears, and what an absent
  list says all have to agree. Two copies of that would drift on the first change to any of them,
  and the drift would be invisible — each surface looks right on its own.

  Display is FREE. Configuration is Solo, and the gate is here rather than at each call site so a
  third surface cannot forget it; the route re-checks the tier regardless, which is the actual
  control (`requireTier(config, TIERS.SOLO)` in routes/workloads.ts).
-->
<template>
  <div>
    <div class="row items-center q-mb-sm">
      <div :class="headingClass">Service Health</div>
      <HelpTooltip text="Weaver checks each configured port every broadcast cycle and reports whether the service inside the workload answers. 'Running' means the VM is up; this says whether the service is." />
      <q-space />
      <q-btn
        v-if="canConfigure"
        flat dense size="sm" color="primary" icon="mdi-heart-pulse" label="Configure"
        data-testid="vm-probes-configure-btn" @click="editorOpen = true"
      />
    </div>

    <q-list v-if="probes.length" dense separator data-testid="vm-probe-list">
      <q-item v-for="probe in probes" :key="probe.port">
        <q-item-section avatar>
          <q-icon :name="probeHealthIcon(probe.health)" :color="probeHealthColor(probe.health)" size="22px" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ probe.label || `Port ${probe.port}` }}</q-item-label>
          <q-item-label caption class="text-mono">{{ probe.type.toUpperCase() }} :{{ probe.port }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row items-center no-wrap q-gutter-xs">
            <q-badge :color="probeHealthColor(probe.health)" rounded>
              {{ probeHealthLabel(probe.health) }}
              <q-tooltip v-if="probe.health === 'unreachable'">
                Weaver refused to probe this target: it is not a private address. Fix the probe —
                the service itself was never contacted.
              </q-tooltip>
            </q-badge>
            <q-btn
              v-if="probe.url && probe.health === 'healthy' && !isDemoMode()"
              flat dense round size="sm" color="primary" icon="mdi-open-in-new"
              @click="openUrl(probe.url)"
            >
              <q-tooltip>{{ probe.url }}</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-caption text-grey-6 q-pb-sm">
      No service probes configured.
      <span v-if="!appStore.isSolo"> Probe configuration requires Weaver Solo.</span>
    </div>

    <ServiceProbeEditor
      v-model="editorOpen"
      :vm-name="vmName"
      :vm-ip="vmIp"
      :probes="configuredProbes"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import HelpTooltip from 'src/components/HelpTooltip.vue'
import ServiceProbeEditor from 'src/components/panels/ServiceProbeEditor.vue'
import { useAppStore } from 'src/stores/app'
import { isDemoMode } from 'src/config/demo-mode'
import { probeHealthColor, probeHealthIcon, probeHealthLabel } from 'src/utils/probe-health'
import type { ServiceProbeSpec, WorkloadServiceProbe } from 'src/types/workload'

const props = defineProps<{
  vmName: string
  vmIp?: string
  probes?: WorkloadServiceProbe[]
  /** `text-h6` on the full page, `text-subtitle2` in the narrower drawer. */
  headingClass?: string
}>()

const emit = defineEmits<{ saved: [ServiceProbeSpec[]] }>()

const appStore = useAppStore()
const editorOpen = ref(false)

const probes = computed(() => props.probes ?? [])
const headingClass = computed(() => props.headingClass ?? 'text-subtitle2')

// Configuring is a mutation, so it follows the provisioning gate. Suppressed in demo mode for the
// same reason Clone is: the demo has no host to write to.
const canConfigure = computed(() => appStore.isSolo && !isDemoMode())

/**
 * What the editor seeds from: the CONFIG, with `health` stripped.
 *
 * `health` is computed per broadcast cycle and is not part of the configuration. Seeding the
 * editor with it and posting it back would send the host a value it must ignore — and the day it
 * stopped ignoring it, a client could paint the dashboard green for a dead service.
 */
const configuredProbes = computed<ServiceProbeSpec[]>(() =>
  probes.value.map(({ health: _health, ...spec }) => spec),
)

function openUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function onSaved(specs: ServiceProbeSpec[]): void {
  emit('saved', specs)
}
</script>

<style scoped lang="scss">
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
</style>
