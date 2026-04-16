<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Network infrastructure node detail panel — renders inside the ResourceDetailDrawer.
  Displays host/bridge info for topology nodes that are not VMs or containers.
-->
<template>
  <div class="network-info-panel column full-height">

    <!-- Panel header -->
    <div class="row items-center no-wrap q-pa-md q-pb-sm">
      <q-icon :name="nodeIcon" size="22px" :color="nodeColor" class="q-mr-sm" />
      <div class="col">
        <div class="text-h6 ellipsis">{{ node.name }}</div>
        <div class="text-caption text-grey-6">{{ nodeTypeLabel }}</div>
      </div>
      <q-btn flat round dense icon="mdi-close" @click="drawerStore.close()" />
    </div>

    <q-separator />

    <!-- Info content -->
    <div class="col scroll q-pa-md">

      <!-- Status chip for VM/container nodes -->
      <div v-if="node.nodeType" class="row q-gutter-xs q-mb-md">
        <StatusBadge :status="node.status" />
        <q-badge v-if="node.containerRuntime" :color="runtimeColor(node.containerRuntime)" :label="node.containerRuntime" />
      </div>

      <!-- Core info list -->
      <q-card flat bordered class="q-mb-md">
        <q-list dense separator>
          <q-item v-if="node.ip">
            <q-item-section>
              <q-item-label caption>IP Address</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium text-mono">{{ node.ip }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.bridge">
            <q-item-section>
              <q-item-label caption>Bridge</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium text-mono">{{ node.bridge }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.macAddress">
            <q-item-section>
              <q-item-label caption>MAC Address</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium text-mono">{{ node.macAddress }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.tapInterface">
            <q-item-section>
              <q-item-label caption>TAP Interface</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium text-mono">{{ node.tapInterface }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.hypervisor && node.nodeType !== 'container'">
            <q-item-section>
              <q-item-label caption>Hypervisor</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium">{{ node.hypervisor }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.distro">
            <q-item-section>
              <q-item-label caption>Distribution</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium">{{ node.distro }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.mem">
            <q-item-section>
              <q-item-label caption>Memory</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium">{{ node.mem }} MB</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.vcpu">
            <q-item-section>
              <q-item-label caption>vCPUs</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium">{{ node.vcpu }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="node.uptime">
            <q-item-section>
              <q-item-label caption>Uptime</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label class="text-weight-medium">{{ node.uptime }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <!-- Service ports -->
      <div v-if="node.servicePorts?.length" class="q-mb-md">
        <div class="row items-center q-mb-xs">
          <q-icon name="mdi-lan-connect" size="16px" color="grey-7" class="q-mr-xs" />
          <span class="text-caption text-weight-medium text-grey-7">Service Ports</span>
        </div>
        <div class="row q-gutter-xs">
          <q-chip v-for="port in node.servicePorts" :key="port" dense size="sm" color="blue-grey-2" text-color="blue-grey-9">
            {{ port }}
          </q-chip>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="node.tags?.length" class="q-mb-md">
        <div class="row items-center q-mb-xs">
          <q-icon name="mdi-tag-multiple" size="16px" color="grey-7" class="q-mr-xs" />
          <span class="text-caption text-weight-medium text-grey-7">Tags</span>
        </div>
        <div class="row q-gutter-xs">
          <q-chip v-for="tag in node.tags" :key="tag" dense outline size="sm" color="primary">{{ tag }}</q-chip>
        </div>
      </div>

      <!-- Description -->
      <div v-if="node.description" class="text-caption text-grey-7">
        {{ node.description }}
      </div>

      <!-- Open full detail link (for VM/container nodes that have full panels) -->
      <div v-if="node.nodeType === 'vm'" class="q-mt-md">
        <q-btn
          outline size="sm" color="primary" icon="mdi-open-in-new" label="Open VM Detail"
          @click="openVmDetail"
        />
      </div>
      <div v-else-if="node.nodeType === 'container'" class="q-mt-md">
        <q-btn
          outline size="sm" color="primary" icon="mdi-open-in-new" label="Open Container Detail"
          @click="openContainerDetail"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from 'src/components/StatusBadge.vue'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { vmTypeIcon, vmTypeColor } from 'src/utils/vm'
import type { NetworkNode } from 'src/types/network'

const props = defineProps<{ node: NetworkNode }>()

const drawerStore = useResourceDrawerStore()

const nodeIcon = computed(() => {
  if (props.node.nodeType === 'container') return 'mdi-docker'
  if (props.node.nodeType === 'vm') return vmTypeIcon(props.node.vmType)
  if (props.node.name.toLowerCase().includes('host')) return 'mdi-server-network'
  return 'mdi-network'
})

const nodeColor = computed(() => {
  if (props.node.nodeType === 'container') return 'blue-7'
  if (props.node.nodeType === 'vm') return vmTypeColor(props.node.vmType)
  return 'grey-7'
})

const nodeTypeLabel = computed(() => {
  if (props.node.nodeType === 'container') return `Container · ${props.node.containerRuntime ?? ''}`
  if (props.node.nodeType === 'vm') return 'Virtual Machine'
  if (props.node.name.toLowerCase().includes('host')) return 'Host System'
  return 'Network Node'
})

function runtimeColor(rt: string): string {
  if (rt === 'docker') return 'blue-7'
  if (rt === 'podman') return 'teal-7'
  return 'deep-purple-6'
}

function openVmDetail() {
  drawerStore.openVm(props.node.name)
}

function openContainerDetail() {
  // Container nodes in topology store their id as the node name
  drawerStore.openContainer(props.node.name)
}
</script>

<style scoped lang="scss">
.network-info-panel {
  overflow: hidden;
}
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
</style>
