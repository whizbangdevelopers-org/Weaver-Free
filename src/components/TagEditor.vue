<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="tag-editor">
    <div class="row items-center q-gutter-xs wrap">
      <q-chip
        v-for="tag in tags"
        :key="tag"
        removable
        dense
        outline
        color="primary"
        size="sm"
        @remove="removeTag(tag)"
      >
        {{ tag }}
      </q-chip>
      <q-input
        v-if="tags.length < 10"
        v-model="newTag"
        dense
        borderless
        placeholder="Add tag..."
        class="tag-input"
        style="max-width: 140px"
        @keydown.enter.prevent="addTag"
        @keydown.tab.prevent="addTag"
      >
        <template #append>
          <q-icon
            v-if="newTag.trim()"
            name="mdi-plus"
            size="16px"
            class="cursor-pointer"
            @click="addTag"
          />
        </template>
        <q-menu v-if="filteredSuggestions.length > 0" fit no-focus auto-close>
          <q-list dense>
            <q-item
              v-for="suggestion in filteredSuggestions"
              :key="suggestion"
              clickable
              @click="addSuggestion(suggestion)"
            >
              <q-item-section>
                <q-chip dense outline size="sm" color="grey">{{ suggestion }}</q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-input>
    </div>
    <div v-if="validationError" class="text-negative text-caption q-mt-xs">{{ validationError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkloadStore } from 'src/stores/workload-store'

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

const props = defineProps<{
  tags: string[]
}>()

const emit = defineEmits<{
  'update:tags': [tags: string[]]
}>()

const workloadStore = useWorkloadStore()
const newTag = ref('')
const validationError = ref('')

const filteredSuggestions = computed(() => {
  const input = newTag.value.toLowerCase().trim()
  if (!input) return []
  return workloadStore.allTags
    .filter(tag => tag.includes(input) && !props.tags.includes(tag))
    .slice(0, 5)
})

function normalizeTag(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, '-')
}

function addTag() {
  const tag = normalizeTag(newTag.value)
  if (!tag) return

  validationError.value = ''
  if (tag.length > 30) {
    validationError.value = 'Tag must be 30 characters or less'
    return
  }
  if (!TAG_PATTERN.test(tag)) {
    validationError.value = 'Lowercase alphanumeric and hyphens only'
    return
  }
  if (props.tags.includes(tag)) {
    validationError.value = 'Tag already exists'
    newTag.value = ''
    return
  }
  if (props.tags.length >= 10) {
    validationError.value = 'Maximum 10 tags'
    return
  }

  emit('update:tags', [...props.tags, tag])
  newTag.value = ''
}

function addSuggestion(tag: string) {
  if (!props.tags.includes(tag) && props.tags.length < 10) {
    emit('update:tags', [...props.tags, tag])
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  emit('update:tags', props.tags.filter(t => t !== tag))
  validationError.value = ''
}
</script>

<style scoped lang="scss">
.tag-input {
  :deep(.q-field__control) {
    height: 28px;
  }
}
</style>
