<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-icon name="mdi-account-group" size="sm" class="q-mr-sm" />
      <div class="text-h4">User Management</div>
      <q-space />
      <q-btn
        v-if="appStore.isWeaver"
        color="primary"
        icon="mdi-account-plus"
        label="Add User"
        unelevated
        :disable="atFullCap"
        data-testid="add-user-btn"
        @click="showAddDialog = true"
      >
        <q-tooltip v-if="atFullCap">Team limit reached — upgrade to FabricK for unlimited users</q-tooltip>
      </q-btn>
    </div>

    <!-- Free tier: upgrade nag -->
    <q-card v-if="!appStore.isWeaver" flat bordered style="max-width: 600px">
      <q-card-section>
        <div class="row items-center q-gutter-md">
          <q-icon name="mdi-account-group" size="48px" color="grey-4" />
          <div>
            <div class="text-body1 text-weight-medium q-mb-xs">Multi-user access requires Weaver Team</div>
            <div class="text-body2 text-grey-7">
              Free tier is single-admin. Upgrade to
              <q-badge outline color="purple" label="Weaver Team" /> to add up to 4 team members
              plus 1 free viewer seat.
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <template v-else>

    <!-- Weaver Team cap banner -->
    <q-banner
      v-if="!appStore.isFabrick && atFullCap"
      rounded
      class="bg-purple-1 text-purple-9 q-mb-md"
      style="max-width: 800px"
    >
      <template #avatar><q-icon name="mdi-account-group" color="purple" /></template>
      Weaver Team limit reached (4 users + 1 viewer).
      Upgrade to <strong>FabricK</strong> for unlimited users with per-VM access control and audit logs.
    </q-banner>

    <!-- Loading state -->
    <div v-if="loading" class="row justify-center q-pa-xl">
      <q-spinner-dots size="48px" color="primary" />
    </div>

    <!-- Error state -->
    <q-banner v-else-if="errorMsg" rounded class="bg-red-1 text-red-9 q-mb-lg" style="max-width: 700px">
      <template #avatar>
        <q-icon name="mdi-alert-circle" color="negative" />
      </template>
      {{ errorMsg }}
      <template #action>
        <q-btn flat label="Retry" color="negative" @click="loadUsers" />
      </template>
    </q-banner>

    <!-- Users table -->
    <q-card v-else flat bordered style="max-width: 800px">
      <q-table
        :rows="users"
        :columns="columns"
        row-key="id"
        flat
        :rows-per-page-options="[10, 25, 50]"
        :pagination="{ sortBy: 'username', descending: false, rowsPerPage: 25 }"
        data-testid="users-table"
      >
        <!-- Role column with dropdown -->
        <template #body-cell-role="props">
          <q-td :props="props">
            <q-select
              :model-value="props.row.role"
              :options="roleOptions"
              emit-value
              map-options
              dense
              outlined
              style="min-width: 130px"
              :disable="isUpdating(props.row.id)"
              :loading="isUpdating(props.row.id)"
              :data-testid="`role-select-${props.row.username}`"
              @update:model-value="(val: string) => changeRole(props.row, val)"
            />
          </q-td>
        </template>

        <!-- Created date column -->
        <template #body-cell-createdAt="props">
          <q-td :props="props">
            {{ formatDate(props.row.createdAt) }}
            <q-tooltip>{{ props.row.createdAt }}</q-tooltip>
          </q-td>
        </template>

        <!-- Actions column -->
        <template #body-cell-actions="props">
          <q-td :props="props" class="text-right">
            <q-btn
              v-if="appStore.isFabrick && props.row.role !== ROLES.ADMIN"
              flat
              dense
              round
              icon="mdi-shield-lock"
              :color="userAcls[props.row.id]?.length ? 'primary' : 'grey'"
              :data-testid="`vm-acl-btn-${props.row.username}`"
              @click="openAclDialog(props.row)"
            >
              <q-tooltip>VM access control</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="mdi-delete"
              color="negative"
              :disable="isSelf(props.row.id) || isDeleting(props.row.id)"
              :loading="isDeleting(props.row.id)"
              :data-testid="`delete-user-${props.row.username}`"
              @click="confirmDelete(props.row)"
            >
              <q-tooltip v-if="isSelf(props.row.id)">
                You cannot delete your own account
              </q-tooltip>
              <q-tooltip v-else>
                Delete user
              </q-tooltip>
            </q-btn>
          </q-td>
        </template>

        <!-- Username column with "you" badge -->
        <template #body-cell-username="props">
          <q-td :props="props">
            <span>{{ props.row.username }}</span>
            <q-badge
              v-if="isSelf(props.row.id)"
              label="you"
              color="primary"
              class="q-ml-sm"
              outline
              dense
            />
          </q-td>
        </template>
      </q-table>
    </q-card>

    </template><!-- end v-else (weaver team+) -->

    <!-- Add User Dialog -->
    <q-dialog v-model="showAddDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add User</div>
        </q-card-section>

        <q-form @submit.prevent="createUser">
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="newUser.username"
            label="Username"
            outlined
            dense
            data-testid="add-user-username"
            :rules="[
              (v: string) => !!v || 'Required',
              (v: string) => v.length >= 3 || 'At least 3 characters',
              (v: string) => /^[a-z][a-z0-9_-]*$/.test(v) || 'Lowercase letters, digits, hyphens, underscores. Must start with a letter.',
            ]"
            hint="Lowercase, starts with letter"
            lazy-rules
          />
          <q-input
            v-model="newUser.password"
            label="Password"
            outlined
            dense
            :type="showPassword ? 'text' : 'password'"
            data-testid="add-user-password"
            :rules="[
              (v: string) => !!v || 'Required',
              (v: string) => v.length >= 14 || 'At least 14 characters',
              (v: string) => /[A-Z]/.test(v) || 'Needs an uppercase letter',
              (v: string) => /[a-z]/.test(v) || 'Needs a lowercase letter',
              (v: string) => /[0-9]/.test(v) || 'Needs a digit',
              (v: string) => /[^A-Za-z0-9]/.test(v) || 'Needs a special character',
            ]"
            hint="Min 14 chars, uppercase + lowercase + digit + special character"
            lazy-rules
          >
            <template #append>
              <q-icon
                :name="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>
          <q-select
            v-model="newUser.role"
            :options="addRoleOptions"
            emit-value
            map-options
            outlined
            dense
            label="Role"
            data-testid="add-user-role"
          />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancel" color="grey" @click="resetAddDialog" />
          <q-btn
            unelevated
            label="Create User"
            color="primary"
            :loading="creating"
            :disable="!isAddFormValid"
            data-testid="add-user-submit"
            type="submit"
          />
        </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- VM ACL Dialog (Fabrick only) -->
    <q-dialog v-model="showAclDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">
            <q-icon name="mdi-shield-lock" class="q-mr-sm" />
            VM Access — {{ aclTargetUser?.username }}
          </div>
        </q-card-section>

        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-md">
            Select which VMs this user can access. Leave empty for unrestricted access to all VMs.
          </div>
          <div v-if="aclLoading" class="text-center q-pa-md">
            <q-spinner-dots size="32px" color="primary" />
          </div>
          <q-select
            v-else
            v-model="editingAcl"
            :options="vmNameOptions"
            multiple
            use-chips
            outlined
            dense
            label="Allowed VMs"
            data-testid="vm-acl-select"
          >
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey-8">No VMs available</q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn
            flat
            label="Clear all"
            color="negative"
            :disable="aclSaving || editingAcl.length === 0"
            data-testid="vm-acl-clear"
            @click="clearAcl"
          />
          <q-space />
          <q-btn flat label="Cancel" color="grey" @click="showAclDialog = false" />
          <q-btn
            unelevated
            label="Save"
            color="primary"
            :loading="aclSaving"
            data-testid="vm-acl-save"
            @click="saveAcl"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useQuasar, QTableColumn } from 'quasar'
import { api } from 'src/boot/axios'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'
import { useWorkloadStore } from 'src/stores/workload-store'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo'
import { ROLES } from 'src/constants/vocabularies'

interface UserEntry {
  id: string
  username: string
  role: string
  createdAt: string
}

const $q = useQuasar()
const authStore = useAuthStore()
const appStore = useAppStore()
const workloadStore = useWorkloadStore()

const users = ref<UserEntry[]>([])
const loading = ref(true)
const errorMsg = ref('')
const updatingIds = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())

// Add user dialog state
const showAddDialog = ref(false)
const showPassword = ref(false)
const creating = ref(false)
const newUser = ref({ username: '', password: '', role: ROLES.VIEWER })

const roleOptions = [
  { label: 'Admin', value: ROLES.ADMIN },
  { label: 'Operator', value: ROLES.OPERATOR },
  { label: 'Viewer', value: ROLES.VIEWER },
]

// Weaver Team cap: max 4 paying (admin+operator) + 1 viewer free (internal decision)
const payingUserCount = computed(() =>
  users.value.filter(u => u.role !== ROLES.VIEWER).length
)
const viewerCount = computed(() =>
  users.value.filter(u => u.role === ROLES.VIEWER).length
)
const atPayingCap = computed(() => !appStore.isFabrick && payingUserCount.value >= 4)
const atViewerCap = computed(() => !appStore.isFabrick && viewerCount.value >= 1)
const atFullCap = computed(() => !appStore.isFabrick && atPayingCap.value && atViewerCap.value)

// Role options for Add User dialog — disable viewer if slot taken (Weaver Team only)
const addRoleOptions = computed(() => {
  if (appStore.isFabrick) return roleOptions
  return roleOptions.map(opt => ({
    ...opt,
    disable: opt.value === ROLES.VIEWER && atViewerCap.value,
  }))
})

const columns: QTableColumn[] = [
  {
    name: 'username',
    label: 'Username',
    field: 'username',
    align: 'left',
    sortable: true,
  },
  {
    name: 'role',
    label: 'Role',
    field: 'role',
    align: 'left',
    sortable: true,
  },
  {
    name: 'createdAt',
    label: 'Created',
    field: 'createdAt',
    align: 'left',
    sortable: true,
  },
  {
    name: 'actions',
    label: '',
    field: 'id',
    align: 'right',
    sortable: false,
  },
]

function isSelf(userId: string): boolean {
  return userId === authStore.user?.id
}

function isUpdating(userId: string): boolean {
  return updatingIds.value.has(userId)
}

function isDeleting(userId: string): boolean {
  return deletingIds.value.has(userId)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const DEMO_USERS: UserEntry[] = [
  { id: 'demo-user', username: 'demo', role: ROLES.ADMIN, createdAt: new Date(Date.now() - 86_400_000 * 30).toISOString() },
  { id: 'demo-ops', username: 'operator1', role: ROLES.OPERATOR, createdAt: new Date(Date.now() - 86_400_000 * 14).toISOString() },
  { id: 'demo-viewer', username: 'viewer1', role: ROLES.VIEWER, createdAt: new Date(Date.now() - 86_400_000 * 7).toISOString() },
]

async function loadUsers() {
  loading.value = true
  errorMsg.value = ''
  try {
    if (isDemoMode()) {
      users.value = JSON.parse(JSON.stringify(DEMO_USERS))
    } else {
      const response = await api.get('/users')
      users.value = response.data
    }
  } catch (err: unknown) {
    errorMsg.value = extractErrorMessage(err, 'Failed to load users')
  } finally {
    loading.value = false
  }
}

async function changeRole(user: UserEntry, newRole: string) {
  if (user.role === newRole) return

  const oldRole = user.role
  updatingIds.value.add(user.id)
  try {
    if (!isDemoMode()) await api.put(`/users/${user.id}/role`, { role: newRole })
    user.role = newRole
    $q.notify({
      type: 'positive',
      message: `${user.username}'s role changed to ${newRole}`,
      position: 'top-right',
      timeout: 3000,
    })
  } catch (err: unknown) {
    // Revert optimistic update
    user.role = oldRole
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, 'Failed to update role'),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    updatingIds.value.delete(user.id)
  }
}

function confirmDelete(user: UserEntry) {
  $q.dialog({
    title: 'Delete User',
    message: `Are you sure you want to delete user "${user.username}"? This action cannot be undone.`,
    cancel: true,
    persistent: false,
    color: 'negative',
    ok: {
      label: 'Delete',
      color: 'negative',
      flat: true,
    },
  }).onOk(() => deleteUser(user))
}

async function deleteUser(user: UserEntry) {
  deletingIds.value.add(user.id)
  try {
    if (!isDemoMode()) await api.delete(`/users/${user.id}`)
    users.value = users.value.filter(u => u.id !== user.id)
    $q.notify({
      type: 'positive',
      message: `User "${user.username}" deleted`,
      position: 'top-right',
      timeout: 3000,
    })
  } catch (err: unknown) {
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, 'Failed to delete user'),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    deletingIds.value.delete(user.id)
  }
}

// Add user form
const isAddFormValid = computed(() => {
  const u = newUser.value
  return (
    u.username.length >= 3 &&
    /^[a-z][a-z0-9_-]*$/.test(u.username) &&
    u.password.length >= 14 &&
    /[A-Z]/.test(u.password) &&
    /[a-z]/.test(u.password) &&
    /[0-9]/.test(u.password) &&
    /[^A-Za-z0-9]/.test(u.password)
  )
})

function resetAddDialog() {
  showAddDialog.value = false
  showPassword.value = false
  newUser.value = { username: '', password: '', role: ROLES.VIEWER }
}

async function createUser() {
  creating.value = true
  try {
    if (isDemoMode()) {
      users.value.push({
        id: `demo-${Date.now()}`,
        username: newUser.value.username,
        role: newUser.value.role,
        createdAt: new Date().toISOString(),
      })
    } else {
      await api.post('/auth/register', {
        username: newUser.value.username,
        password: newUser.value.password,
        role: newUser.value.role,
      })
    }
    $q.notify({
      type: 'positive',
      message: `User "${newUser.value.username}" created`,
      position: 'top-right',
      timeout: 3000,
    })
    resetAddDialog()
    await loadUsers()
  } catch (err: unknown) {
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, 'Failed to create user'),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    creating.value = false
  }
}

// --- VM ACL management (Fabrick only) ---
const showAclDialog = ref(false)
const aclTargetUser = ref<UserEntry | null>(null)
const editingAcl = ref<string[]>([])
const aclLoading = ref(false)
const aclSaving = ref(false)
const userAcls = reactive<Record<string, string[]>>({})

const vmNameOptions = computed(() =>
  workloadStore.workloads.map(w => w.name).sort()
)

// Demo ACL assignments: operator has broad production access, viewer is restricted
const DEMO_ACLS: Record<string, string[]> = {
  'demo-ops':    ['lb-haproxy-01', 'api-gateway', 'web-frontend-01', 'web-frontend-02', 'svc-orders', 'svc-payments', 'qa-staging', 'qa-load-test'],
  'demo-viewer': ['lb-haproxy-01', 'mon-prometheus'],
}

async function loadUserAcls() {
  if (!appStore.isFabrick) return
  if (isDemoMode()) {
    for (const user of users.value) {
      if (user.role !== ROLES.ADMIN) userAcls[user.id] = DEMO_ACLS[user.id] ?? []
    }
    return
  }
  for (const user of users.value) {
    if (user.role === ROLES.ADMIN) continue
    try {
      const { data } = await api.get<{ vmNames: string[] }>(`/users/${user.id}/vms`)
      userAcls[user.id] = data.vmNames
    } catch {
      // Ignore — may fail on non-Fabrick tiers
    }
  }
}

async function openAclDialog(user: UserEntry) {
  aclTargetUser.value = user
  showAclDialog.value = true
  aclLoading.value = true
  try {
    if (isDemoMode()) {
      editingAcl.value = []
      userAcls[user.id] = []
    } else {
      const { data } = await api.get<{ vmNames: string[] }>(`/users/${user.id}/vms`)
      editingAcl.value = [...data.vmNames]
      userAcls[user.id] = data.vmNames
    }
  } catch (err: unknown) {
    editingAcl.value = []
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, 'Failed to load VM access list'),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    aclLoading.value = false
  }
}

async function saveAcl() {
  if (!aclTargetUser.value) return
  aclSaving.value = true
  try {
    let savedNames: string[]
    if (isDemoMode()) {
      savedNames = [...editingAcl.value]
    } else {
      const { data } = await api.put<{ vmNames: string[] }>(
        `/users/${aclTargetUser.value.id}/vms`,
        { vmNames: editingAcl.value }
      )
      savedNames = data.vmNames
    }
    userAcls[aclTargetUser.value.id] = savedNames
    showAclDialog.value = false
    $q.notify({
      type: 'positive',
      message: savedNames.length
        ? `VM access updated for ${aclTargetUser.value.username} (${savedNames.length} VMs)`
        : `VM access restrictions cleared for ${aclTargetUser.value.username}`,
      position: 'top-right',
      timeout: 3000,
    })
  } catch (err: unknown) {
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, 'Failed to update VM access'),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    aclSaving.value = false
  }
}

async function clearAcl() {
  if (!aclTargetUser.value) return
  aclSaving.value = true
  try {
    if (!isDemoMode()) await api.delete(`/users/${aclTargetUser.value.id}/vms`)
    userAcls[aclTargetUser.value.id] = []
    editingAcl.value = []
    showAclDialog.value = false
    $q.notify({
      type: 'positive',
      message: `VM access restrictions cleared for ${aclTargetUser.value.username}`,
      position: 'top-right',
      timeout: 3000,
    })
  } catch (err: unknown) {
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, 'Failed to clear VM access'),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    aclSaving.value = false
  }
}

onMounted(async () => {
  await loadUsers()
  await loadUserAcls()
})
</script>
