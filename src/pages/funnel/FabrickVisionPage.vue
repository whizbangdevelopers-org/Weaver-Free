<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-icon name="mdi-view-grid" color="fabrick" size="md" class="q-mr-sm" />
      <div>
        <div class="text-h5 text-weight-bold">FabricK</div>
        <div class="text-caption text-grey-7">Fleet-scale infrastructure governance</div>
      </div>
    </div>

    <!-- Hero narrative -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Your fleet, one control plane</div>
        <p class="text-body1 text-grey-8">
          You're managing tens or hundreds of hosts. You need policy, compliance,
          and orchestration at a scale where manual management breaks down.
          FabricK is the control plane that orchestrates your entire fleet —
          every host running Weaver, unified under one governance layer.
        </p>
        <p class="text-body1 text-grey-8">
          Weaver manages hosts. FabricK orchestrates the fleet.
        </p>
      </q-card-section>
    </q-card>

    <!-- Identity cards -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-md-6">
        <q-card flat bordered class="full-height">
          <q-card-section>
            <q-icon name="mdi-shield-check" color="fabrick" size="sm" class="q-mb-sm" />
            <div class="text-subtitle1 text-weight-bold q-mb-xs">Governance at scale</div>
            <p class="text-body2 text-grey-7">
              Per-workload access control, audit logging, resource quotas, and
              compliance enforcement — the infrastructure controls enterprise
              teams require.
            </p>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card flat bordered class="full-height">
          <q-card-section>
            <q-icon name="mdi-spider-web" color="fabrick" size="sm" class="q-mb-sm" />
            <div class="text-subtitle1 text-weight-bold q-mb-xs">Fleet topology</div>
            <p class="text-body2 text-grey-7">
              See your entire fleet at a glance. Spatial topology, host health,
              workload distribution, and drift detection across every node.
            </p>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Development status -->
    <q-card flat bordered class="q-mb-lg bg-grey-1">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-icon name="mdi-map-marker-path" color="fabrick" size="sm" class="q-mr-sm" />
          <div class="text-h6">Designed from the ground up</div>
        </div>
        <p class="text-body2 text-grey-8">
          FabricK is designed from the ground up for enterprise infrastructure
          teams. We've mapped out a comprehensive multi-version development plan
          that builds on the Weaver foundation. Founding Members shape the
          fleet management experience before it ships.
        </p>
      </q-card-section>
    </q-card>

    <!-- Founding Member CTA -->
    <q-card flat bordered class="bg-fabrick text-white">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Become a Founding Member</div>
        <p class="text-body2">
          Lock in Founding Member pricing — permanently. Shape the fleet management
          roadmap with direct feedback. Get priority support and early builds.
        </p>
        <div class="row q-gutter-sm q-mt-md">
          <q-btn
            unelevated
            color="white"
            text-color="blue-8"
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
import { PUBLIC_DEMO_LINKS } from 'src/config/demo'
</script>
