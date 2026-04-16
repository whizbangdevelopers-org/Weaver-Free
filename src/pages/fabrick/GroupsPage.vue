<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Workload Groups page — demo v3.3+ FabricK only.
  Manages workload groups for scoped Weaver views, compliance tagging,
  and identity provider (IdP) integration.
-->
<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-lg">
      <q-icon name="mdi-folder-account" size="32px" class="q-mr-sm" />
      <div class="text-h4">Workload Groups</div>
      <q-badge outline color="grey-6" label="v3.3.0" class="q-ml-sm" />
      <q-space />
      <q-btn color="primary" icon="mdi-plus" label="Create Group" @click="showCreate = true" />
    </div>

    <!-- Groups list -->
    <div class="row q-gutter-md">
      <q-card v-for="g in groups" :key="g.id" flat bordered class="col-12 col-md-5" style="min-width: 320px">
        <q-card-section>
          <div class="row items-center q-mb-sm">
            <q-icon name="mdi-folder-account" size="24px" :color="g.color" class="q-mr-sm" />
            <span class="text-h6">{{ g.name }}</span>
            <q-space />
            <q-badge :color="g.color" :label="`${g.workloads} workloads`" />
          </div>
          <div class="text-caption text-grey-8 q-mb-sm">{{ g.description }}</div>

          <!-- Compliance tags -->
          <div class="row q-gutter-xs q-mb-sm">
            <q-badge v-for="tag in g.compliance" :key="tag" outline color="amber-9" :label="tag" size="sm" />
          </div>

          <!-- Members -->
          <div class="row items-center q-gutter-xs q-mb-sm">
            <q-icon name="mdi-account-multiple" size="16px" color="grey" />
            <span class="text-caption text-grey-8">{{ g.members }} members</span>
            <q-icon name="mdi-account-key" size="16px" color="grey" class="q-ml-sm" />
            <span class="text-caption text-grey-8">{{ g.owners }} owners</span>
          </div>

          <!-- AI policy -->
          <div class="row items-center q-gutter-xs q-mb-sm">
            <q-icon name="mdi-robot" size="16px" color="grey" />
            <span class="text-caption">AI policy:</span>
            <q-badge outline :color="aiPolicyColor(g.aiPolicy)" :label="g.aiPolicy" size="sm" />
          </div>

          <!-- IdP group sync detail -->
          <div v-if="g.idpDn" class="q-mt-xs">
            <div class="row items-center q-gutter-xs">
              <q-icon name="mdi-cloud-sync" size="16px" color="grey" />
              <span class="text-caption text-grey-8">IdP: {{ g.idpDn }}</span>
              <q-space />
              <q-btn flat dense size="xs" icon="mdi-chevron-down" :icon-right="idpExpanded[g.id] ? 'mdi-chevron-up' : 'mdi-chevron-down'" @click="idpExpanded[g.id] = !idpExpanded[g.id]" />
            </div>
            <div v-if="idpExpanded[g.id]" class="q-ml-md q-mt-xs">
              <div class="row q-gutter-sm items-center">
                <q-badge :color="idpSyncStatus[g.id]?.status === 'synced' ? 'positive' : 'warning'" :label="idpSyncStatus[g.id]?.status ?? 'unknown'" size="sm" />
                <span class="text-caption text-grey-8">Last sync: {{ idpSyncStatus[g.id]?.lastSync ?? 'never' }}</span>
              </div>
              <div class="row q-gutter-sm items-center q-mt-xs">
                <span class="text-caption">IdP members: {{ idpSyncStatus[g.id]?.idpMembers ?? 0 }}</span>
                <span class="text-caption text-grey-8">|</span>
                <span class="text-caption">Local members: {{ idpSyncStatus[g.id]?.localMembers ?? 0 }}</span>
              </div>
              <q-btn flat dense size="xs" icon="mdi-sync" label="Sync Now" color="primary" class="q-mt-xs" />
            </div>
          </div>

          <!-- Fleet bridge (1:1 mapping — Decision #114) -->
          <div v-if="fleetBridgeFor(g.id)" class="row items-center q-gutter-xs q-mt-sm">
            <q-icon name="mdi-lan" size="16px" color="deep-purple" />
            <span class="text-caption">Fleet bridge:</span>
            <q-badge outline color="deep-purple" :label="fleetBridgeFor(g.id)!.name" size="sm" />
            <q-badge
              :color="fleetBridgeFor(g.id)!.overlay === 'vxlan' ? 'blue-7' : 'orange-7'"
              :label="fleetBridgeFor(g.id)!.overlay.toUpperCase()"
              size="xs"
            />
            <q-badge
              :color="fleetBridgeFor(g.id)!.health === 'healthy' ? 'positive' : 'warning'"
              :label="fleetBridgeFor(g.id)!.health"
              size="xs"
            />
          </div>

          <q-separator class="q-my-sm" />
          <div class="row q-gutter-xs">
            <q-btn flat dense size="sm" icon="mdi-eye" label="View scope" color="primary" />
            <q-btn
              v-if="fleetBridgeFor(g.id)"
              flat dense size="sm" icon="mdi-lan" label="View bridge" color="deep-purple"
              @click="navigateToFleetBridge()"
            />
            <q-btn flat dense size="sm" icon="mdi-pencil" label="Edit" color="grey-7" />
            <q-btn flat dense size="sm" icon="mdi-account-plus" label="Add member" color="grey-7" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Access Request Queue -->
    <q-card flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <q-icon name="mdi-account-clock" size="24px" class="q-mr-sm" />
          <span class="text-h6">Access Requests</span>
          <q-badge color="warning" label="2 pending" class="q-ml-sm" />
        </div>
        <q-markup-table flat dense bordered>
          <thead>
            <tr>
              <th class="text-left">User</th>
              <th class="text-left">Group</th>
              <th class="text-left">Requested</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>alice@example.com</td>
              <td>Production</td>
              <td>2026-03-30 14:22</td>
              <td>
                <q-btn flat dense size="xs" icon="mdi-check" label="Approve" color="positive" class="q-mr-xs" />
                <q-btn flat dense size="xs" icon="mdi-close" label="Deny" color="negative" />
              </td>
            </tr>
            <tr>
              <td>bob@example.com</td>
              <td>CI/CD</td>
              <td>2026-03-31 09:15</td>
              <td>
                <q-btn flat dense size="xs" icon="mdi-check" label="Approve" color="positive" class="q-mr-xs" />
                <q-btn flat dense size="xs" icon="mdi-close" label="Deny" color="negative" />
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card-section>
    </q-card>

    <!-- Compliance Audit Trail -->
    <q-card flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <q-icon name="mdi-shield-check" size="24px" class="q-mr-sm" />
          <span class="text-h6">Compliance Audit Trail</span>
        </div>
        <q-list dense separator>
          <q-item v-for="evt in auditEvents" :key="evt.id">
            <q-item-section avatar><q-icon :name="evt.icon" :color="evt.color" size="18px" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ evt.action }}</q-item-label>
              <q-item-label caption>{{ evt.actor }} · {{ evt.time }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="evt.framework" outline color="amber-9" :label="evt.framework" size="sm" />
            </q-item-section>
          </q-item>
        </q-list>
        <div class="row q-gutter-sm q-mt-md">
          <q-btn flat dense size="sm" icon="mdi-download" label="Export HIPAA report" color="primary" />
          <q-btn flat dense size="sm" icon="mdi-download" label="Export CMMC report" color="primary" />
        </div>
      </q-card-section>
    </q-card>

    <!-- Access Inspector -->
    <q-card flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <q-icon name="mdi-eye-check" size="24px" class="q-mr-sm" />
          <span class="text-h6">Access Inspector</span>
          <q-badge outline color="grey-6" label="View As" class="q-ml-sm" />
        </div>
        <div class="row q-gutter-md items-end q-mb-md">
          <q-select v-model="inspectorUser" :options="inspectorUsers" label="Select user" outlined dense style="min-width: 200px" />
          <q-select v-model="inspectorGroup" :options="inspectorGroups" label="Scope to group" outlined dense clearable style="min-width: 200px" />
          <q-btn flat dense size="sm" icon="mdi-eye" label="Inspect" color="primary" />
        </div>
        <q-markup-table flat dense bordered>
          <thead>
            <tr><th class="text-left">Workload</th><th class="text-left">Host</th><th class="text-left">Access</th><th class="text-left">Source</th></tr>
          </thead>
          <tbody>
            <tr v-for="w in inspectorWorkloads" :key="w.name">
              <td class="text-weight-medium">{{ w.name }}</td>
              <td class="text-caption">{{ w.host }}</td>
              <td><q-badge :color="w.access === 'manage' ? 'positive' : w.access === 'view' ? 'info' : 'grey'" :label="w.access" /></td>
              <td class="text-caption">{{ w.source }}</td>
            </tr>
          </tbody>
        </q-markup-table>
        <div class="text-caption text-grey-8 q-mt-sm">
          <q-icon name="mdi-information-outline" size="14px" class="q-mr-xs" />
          Shows the effective permissions for the selected user and scope
        </div>
      </q-card-section>
    </q-card>

    <!-- Compliance Report Generator -->
    <q-card flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <q-icon name="mdi-file-certificate" size="24px" class="q-mr-sm" />
          <span class="text-h6">Compliance Reports</span>
        </div>
        <div class="row q-gutter-md items-end">
          <q-select v-model="reportFramework" :options="['HIPAA', 'PCI-DSS', 'CMMC', 'SOC2', 'ISO27001', 'NIST']" label="Framework" outlined dense style="min-width: 160px" />
          <q-select v-model="reportFormat" :options="['PDF', 'CSV']" label="Format" outlined dense style="min-width: 100px" />
          <div>
            <div class="text-caption text-grey-8 q-mb-xs">Date range</div>
            <span class="text-body2">2026-01-01 — 2026-03-31</span>
          </div>
          <q-space />
          <q-btn unelevated icon="mdi-file-download" label="Generate Report" color="primary" @click="showReportToast = true" />
        </div>
        <q-banner v-if="showReportToast" class="q-mt-md bg-positive text-white" rounded>
          <template v-slot:avatar><q-icon name="mdi-check-circle" /></template>
          {{ reportFramework }} report generated — {{ reportFormat }} ready for download
          <template v-slot:action><q-btn flat label="Download" color="white" /><q-btn flat label="Dismiss" color="white" @click="showReportToast = false" /></template>
        </q-banner>
      </q-card-section>
    </q-card>

    <!-- Create Group Dialog -->
    <q-dialog v-model="showCreate" max-width="500px">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-xs">
          <q-icon name="mdi-folder-plus" size="22px" color="primary" class="q-mr-sm" />
          <span class="text-h6">Create Workload Group</span>
          <q-space />
          <q-btn flat round dense icon="mdi-close" @click="showCreate = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-md">
          <q-input v-model="newGroup.name" label="Group name" outlined dense placeholder="e.g. Production" />
          <q-input v-model="newGroup.description" label="Description" outlined dense placeholder="Production workloads across all hosts" />
          <q-select v-model="newGroup.aiPolicy" label="AI policy" outlined dense :options="['allow-all', 'claude-only', 'local-only', 'none']" />
          <q-input v-model="newGroup.idpDn" label="IdP group DN (optional)" outlined dense placeholder="CN=Production,OU=Groups,DC=corp" />
          <q-select v-model="newGroup.compliance" label="Compliance frameworks" outlined dense multiple :options="['HIPAA', 'PCI-DSS', 'CMMC', 'SOC2', 'ISO27001', 'NIST']" />
        </q-card-section>
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Cancel" color="grey-7" @click="showCreate = false" />
          <q-btn unelevated label="Create" color="primary" icon="mdi-plus" @click="showCreate = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DEMO_FLEET_BRIDGES } from 'src/config/demo'
import type { DemoFleetBridge } from 'src/config/demo'

const router = useRouter()
const showCreate = ref(false)

// IdP sync expandable state
const idpExpanded = reactive<Record<string, boolean>>({})
const idpSyncStatus: Record<string, { lastSync: string; idpMembers: number; localMembers: number; status: string }> = {
  prod: { lastSync: '2026-03-31 02:00', idpMembers: 12, localMembers: 8, status: 'synced' },
  data: { lastSync: '2026-03-31 02:00', idpMembers: 7, localMembers: 5, status: 'synced' },
}

// Access Inspector state
const inspectorUser = ref('alice@example.com')
const inspectorGroup = ref<string | null>(null)
const inspectorUsers = ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@ops']
const inspectorGroups = ['Production', 'CI/CD', 'Data Platform', 'Edge Fleet']
const inspectorWorkloads = [
  { name: 'web-nginx', host: 'king', access: 'manage', source: 'Production group' },
  { name: 'app-server', host: 'king', access: 'manage', source: 'Production group' },
  { name: 'db-primary', host: 'vault', access: 'view', source: 'Data Platform group' },
  { name: 'ci-runner', host: 'crucible', access: 'none', source: '—' },
  { name: 'monitoring-stack', host: 'nexus', access: 'view', source: 'Inherited (admin)' },
]

// Compliance report state
const reportFramework = ref('HIPAA')
const reportFormat = ref('PDF')
const showReportToast = ref(false)

/** Find the fleet bridge bound to a workload group (1:1 mapping, Decision #114). */
function fleetBridgeFor(groupId: string): DemoFleetBridge | undefined {
  return DEMO_FLEET_BRIDGES.find(fb => fb.workloadGroupId === groupId)
}

/** Navigate to Loom page (logical view will show fleet bridges). */
function navigateToFleetBridge() {
  void router.push('/loom')
}

const newGroup = ref({
  name: '',
  description: '',
  aiPolicy: 'allow-all',
  idpDn: '',
  compliance: [] as string[],
})

const groups = [
  {
    id: 'prod', name: 'Production', description: 'Customer-facing production workloads', color: 'red-7',
    workloads: 14, members: 8, owners: 2, aiPolicy: 'claude-only',
    compliance: ['HIPAA', 'SOC2'], idpDn: 'CN=Prod-Team,OU=Groups,DC=corp',
  },
  {
    id: 'cicd', name: 'CI/CD', description: 'Build and deployment pipeline hosts', color: 'blue-7',
    workloads: 6, members: 4, owners: 1, aiPolicy: 'allow-all',
    compliance: [], idpDn: null,
  },
  {
    id: 'data', name: 'Data Platform', description: 'Databases, caches, and data processing', color: 'teal-7',
    workloads: 8, members: 5, owners: 2, aiPolicy: 'local-only',
    compliance: ['PCI-DSS', 'HIPAA'], idpDn: 'CN=Data-Team,OU=Groups,DC=corp',
  },
  {
    id: 'edge', name: 'Edge Fleet', description: 'IoT gateways and edge inference nodes', color: 'amber-8',
    workloads: 5, members: 3, owners: 1, aiPolicy: 'none',
    compliance: ['CMMC'], idpDn: null,
  },
]

const auditEvents = [
  { id: '1', action: 'alice@example.com added to Production group', actor: 'admin@corp', time: '2026-03-30 14:30', icon: 'mdi-account-plus', color: 'positive', framework: 'HIPAA' },
  { id: '2', action: 'AI policy changed: Data Platform → local-only', actor: 'admin@corp', time: '2026-03-29 11:00', icon: 'mdi-robot', color: 'warning', framework: 'PCI-DSS' },
  { id: '3', action: 'bob@example.com removed from Edge Fleet', actor: 'admin@corp', time: '2026-03-28 16:45', icon: 'mdi-account-minus', color: 'negative', framework: null },
  { id: '4', action: 'IdP sync: 2 members added to Production from LDAP', actor: 'system', time: '2026-03-28 02:00', icon: 'mdi-cloud-sync', color: 'blue', framework: null },
  { id: '5', action: 'SoD check passed: operator ≠ approver for access request', actor: 'system', time: '2026-03-27 14:22', icon: 'mdi-shield-check', color: 'positive', framework: 'SOC2' },
]

function aiPolicyColor(policy: string): string {
  if (policy === 'allow-all') return 'positive'
  if (policy === 'claude-only') return 'deep-purple'
  if (policy === 'local-only') return 'teal'
  return 'negative'
}
</script>
