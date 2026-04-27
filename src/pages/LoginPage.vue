<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column items-center justify-center" style="min-height: 100vh">
    <q-card class="login-card" flat bordered>
      <q-card-section class="text-center q-pb-none">
        <img v-if="orgLogoUrl" :src="orgLogoUrl" alt="Logo" style="max-height: 48px; max-width: 200px; object-fit: contain" />
        <q-icon v-else name="mdi-server-network" size="48px" color="primary" />
        <div class="text-h5 q-mt-sm">{{ loginTitle }}</div>
        <div v-if="loginSubtitle" class="text-subtitle2 text-grey-8 q-mt-xs">{{ loginSubtitle }}</div>
        <div class="text-caption text-grey-8 q-mt-xs">
          {{ isSetup ? 'Create Admin Account' : 'Sign In' }}
        </div>
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="onSubmit" class="q-gutter-y-md">
          <q-input
            v-model="username"
            label="Username"
            filled
            :rules="usernameRules"
            :lazy-rules="!isSetup"
            :counter="isSetup"
            :maxlength="isSetup ? 32 : undefined"
            autocomplete="username"
            data-testid="username-input"
            @update:model-value="(v: string | number | null) => username = String(v ?? '').toLowerCase()"
          >
            <template #prepend>
              <q-icon name="mdi-account" />
            </template>
          </q-input>

          <!-- Dynamic username compliance checklist (setup only) -->
          <div v-if="isSetup && username.length > 0" class="password-checklist q-pl-sm q-pr-sm">
            <div
              v-for="item in usernameChecklist"
              :key="item.id"
              class="row items-center q-gutter-xs text-caption"
              :class="item.pass ? 'text-positive' : 'text-grey-8'"
            >
              <q-icon
                :name="item.pass ? 'mdi-check-circle' : 'mdi-circle-outline'"
                size="16px"
              />
              <span>{{ item.label }}</span>
            </div>
          </div>

          <q-input
            v-if="isSetup"
            v-model="confirmUsername"
            label="Confirm Username"
            filled
            :rules="[val => val === username || 'Usernames do not match']"
            lazy-rules
            autocomplete="off"
            data-testid="confirm-username-input"
            @update:model-value="(v: string | number | null) => confirmUsername = String(v ?? '').toLowerCase()"
          >
            <template #prepend>
              <q-icon name="mdi-account-check" />
            </template>
          </q-input>

          <q-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            filled
            :rules="passwordRules"
            :lazy-rules="!isSetup"
            :counter="isSetup"
            :maxlength="isSetup ? 128 : undefined"
            :autocomplete="isSetup ? 'new-password' : 'current-password'"
            data-testid="password-input"
          >
            <template #prepend>
              <q-icon name="mdi-lock" />
            </template>
            <template #append>
              <q-icon
                :name="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <!-- Dynamic password compliance checklist (setup only) -->
          <div v-if="isSetup && password.length > 0" class="password-checklist q-pl-sm q-pr-sm">
            <div
              v-for="item in passwordChecklist"
              :key="item.id"
              class="row items-center q-gutter-xs text-caption"
              :class="item.pass ? 'text-positive' : 'text-grey-8'"
            >
              <q-icon
                :name="item.pass ? 'mdi-check-circle' : 'mdi-circle-outline'"
                size="16px"
              />
              <span>{{ item.label }}</span>
            </div>
          </div>

          <q-input
            v-if="isSetup"
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            label="Confirm Password"
            filled
            :rules="[val => val === password || 'Passwords do not match']"
            lazy-rules
            autocomplete="new-password"
            data-testid="confirm-password-input"
          >
            <template #prepend>
              <q-icon name="mdi-lock-check" />
            </template>
          </q-input>

          <q-select
            v-if="isSetup"
            v-model="sector"
            label="What sector do you work in?"
            filled
            :options="sectorOptions"
            emit-value
            map-options
            :rules="[val => !!val || 'Please select your sector']"
            lazy-rules
            data-testid="sector-select"
          >
            <template #prepend>
              <q-icon name="mdi-domain" />
            </template>
          </q-select>
          <div v-if="isSetup" class="text-caption text-grey-8 q-mt-none" style="margin-top: -8px">
            This helps us personalize your experience. Sector data is stored locally on this server and is never transmitted externally.
            You can change this later in Settings.
          </div>

          <div v-if="isSetup" class="row items-center q-gutter-sm" style="margin-top: 4px">
            <q-checkbox
              v-model="tosAccepted"
              :disable="!hasScrolledToBottom"
              color="primary"
              data-testid="tos-checkbox"
            />
            <a class="text-primary cursor-pointer text-caption" data-testid="tos-link" @click="openTosDialog">Read Terms of Service</a>
          </div>

          <q-banner v-if="errorMessage" class="bg-negative text-white" rounded dense>
            <template #avatar>
              <q-icon name="mdi-alert-circle" />
            </template>
            {{ errorMessage }}
          </q-banner>

          <q-btn
            type="submit"
            color="primary"
            :label="isLockedOut ? `Locked (${lockoutRemaining}s)` : isSetup ? 'Create Admin Account' : 'Sign In'"
            class="full-width"
            :loading="loading"
            :disable="isLockedOut || (isSetup && !tosAccepted)"
            data-testid="submit-btn"
          />

          <div v-if="!isSetup" class="text-center">
            <a class="text-caption text-primary cursor-pointer" data-testid="forgot-password-link" @click="showForgotPassword = true">
              Forgot password?
            </a>
          </div>
        </q-form>
      </q-card-section>

      <q-card-section v-if="isSetup" class="text-center q-pt-none">
        <div class="text-caption text-grey-8">
          This is the first-time setup. The account you create will have admin privileges.
        </div>
      </q-card-section>

      <q-dialog v-model="showTosDialog">
        <q-card style="width: 640px; max-width: 95vw">
          <q-toolbar>
            <q-toolbar-title class="text-subtitle1">Terms of Service</q-toolbar-title>
            <q-btn flat round dense icon="mdi-close" v-close-popup data-testid="tos-dialog-close" />
          </q-toolbar>
          <q-separator />
          <div
            ref="tosScrollRef"
            style="max-height: 55vh; overflow-y: auto; padding: 16px"
            data-testid="tos-scroll-area"
            @scroll="onTosScroll"
          >
            <div class="tos-content" v-html="tosHtml" />
            <div style="height: 1px" data-testid="tos-sentinel" />
          </div>
          <q-separator />
          <q-card-actions align="right">
            <span v-if="!hasScrolledToBottom" class="text-caption text-grey-6 q-mr-sm">Scroll to read all terms</span>
            <q-btn flat label="Close" v-close-popup />
            <q-btn
              label="I Agree"
              color="primary"
              :disable="!hasScrolledToBottom"
              data-testid="tos-agree-btn"
              @click="tosAccepted = true; showTosDialog = false"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="showForgotPassword">
        <q-card style="max-width: 420px">
          <q-card-section>
            <div class="text-h6">Password Recovery</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <template v-if="tier === TIERS.FREE || tier === TIERS.DEMO">
              <p>If you have root access on the host, run:</p>
              <q-banner class="bg-grey-2 text-body2" rounded dense>
                <code>sudo weaver-reset-password</code>
              </q-banner>
              <p class="q-mt-sm text-caption text-grey-8">
                This will prompt for a username and new password, then update the password directly.
              </p>
            </template>
            <template v-else>
              <p>Contact your system administrator to reset your password.</p>
              <p class="text-caption text-grey-8">
                Admins can reset passwords from the Users page or via the CLI on the host.
              </p>
            </template>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </q-card>
    <p class="text-caption text-grey-6 q-mt-sm q-mb-none">
      &copy; {{ new Date().getFullYear() }} whizBANG Developers LLC. All rights reserved.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import tosText from '../../docs/legal/TERMS-OF-SERVICE.md?raw'
import { useAuthStore, SECTOR_OPTIONS, type SectorId } from 'src/stores/auth-store'
import { api } from 'src/boot/axios'
import { isDemoMode } from 'src/config/demo-mode'
import { TIERS, TIER_LABELS, type TierName } from 'src/constants/vocabularies'

const router = useRouter()
const authStore = useAuthStore()

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_SECONDS = 30

const username = ref('')
const confirmUsername = ref('')
const password = ref('')
const confirmPassword = ref('')
const sector = ref<SectorId | null>(null)
const sectorOptions = SECTOR_OPTIONS
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const isSetup = ref(false)
const tosAccepted = ref(false)
const tosHtml = computed(() => new MarkdownIt({ html: false, linkify: true, typographer: false }).render(tosText))
const showTosDialog = ref(false)
const hasScrolledToBottom = ref(false)
const tosScrollRef = ref<HTMLDivElement | null>(null)
const attempts = ref(0)
const lockedUntil = ref<number | null>(null)
const lockoutRemaining = ref(0)
const tier = ref<string>(TIERS.FREE)

// Login screen title/subtitle logic:
// - Free tier, no org: title = "Weaver Free", no subtitle
// - Solo/Team/Fabrick, no org: title = "Weaver Solo" / "FabricK", no subtitle
// - Free tier, branded: title = org name, no subtitle (Free tier never shows tier badge)
// - Solo/Team/Fabrick, branded: title = org name, subtitle = tier label
const loginTitle = computed(() => {
  if (orgName.value) return orgName.value
  return TIER_LABELS[tier.value as TierName] ?? 'Weaver'
})
const loginSubtitle = computed<string | null>(() => {
  if (!orgName.value) return null
  if (tier.value === TIERS.FREE || tier.value === TIERS.DEMO) return null
  return TIER_LABELS[tier.value as TierName] ?? null
})
const orgName = ref('')
const orgLogoUrl = ref('')
const showForgotPassword = ref(false)

const usernameRules = computed(() => {
  const rules: ((val: string) => boolean | string)[] = [
    (val: string) => !!val || 'Username is required',
  ]
  if (isSetup.value) {
    rules.push(
      (val: string) => val.length >= 3 || 'Username must be at least 3 characters',
      (val: string) => /^[a-z]/.test(val) || 'Username must start with a letter',
      (val: string) => /^[a-z][a-z0-9_-]*$/.test(val) || 'Only lowercase letters, digits, hyphens, and underscores',
    )
  }
  return rules
})

const passwordRules = computed(() => {
  const rules: ((val: string) => boolean | string)[] = [
    (val: string) => !!val || 'Password is required',
  ]
  if (isSetup.value) {
    rules.push(
      (val: string) => val.length >= 14 || 'Password must be at least 14 characters',
      (val: string) => /[A-Z]/.test(val) || 'Must contain at least one uppercase letter',
      (val: string) => /[a-z]/.test(val) || 'Must contain at least one lowercase letter',
      (val: string) => /[0-9]/.test(val) || 'Must contain at least one digit',
      (val: string) => /[^A-Za-z0-9]/.test(val) || 'Must contain at least one special character',
      (val: string) => !containsUsername(val, username.value) || 'Password must not contain the username',
    )
  }
  return rules
})

function containsUsername(pwd: string, user: string): boolean {
  if (!pwd || !user || user.length < 3) return false
  return pwd.toLowerCase().includes(user.toLowerCase())
}

const passwordChecklist = computed(() => {
  const val = password.value
  const user = username.value
  return [
    { id: 'length', label: 'At least 14 characters', pass: val.length >= 14 },
    { id: 'upper', label: 'At least one uppercase letter', pass: /[A-Z]/.test(val) },
    { id: 'lower', label: 'At least one lowercase letter', pass: /[a-z]/.test(val) },
    { id: 'digit', label: 'At least one digit', pass: /[0-9]/.test(val) },
    { id: 'special', label: 'At least one special character', pass: /[^A-Za-z0-9]/.test(val) },
    { id: 'no-username', label: 'Does not contain username', pass: !containsUsername(val, user) },
  ]
})

const usernameChecklist = computed(() => {
  const val = username.value
  return [
    { id: 'length', label: 'At least 3 characters', pass: val.length >= 3 },
    { id: 'starts-letter', label: 'Starts with a letter', pass: /^[a-z]/.test(val) },
    { id: 'allowed-chars', label: 'Lowercase letters, digits, hyphens, underscores only', pass: /^[a-z][a-z0-9_-]*$/.test(val) },
  ]
})

function openTosDialog() {
  hasScrolledToBottom.value = false
  showTosDialog.value = true
}

function onTosScroll() {
  const el = tosScrollRef.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
    hasScrolledToBottom.value = true
  }
}

onMounted(async () => {
  // If already authenticated, redirect to dashboard
  if (authStore.isAuthenticated) {
    await router.replace('/weaver')
    return
  }

  // Demo mode: skip all backend calls
  if (isDemoMode()) {
    isSetup.value = false
    tier.value = TIERS.DEMO
    return
  }

  // Check if this is first-run setup (critical — must not fail)
  try {
    const response = await api.get('/auth/setup-required')
    isSetup.value = response.data.setupRequired
  } catch {
    // If backend is unreachable, show login form
    isSetup.value = false
  }

  // Fetch tier for password recovery hint (non-critical, independent)
  try {
    const healthResponse = await api.get('/health')
    const healthData = healthResponse.data as { tier?: string; organization?: { name?: string; logoUrl?: string | null } }
    tier.value = healthData.tier ?? TIERS.FREE
    orgName.value = healthData.organization?.name ?? ''
    orgLogoUrl.value = healthData.organization?.logoUrl ?? ''
  } catch {
    // Default to free-tier hint if health endpoint unreachable
  }
})

function startLockout() {
  lockedUntil.value = Date.now() + LOCKOUT_SECONDS * 1000
  lockoutRemaining.value = LOCKOUT_SECONDS
  const timer = setInterval(() => {
    if (!lockedUntil.value) {
      clearInterval(timer)
      return
    }
    const remaining = Math.ceil((lockedUntil.value - Date.now()) / 1000)
    if (remaining <= 0) {
      lockedUntil.value = null
      lockoutRemaining.value = 0
      attempts.value = 0
      errorMessage.value = ''
      clearInterval(timer)
    } else {
      lockoutRemaining.value = remaining
    }
  }, 1000)
}

const isLockedOut = computed(() => !!lockedUntil.value)

async function onSubmit() {
  if (isLockedOut.value) return
  if (isSetup.value && !tosAccepted.value) {
    errorMessage.value = 'You must agree to the Terms of Service to continue'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    if (isSetup.value) {
      if (username.value !== confirmUsername.value) {
        errorMessage.value = 'Usernames do not match'
        return
      }
      if (password.value !== confirmPassword.value) {
        errorMessage.value = 'Passwords do not match'
        return
      }
      await authStore.register(username.value, password.value, sector.value || undefined)
    } else {
      await authStore.login(username.value, password.value)
      attempts.value = 0
    }
  } catch (err: unknown) {
    if (!isSetup.value) {
      attempts.value++
      if (attempts.value >= MAX_LOGIN_ATTEMPTS) {
        errorMessage.value = `Too many failed attempts. Try again in ${LOCKOUT_SECONDS} seconds.`
        password.value = ''
        startLockout()
        return
      }
      const remaining = MAX_LOGIN_ATTEMPTS - attempts.value
      const axiosErr = err as { response?: { data?: { error?: string; details?: string[] } } }
      const data = axiosErr.response?.data
      const base = data?.error ?? 'Invalid credentials'
      errorMessage.value = `${base} (${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining)`
      password.value = ''
    } else {
      const axiosErr = err as { response?: { data?: { error?: string; details?: string[] } } }
      const data = axiosErr.response?.data
      if (Array.isArray(data?.details) && data.details.length > 0) {
        errorMessage.value = data.details.join('. ')
      } else {
        errorMessage.value = data?.error ?? 'An error occurred. Please try again.'
      }
    }
    return
  } finally {
    loading.value = false
  }

  // Auth succeeded — navigate outside the catch so router errors don't surface as auth errors
  await router.push('/weaver')
}
</script>

<style scoped lang="scss">
.login-card {
  width: 100%;
  max-width: 420px;
}

.tos-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--q-dark, #1d1d1d);

  :deep(h1), :deep(h2) { font-size: 1.1em; font-weight: 600; margin: 1em 0 0.4em; }
  :deep(h3) { font-size: 1em; font-weight: 600; margin: 0.8em 0 0.3em; }
  :deep(p) { margin: 0 0 0.6em; }
  :deep(ul), :deep(ol) { margin: 0 0 0.6em 1.2em; padding: 0; }
  :deep(li) { margin-bottom: 0.2em; }
  :deep(hr) { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 1em 0; }
  :deep(table) {
    width: 100%; border-collapse: collapse; margin: 0.6em 0;
    th, td { border: 1px solid rgba(0,0,0,0.15); padding: 4px 8px; text-align: left; }
    th { background: rgba(0,0,0,0.04); font-weight: 600; }
  }
  :deep(strong) { font-weight: 600; }
}
</style>
