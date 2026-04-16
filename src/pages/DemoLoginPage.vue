<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="flex flex-center" style="min-height: 100vh">
    <q-card class="demo-login-card q-pa-lg" style="min-width: 380px; max-width: 480px">
      <q-card-section class="text-center">
        <q-icon name="mdi-server-network" size="64px" color="primary" />
        <h4 class="q-mt-md q-mb-none">Weaver Demo</h4>
        <p class="text-body1 text-grey-8 q-mt-sm">
          Try out Weaver with simulated MicroVMs.
          No backend required.
        </p>
      </q-card-section>

      <q-separator />

      <q-card-section class="text-center">
        <!-- hCaptcha widget container -->
        <div v-if="!captchaVerified" class="captcha-container q-mb-md">
          <div id="hcaptcha-widget" ref="captchaContainer"></div>
          <p v-if="captchaError" class="text-negative text-caption q-mt-sm">
            {{ captchaError }}
          </p>
        </div>

        <q-btn
          v-else
          color="primary"
          label="Enter Demo"
          icon="mdi-login"
          size="lg"
          class="full-width"
          :loading="entering"
          @click="enterDemo"
        />
      </q-card-section>

      <q-card-section class="text-center q-pt-none">
        <p class="text-caption text-grey-8">
          This demo uses mock data. All changes reset on page reload.
        </p>
        <p class="text-caption text-grey-6 q-mt-sm q-mb-none">
          &copy; {{ new Date().getFullYear() }} whizBANG Developers LLC. All rights reserved.
        </p>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const captchaSiteKey =
  import.meta.env.VITE_HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001'

const captchaVerified = ref(false)
const captchaError = ref<string | null>(null)
const captchaContainer = ref<HTMLElement | null>(null)
const entering = ref(false)

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: string | HTMLElement, params: Record<string, unknown>) => string
      getResponse: (widgetId: string) => string
      reset: (widgetId: string) => void
    }
    onHcaptchaVerify?: (token: string) => void
    onHcaptchaExpire?: () => void
    onHcaptchaError?: (err: string) => void
  }
}

function loadHcaptchaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.hcaptcha) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load hCaptcha script'))
    document.head.appendChild(script)
  })
}

function renderCaptcha() {
  if (!window.hcaptcha || !captchaContainer.value || !captchaSiteKey) return

  window.hcaptcha.render(captchaContainer.value, {
    sitekey: captchaSiteKey,
    theme: 'dark',
    callback: (token: string) => {
      if (token) {
        captchaVerified.value = true
        captchaError.value = null
      }
    },
    'expired-callback': () => {
      captchaVerified.value = false
      captchaError.value = 'Captcha expired. Please verify again.'
    },
    'error-callback': () => {
      captchaError.value = 'Captcha verification failed. Please try again.'
    },
  })
}

onMounted(async () => {
  try {
    await loadHcaptchaScript()
    // Small delay to ensure hCaptcha is fully initialized
    setTimeout(() => {
      renderCaptcha()
    }, 100)
  } catch {
    captchaError.value = 'Failed to load captcha. You may proceed without verification.'
    captchaVerified.value = true
  }
})

async function enterDemo() {
  entering.value = true
  try {
    localStorage.setItem('microvm-demo-mode', 'true')
    authStore.loginAsDemo()
    await appStore.initialize()
    await router.push('/weaver')
  } finally {
    entering.value = false
  }
}
</script>

<style scoped lang="scss">
.demo-login-card {
  border-radius: 12px;
}

.captcha-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}
</style>
