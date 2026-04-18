// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { RouteRecordRaw } from 'vue-router'
import { isDemoMode } from 'src/config/demo-mode'

// Build-time demo mode: show DemoLoginPage instead of LoginPage
const loginComponent = isDemoMode()
  ? () => import('pages/DemoLoginPage.vue')
  : () => import('pages/LoginPage.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: loginComponent,
    meta: { public: true },
  },

  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/weaver' },
      {
        path: 'weaver',
        component: () => import('pages/WeaverPage.vue'),
        meta: { title: 'Workloads' },
      },
      {
        path: 'workload/:name',
        component: () => import('pages/WorkloadDetailPage.vue'),
        props: true,
      },
      {
        path: 'container/:id',
        redirect: '/weaver',
      },
      {
        path: 'network',
        component: () => import('pages/NetworkMapPage.vue'),
        meta: { title: 'Strands' },
      },
      {
        // Shed — unified workload creation (Decision #92)
        path: 'shed',
        component: () => import('pages/ShedPage.vue'),
        meta: { title: 'Shed' },
      },
      {
        path: 'settings',
        component: () => import('pages/SettingsPage.vue'),
        meta: { title: 'Settings' },
      },
      {
        path: 'profile',
        component: () => import('pages/ProfilePage.vue'),
        meta: { title: 'Profile' },
      },
      {
        path: 'users',
        component: () => import('pages/UsersPage.vue'),
        meta: { requiresAdmin: true, title: 'Users' },
      },
      {
        path: 'audit',
        component: () => import('pages/AuditPage.vue'),
        meta: { requiresAdmin: true, requiresFabrick: true, title: 'Audit Log' },
      },
      {
        path: 'extensions',
        component: () => import('pages/IntegrationsPage.vue'),
        meta: { title: 'Extensions' },
      },
      {
        path: 'compliance',
        component: () => import('pages/CompliancePage.vue'),
        meta: { title: 'Compliance' },
      },
      {
        path: 'help',
        component: () => import('pages/HelpPage.vue'),
        meta: { title: 'Help' },
      },
      {
        path: 'docs/:slug',
        component: () => import('pages/DocsPage.vue'),
        props: true,
        meta: { title: 'Documentation' },
      },
      // Tier-gated routes — imports reference sync-excluded files.
      // Free builds set VITE_FREE_BUILD=true so the spread resolves to [] and
      // rolldown tree-shakes the dynamic imports dead. Do NOT reference any
      // of these page paths outside this guarded block.
      ...(import.meta.env.VITE_FREE_BUILD === 'true' ? [] : [
        {
          // Fabrick overview — demo v3.0+ Fabrick only
          path: 'fabrick',
          component: () => import('pages/fabrick/FabrickOverviewPage.vue'),
          meta: { requiresFabrick: true, title: 'FabricK' },
        },
        {
          // Loom — fleet topology, demo v3.0+ Fabrick only
          path: 'loom',
          component: () => import('pages/fabrick/LoomPage.vue'),
          meta: { requiresFabrick: true, title: 'Loom' },
        },
        {
          // Warp — fleet host configuration patterns, demo v2.5+ Fabrick
          path: 'warp',
          component: () => import('pages/fabrick/WarpPage.vue'),
          meta: { requiresFabrick: true, title: 'Warp' },
        },
        {
          // Workload Groups — demo v3.3+ Fabrick only
          path: 'groups',
          component: () => import('pages/fabrick/GroupsPage.vue'),
          meta: { requiresFabrick: true, title: 'Groups' },
        },
        // Public demo funnel pages (Decision #135)
        {
          path: 'explore/solo',
          component: () => import('pages/funnel/SoloTeaserPage.vue'),
          meta: { title: 'Weaver Solo' },
        },
        {
          path: 'explore/team',
          component: () => import('pages/funnel/TeamVisionPage.vue'),
          meta: { title: 'Weaver Team' },
        },
        {
          path: 'explore/fabrick',
          component: () => import('pages/funnel/FabrickVisionPage.vue'),
          meta: { title: 'FabricK' },
        },
        {
          path: 'explore/pricing',
          component: () => import('pages/funnel/PricingPage.vue'),
          meta: { title: 'Pricing' },
        },
      ]),
    ],
  },

  // Always leave this as last one
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
