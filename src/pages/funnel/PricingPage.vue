<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-icon name="mdi-tag-outline" color="grey-8" size="md" class="q-mr-sm" />
      <div>
        <div class="text-h5 text-weight-bold">Pricing</div>
        <div class="text-caption text-grey-7">Total cost of ownership — not just license fees</div>
      </div>
    </div>

    <!-- TCO narrative -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-h6 q-mb-sm">The real cost of infrastructure management</div>
        <p class="text-body1 text-grey-8">
          License fees are the smallest line item. The real cost is admin
          overhead, training, migration complexity, and the features you
          don't get. Here's how Weaver compares.
        </p>
      </q-card-section>
    </q-card>

    <!-- TCO comparison table -->
    <q-card flat bordered class="q-mb-lg">
      <q-table
        :rows="tcoRows"
        :columns="tcoColumns"
        row-key="category"
        flat
        bordered
        hide-pagination
        :rows-per-page-options="[0]"
        class="tco-table"
      />
    </q-card>

    <!-- Tier summary -->
    <div class="text-subtitle1 text-weight-bold q-mb-sm">Weaver editions</div>
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="full-height">
          <q-card-section class="text-center">
            <div class="text-subtitle1 text-weight-bold">Free</div>
            <div class="text-h4 text-weight-bold text-primary q-my-sm">{{ PRICING.free.fmShort }}</div>
            <div class="text-caption text-grey-6">Forever</div>
            <q-btn
              unelevated
              color="primary"
              label="Get Started"
              :href="PUBLIC_DEMO_LINKS.getStarted"
              target="_blank"
              no-caps
              class="q-mt-md full-width"
            />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="full-height">
          <q-card-section class="text-center">
            <div class="text-subtitle1 text-weight-bold">Solo</div>
            <div class="text-h4 text-weight-bold text-primary q-my-sm">
              {{ fmCardPrice('solo') }}
            </div>
            <div v-if="FM_AVAILABLE" class="text-caption text-grey-6">Founding Member pricing</div>
            <div v-else class="text-caption text-grey-6">{{ PRICING.solo.standard }}</div>
            <q-btn
              unelevated
              color="primary"
              label="Become a Founding Member"
              :href="PUBLIC_DEMO_LINKS.fmProgram"
              target="_blank"
              no-caps
              class="q-mt-md full-width"
            />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="full-height">
          <q-card-section class="text-center">
            <div class="text-subtitle1 text-weight-bold">Team</div>
            <div class="text-h5 text-weight-bold text-primary q-my-sm">Contact us</div>
            <div class="text-caption text-grey-6">Per-user pricing</div>
            <q-btn
              outline
              color="primary"
              label="Contact Us"
              :href="PUBLIC_DEMO_LINKS.contact"
              target="_blank"
              no-caps
              class="q-mt-md full-width"
            />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="full-height">
          <q-card-section class="text-center">
            <div class="text-subtitle1 text-weight-bold text-fabrick">FabricK</div>
            <div class="text-h5 text-weight-bold text-fabrick q-my-sm">Contact us</div>
            <div class="text-caption text-grey-6">Per-node pricing</div>
            <q-btn
              outline
              color="blue-8"
              label="Contact Us"
              :href="PUBLIC_DEMO_LINKS.contact"
              target="_blank"
              no-caps
              class="q-mt-md full-width"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Founding Member callout -->
    <q-card flat bordered class="bg-amber-1 q-mb-lg">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-icon name="mdi-star-circle" color="amber-8" size="sm" class="q-mr-sm" />
          <div class="text-h6">Founding Member Pricing</div>
        </div>
        <p class="text-body2 text-grey-8">
          Founding Members lock in their pricing — permanently.
          As features ship and the product matures, standard pricing increases.
          Your rate stays locked at the founding level for as long as you're
          a member. No surprises, no bait-and-switch.
        </p>
        <q-btn
          unelevated
          color="amber-8"
          text-color="white"
          label="Become a Founding Member"
          :href="PUBLIC_DEMO_LINKS.fmProgram"
          target="_blank"
          no-caps
          class="q-mt-sm"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar'
import { PUBLIC_DEMO_LINKS } from 'src/config/demo'
import { PRICING, FM_AVAILABLE, fmCardPrice } from 'src/constants/pricing'

// Phase 1 competitors: Proxmox + DIY only (Decision #135).
// Fabrick-tier competitors (VMware, K8s) added when Team dev starts.
const tcoColumns: QTableColumn[] = [
  { name: 'category', label: '', field: 'category', align: 'left', style: 'font-weight: 600' },
  { name: 'weaverFree', label: 'Weaver Free', field: 'weaverFree', align: 'center' },
  { name: 'weaverSolo', label: 'Weaver Solo', field: 'weaverSolo', align: 'center' },
  { name: 'proxmox', label: 'Proxmox', field: 'proxmox', align: 'center' },
  { name: 'diy', label: 'DIY / Manual', field: 'diy', align: 'center' },
]

const tcoRows = [
  {
    category: 'License cost',
    weaverFree: 'Free',
    weaverSolo: FM_AVAILABLE ? `Under $150/yr (FM)` : PRICING.solo.standard,
    proxmox: 'Free (community) or $110+/yr/socket',
    diy: 'Free',
  },
  {
    category: 'Admin overhead',
    weaverFree: 'Low — Weaver + AI diagnostics',
    weaverSolo: 'Low — Live Provisioning from browser',
    proxmox: 'Medium — web UI + CLI management',
    diy: 'High — SSH + config files + scripts',
  },
  {
    category: 'Training required',
    weaverFree: 'Minimal — intuitive web UI',
    weaverSolo: 'Minimal — guided provisioning',
    proxmox: 'Moderate — Proxmox-specific concepts',
    diy: 'Significant — OS-specific tooling',
  },
  {
    category: 'Migration complexity',
    weaverFree: 'Low — scan existing VMs',
    weaverSolo: 'Low — import tools included',
    proxmox: 'Medium — format conversion needed',
    diy: 'N/A — already there',
  },
  {
    category: 'AI diagnostics',
    weaverFree: 'Included (BYOK)',
    weaverSolo: 'Included (server key)',
    proxmox: 'Not available',
    diy: 'Not available',
  },
  {
    category: 'NixOS native',
    weaverFree: 'Yes — built for NixOS',
    weaverSolo: 'Yes — built for NixOS',
    proxmox: 'No — Debian-based',
    diy: 'Depends on distro',
  },
]
</script>

<style scoped lang="scss">
.tco-table {
  :deep(th) {
    font-weight: 700;
    background: #f8fafc;
  }
}
</style>
