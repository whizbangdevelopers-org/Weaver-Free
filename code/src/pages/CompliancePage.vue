<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="text-h4 q-mb-sm">
      <q-icon name="mdi-shield-check" class="q-mr-sm" />
      Compliance &amp; Standards
    </div>
    <div class="text-body2 text-grey-7 q-mb-lg" style="max-width: 800px">
      Weaver's security controls mapped to industry standards. Each document shows
      which controls are implemented in your installed version (<strong>v{{ appVersion }}</strong>).
    </div>

    <div class="q-gutter-md" style="max-width: 800px">
      <!-- Security Baselines -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-icon name="mdi-security" size="28px" color="primary" />
            <div class="text-h6">Security Baselines</div>
          </div>
          <div class="text-body2 text-grey-8">
            Minimum security parameter thresholds enforced by automated checks on every build.
            Password policy, JWT session management, HSTS, CSP, CORS, audit logging.
          </div>
        </q-card-section>
        <q-card-actions>
          <q-btn flat color="primary" icon="mdi-arrow-right" label="View Baselines" to="/docs/security-baselines" />
          <q-btn flat :color="isDemoMode() ? 'grey-8' : 'primary'" icon="mdi-arrow-right" label="Download PDF" :disable="isDemoMode()" :loading="downloading === 'security-baselines'" @click="downloadPdf('security-baselines')">
            <q-badge v-if="isDemoMode()" outline color="grey-8" label="production" class="q-ml-sm" />
          </q-btn>
        </q-card-actions>
      </q-card>

      <!-- Control Mappings -->
      <q-card
        v-for="standard in standards"
        :key="standard.slug"
        flat
        bordered
      >
        <q-card-section>
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-icon :name="standard.icon" size="28px" :color="standard.color" />
            <div class="text-h6">{{ standard.title }}</div>
            <q-badge :label="standard.badge" :color="standard.badgeColor" class="q-ml-sm" />
            <q-badge
              :color="isFullCompliance(standard) ? 'positive' : 'orange'"
              :label="isFullCompliance(standard) ? `${standard.total}/${standard.total} implemented` : `${standard.implemented}/${standard.total} implemented`"
              class="q-ml-xs"
            />
          </div>
          <div class="text-body2 text-grey-8">
            {{ standard.description }}
          </div>
          <div v-if="!isFullCompliance(standard) && standard.planned" class="text-caption text-orange-8 q-mt-sm">
            <q-icon name="mdi-clock-outline" size="14px" class="q-mr-xs" />
            Planned for v{{ standard.fullVersion }}: {{ standard.planned }}
          </div>
        </q-card-section>
        <q-card-actions>
          <q-btn flat color="primary" icon="mdi-arrow-right" label="View Mapping" :to="'/docs/' + standard.slug" />
          <q-btn flat :color="isDemoMode() ? 'grey-8' : 'primary'" icon="mdi-arrow-right" label="Download PDF" :disable="isDemoMode()" :loading="downloading === standard.slug" @click="downloadPdf(standard.slug)">
            <q-badge v-if="isDemoMode()" outline color="grey-8" label="production" class="q-ml-sm" />
          </q-btn>
        </q-card-actions>
      </q-card>

      <!-- Open Source Dependencies -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-icon name="mdi-package-variant" size="28px" color="grey-8" />
            <div class="text-h6">Open Source Dependencies</div>
          </div>
          <div class="text-body2 text-grey-8">
            All runtime dependencies, their licenses, and copyright holders.
            One dependency (<strong>web-push</strong>) uses MPL-2.0 (file-level copyleft) &mdash;
            review if your compliance policy restricts copyleft.
          </div>
        </q-card-section>
        <q-card-actions>
          <q-btn flat color="primary" icon="mdi-arrow-right" label="View Attribution" to="/docs/attribution" />
        </q-card-actions>
      </q-card>

      <!-- Legal Terms -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-icon name="mdi-scale-balance" size="28px" color="brown-7" />
            <div class="text-h6">Terms of Service</div>
          </div>
          <div class="text-body2 text-grey-8">
            Software license terms, BYOK liability, AI training restriction,
            warranty disclaimer, and limitation of liability.
          </div>
        </q-card-section>
        <q-card-actions>
          <q-btn flat color="primary" icon="mdi-arrow-right" label="View Terms" to="/docs/terms-of-service" />
        </q-card-actions>
      </q-card>

      <!-- Disclaimer -->
      <div class="text-caption text-grey q-mt-lg q-pt-md" style="max-width: 800px">
        These documents map Weaver's technical controls to industry standards.
        They are not certification claims. Verify controls against your specific compliance requirements.
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, computed } from 'vue'
import { api } from 'src/boot/axios'
import { isDemoMode } from 'src/config/demo'
import { useAppStore } from 'src/stores/app'

const appStore = useAppStore()
const appVersion = computed(() =>
  isDemoMode() ? appStore.demoVersion + '.0' : __APP_VERSION__
)
const downloading = ref<string | null>(null)

async function downloadPdf(slug: string): Promise<void> {
  downloading.value = slug
  try {
    const response = await api.get(`/compliance/${slug}/pdf`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `weaver-${slug}-v${appVersion.value}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('PDF download failed:', err)
  } finally {
    downloading.value = null
  }
}

interface ComplianceStandard {
  slug: string
  title: string
  badge: string
  badgeColor: string
  icon: string
  color: string
  description: string
  implemented: number
  total: number
  fullVersion: string // version at which all controls are implemented
  planned: string     // what's remaining
}

const standards: ComplianceStandard[] = [
  {
    slug: 'nist-800-171',
    title: 'NIST 800-171',
    badge: 'Defense / CUI',
    badgeColor: 'deep-purple',
    icon: 'mdi-shield-lock',
    color: 'deep-purple',
    description: '24 controls across 7 families (Access Control, Audit, Identification & Authentication, System & Communications Protection, System Integrity, Configuration Management, Media Protection).',
    implemented: 20, total: 24, fullVersion: '1.1',
    planned: 'MFA, cryptographic key management, CUI encryption at rest, media protection',
  },
  {
    slug: 'hipaa-164-312',
    title: 'HIPAA §164.312',
    badge: 'Healthcare',
    badgeColor: 'teal',
    icon: 'mdi-hospital-box',
    color: 'teal',
    description: 'Technical Safeguards mapping — access control, audit controls, integrity, authentication, and transmission security.',
    implemented: 11, total: 13, fullVersion: '1.1',
    planned: 'MFA, encryption at rest',
  },
  {
    slug: 'pci-dss',
    title: 'PCI DSS v4.0',
    badge: 'Financial',
    badgeColor: 'blue',
    icon: 'mdi-credit-card-check',
    color: 'blue',
    description: '26 controls across 6 requirements — secure configuration, data protection, secure development, access restriction, authentication, logging.',
    implemented: 24, total: 26, fullVersion: '1.1',
    planned: 'MFA for CDE access, cryptographic key protection',
  },
  {
    slug: 'cis-benchmarks',
    title: 'CIS Benchmarks',
    badge: 'Infrastructure',
    badgeColor: 'orange',
    icon: 'mdi-server-security',
    color: 'orange',
    description: 'Linux hardening alignment — filesystem, user accounts, logging, network, access control, SSH. NixOS-specific advantages noted.',
    implemented: 18, total: 18, fullVersion: '1.0',
    planned: '',
  },
  {
    slug: 'soc2-readiness',
    title: 'SOC 2 Readiness',
    badge: 'Audit',
    badgeColor: 'indigo',
    icon: 'mdi-certificate',
    color: 'indigo',
    description: 'Trust Service Criteria mapping — Security, Availability, Processing Integrity, Confidentiality. Audit evidence summary included.',
    implemented: 25, total: 28, fullVersion: '1.1',
    planned: 'MFA, cryptographic key management, encryption at rest',
  },
]

/** Check whether the current version meets a standard's full-compliance version */
function isFullCompliance(standard: ComplianceStandard): boolean {
  if (!isDemoMode()) return parseFloat(__APP_VERSION__) >= parseFloat(standard.fullVersion)
  return appStore.isDemoVersionAtLeast(standard.fullVersion)
}
</script>
