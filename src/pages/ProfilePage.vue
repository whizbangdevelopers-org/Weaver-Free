<!--
  Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.

  User profile page — appearance, account, BYOK AI key, help preferences.
  FabricK operators see their assigned workloads (My Workloads).
-->
<template>
  <q-page padding>
    <div class="text-h4 q-mb-lg">
      <q-icon name="mdi-account-circle" class="q-mr-sm" />
      Profile
    </div>

    <!-- Account -->
    <q-card flat bordered class="q-mb-lg" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="mdi-account" class="q-mr-sm" />
          Account
        </div>

        <div class="q-gutter-md">
          <div class="row items-center q-gutter-sm">
            <q-icon name="mdi-account-circle" size="40px" color="primary" />
            <div>
              <div class="text-body1 text-weight-medium">{{ authStore.displayName }}</div>
              <q-badge :color="roleBadgeColor" :label="authStore.userRole" rounded class="text-capitalize" />
            </div>
          </div>

          <q-separator />

          <q-select
            v-model="sectorValue"
            label="Work Sector"
            outlined
            dense
            :options="sectorOptions"
            emit-value
            map-options
            data-testid="sector-select"
            @update:model-value="onSectorChange"
          />
          <div class="text-caption text-grey-8">
            Sector data is stored locally on this server and is never transmitted externally.
          </div>

          <q-separator />

          <div class="text-subtitle2">Change Password</div>
          <q-input
            v-model="currentPassword"
            label="Current password"
            outlined dense
            :type="showCurrentPw ? 'text' : 'password'"
            :error="!!pwError" :error-message="pwError"
          >
            <template #append>
              <q-icon :name="showCurrentPw ? 'mdi-eye-off' : 'mdi-eye'" class="cursor-pointer" @click="showCurrentPw = !showCurrentPw" />
            </template>
          </q-input>
          <q-input
            v-model="newPassword"
            label="New password"
            outlined dense
            :type="showNewPw ? 'text' : 'password'"
          >
            <template #append>
              <q-icon :name="showNewPw ? 'mdi-eye-off' : 'mdi-eye'" class="cursor-pointer" @click="showNewPw = !showNewPw" />
            </template>
          </q-input>
          <q-input
            v-model="confirmPassword"
            label="Confirm new password"
            outlined dense
            type="password"
            :error="!!confirmError" :error-message="confirmError"
          />
          <q-btn
            unelevated color="primary" label="Change Password"
            icon="mdi-lock-reset"
            :disable="!currentPassword || !newPassword || !confirmPassword"
            :loading="changingPw"
            @click="doChangePassword"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Appearance -->
    <q-card flat bordered class="q-mb-lg" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="mdi-palette" class="q-mr-sm" />
          Appearance
        </div>

        <div class="q-gutter-md">
          <div class="text-subtitle2 q-mb-sm">Theme</div>
          <q-btn-toggle
            :model-value="settingsStore.darkMode"
            toggle-color="primary"
            :options="[
              { label: 'Auto', value: 'auto', icon: 'mdi-theme-light-dark' },
              { label: 'Light', value: 'light', icon: 'mdi-weather-sunny' },
              { label: 'Dark', value: 'dark', icon: 'mdi-weather-night' },
            ]"
            @update:model-value="settingsStore.setDarkMode($event)"
            spread no-caps
          />
          <div class="text-caption text-grey-8 q-ml-sm">
            Auto follows your system preference. Changes are saved automatically.
          </div>

          <q-separator class="q-my-md" />

          <div class="text-subtitle2 q-mb-sm">Infrastructure Defaults</div>
          <q-toggle
            :model-value="settingsStore.sidebarVmSectionOpen"
            label="Expand sections by default"
            @update:model-value="settingsStore.sidebarVmSectionOpen = $event; settingsStore.sidebarContainerSectionOpen = $event"
          />
          <div class="q-mt-sm">
            <div class="text-caption text-grey-7 q-mb-xs">Default sort order</div>
            <q-btn-toggle
              :model-value="uiStore.sortPreference === 'name-desc' ? 'name-desc' : 'name-asc'"
              toggle-color="primary"
              :options="[
                { label: 'A-Z', value: 'name-asc', icon: 'mdi-sort-alphabetical-ascending' },
                { label: 'Z-A', value: 'name-desc', icon: 'mdi-sort-alphabetical-descending' },
              ]"
              unelevated no-caps
              @update:model-value="uiStore.setSortPreference($event)"
            />
          </div>

          <q-separator class="q-my-md" />

          <div class="text-subtitle2 q-mb-sm">Network Topology defaults</div>
          <div class="text-caption text-grey-7 q-mb-sm">Default side for each group in the topology graph.</div>
          <q-btn-toggle
            :model-value="settingsStore.topologyVmsSide"
            :options="[{ label: 'VMs left, Containers right', value: 'left' }, { label: 'Containers left, VMs right', value: 'right' }]"
            unelevated toggle-color="primary" color="grey-3" text-color="dark" size="sm"
            @update:model-value="settingsStore.topologyVmsSide = $event"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Help Preferences -->
    <q-card flat bordered class="q-mb-lg" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="mdi-help-circle" class="q-mr-sm" />
          Help Preferences
        </div>

        <div class="q-gutter-md">
          <q-toggle
            :model-value="settingsStore.showHelpTooltips"
            label="Show contextual help tooltips"
            @update:model-value="settingsStore.toggleHelpTooltips($event)"
          />
          <div class="text-caption text-grey-8 q-ml-lg">
            When enabled, small help icons appear next to form fields and section headers throughout the UI.
          </div>

        </div>
      </q-card-section>
    </q-card>

    <!-- My Workloads (FabricK operators only) -->
    <q-card v-if="appStore.isFabrick && !authStore.isAdmin" flat bordered class="q-mb-lg" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="mdi-server-security" class="q-mr-sm" />
          My Workloads
          <q-badge color="amber-9" label="FabricK" class="q-ml-sm" />
        </div>

        <div v-if="aclLoading" class="text-center q-pa-md">
          <q-spinner-dots size="24px" color="primary" />
        </div>

        <div v-else-if="assignedVms.length === 0" class="q-gutter-sm">
          <q-icon name="mdi-check-circle" color="positive" size="20px" />
          <span class="text-body2 text-grey-7">No restrictions — you have access to all workloads on this host.</span>
        </div>

        <div v-else class="q-gutter-sm">
          <div class="text-caption text-grey-8 q-mb-sm">
            Your access is restricted to the following workloads:
          </div>
          <q-chip
            v-for="name in assignedVms"
            :key="name"
            icon="mdi-cube-outline"
            color="primary"
            text-color="white"
            dense
          >{{ name }}</q-chip>
        </div>
      </q-card-section>
    </q-card>

  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useSettingsStore } from 'src/stores/settings-store'
import { useUiStore } from 'src/stores/ui-store'
import { useAppStore } from 'src/stores/app'
import { useAuthStore, SECTOR_OPTIONS, type SectorId } from 'src/stores/auth-store'
import { isDemoMode } from 'src/config/demo-mode'
import { api } from 'src/boot/axios'

const $q = useQuasar()
const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const appStore = useAppStore()
const authStore = useAuthStore()

// --- Account ---
const sectorOptions = SECTOR_OPTIONS
const sectorValue = ref<SectorId | null>(authStore.user?.sector ?? null)

async function onSectorChange(value: SectorId) {
  try {
    await authStore.updateSector(value)
    $q.notify({ type: 'positive', message: 'Sector updated', position: 'top-right', timeout: 3000 })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update sector', position: 'top-right', timeout: 3000 })
    sectorValue.value = authStore.user?.sector ?? null
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrentPw = ref(false)
const showNewPw = ref(false)
const changingPw = ref(false)
const pwError = ref('')
const confirmError = ref('')

async function doChangePassword() {
  pwError.value = ''
  confirmError.value = ''
  if (newPassword.value !== confirmPassword.value) {
    confirmError.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 14) {
    confirmError.value = 'Password must be at least 14 characters'
    return
  }
  changingPw.value = true
  try {
    await authStore.changePassword(currentPassword.value, newPassword.value)
    $q.notify({ type: 'positive', message: 'Password changed successfully', position: 'top-right', timeout: 3000 })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch {
    pwError.value = 'Current password is incorrect'
  } finally {
    changingPw.value = false
  }
}

const roleBadgeColor = computed(() => {
  switch (authStore.userRole) {
    case 'admin': return 'negative'
    case 'operator': return 'primary'
    default: return 'grey-6'
  }
})

// --- My Workloads (FabricK operators) ---
const assignedVms = ref<string[]>([])
const aclLoading = ref(false)

async function loadMyWorkloads() {
  if (!appStore.isFabrick || authStore.isAdmin) return
  aclLoading.value = true
  try {
    if (isDemoMode()) {
      assignedVms.value = ['web-nginx', 'web-app']
    } else {
      const userId = authStore.user?.id
      if (!userId) return
      const { data } = await api.get<{ vmNames: string[] }>(`/users/${userId}/vms`)
      assignedVms.value = data.vmNames
    }
  } catch {
    assignedVms.value = []
  } finally {
    aclLoading.value = false
  }
}

onMounted(() => {
  void loadMyWorkloads()
})
</script>
