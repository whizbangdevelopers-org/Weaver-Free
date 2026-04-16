<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-icon name="mdi-account-group" color="primary" size="md" class="q-mr-sm" />
      <div>
        <div class="text-h5 text-weight-bold">Weaver Team</div>
        <div class="text-caption text-grey-7">Manage your small team's distributed infrastructure</div>
      </div>
    </div>

    <!-- Hero narrative -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Built for small teams, serious infrastructure</div>
        <p class="text-body1 text-grey-8">
          You're a team lead with two or three servers spread across locations.
          Your team needs visibility and control — without the complexity of
          fleet orchestration tools built for hundreds of nodes.
        </p>
        <p class="text-body1 text-grey-8">
          Weaver Team gives your team full management across your infrastructure.
          One hub, up to two peers. Start, stop, provision, and manage workloads
          on remote hosts as if they were local.
        </p>
      </q-card-section>
    </q-card>

    <!-- Scale narrative -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-h6 q-mb-sm">The right scale for your team</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-4">
            <div class="text-subtitle2 text-weight-bold text-primary">Solo</div>
            <div class="text-body2 text-grey-7">One host, one operator.</div>
          </div>
          <div class="col-12 col-md-4">
            <div class="text-subtitle2 text-weight-bold text-primary">Team</div>
            <div class="text-body2 text-grey-7">Three hosts, full management. When your infrastructure outgrows a single machine.</div>
          </div>
          <div class="col-12 col-md-4">
            <div class="text-subtitle2 text-weight-bold text-fabrick">FabricK</div>
            <div class="text-body2 text-grey-7">Fleet-scale orchestration. When you outgrow three nodes.</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Development status -->
    <q-card flat bordered class="q-mb-lg bg-grey-1">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-icon name="mdi-map-marker-path" color="primary" size="sm" class="q-mr-sm" />
          <div class="text-h6">On the roadmap</div>
        </div>
        <p class="text-body2 text-grey-8">
          We've mapped out a comprehensive development plan for Weaver Team.
          Founding Members get to shape the product as it's built —
          your feedback directly influences what ships.
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
import { PUBLIC_DEMO_LINKS } from 'src/config/demo'
</script>
