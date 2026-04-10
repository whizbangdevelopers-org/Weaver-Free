<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered>
    <q-expansion-item icon="mdi-bell" label="Notifications" caption="In-app and push notification channels" header-class="text-h6">
    <q-card-section>
      <div class="q-gutter-md">
        <!-- In-App Notifications (all tiers) -->
        <div>
          <div class="text-subtitle2 q-mb-xs">In-App Notifications</div>
          <q-banner rounded dense class="bg-blue-1 text-blue-9 q-mb-sm">
            <template #avatar>
              <q-icon name="mdi-information" color="blue" />
            </template>
            In-app notifications appear when events occur.
            Click the bell icon in the toolbar to view recent notifications.
          </q-banner>
        </div>

        <!-- Push Channels (Weaver Solo+) — dynamically loaded -->
        <component :is="PushChannels" />
      </div>
    </q-card-section>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { useTierFeature } from 'src/composables/useTierFeature'
import { TIERS } from 'src/constants/vocabularies'

const PushChannels = useTierFeature({
  minimumTier: TIERS.WEAVER,
  loader: () => import('src/components/weaver/NotificationPushChannels.vue'),
  featureName: 'Push Notifications',
  featureDescription: 'Configure push notification channels for alerts.',
  features: ['ntfy.sh integration', 'Email (SMTP)', 'Webhooks', 'Web Push'],
})
</script>
