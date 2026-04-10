<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Universal right-side detail drawer. Hosts VmDetailPanel, ContainerDetailPanel,
  and NetworkInfoPanel based on what resource-drawer-store reports as open.
  480px on desktop, full-width on mobile, overlay mode.
-->
<template>
  <q-drawer
    v-model="drawerOpen"
    side="right"
    overlay
    bordered
    :width="drawerWidth"
    :breakpoint="600"
    class="resource-detail-drawer"
    @hide="drawerStore.close()"
  >
    <div class="full-height column">
      <VmDetailPanel
        v-if="drawerStore.resourceType === 'vm' && drawerStore.resourceId"
        :vm-name="drawerStore.resourceId"
      />
      <ContainerDetailPanel
        v-else-if="drawerStore.resourceType === 'container' && drawerStore.resourceId"
        :container-id="drawerStore.resourceId"
      />
      <NetworkInfoPanel
        v-else-if="drawerStore.resourceType === 'network-node' && drawerStore.networkNode"
        :node="drawerStore.networkNode"
      />
      <div v-else class="col flex flex-center text-grey">
        <q-icon name="mdi-information-outline" size="48px" />
      </div>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import VmDetailPanel from 'src/components/panels/VmDetailPanel.vue'
import ContainerDetailPanel from 'src/components/panels/ContainerDetailPanel.vue'
import NetworkInfoPanel from 'src/components/panels/NetworkInfoPanel.vue'

const $q = useQuasar()
const drawerStore = useResourceDrawerStore()

const drawerOpen = computed({
  get: () => drawerStore.isOpen,
  set: (val) => { if (!val) drawerStore.close() },
})

const drawerWidth = computed(() => ($q.screen.lt.sm ? $q.screen.width : 480))
</script>

<style scoped lang="scss">
.resource-detail-drawer {
  // Ensure drawer sits above page content
  z-index: 2000;
}
</style>
