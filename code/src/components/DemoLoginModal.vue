<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="visible" persistent>
    <q-card class="demo-login-card q-pa-sm" style="min-width: 360px; max-width: 440px">
      <q-card-section class="text-center q-pb-sm">
        <q-icon name="mdi-server-network" size="48px" color="primary" />
        <div class="text-h6 q-mt-sm">Weaver</div>
        <div class="text-caption text-grey-6">Sign in to manage your virtual machines</div>
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-sm">
        <q-input
          model-value="admin"
          label="Username"
          outlined
          dense
          readonly
          prepend-icon="mdi-account"
        >
          <template #prepend><q-icon name="mdi-account" /></template>
        </q-input>
        <q-input
          model-value="••••••••"
          label="Password"
          outlined
          dense
          readonly
          type="password"
        >
          <template #prepend><q-icon name="mdi-lock" /></template>
        </q-input>

        <q-banner dense rounded class="bg-blue-1 text-blue-9 q-mt-xs" style="font-size: 12px">
          <template #avatar><q-icon name="mdi-information" color="blue-7" /></template>
          Credentials are pre-filled. This is a live interactive demo.
        </q-banner>

        <q-btn
          color="primary"
          label="Log In"
          icon="mdi-login"
          class="full-width q-mt-sm"
          size="md"
          :loading="entering"
          @click="enter"
        />
      </q-card-section>

      <q-card-section class="text-center q-pt-xs q-pb-sm">
        <div class="text-caption text-grey-5">
          All changes reset on page reload &nbsp;·&nbsp; No backend required
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const STORAGE_KEY = 'microvm-demo-login-dismissed'

const visible = ref(!localStorage.getItem(STORAGE_KEY))
const entering = ref(false)

function enter() {
  entering.value = true
  // Brief delay so the button loading state is visible
  setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    visible.value = false
    entering.value = false
  }, 600)
}
</script>

<style scoped lang="scss">
.demo-login-card {
  border-radius: 12px;
}
</style>
