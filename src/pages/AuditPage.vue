<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page class="q-pa-md">
    <!-- Fabrick tier gate -->
    <div v-if="!appStore.isFabrick" class="column items-center q-pa-xl">
      <q-icon name="mdi-lock" size="64px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-7">FabricK Feature</div>
      <div class="text-body2 text-grey-8 q-mt-sm" style="max-width: 400px; text-align: center">
        The audit log is available on the FabricK tier. Upgrade your license to access detailed activity tracking.
      </div>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="text-h5">
        <q-icon name="mdi-text-box-search" class="q-mr-sm" />
        Audit Log
      </div>
      <q-space />
      <q-btn
        flat
        dense
        icon="mdi-refresh"
        label="Refresh"
        :loading="loading"
        @click="fetch"
      >
        <q-tooltip>Refresh audit entries</q-tooltip>
      </q-btn>
    </div>

    <!-- Filters -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row q-gutter-sm items-end">
          <!-- Date range: since -->
          <q-input
            v-model="filters.since"
            dense
            outlined
            type="date"
            label="From"
            class="col-auto"
            style="min-width: 160px"
            clearable
            data-testid="audit-filter-since"
          />

          <!-- Date range: until -->
          <q-input
            v-model="filters.until"
            dense
            outlined
            type="date"
            label="Until"
            class="col-auto"
            style="min-width: 160px"
            clearable
            data-testid="audit-filter-until"
          />

          <!-- Action type -->
          <q-select
            v-model="filters.action"
            dense
            outlined
            :options="actionOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            label="Action"
            class="col-auto"
            style="min-width: 180px"
            clearable
            data-testid="audit-filter-action"
          />

          <!-- User filter -->
          <q-input
            v-model="filters.userId"
            dense
            outlined
            label="User ID"
            class="col-auto"
            style="min-width: 160px"
            clearable
            data-testid="audit-filter-user"
          />

          <!-- Resource filter -->
          <q-input
            v-model="filters.resource"
            dense
            outlined
            label="Resource"
            class="col-auto"
            style="min-width: 160px"
            clearable
            data-testid="audit-filter-resource"
          />

          <!-- Filter actions -->
          <q-btn
            color="primary"
            dense
            label="Apply"
            icon="mdi-filter"
            @click="applyFilters"
            data-testid="audit-apply-filters"
          />
          <q-btn
            flat
            dense
            label="Clear"
            icon="mdi-filter-off"
            @click="handleClearFilters"
            data-testid="audit-clear-filters"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Error state -->
    <q-banner v-if="error" type="warning" class="q-mb-md" rounded>
      <template #avatar>
        <q-icon name="mdi-alert" color="warning" />
      </template>
      {{ error }}
      <template #action>
        <q-btn flat label="Retry" @click="fetch" />
      </template>
    </q-banner>

    <!-- Table -->
    <q-table
      flat
      bordered
      :rows="entries"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :rows-per-page-options="[25, 50, 100]"
      v-model:pagination="tablePagination"
      hide-pagination
      data-testid="audit-table"
    >
      <!-- Timestamp column -->
      <template #body-cell-timestamp="props">
        <q-td :props="props">
          <span class="text-caption">{{ formatTimestamp(props.row.timestamp) }}</span>
        </q-td>
      </template>

      <!-- Username column -->
      <template #body-cell-username="props">
        <q-td :props="props">
          <span class="text-weight-medium">{{ props.row.username }}</span>
        </q-td>
      </template>

      <!-- Action column (color-coded) -->
      <template #body-cell-action="props">
        <q-td :props="props">
          <q-badge
            :color="getActionColor(props.row.action)"
            :label="props.row.action"
            outline
          />
        </q-td>
      </template>

      <!-- Resource column -->
      <template #body-cell-resource="props">
        <q-td :props="props">
          <span v-if="props.row.resource" class="text-caption">{{ props.row.resource }}</span>
          <span v-else class="text-grey-8 text-caption">--</span>
        </q-td>
      </template>

      <!-- Success column (check/X) -->
      <template #body-cell-success="props">
        <q-td :props="props">
          <q-icon
            v-if="props.row.success"
            name="mdi-check-circle"
            color="positive"
            size="20px"
          >
            <q-tooltip>Success</q-tooltip>
          </q-icon>
          <q-icon
            v-else
            name="mdi-close-circle"
            color="negative"
            size="20px"
          >
            <q-tooltip>Failed</q-tooltip>
          </q-icon>
        </q-td>
      </template>

      <!-- IP column -->
      <template #body-cell-ip="props">
        <q-td :props="props">
          <span v-if="props.row.ip" class="text-caption text-mono">{{ props.row.ip }}</span>
          <span v-else class="text-grey-8 text-caption">--</span>
        </q-td>
      </template>

      <!-- Empty state -->
      <template #no-data>
        <div class="text-center q-pa-xl full-width">
          <q-icon name="mdi-text-box-remove" size="60px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-8">No Audit Entries</div>
          <div class="text-caption text-grey-8 q-mt-sm">
            No log entries match the current filters.
          </div>
        </div>
      </template>
    </q-table>

    <!-- Custom pagination -->
    <div class="row items-center justify-between q-mt-sm">
      <div class="text-caption text-grey-8">
        Showing {{ paginationStart }}&#8211;{{ paginationEnd }} of {{ total }} entries
      </div>
      <div class="row items-center q-gutter-sm">
        <q-btn
          flat
          dense
          icon="mdi-chevron-left"
          :disable="!hasPrev"
          @click="prevPage"
          data-testid="audit-prev-page"
        >
          <q-tooltip>Previous page</q-tooltip>
        </q-btn>
        <span class="text-caption">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <q-btn
          flat
          dense
          icon="mdi-chevron-right"
          :disable="!hasNext"
          @click="nextPage"
          data-testid="audit-next-page"
        >
          <q-tooltip>Next page</q-tooltip>
        </q-btn>
      </div>
    </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useAudit, actionColor, AUDIT_ACTIONS } from 'src/composables/useAudit'
import { useAppStore } from 'src/stores/app'
import type { QTableColumn } from 'quasar'

const appStore = useAppStore()

const {
  entries,
  total,
  loading,
  error,
  filters,
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  fetch,
  nextPage,
  prevPage,
  applyFilters,
  resetFilters,
  offset,
  limit,
} = useAudit()

// Table column definitions
const columns: QTableColumn[] = [
  {
    name: 'timestamp',
    label: 'Timestamp',
    field: 'timestamp',
    align: 'left',
    sortable: false,
    style: 'width: 180px',
  },
  {
    name: 'username',
    label: 'User',
    field: 'username',
    align: 'left',
    sortable: false,
  },
  {
    name: 'action',
    label: 'Action',
    field: 'action',
    align: 'left',
    sortable: false,
  },
  {
    name: 'resource',
    label: 'Resource',
    field: 'resource',
    align: 'left',
    sortable: false,
  },
  {
    name: 'success',
    label: 'Status',
    field: 'success',
    align: 'center',
    sortable: false,
    style: 'width: 80px',
  },
  {
    name: 'ip',
    label: 'IP',
    field: 'ip',
    align: 'left',
    sortable: false,
    style: 'width: 140px',
  },
]

// Action filter options
const actionOptions = AUDIT_ACTIONS.map((a) => ({
  label: a,
  value: a,
}))

// Table pagination object (controls rows-per-page but we handle paging ourselves)
const tablePagination = reactive({
  rowsPerPage: 0, // 0 = show all rows returned by server (we handle paging)
})

// Computed pagination display values
const paginationStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const paginationEnd = computed(() => Math.min(offset.value + limit.value, total.value))

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

function getActionColor(action: string): string {
  return actionColor(action)
}

function handleClearFilters() {
  resetFilters()
  void fetch()
}

onMounted(() => {
  void fetch()
})
</script>

<style scoped lang="scss">
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
</style>
