<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered class="q-mt-md">
    <q-card-section class="row items-center">
      <StatusBadge :status="node.status" class="q-mr-md" />
      <div class="text-h6">{{ node.name }}</div>
      <q-badge v-if="node.autostart" color="teal" class="q-ml-sm" label="autostart" />
      <q-space />
      <q-btn flat round icon="mdi-close" size="sm" @click="$emit('close')" />
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div v-if="node.description" class="text-body2 text-grey-7 q-mb-md">{{ node.description }}</div>

      <div class="row q-gutter-lg">
        <div class="col-auto">
          <div class="text-caption text-grey-8">IP Address</div>
          <div class="text-body1">{{ node.ip }}</div>
        </div>
        <div v-if="node.mem" class="col-auto">
          <div class="text-caption text-grey-8">Memory</div>
          <div class="text-body1">{{ node.mem >= 1024 ? `${node.mem / 1024} GB` : `${node.mem} MB` }}</div>
        </div>
        <div v-if="node.vcpu" class="col-auto">
          <div class="text-caption text-grey-8">vCPU</div>
          <div class="text-body1">{{ node.vcpu }}</div>
        </div>
        <div v-if="uptimeFormatted" class="col-auto">
          <div class="text-caption text-grey-8">Uptime</div>
          <div class="text-body1">{{ uptimeFormatted }}</div>
        </div>
        <div v-if="node.bridge" class="col-auto">
          <div class="text-caption text-grey-8">Bridge</div>
          <div class="text-body1 text-mono">{{ node.bridge }}</div>
        </div>
        <div v-if="node.macAddress" class="col-auto">
          <div class="text-caption text-grey-8">MAC Address</div>
          <div class="text-body1 text-mono">{{ node.macAddress }}</div>
        </div>
        <div v-if="node.tapInterface" class="col-auto">
          <div class="text-caption text-grey-8">TAP Interface</div>
          <div class="text-body1 text-mono">{{ node.tapInterface }}</div>
        </div>
        <div class="col-auto">
          <div class="text-caption text-grey-8">Hypervisor</div>
          <div class="text-body1">{{ node.hypervisor }}</div>
        </div>
        <div v-if="node.distro" class="col-auto">
          <div class="text-caption text-grey-8">Distribution</div>
          <div class="text-body1">{{ node.distro }}</div>
        </div>
        <div v-if="node.guestOs" class="col-auto">
          <div class="text-caption text-grey-8">Guest OS</div>
          <div class="text-body1">{{ node.guestOs === 'windows' ? 'Windows' : 'Linux' }}</div>
        </div>
      </div>

      <div v-if="node.tags && node.tags.length" class="q-mt-md row q-gutter-xs">
        <q-badge
          v-for="tag in node.tags"
          :key="tag"
          color="grey-7"
          :label="tag"
        />
      </div>
    </q-card-section>

    <q-card-actions align="right">
      <q-btn
        flat
        color="primary"
        icon="mdi-monitor-eye"
        label="View VM Details"
        :to="`/workload/${node.name}`"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from 'src/components/StatusBadge.vue'
import type { NetworkNode } from 'src/types/network'
import { formatUptime } from 'src/utils/format'

const props = defineProps<{
  node: NetworkNode
}>()

defineEmits<{
  close: []
}>()

const uptimeFormatted = computed(() => formatUptime(props.node.uptime))
</script>

<style scoped>
.text-mono {
  font-family: monospace;
}
</style>
