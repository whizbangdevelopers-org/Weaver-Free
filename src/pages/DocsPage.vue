<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div style="max-width: 900px; margin: 0 auto">
      <!-- Breadcrumb + actions -->
      <div class="row items-center justify-between q-mb-md">
        <q-breadcrumbs>
          <q-breadcrumbs-el
            :label="isComplianceDoc ? 'Compliance' : 'Help'"
            :icon="isComplianceDoc ? 'mdi-shield-check' : 'mdi-help-circle'"
            :to="isComplianceDoc ? '/compliance' : '/help'"
          />
          <q-breadcrumbs-el :label="pageTitle" />
        </q-breadcrumbs>

        <!-- Guides: browser print -->
        <q-btn
          v-if="isGuide"
          flat
          color="primary"
          icon="mdi-printer"
          label="Print"
          @click="printPage"
        />
      </div>

      <!-- One banner only: development notice OR version filter, never both -->
      <q-banner v-if="isDemoMode() && !hasSnapshot" class="q-mb-md bg-amber-1" rounded dense>
        <template #avatar>
          <q-icon name="mdi-information" color="amber-8" size="sm" />
        </template>
        <span class="text-body2">
          Documentation for v{{ appVersion }} is in development. Showing latest available.
        </span>
      </q-banner>
      <q-banner v-else-if="hasVersionGating" class="q-mb-md bg-blue-1" rounded dense>
        <template #avatar>
          <q-icon name="mdi-information" color="primary" size="sm" />
        </template>
        <span class="text-body2">
          This guide shows documentation for <strong>v{{ appVersion }}</strong>.
          Sections for future versions are hidden.
        </span>
      </q-banner>

      <!-- Loading state -->
      <div v-if="docLoading" class="flex flex-center q-pa-xl">
        <q-spinner-dots color="primary" size="md" />
      </div>

      <!-- Rendered markdown -->
      <div v-else class="docs-content" v-html="renderedHtml" @click="handleContentClick" />

      <!-- Back to help -->
      <div class="q-mt-xl q-pt-md">
        <q-btn
          flat
          color="primary"
          icon="mdi-arrow-left"
          :label="isComplianceDoc ? 'Back to Compliance' : 'Back to Help'"
          :to="isComplianceDoc ? '/compliance' : '/help'"
        />
      </div>

      <!-- Future: external docs site (Option C) -->
      <!-- When a public docs site ships, add a link here:
           "View this guide on docs.weaver.dev for the latest version" -->
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import { isDemoMode } from 'src/config/demo-mode'
import MarkdownIt from 'markdown-it'

// Lazy glob — each doc is a separate chunk loaded on demand.
// eager: true was the root cause of the 650 KB DocsPage chunk: all docs were
// bundled regardless of which page the user visited.
// Deliberately specific patterns — docs/**/*.md would pull in dev-only files
// (LESSONS-LEARNED, KNOWN-GOTCHAS, DEVELOPER-GUIDE) that are not served in the app.
const docLoaders = import.meta.glob<string>(
  [
    '../../docs/ADMIN-GUIDE.md',
    '../../docs/USER-GUIDE.md',
    '../../docs/UPGRADE.md',
    '../../docs/UNINSTALL.md',
    '../../docs/PRODUCTION-DEPLOYMENT.md',
    '../../docs/COMPATIBILITY.md',
    '../../docs/security/SECURITY-BASELINES.md',
    '../../docs/security/ENGINEERING-DISCIPLINE.md',
    '../../docs/security/COMPENSATING-CONTROLS.md',
    '../../docs/security/compliance/NIST-800-171-MAPPING.md',
    '../../docs/security/compliance/HIPAA-164-312-MAPPING.md',
    '../../docs/security/compliance/PCI-DSS-MAPPING.md',
    '../../docs/security/compliance/CIS-BENCHMARK-ALIGNMENT.md',
    '../../docs/security/compliance/CIS-CONTROLS-MAPPING.md',
    '../../docs/security/compliance/SOC2-READINESS.md',
    '../../docs/legal/TERMS-OF-SERVICE.md',
    '../../docs/legal/TERMS-OF-SERVICE-COMMERCIAL.md',
    '../../docs/operations/cache-key-compromise-runbook.md',
    '../../docs/operations/cache-key-retirement-policy.md',
    '../../ATTRIBUTION.md',
  ],
  { query: '?raw', import: 'default', eager: false }
)
const versionedDocLoaders = import.meta.glob<string>(
  '../../docs/v*/**/*.md',
  { query: '?raw', import: 'default', eager: false }
)

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const appVersion = computed(() =>
  isDemoMode() ? appStore.demoVersion + '.0' : __APP_VERSION__
)

const slugToTitle: Record<string, string> = {
  'admin-guide': 'Admin Guide',
  'user-guide': 'User Guide',
  'upgrade': 'Upgrade Guide',
  'uninstall': 'Uninstall Guide',
  'security-baselines': 'Security Baselines',
  'nist-800-171': 'NIST 800-171 Mapping',
  'hipaa-164-312': 'HIPAA §164.312 Mapping',
  'pci-dss': 'PCI DSS v4.0 Mapping',
  'cis-benchmarks': 'CIS Benchmark Alignment',
  'cis-controls': 'CIS Controls v8.1 Mapping',
  'soc2-readiness': 'SOC 2 Readiness',
  'engineering-discipline': 'Engineering Discipline',
  'compensating-controls': 'Compensating Controls',
  'runbook-cache-key-compromise': 'Runbook: Cache Key Compromise Response',
  'policy-cache-key-retirement': 'Policy: Cache Key Retirement',
  'attribution': 'Open Source Dependencies',
  'terms-of-service': 'Terms of Service',
  'production-deployment': 'Production Deployment',
  'compatibility': 'Compatibility Matrix',
}

/** Slug → glob key for current (living) docs. Terms of Service varies by tier. */
const slugToGlobKey = computed<Record<string, string>>(() => ({
  'admin-guide': '../../docs/ADMIN-GUIDE.md',
  'user-guide': '../../docs/USER-GUIDE.md',
  'upgrade': '../../docs/UPGRADE.md',
  'uninstall': '../../docs/UNINSTALL.md',
  'security-baselines': '../../docs/security/SECURITY-BASELINES.md',
  'nist-800-171': '../../docs/security/compliance/NIST-800-171-MAPPING.md',
  'hipaa-164-312': '../../docs/security/compliance/HIPAA-164-312-MAPPING.md',
  'pci-dss': '../../docs/security/compliance/PCI-DSS-MAPPING.md',
  'cis-benchmarks': '../../docs/security/compliance/CIS-BENCHMARK-ALIGNMENT.md',
  'cis-controls': '../../docs/security/compliance/CIS-CONTROLS-MAPPING.md',
  'soc2-readiness': '../../docs/security/compliance/SOC2-READINESS.md',
  'engineering-discipline': '../../docs/security/ENGINEERING-DISCIPLINE.md',
  'compensating-controls': '../../docs/security/COMPENSATING-CONTROLS.md',
  'runbook-cache-key-compromise': '../../docs/operations/cache-key-compromise-runbook.md',
  'policy-cache-key-retirement': '../../docs/operations/cache-key-retirement-policy.md',
  'attribution': '../../ATTRIBUTION.md',
  'terms-of-service': (appStore.isWeaver || appStore.isFabrick)
    ? '../../docs/legal/TERMS-OF-SERVICE-COMMERCIAL.md'
    : '../../docs/legal/TERMS-OF-SERVICE.md',
  'production-deployment': '../../docs/PRODUCTION-DEPLOYMENT.md',
  'compatibility': '../../docs/COMPATIBILITY.md',
}))

/** Slug → relative file path within a version snapshot directory. */
const slugToPath: Record<string, string> = {
  'admin-guide': 'ADMIN-GUIDE.md',
  'user-guide': 'USER-GUIDE.md',
  'upgrade': 'UPGRADE.md',
  'uninstall': 'UNINSTALL.md',
  'production-deployment': 'PRODUCTION-DEPLOYMENT.md',
  'compatibility': 'COMPATIBILITY.md',
  'security-baselines': 'security/SECURITY-BASELINES.md',
  'nist-800-171': 'security/compliance/NIST-800-171-MAPPING.md',
  'hipaa-164-312': 'security/compliance/HIPAA-164-312-MAPPING.md',
  'pci-dss': 'security/compliance/PCI-DSS-MAPPING.md',
  'cis-benchmarks': 'security/compliance/CIS-BENCHMARK-ALIGNMENT.md',
  'cis-controls': 'security/compliance/CIS-CONTROLS-MAPPING.md',
  'soc2-readiness': 'security/compliance/SOC2-READINESS.md',
  'engineering-discipline': 'security/ENGINEERING-DISCIPLINE.md',
  'compensating-controls': 'security/COMPENSATING-CONTROLS.md',
  'runbook-cache-key-compromise': 'operations/cache-key-compromise-runbook.md',
  'policy-cache-key-retirement': 'operations/cache-key-retirement-policy.md',
  'attribution': 'ATTRIBUTION.md',
  'terms-of-service': 'legal/TERMS-OF-SERVICE.md',
}

/**
 * Map from markdown filenames (as they appear in cross-doc links) to SPA slugs.
 * Covers all registered docs — both bare filenames and relative paths.
 */
const fileToSlug: Record<string, string> = {
  'ADMIN-GUIDE.md': 'admin-guide',
  'USER-GUIDE.md': 'user-guide',
  'UPGRADE.md': 'upgrade',
  'UNINSTALL.md': 'uninstall',
  'PRODUCTION-DEPLOYMENT.md': 'production-deployment',
  'SECURITY-BASELINES.md': 'security-baselines',
  'NIST-800-171-MAPPING.md': 'nist-800-171',
  'HIPAA-164-312-MAPPING.md': 'hipaa-164-312',
  'PCI-DSS-MAPPING.md': 'pci-dss',
  'CIS-BENCHMARK-ALIGNMENT.md': 'cis-benchmarks',
  'SOC2-READINESS.md': 'soc2-readiness',
  'ENGINEERING-DISCIPLINE.md': 'engineering-discipline',
  'COMPENSATING-CONTROLS.md': 'compensating-controls',
  'ATTRIBUTION.md': 'attribution',
  'TERMS-OF-SERVICE.md': 'terms-of-service',
  'COMPATIBILITY.md': 'compatibility',
}

const slug = computed(() => (route.params.slug as string) || '')

// Reactive state for the lazily-loaded doc content
const docContent = ref<string | null>(null)
const docLoading = ref(false)
const docFromSnapshot = ref(false)

// Watch slug + demo version + commercial tier flag so tier changes reload the ToS correctly
watch(
  [slug, () => (isDemoMode() ? appStore.demoVersion : null), () => appStore.isWeaver || appStore.isFabrick],
  async ([s]) => {
    if (!s) {
      docContent.value = null
      docFromSnapshot.value = false
      return
    }

    docLoading.value = true
    docFromSnapshot.value = false
    try {
      // Demo mode: try version snapshot first
      if (isDemoMode()) {
        const relPath = slugToPath[s]
        if (relPath) {
          const globKey = `../../docs/v${appStore.demoVersion}/${relPath}`
          const loader = versionedDocLoaders[globKey]
          if (loader) {
            docContent.value = await loader()
            docFromSnapshot.value = true
            return
          }
        }
      }

      // Current (living) doc
      const globKey = slugToGlobKey.value[s]
      const loader = globKey ? docLoaders[globKey] : undefined
      docContent.value = loader ? await loader() : null
    } finally {
      docLoading.value = false
    }
  },
  { immediate: true }
)

const hasSnapshot = computed(() => docFromSnapshot.value)
const pageTitle = computed(() => slugToTitle[slug.value] ?? 'Not Found')

const complianceSlugs = new Set(['security-baselines', 'nist-800-171', 'hipaa-164-312', 'pci-dss', 'cis-benchmarks', 'cis-controls', 'soc2-readiness', 'engineering-discipline', 'compensating-controls', 'attribution', 'terms-of-service'])
const guideSlugs = new Set(['admin-guide', 'user-guide'])
const isComplianceDoc = computed(() => complianceSlugs.has(slug.value))
const isGuide = computed(() => guideSlugs.has(slug.value))
const hasVersionGating = computed(() => docContent.value?.includes('*Available:') ?? false)

function printPage(): void {
  window.print()
}

/** Parse "1.2" from version string like "v1.2.0" or "1.2" */
function parseVersion(v: string): number {
  const [maj, min] = v.replace(/^v/, '').split('.').map(Number)
  return (maj ?? 0) * 100 + (min ?? 0)
}

/** Check if a version tag is visible for the current app/demo version */
function isVersionVisible(version: string): boolean {
  if (isDemoMode()) return appStore.isDemoVersionAtLeast(version)
  return parseVersion(appVersion.value) >= parseVersion(version)
}

/**
 * Filter markdown content by version — strips sections whose *Available: vX.Y+*
 * tag exceeds the current installed (or demo) version.
 *
 * Splits on heading boundaries (## or ###), extracts the first vX.Y from the
 * *Available:* line, and drops the entire section if vX.Y > current version.
 * Sections without an *Available:* tag are always shown.
 */
function filterByVersion(raw: string): string {
  // Split into sections by ## or ### headings, keeping the heading with each section
  const sectionPattern = /^(#{2,3}\s)/m
  const parts = raw.split(sectionPattern)

  // Reassemble: parts[0] is pre-first-heading content, then alternating delimiter + content
  const sections: string[] = []
  sections.push(parts[0]) // intro content before first heading — always shown
  for (let i = 1; i < parts.length; i += 2) {
    sections.push((parts[i] ?? '') + (parts[i + 1] ?? ''))
  }

  return sections
    .filter((section) => {
      // Extract first version from *Available: vX.Y+* (handles "v1.0+ (basic), v1.2+ (full)")
      const match = section.match(/\*Available:\s*v?([\d.]+)\+/)
      if (!match) return true // no version tag — always show
      return isVersionVisible(match[1])
    })
    .join('')
}

/** Slugify heading text — matches GitHub-flavored markdown anchor format.
 *  GitHub does NOT collapse double hyphens: "Tags & Organization" → "tags--organization".
 *  Must match verify-docs-links.ts slugify exactly. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // strip non-word chars except hyphens
    .replace(/\s/g, '-')        // each space to hyphen (preserves double hyphens from stripped chars)
    .trim()
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

// Add id attributes to headings so in-page anchor links work
const defaultHeadingOpen = md.renderer.rules.heading_open ??
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts))
md.renderer.rules.heading_open = (tokens, idx, opts, env, self) => {
  const contentToken = tokens[idx + 1]
  if (contentToken?.children) {
    const text = contentToken.children.map(t => t.content).join('')
    tokens[idx].attrSet('id', slugify(text))
  }
  return defaultHeadingOpen(tokens, idx, opts, env, self)
}

/**
 * Rewrite markdown cross-doc links (.md) to SPA routes at render time.
 * - Registered docs: rewrite to /#/docs/<slug> (or /#/docs/<slug>#anchor)
 * - Unregistered .md files: render as plain text (no clickable dead link)
 */
const defaultLinkOpen = md.renderer.rules.link_open ??
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts))
const defaultLinkClose = md.renderer.rules.link_close ??
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts))

md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const hrefAttr = tokens[idx].attrGet('href')
  if (hrefAttr && hrefAttr.match(/\.md(?:#|$)/i)) {
    // Extract filename from path (strip leading ../ or ./ or path segments)
    const [filePart, anchor] = hrefAttr.split('#')
    const filename = filePart.split('/').pop() ?? filePart
    const targetSlug = fileToSlug[filename]

    if (targetSlug) {
      // Registered doc — rewrite to SPA route
      const newHref = anchor ? `/#/docs/${targetSlug}#${anchor}` : `/#/docs/${targetSlug}`
      tokens[idx].attrSet('href', newHref)
      return defaultLinkOpen(tokens, idx, opts, env, self)
    }
    // Unregistered .md — render as plain text (strip the link tag)
    ;(env as Record<string, boolean>)._stripLink = true
    return ''
  }
  return defaultLinkOpen(tokens, idx, opts, env, self)
}

md.renderer.rules.link_close = (tokens, idx, opts, env, self) => {
  if ((env as Record<string, boolean>)._stripLink) {
    (env as Record<string, boolean>)._stripLink = false
    return ''
  }
  return defaultLinkClose(tokens, idx, opts, env, self)
}

/**
 * Intercept clicks on in-page anchor links (#section-name) and scroll
 * to the element instead of navigating — hash-mode routing would interpret
 * #anchor as a route change, causing a 404.
 *
 * Also intercepts clicks on rewritten cross-doc links (/#/docs/<slug>) and
 * navigates via the router instead of a full page reload.
 */
function handleContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('a')
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  // In-page anchor: scroll to element
  if (href.startsWith('#')) {
    event.preventDefault()
    const el = document.getElementById(href.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth' })
    return
  }

  // Cross-doc link (rewritten to /#/docs/<slug>): navigate via router
  if (href.startsWith('/#/docs/')) {
    event.preventDefault()
    const path = href.slice(2) // strip leading /#
    const [routePath, anchor] = path.split('#')
    void router.push(routePath).then(() => {
      if (anchor) {
        // Scroll to anchor after route change
        setTimeout(() => {
          const el = document.getElementById(anchor)
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    })
    return
  }
}

const renderedHtml = computed(() => {
  if (!docContent.value) {
    return '<p>Document not found. <a href="/help">Return to Help</a>.</p>'
  }
  // Strip all copyright header comments at the top of the file
  const stripped = docContent.value.replace(/^(\s*<!--[\s\S]*?-->\s*)+/, '')
  // Filter sections by version — only show content for installed/demo version
  const content = filterByVersion(stripped)
  return md.render(content)
})
</script>

<style lang="scss">
.docs-content {
  line-height: 1.7;

  h1 {
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 0.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }

  h2 {
    font-size: 1.4rem;
    font-weight: 600;
    margin-top: 2em;
    margin-bottom: 0.5em;
    padding-bottom: 0.2em;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  h3 {
    font-size: 1.15rem;
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.4em;
  }

  p {
    margin-bottom: 1em;
  }

  ul, ol {
    margin-bottom: 1em;
    padding-left: 1.5em;
  }

  li {
    margin-bottom: 0.3em;
  }

  code {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
  }

  pre {
    background: rgba(0, 0, 0, 0.05);
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: 1em;

    code {
      background: none;
      padding: 0;
    }
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;

    th, td {
      border: 1px solid rgba(0, 0, 0, 0.12);
      padding: 0.5em 0.75em;
      text-align: left;
    }

    th {
      background: rgba(0, 0, 0, 0.04);
      font-weight: 600;
    }
  }

  blockquote {
    border-left: 4px solid $primary;
    margin: 1em 0;
    padding: 0.5em 1em;
    background: rgba(0, 0, 0, 0.02);

    p {
      margin-bottom: 0.3em;
    }
  }

  em {
    // Version tags like *Available: v1.0+*
    &:first-child {
      color: $primary;
    }
  }

  a {
    color: $primary;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  hr {
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    margin: 2em 0;
  }
}

// Print styles — clean output for admin/user guides
@media print {
  // Hide all app chrome
  .q-header,
  .q-drawer,
  .q-footer,
  .q-breadcrumbs,
  .q-banner,
  .q-btn {
    display: none !important;
  }

  .q-page {
    padding: 0 !important;
  }

  .docs-content {
    max-width: 100% !important;

    a {
      color: inherit;
      text-decoration: underline;
    }

    table {
      page-break-inside: avoid;
    }

    h2, h3 {
      page-break-after: avoid;
    }
  }
}

// Dark mode overrides
.body--dark .docs-content {
  h1, h2 {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  code {
    background: rgba(255, 255, 255, 0.08);
  }

  pre {
    background: rgba(255, 255, 255, 0.05);
  }

  table {
    th, td {
      border-color: rgba(255, 255, 255, 0.12);
    }

    th {
      background: rgba(255, 255, 255, 0.05);
    }
  }

  blockquote {
    background: rgba(255, 255, 255, 0.03);
  }

  hr {
    border-top-color: rgba(255, 255, 255, 0.12);
  }
}
</style>
