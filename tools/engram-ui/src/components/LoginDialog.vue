<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 380px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="mdi-memory" class="q-mr-xs" color="primary" />
          Sign in to Engram
        </div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="email"
          label="Email"
          type="email"
          outlined
          dense
          class="q-mb-sm"
          autofocus
          @keyup.enter="password ? onSubmit() : undefined"
        >
          <template #prepend><q-icon name="mdi-email-outline" /></template>
        </q-input>
        <q-input
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          outlined
          dense
          @keyup.enter="onSubmit"
        >
          <template #prepend><q-icon name="mdi-lock-outline" /></template>
          <template #append>
            <q-icon
              :name="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <div v-if="errorMsg" class="text-negative text-caption q-mt-sm">
          {{ errorMsg }}
        </div>

        <div class="text-caption text-grey-6 q-mt-md">
          Default credentials: <code>default_user@example.com</code> / <code>default_password</code>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Skip" @click="emit('skip')" />
        <q-btn
          color="primary"
          label="Sign in"
          :loading="loading"
          :disable="!email.trim() || !password"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  submit: [email: string, password: string]
  skip: []
}>()

const open = ref(props.modelValue)
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMsg = ref('')

watch(() => props.modelValue, (v) => { open.value = v })
watch(open, (v) => emit('update:modelValue', v))

function onSubmit() {
  if (!email.value.trim() || !password.value) return
  errorMsg.value = ''
  emit('submit', email.value.trim(), password.value)
}

function setError(msg: string) {
  errorMsg.value = msg
}

defineExpose({ setError })
</script>
