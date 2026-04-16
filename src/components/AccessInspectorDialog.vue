<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card style="min-width: 480px; max-width: 540px;">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="mdi-account-search" size="20px" color="primary" class="q-mr-sm" />
        <span class="text-h6">View as</span>
        <q-space />
        <q-btn flat round dense icon="mdi-close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-sm q-pb-xs">
        <p class="text-caption text-grey-6 q-mb-none">
          Select a user or group to inspect their scope and AI policy enforcement on this host.
          Read-only — no actions can be taken while inspecting.
        </p>
      </q-card-section>

      <q-tabs v-model="tab" dense align="left" class="q-px-md">
        <q-tab name="users" icon="mdi-account" label="Users" />
        <q-tab name="groups" icon="mdi-account-group" label="Groups" />
      </q-tabs>
      <q-separator />

      <q-tab-panels v-model="tab" animated style="min-height: 260px;">

        <!-- Users tab -->
        <q-tab-panel name="users" class="q-pa-none">
          <q-list separator>
            <q-item
              v-for="user in DEMO_INSPECTOR_USERS"
              :key="user.id"
              clickable
              @click="selectUser(user)"
              v-close-popup
            >
              <q-item-section avatar>
                <q-avatar :color="roleColor(user.role)" text-color="white" size="36px" font-size="14px">
                  {{ user.name[0] }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ user.name }}</q-item-label>
                <q-item-label caption>
                  <q-badge :color="roleColor(user.role)" :label="user.role" rounded class="q-mr-xs text-capitalize" />
                  <span class="text-grey-6">{{ user.groups.length }} group{{ user.groups.length !== 1 ? 's' : '' }}</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-chip
                    v-for="gid in user.groups"
                    :key="gid"
                    dense size="sm"
                    :color="groupChipColor(gid)"
                    text-color="white"
                  >{{ groupLabel(gid) }}</q-chip>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <!-- Groups tab -->
        <q-tab-panel name="groups" class="q-pa-none">
          <q-list separator>
            <q-item
              v-for="group in DEMO_INSPECTOR_GROUPS"
              :key="group.id"
              clickable
              @click="selectGroup(group)"
              v-close-popup
            >
              <q-item-section avatar>
                <q-icon name="mdi-account-group" size="24px" :color="aiPolicyColor(group.aiPolicy)" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ group.name }}</q-item-label>
                <q-item-label caption>
                  <span class="text-grey-6">{{ group.memberCount }} members · {{ group.workloadCount }} workloads</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="column items-end q-gutter-xs">
                  <!-- Compliance framework tags -->
                  <div v-if="group.frameworks.length" class="row q-gutter-xs">
                    <q-badge
                      v-for="f in group.frameworks"
                      :key="f"
                      color="blue-grey-7"
                      :label="f.toUpperCase()"
                      rounded
                    />
                  </div>
                  <!-- AI policy badge -->
                  <q-badge
                    :color="aiPolicyColor(group.aiPolicy)"
                    :label="aiPolicyLabel(group.aiPolicy)"
                    rounded
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from 'src/stores/app'
import {
  DEMO_INSPECTOR_USERS,
  DEMO_INSPECTOR_GROUPS,
  type DemoInspectorUser,
  type DemoInspectorGroup,
} from 'src/config/demo'

defineProps<{ modelValue: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const appStore = useAppStore()
const tab = ref<'users' | 'groups'>('users')

function selectUser(user: DemoInspectorUser) {
  appStore.activateIdentityInspector('user', user.id, user.name, user.role)
}

function selectGroup(group: DemoInspectorGroup) {
  const subLabel = group.frameworks.length
    ? group.frameworks.map(f => f.toUpperCase()).join(' · ')
    : 'no framework'
  appStore.activateIdentityInspector('group', group.id, group.name, subLabel)
}

function groupLabel(groupId: string): string {
  return DEMO_INSPECTOR_GROUPS.find(g => g.id === groupId)?.name ?? groupId
}

function groupChipColor(groupId: string): string {
  const g = DEMO_INSPECTOR_GROUPS.find(g => g.id === groupId)
  if (!g) return 'grey-7'
  return aiPolicyColor(g.aiPolicy)
}

function roleColor(role: string): string {
  switch (role) {
    case 'admin':    return 'purple'
    case 'operator': return 'teal'
    case 'auditor':  return 'blue-7'
    default:         return 'grey-7'
  }
}

function aiPolicyColor(policy: string): string {
  switch (policy) {
    case 'claude-only': return 'orange-8'
    case 'local-only':  return 'red-8'
    case 'allow-all':   return 'green-7'
    default:            return 'grey-7'
  }
}

function aiPolicyLabel(policy: string): string {
  switch (policy) {
    case 'claude-only': return 'Claude only'
    case 'local-only':  return 'Local / air-gap'
    case 'allow-all':   return 'Allow all'
    default:            return 'No AI policy'
  }
}
</script>
