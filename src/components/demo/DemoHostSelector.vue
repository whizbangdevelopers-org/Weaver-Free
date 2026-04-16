<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  DemoHostSelector — shows the active host in the demo toolbar.

  v1.x / v2.x  Single host only (king). Displays as a static badge.
                Tooltip hints that multi-host arrives in FabricK v3.0.

  v3.0+         Full dropdown: select any fleet host or navigate to the
  (FabricK)     Fleet overview page.
-->
<template>
  <div class="demo-host-selector row items-center no-wrap q-mr-sm">
    <!-- Single-host mode (pre-v3.0): static badge -->
    <template v-if="!isFabric">
      <q-icon name="mdi-server" size="14px" class="q-mr-xs" style="opacity: 0.7" />
      <span class="host-label">{{ currentHost?.hostname ?? 'king' }}</span>
      <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 8]">
        <div class="text-weight-bold">Single-host mode</div>
        <div class="text-caption text-grey-7">Multi-host fleet management arrives in Fabrick v3.0</div>
      </q-tooltip>
    </template>

    <!-- Fabrick mode (v3.0+ Fabrick tier): host dropdown -->
    <template v-else>
      <q-btn-dropdown
        flat dense no-caps
        :label="currentHost?.hostname ?? 'king'"
        icon="mdi-server-network"
        class="fabric-dropdown"
        content-class="fabric-host-menu"
      >
        <q-list dense style="min-width: 200px">
          <q-item-label header class="text-uppercase text-grey-7" style="font-size: 0.65rem; letter-spacing: 0.08em">
            FabricK Hosts
          </q-item-label>

          <q-item
            v-for="host in DEMO_HOSTS"
            :key="host.id"
            clickable v-close-popup
            :active="appStore.demoSelectedHostId === host.id"
            active-class="text-primary"
            @click="appStore.setDemoHost(host.id)"
          >
            <q-item-section avatar>
              <q-icon
                name="mdi-server"
                :color="host.status === 'healthy' ? 'positive' : host.status === 'degraded' ? 'warning' : 'negative'"
                size="18px"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ host.hostname }}</q-item-label>
              <q-item-label caption>{{ host.role }} · {{ host.ipAddress }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge
                :color="host.status === 'healthy' ? 'positive' : 'warning'"
                :label="host.status"
                rounded
              />
            </q-item-section>
          </q-item>

          <q-separator class="q-my-xs" />

          <q-item clickable v-close-popup @click="router.push('/fabrick')">
            <q-item-section avatar>
              <q-icon name="mdi-view-grid" color="purple-4" size="18px" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-purple-4">FabricK</q-item-label>
              <q-item-label caption>All hosts at a glance</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import { DEMO_HOSTS } from 'src/config/demo'

const appStore = useAppStore()
const router = useRouter()

const isFabric = computed(() =>
  appStore.isDemoVersionAtLeast('3.0') && appStore.isFabrick
)

const currentHost = computed(() =>
  DEMO_HOSTS.find(h => h.id === appStore.demoSelectedHostId) ?? DEMO_HOSTS[0]
)
</script>

<style scoped lang="scss">
.demo-host-selector {
  background: rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0 10px;
  min-height: 36px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
}

.host-label {
  font-weight: 600;
  letter-spacing: 0.01em;
}

.fabric-dropdown {
  color: #fff !important;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
