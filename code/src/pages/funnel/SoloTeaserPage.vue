<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-icon name="mdi-rocket-launch" color="primary" size="md" class="q-mr-sm" />
      <div>
        <div class="text-h5 text-weight-bold">Weaver Solo</div>
        <div class="text-caption text-grey-7">Live Provisioning — create and manage workloads from your browser</div>
      </div>
    </div>

    <!-- Hero narrative -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Your infrastructure, your way</div>
        <p class="text-body1 text-grey-8">
          Weaver Solo gives you full lifecycle control over your NixOS workloads.
          Create VMs and containers directly from the browser — no terminal,
          no <code>nixos-rebuild switch</code>, no configuration files to manage.
          Just point, click, and provision.
        </p>
        <p class="text-body2 text-grey-7">
          Everything you see below is running on real mock data — this is what
          Solo looks and feels like in practice.
        </p>
      </q-card-section>
    </q-card>

    <!-- Mock workload cards — read-only snapshot of Solo-tier data -->
    <div class="text-subtitle1 text-weight-bold q-mb-sm">Workloads at a glance</div>
    <div class="row q-col-gutter-md q-mb-lg">
      <div v-for="vm in soloVms" :key="vm.name" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center no-wrap q-mb-xs">
              <q-badge
                :color="vm.status === 'running' ? 'positive' : vm.status === 'stopped' ? 'grey-5' : 'negative'"
                rounded
                class="q-mr-sm"
              >{{ vm.status }}</q-badge>
              <span class="text-weight-bold">{{ vm.name }}</span>
            </div>
            <div class="text-caption text-grey-6">
              {{ vm.ip }} · {{ vm.vcpu }} vCPU · {{ vm.mem }} MB
            </div>
            <div v-if="vm.hypervisor" class="text-caption text-grey-5">
              {{ vm.hypervisor }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- What Solo enables — brief, no feature list -->
    <q-card flat bordered class="q-mb-lg bg-amber-1">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Beyond monitoring — full control</div>
        <p class="text-body2 text-grey-8">
          With Free, you manage workloads you already have. With Solo, you create
          new ones — choose a distro, set resources, and provision in seconds.
          Managed bridges, push notifications, and integrated extensions give you
          the tools to run serious infrastructure from a single host.
        </p>
      </q-card-section>
    </q-card>

    <!-- Founding Member CTA -->
    <q-card flat bordered class="bg-primary text-white">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Become a Founding Member</div>
        <p class="text-body2">
          Lock in Founding Member pricing — permanently. Shape the product roadmap
          with direct feedback. Get priority support from the development team.
        </p>
        <div class="row q-gutter-sm q-mt-md">
          <q-btn
            unelevated
            color="white"
            text-color="primary"
            label="Become a Founding Member"
            :href="PUBLIC_DEMO_LINKS.fmProgram"
            target="_blank"
            no-caps
          />
          <q-btn
            outline
            color="white"
            label="Contact Us"
            :href="PUBLIC_DEMO_LINKS.contact"
            target="_blank"
            no-caps
          />
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { getDemoVmsForTier, PUBLIC_DEMO_LINKS } from 'src/config/demo'
import { TIERS } from 'src/constants/vocabularies'

// Solo-tier mock workloads — displayed read-only as a snapshot
const soloVms = getDemoVmsForTier(TIERS.WEAVER)
</script>
