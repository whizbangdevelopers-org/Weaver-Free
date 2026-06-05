<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="open">
    <q-card style="min-width: 380px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="mdi-account-plus" class="q-mr-xs" color="primary" />
          Add Engram user
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
          :rules="[emailRule]"
          @keyup.enter="canSubmit ? onSubmit() : undefined"
        >
          <template #prepend><q-icon name="mdi-email-outline" /></template>
        </q-input>
        <q-input
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          outlined
          dense
          class="q-mb-sm"
          @keyup.enter="canSubmit ? onSubmit() : undefined"
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
        <q-input
          v-model="confirm"
          label="Confirm password"
          :type="showPassword ? 'text' : 'password'"
          outlined
          dense
          :rules="[confirmRule]"
          @keyup.enter="canSubmit ? onSubmit() : undefined"
        >
          <template #prepend><q-icon name="mdi-lock-check-outline" /></template>
        </q-input>

        <div v-if="errorMsg" class="text-negative text-caption q-mt-sm">
          {{ errorMsg }}
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="open = false" />
        <q-btn
          color="primary"
          label="Add user"
          :loading="loading"
          :disable="!canSubmit"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  submit: [email: string, password: string]
}>()

const open = ref(props.modelValue)
const email = ref('')
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const errorMsg = ref('')

watch(() => props.modelValue, (v) => { open.value = v })
watch(open, (v) => {
  emit('update:modelValue', v)
  if (!v) reset()
})

function emailRule(v: string): boolean | string {
  if (!v || !v.trim()) return 'Email is required'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Enter a valid email'
}

function confirmRule(v: string): boolean | string {
  return v === password.value || 'Passwords do not match'
}

const canSubmit = computed(
  () =>
    emailRule(email.value) === true &&
    password.value.length > 0 &&
    confirm.value === password.value,
)

function onSubmit() {
  if (!canSubmit.value) return
  errorMsg.value = ''
  emit('submit', email.value.trim(), password.value)
}

function reset() {
  email.value = ''
  password.value = ''
  confirm.value = ''
  showPassword.value = false
  errorMsg.value = ''
}

function setError(msg: string) {
  errorMsg.value = msg
}

defineExpose({ setError })
</script>
