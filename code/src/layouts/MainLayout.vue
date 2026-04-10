<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <!-- ══ demo bar: fixed full-viewport-width, above everything ═════════════ -->
  <DemoToolbar v-if="isDemoMode" :show-tui="showTui" :show-mobile="showMobile" @toggle-tui="toggleTui" @toggle-mobile="toggleMobile" />

  <q-layout view="lHh Lpr lFf" :class="{ 'demo-layout': isDemoMode }">
    <q-header elevated :class="headerBgClass">
      <!-- DemoBanner removed from public demo — info is in the toolbar label (Decision #135) -->

      <!-- ══ toolbar: fabrick ═══════════════════════════════════════════════ -->
      <q-toolbar data-toolbar="fabrick">
        <q-btn flat dense round icon="mdi-menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title class="row items-center no-wrap" style="flex: 0 0 auto">
          <img v-if="headerLogoUrl" :src="headerLogoUrl" alt="Logo" style="max-height: 28px; max-width: 120px; object-fit: contain" class="q-mr-sm" />
          <q-icon v-else :name="appIcon" class="q-mr-sm" />
          <router-link v-if="isFabrickMode" to="/fabrick" class="text-white" style="text-decoration: none" @click="appStore.setFabrickDrill(null)">{{ appName }}</router-link>
          <template v-else>{{ appName }}</template>
          <!-- Fabrick drill-down breadcrumb: FabricK > hostname -->
          <template v-if="isFabrickMode && appStore.fabrickDrillHostId">
            <q-icon name="mdi-chevron-right" size="18px" class="q-mx-xs text-white opacity-60" />
            <span class="text-white text-weight-medium" style="font-size:0.95rem">{{ fabrickDrillHostname }}</span>
          </template>
        </q-toolbar-title>

        <!-- DemoTierRoadmap removed — funnel now in version switcher (Decision #135) -->

        <!-- WebSocket status — right after title, Weaver mode only -->
        <q-chip
          v-if="!isFabrickMode && !isEnterpriseWeaverMode && !isLoomMode && !isShedMode && !isWarpMode"
          :color="wsConnected ? 'positive' : 'negative'"
          text-color="white"
          :icon="wsConnected ? 'mdi-wifi' : 'mdi-wifi-off'"
          size="sm"
          class="q-ml-md"
        >{{ wsConnected ? 'WebSocket' : 'WebSocket Offline' }}</q-chip>

        <q-space />

        <!-- Loom legend — left of search -->
        <template v-if="isLoomMode">
          <div class="row items-center q-mr-md" style="gap:14px; opacity:0.85">
            <div class="row items-center" style="gap:6px">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="white" stroke-width="2"/></svg>
              <span class="text-caption text-white">Host tunnel</span>
            </div>
            <div class="row items-center" style="gap:6px">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#FF6B35" stroke-width="2" stroke-dasharray="5 3"/></svg>
              <span class="text-caption text-white">Cross-host service</span>
            </div>
          </div>
        </template>

        <!-- Global search — desktop (gt-xs) -->
        <q-input
          v-if="searchContext.show && $q.screen.gt.xs"
          :model-value="uiStore.searchQuery"
          dense
          borderless
          input-class="text-white"
          :placeholder="searchContext.placeholder"
          class="toolbar-search q-mr-sm flex-shrink"
          @update:model-value="uiStore.setSearchQuery(($event as string) ?? '')"
        >
          <template #prepend>
            <q-icon name="mdi-magnify" size="18px" color="white" class="q-mr-xs" />
          </template>
          <template v-if="uiStore.searchQuery" #append>
            <q-btn flat round dense size="xs" icon="mdi-close" color="white" @click="uiStore.setSearchQuery('')" />
          </template>
        </q-input>

        <!-- Global search — mobile icon (xs) -->
        <q-btn
          v-if="searchContext.show && $q.screen.xs"
          flat round dense
          icon="mdi-magnify"
          color="white"
          class="q-mr-xs"
          @click="showMobileSearch = true"
        >
          <q-badge v-if="uiStore.searchQuery" color="orange" floating rounded />
        </q-btn>

        <!-- Mobile search dialog -->
        <q-dialog v-model="showMobileSearch" position="top" seamless>
          <q-card style="width: 100vw; max-width: 100vw; border-radius: 0; margin: 0;">
            <q-card-section class="row items-center q-pa-sm">
              <q-input
                :model-value="uiStore.searchQuery"
                dense
                outlined
                autofocus
                clearable
                :placeholder="searchContext.placeholder"
                class="col"
                @update:model-value="uiStore.setSearchQuery(($event as string) ?? '')"
                @keyup.escape="showMobileSearch = false"
              >
                <template #prepend>
                  <q-icon name="mdi-magnify" size="20px" />
                </template>
              </q-input>
              <q-btn flat round dense icon="mdi-close" class="q-ml-xs" @click="showMobileSearch = false" />
            </q-card-section>
          </q-card>
        </q-dialog>

        <!-- Notification bell — Weaver mode only (not when FabricK or Loom bar is active) -->
        <NotificationBell v-if="!isFabrickMode && !isEnterpriseWeaverMode && !isLoomMode" />

        <!-- View as Viewer toggle — Weaver Team, v3.3+ (single-mode, no picker) -->
        <q-btn
          v-if="!isFabrickMode && !isEnterpriseWeaverMode && appStore.isWeaver && !appStore.isFabrick && isDemoMode && appStore.isDemoVersionAtLeast('3.3')"
          flat dense round
          :icon="appStore.inspectorMode ? 'mdi-eye-off' : 'mdi-eye'"
          :color="appStore.inspectorMode ? 'warning' : 'white'"
          @click="toggleViewerInspector"
        ><q-tooltip>{{ appStore.inspectorMode ? 'Exit Viewer mode' : 'View as Viewer' }}</q-tooltip></q-btn>

        <!-- FabricK / Loom controls -->
        <template v-if="isFabrickMode || isEnterpriseWeaverMode || isLoomMode">
          <NotificationBell />
        </template>

        <!-- shared -->
        <q-btn flat round :icon="darkModeIcon" @click="settingsStore.cycleDarkMode()">
          <q-tooltip>{{ darkModeTooltip }}</q-tooltip>
        </q-btn>

        <!-- User menu -->
        <q-btn-dropdown
          v-if="authStore.isAuthenticated"
          flat
          no-caps
          :label="authStore.displayName"
          icon="mdi-account-circle"
          class="q-ml-xs"
          data-testid="user-menu"
        >
          <q-list dense>
            <q-item>
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ authStore.displayName }}</q-item-label>
                <q-item-label caption class="text-capitalize">{{ authStore.userRole }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="roleBadgeColor" :label="authStore.userRole" rounded class="text-capitalize" />
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item clickable v-close-popup @click="router.push('/profile')">
              <q-item-section avatar>
                <q-icon name="mdi-account-cog" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Profile</q-item-label>
                <q-item-label caption>Preferences &amp; account</q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="handleLogout">
              <q-item-section avatar>
                <q-icon name="mdi-logout" color="negative" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Logout</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </q-toolbar>

      <!-- ══ toolbar: fabrick — Weaver sub-bar (orange) ══════════════════ -->
      <q-toolbar
        v-if="isFabrickMode && appStore.fabrickDrillHostId"
        data-toolbar="weaver-sub"
        class="bg-primary"
        style="min-height: 44px;"
      >
        <q-icon :name="route.path === '/network' ? 'mdi-lan' : 'mdi-server-network'" class="q-mr-sm" />
        <span class="text-weight-medium">{{ route.path === '/network' ? 'Strands' : 'Weaver' }}</span>
        <q-chip
          :color="wsConnected ? 'positive' : 'negative'"
          text-color="white"
          :icon="wsConnected ? 'mdi-wifi' : 'mdi-wifi-off'"
          size="sm"
          class="q-ml-md"
        >{{ wsConnected ? 'WebSocket' : 'WebSocket Offline' }}</q-chip>
        <q-space />
        <q-input
          v-if="$q.screen.gt.xs"
          :model-value="uiStore.searchQuery"
          dense borderless input-class="text-white"
          placeholder="Search workloads..."
          class="toolbar-search q-mr-sm flex-shrink"
          @update:model-value="uiStore.setSearchQuery(($event as string) ?? '')"
        >
          <template #prepend><q-icon name="mdi-magnify" size="18px" color="white" class="q-mr-xs" /></template>
          <template v-if="uiStore.searchQuery" #append>
            <q-btn flat round dense size="xs" icon="mdi-close" color="white" @click="uiStore.setSearchQuery('')" />
          </template>
        </q-input>
        <router-link
          v-if="$q.screen.gt.xs"
          to="/network"
          class="row no-wrap items-center q-mr-sm text-white"
          style="width:220px; max-width:220px; min-width:120px; background:rgba(255,255,255,0.15); border-radius:4px; height:32px; padding:0 8px; gap:6px; flex-shrink:1; text-decoration:none;"
        >
          <q-icon name="mdi-lan" size="18px" />
          <span class="text-body2">Strands</span>
        </router-link>
      </q-toolbar>


      <!-- ══ toolbar: weaver ════════════════════════════════════════════════ -->
      <q-toolbar v-if="isEnterpriseWeaverMode" data-toolbar="weaver" class="bg-primary">
        <q-toolbar-title class="row items-center no-wrap" style="flex: 0 0 auto">
          <q-icon name="mdi-server-network" class="q-mr-sm" />
          Weaver
        </q-toolbar-title>
        <q-chip
          :color="wsConnected ? 'positive' : 'negative'"
          text-color="white"
          :icon="wsConnected ? 'mdi-wifi' : 'mdi-wifi-off'"
          size="sm" class="q-ml-md"
        >{{ wsConnected ? 'WebSocket' : 'WebSocket Offline' }}</q-chip>
        <q-space />
        <q-input
          v-if="$q.screen.gt.xs"
          :model-value="uiStore.searchQuery"
          dense borderless input-class="text-white"
          placeholder="Search..."
          class="toolbar-search q-mr-sm flex-shrink"
          @update:model-value="uiStore.setSearchQuery(($event as string) ?? '')"
        >
          <template #prepend><q-icon name="mdi-magnify" size="18px" color="white" class="q-mr-xs" /></template>
          <template v-if="uiStore.searchQuery" #append>
            <q-btn flat round dense size="xs" icon="mdi-close" color="white" @click="uiStore.setSearchQuery('')" />
          </template>
        </q-input>
        <!-- Access Inspector control — Fabrick + Compliance Pack, v3.3+ -->
        <template v-if="isDemoMode && appStore.isDemoVersionAtLeast('3.3')">
          <q-chip
            v-if="appStore.inspectorMode"
            clickable dense removable
            icon="mdi-incognito"
            color="warning" text-color="dark"
            class="q-ml-sm"
            @click="showInspectorDialog = true"
            @remove="appStore.exitInspector()"
          >{{ inspectorChipLabel }}</q-chip>
          <q-btn
            v-else
            flat dense round
            icon="mdi-account-search"
            color="white"
            class="q-ml-sm"
            @click="showInspectorDialog = true"
          ><q-tooltip>View as user or group</q-tooltip></q-btn>
        </template>
      </q-toolbar>

      <!-- Inspector active banner -->
      <div
        v-if="appStore.inspectorMode"
        class="row items-center q-px-md"
        style="background: #92400E; min-height: 28px;"
      >
        <q-icon name="mdi-incognito" size="14px" class="q-mr-xs" color="white" />
        <span class="text-white" style="font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
          Viewing as {{ inspectorBannerLabel }} · Read only
        </span>
        <q-space />
        <q-btn flat dense size="xs" padding="2px 8px" color="white" label="Exit" icon="mdi-close" @click="appStore.exitInspector()" />
      </div>

    </q-header>

    <AccessInspectorDialog v-model="showInspectorDialog" />

    <q-drawer v-model="leftDrawerOpen" bordered>
      <q-list>
        <q-item-label header class="text-weight-bold text-uppercase text-grey-7">
          Navigation
        </q-item-label>

        <!-- Fabrick fleet view — demo v3.0+ Fabrick only -->
        <q-item
          v-if="isDemoMode && appStore.isDemoVersionAtLeast('3.0') && appStore.isFabrick"
          clickable to="/fabrick" active-class="text-fabrick bg-fabrick-active"
        >
          <q-item-section avatar>
            <q-icon name="mdi-view-grid" class="text-fabrick" />
          </q-item-section>
          <q-item-section>
            <q-item-label>FabricK</q-item-label>
            <q-item-label caption>Multi-host control plane</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Loom fleet topology — demo v3.0+ Fabrick only -->
        <q-item
          v-if="isDemoMode && appStore.isDemoVersionAtLeast('3.0') && appStore.isFabrick"
          clickable to="/loom" active-class="text-purple bg-purple-1"
        >
          <q-item-section avatar>
            <q-icon name="mdi-spider-web" color="purple-7" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Loom</q-item-label>
            <q-item-label caption>Fleet topology</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Warp — fleet host configuration patterns, demo v2.5+ Fabrick -->
        <q-item
          v-if="isDemoMode && appStore.isDemoVersionAtLeast('2.5') && appStore.isFabrick"
          clickable to="/warp" active-class="text-brown-7 bg-brown-1"
        >
          <q-item-section avatar>
            <q-icon name="mdi-texture" color="brown-7" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Warp</q-item-label>
            <q-item-label caption>Host patterns</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="!appStore.isFabrick" clickable to="/weaver" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-view-dashboard" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Weaver</q-item-label>
            <q-item-label caption>Manage workloads</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="!appStore.isFabrick" clickable to="/network" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-lan" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Strands</q-item-label>
            <q-item-label caption>Local topology</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <!-- Shed — unified workload creation (Decision #92). Replaces New Workload button. Role-gated: hidden for Viewer/Auditor. -->
        <q-item v-if="authStore.canManageVms" clickable to="/shed" active-class="text-shed bg-shed-active">
          <q-item-section avatar>
            <q-icon name="mdi-door-open" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Shed</q-item-label>
            <q-item-label caption>New workloads</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <q-item v-if="authStore.canManageUsers" clickable to="/users" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-account-group" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Users</q-item-label>
            <q-item-label caption>Manage accounts</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Workload Groups — Fabrick v3.3+ -->
        <q-item
          v-if="isDemoMode && appStore.isDemoVersionAtLeast('3.3') && appStore.isFabrick"
          clickable to="/groups" active-class="text-primary bg-weaver-active"
        >
          <q-item-section avatar>
            <q-icon name="mdi-folder-account" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Groups</q-item-label>
            <q-item-label caption>Workload groups</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="authStore.isAdmin && appStore.isFabrick" clickable to="/audit" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-text-box-search" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Audit Log</q-item-label>
            <q-item-label caption>Activity history</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable to="/extensions" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-puzzle" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Extensions</q-item-label>
            <q-item-label caption>Integrated catalog</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge color="amber-8" :label="pluginCount" rounded />
          </q-item-section>
        </q-item>

        <q-item clickable to="/settings" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-cog" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Settings</q-item-label>
            <q-item-label caption>AI provider, preferences</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable to="/compliance" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-shield-check" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Compliance</q-item-label>
            <q-item-label caption>Standards, control mappings</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable to="/help" active-class="text-primary bg-weaver-active">
          <q-item-section avatar>
            <q-icon name="mdi-help-circle" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Help</q-item-label>
            <q-item-label caption>Guides, FAQ, tips</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Drawer footer -->
      <div class="absolute-bottom q-pa-md text-caption text-grey">
        <div>{{ appStore.orgDisplayName }} v{{ version }}</div>
        <div>&copy; {{ new Date().getFullYear() }} whizBANG Developers LLC</div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <ResourceDetailDrawer />
    <TuiPreview v-if="showTui" @close="showTui = false" />
    <MobilePreview v-if="showMobile" @close="showMobile = false" />
    <DemoLoginModal v-if="isPublicDemoMode" />
    <AddVmDialog v-model="showRegisterFromLayout" />
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar, useMeta } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'
import { useSettingsStore } from 'src/stores/settings-store'
import { useAppStore } from 'src/stores/app'
import { useUiStore } from 'src/stores/ui-store'
import { useKeyboardShortcuts } from 'src/composables/useKeyboardShortcuts'
import { useNotifications } from 'src/composables/useNotifications'
import NotificationBell from 'src/components/NotificationBell.vue'
import DemoToolbar from 'src/components/DemoToolbar.vue'
import TuiPreview from 'src/components/demo/TuiPreview.vue'
import MobilePreview from 'src/components/demo/MobilePreview.vue'
import DemoLoginModal from 'src/components/DemoLoginModal.vue'
import ResourceDetailDrawer from 'src/components/ResourceDetailDrawer.vue'
import AddVmDialog from 'src/components/AddVmDialog.vue'
import AccessInspectorDialog from 'src/components/AccessInspectorDialog.vue'
import { isWsConnected, onWsConnect, onWsDisconnect, onSessionKicked } from 'src/services/ws'
import { DEMO_HOSTS } from 'src/config/demo'
import { ROLES } from 'src/constants/vocabularies'

declare const __APP_VERSION__: string

const $q = useQuasar()
void $q // used via template
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const appStore = useAppStore()
const uiStore = useUiStore()
useKeyboardShortcuts()
useNotifications()

// Dynamic browser tab title based on current route
const pageTitle = computed(() => {
  const meta = route.meta as Record<string, unknown>
  if (meta.title) return meta.title as string
  // Workload detail page: show workload name with org context
  if (route.path.startsWith('/workload/') && route.params.name) {
    return `${appStore.orgDisplayName} — ${route.params.name as string}`
  }
  return appStore.orgDisplayName
})
useMeta(() => ({ title: pageTitle.value }))
const isDemoMode = !!import.meta.env.VITE_DEMO_MODE
const isPublicDemoMode = import.meta.env.VITE_DEMO_PUBLIC === 'true'
const showTui = ref(false)
const showMobile = ref(false)

function toggleTui() {
  showTui.value = !showTui.value
  if (showTui.value) showMobile.value = false
}

function toggleMobile() {
  showMobile.value = !showMobile.value
  if (showMobile.value) showTui.value = false
}
const leftDrawerOpen = ref(window.innerWidth >= 1440)
const showMobileSearch = ref(false)
const showRegisterFromLayout = ref(false)
const showInspectorDialog = ref(false)


const searchContext = computed(() => {
  const path = route.path
  if (path === '/fabrick' && appStore.fabrickDrillHostId) return { show: false, placeholder: '' }
  if (path === '/network' && appStore.fabrickDrillHostId) return { show: false, placeholder: '' }
  if (path === '/fabrick') return { show: true, placeholder: 'Search hosts & workloads...' }
  if (path === '/loom') return { show: true, placeholder: 'Search...' }
  if (path === '/weaver' && !isEnterpriseWeaverMode.value) return { show: true, placeholder: 'Search...' }
  if (path === '/network') return { show: true, placeholder: 'Search...' }
  return { show: false, placeholder: '' }
})
const wsConnected = ref(isDemoMode || isWsConnected())
onWsConnect(() => { wsConnected.value = true })
onWsDisconnect(() => { wsConnected.value = false })
onSessionKicked(() => {
  $q.notify({
    type: 'warning',
    message: 'Session ended — logged in from another location',
    timeout: 0,
    actions: [{ label: 'Dismiss', color: 'white' }],
  })
  void authStore.logout().then(() => router.push('/login'))
})
const isFabrickMode = computed(() =>
  route.path === '/fabrick' ||
  (route.path === '/network' && !!appStore.fabrickDrillHostId)
)
const isWeaverMode = computed(() => route.path === '/weaver')
const isEnterpriseWeaverMode = computed(() =>
  isWeaverMode.value && appStore.isFabrick && (!isDemoMode || appStore.isDemoVersionAtLeast('3.0'))
)
const isLoomMode = computed(() => route.path === '/loom')
const isWarpMode = computed(() => route.path === '/warp')
const isShedMode = computed(() => route.path === '/shed')
const headerBgClass = computed(() => {
  if (isLoomMode.value) return 'bg-purple'
  if (isWarpMode.value) return 'bg-brown-7'
  if (isShedMode.value) return 'bg-shed'
  if (isFabrickMode.value || isEnterpriseWeaverMode.value) return 'bg-fabrick'
  return 'bg-primary'
})

const inspectorChipLabel = computed(() => {
  if (appStore.inspectorType === 'viewer') return 'Viewer'
  return appStore.inspectorIdentity?.label ?? ''
})

const inspectorBannerLabel = computed(() => {
  if (appStore.inspectorType === ROLES.VIEWER) return 'Viewer role'
  if (appStore.inspectorType === 'user') return `${appStore.inspectorIdentity?.label} (${appStore.inspectorIdentity?.subLabel ?? 'user'})`
  if (appStore.inspectorType === 'group') return `${appStore.inspectorIdentity?.label} group`
  return ''
})

function toggleViewerInspector() {
  if (appStore.inspectorMode) {
    appStore.exitInspector()
  } else {
    appStore.activateViewerInspector()
  }
}

// Clear inspector when navigating away from Weaver
watch(() => route.path, () => {
  if (appStore.inspectorMode) appStore.exitInspector()
})
const appName = computed(() => {
  if (isLoomMode.value) return 'Loom'
  if (isWarpMode.value) return 'Warp'
  if (isShedMode.value) return 'Shed'
  if (isFabrickMode.value || isEnterpriseWeaverMode.value) return 'FabricK'
  // Decision #139: toolbar shows tier qualifier — Free, Solo, Team
  if (isDemoMode) {
    if (appStore.isWeaver && !appStore.isFabrick) {
      const suffix = appStore.demoWeaverSubTier === 'team' ? ' Team' : ' Solo'
      return `Weaver${suffix}`
    }
    if (appStore.isFree) return 'Weaver Free'
  }
  return appStore.orgDisplayName
})
const headerLogoUrl = computed(() => appStore.organization?.logoUrl || null)
const appIcon = computed(() => {
  if (isLoomMode.value) return 'mdi-spider-web'
  if (isWarpMode.value) return 'mdi-texture'
  if (isShedMode.value) return 'mdi-door-open'
  if (isFabrickMode.value || isEnterpriseWeaverMode.value) return 'mdi-view-grid'
  return 'mdi-server-network'
})
// Clear drill state when navigating away from Fabrick
watch(() => route.path, (path) => {
  if (path !== '/fabrick') appStore.setFabrickDrill(null)
})

const fabrickDrillHostname = computed(() => {
  const id = appStore.fabrickDrillHostId
  if (!id) return ''
  return DEMO_HOSTS.find(h => h.id === id)?.hostname ?? id
})




const version = __APP_VERSION__

const PLUGIN_TIER_LEVEL: Record<string, number> = { demo: 0, free: 1, weaver: 2, fabrick: 3 }
const pluginCount = computed(() => {
  const level = PLUGIN_TIER_LEVEL[appStore.effectiveTier] ?? 0
  return appStore.availablePlugins.filter(p =>
    (PLUGIN_TIER_LEVEL[p.minimumTier] ?? 0) <= level &&
    !(p.replacedByFabrick && level >= PLUGIN_TIER_LEVEL.fabrick)
  ).length
})

const roleBadgeColor = computed(() => {
  switch (authStore.userRole) {
    case ROLES.ADMIN: return 'purple'
    case ROLES.OPERATOR: return 'teal'
    case ROLES.VIEWER: return 'grey-7'
    default: return 'grey'
  }
})

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

const darkModeIcon = computed(() => {
  switch (settingsStore.darkMode) {
    case 'dark': return 'mdi-weather-night'
    case 'light': return 'mdi-weather-sunny'
    default: return 'mdi-theme-light-dark'
  }
})

const darkModeTooltip = computed(() => {
  switch (settingsStore.darkMode) {
    case 'dark': return 'Dark mode (click to switch to auto)'
    case 'light': return 'Light mode (click to switch to dark)'
    default: return 'Auto theme (click to switch to light)'
  }
})


async function handleLogout() {
  await authStore.logout()
  await router.push('/login')
}

</script>

<style scoped lang="scss">
// Push all fixed layout elements below the full-width demo bar.
// margin-top is additive to Quasar's own top/padding-top inline styles
// because Quasar never touches margin.
.demo-layout {
  :deep(.q-header)         { margin-top: 51px; }
  :deep(.q-drawer)         { margin-top: 51px; }
  :deep(.q-page-container) { margin-top: 51px; }
}

.toolbar-search {
  width: 220px;
  max-width: 220px;
  min-width: 120px;
  flex-shrink: 1;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;

  :deep(input::placeholder) {
    color: rgba(255, 255, 255, 0.7);
  }
}

.toolbar-strands-btn {
  width: 220px;
  max-width: 220px;
  min-width: 120px;
  flex-shrink: 1;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.body--dark {
  .bg-fabrick-active {
    background: rgba(46, 92, 200, 0.2) !important;
  }
}
</style>
