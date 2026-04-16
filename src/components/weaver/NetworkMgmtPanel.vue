<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered>
    <q-tabs v-model="tab" dense class="text-grey-8" active-color="primary" indicator-color="primary" align="left" narrow-indicator>
      <q-tab name="bridges" label="Bridges" icon="mdi-bridge" />
      <q-tab name="ip-pool" label="IP Pool" icon="mdi-ip-network" />
      <q-tab name="firewall" label="Firewall" icon="mdi-shield-lock" />
      <q-tab name="vm-config" label="VM Config" icon="mdi-cog-outline" />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="bridges">
        <BridgeManager :topology-bridges="bridgeList" />
      </q-tab-panel>
      <q-tab-panel name="ip-pool">
        <IpPoolManager :bridges="bridgeList" />
      </q-tab-panel>
      <q-tab-panel name="firewall">
        <FirewallRulesTable />
      </q-tab-panel>
      <q-tab-panel name="vm-config">
        <VmNetworkEditor />
      </q-tab-panel>
    </q-tab-panels>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import BridgeManager from './network/BridgeManager.vue'
import IpPoolManager from './network/IpPoolManager.vue'
import FirewallRulesTable from './network/FirewallRulesTable.vue'
import VmNetworkEditor from './network/VmNetworkEditor.vue'

interface BridgeInfo {
  name: string
  subnet: string
  gateway: string
}

const props = defineProps<{
  bridges: BridgeInfo[]
}>()

const tab = ref('bridges')

const bridgeList = computed(() =>
  props.bridges.map((b) => ({ name: b.name, subnet: b.subnet, gateway: b.gateway })),
)
</script>
