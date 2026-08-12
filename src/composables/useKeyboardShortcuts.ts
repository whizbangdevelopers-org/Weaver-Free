// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from 'src/stores/ui-store'
import { useWorkloadApi } from 'src/composables/useVmApi'

/**
 * One row per shortcut, exported so the overlay RENDERS FROM THIS TABLE rather than restating it.
 *
 * A hand-written help panel is the classic drift surface: the shortcut changes, the panel does
 * not, and the panel is the only place a user ever looks. Deriving it means a new row is
 * documented the moment it works, and a removed row cannot linger in the docs.
 *
 * `context` is presentational grouping only — the actual gating lives in the handler, because a
 * shortcut's precondition (a route, a focused workload, an open overlay) is not expressible as a
 * string.
 */
export interface ShortcutRow {
  keys: string
  description: string
  context: 'Global' | 'Workload list' | 'Focused workload'
}

export const SHORTCUTS: ShortcutRow[] = [
  { keys: '?', description: 'Show this shortcut overlay', context: 'Global' },
  { keys: 'd', description: 'Go to Weaver', context: 'Global' },
  { keys: 's', description: 'Go to Settings', context: 'Global' },
  { keys: 't', description: 'Go to Strands (network topology)', context: 'Global' },
  { keys: 'n', description: 'Create a new workload', context: 'Global' },
  { keys: 'Esc', description: 'Close the overlay, or clear workload focus', context: 'Global' },
  { keys: '/', description: 'Focus the search box', context: 'Workload list' },
  { keys: 'j', description: 'Focus the next workload', context: 'Workload list' },
  { keys: 'k', description: 'Focus the previous workload', context: 'Workload list' },
  { keys: 'Enter', description: 'Open the focused workload', context: 'Workload list' },
  { keys: 'Shift + S', description: 'Start the focused workload', context: 'Focused workload' },
  { keys: 'Shift + X', description: 'Stop the focused workload', context: 'Focused workload' },
  { keys: 'Shift + R', description: 'Restart the focused workload', context: 'Focused workload' },
]

/** Routes on which list navigation applies. */
const WORKLOAD_LIST_ROUTES = ['/weaver']

export function useKeyboardShortcuts() {
  const router = useRouter()
  const route = useRoute()
  const uiStore = useUiStore()
  const { vmAction } = useWorkloadApi()

  const onWorkloadList = () => WORKLOAD_LIST_ROUTES.includes(route.path)

  function focusSearchBox() {
    // Queried rather than injected: the toolbar is mounted by the page, not by the layout that
    // owns this composable, so there is no ref to thread through. The testid is the contract.
    const el = document.querySelector<HTMLInputElement>('[data-testid="workload-search-input"]')
    el?.focus()
    el?.select()
  }

  async function actOnFocused(action: 'start' | 'stop' | 'restart') {
    const name = uiStore.focusedWorkloadName
    if (!name) return
    await vmAction(name, action)
  }

  function handler(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    const tag = target?.tagName
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable

    // Escape is the ONE key that must work while typing — it is how you get out of the search box.
    // Everything below this point is suppressed during text entry.
    if (e.key === 'Escape') {
      if (uiStore.shortcutOverlayOpen) {
        e.preventDefault()
        uiStore.setShortcutOverlay(false)
        return
      }
      if (typing) {
        // Leave the field; do not also clear focus, or one Escape does two things.
        ;(target as HTMLInputElement).blur()
        return
      }
      if (uiStore.focusedWorkloadName) {
        e.preventDefault()
        uiStore.clearWorkloadFocus()
      }
      return
    }

    if (typing) return

    // While the overlay is open it owns the keyboard — otherwise `d` would navigate away
    // underneath it, leaving the user on a new page wondering what happened.
    if (uiStore.shortcutOverlayOpen) {
      if (e.key === '?') {
        e.preventDefault()
        uiStore.setShortcutOverlay(false)
      }
      return
    }

    // A modifier means the user is talking to the browser or the OS, not to us. Shift is the
    // exception — it is part of `?` and of the Shift+S/X/R actions.
    if (e.ctrlKey || e.metaKey || e.altKey) return

    switch (e.key) {
      // `?` is Shift+/ on most layouts, so the plan's "?" and "Shift+?" are one keystroke. It
      // opens the OVERLAY rather than navigating to the Help page: that is the near-universal
      // convention, and the overlay carries a link to the full Help page, so nothing is lost.
      case '?':
        e.preventDefault()
        uiStore.setShortcutOverlay(true)
        return

      case 'd':
        e.preventDefault()
        void router.push('/weaver')
        return

      case 's':
        e.preventDefault()
        void router.push('/settings')
        return

      case 't':
        e.preventDefault()
        void router.push('/network')
        return

      case 'n':
        e.preventDefault()
        void router.push({ path: '/weaver', query: { action: 'create' } })
        return

      // Uppercase because Shift is held — `e.key` is already the shifted character, so this can
      // never collide with the bare `s` above.
      case 'S':
        e.preventDefault()
        void actOnFocused('start')
        return

      case 'X':
        e.preventDefault()
        void actOnFocused('stop')
        return

      case 'R':
        e.preventDefault()
        void actOnFocused('restart')
        return
    }

    // --- list-scoped, below here ---
    if (!onWorkloadList()) return

    switch (e.key) {
      case '/':
        e.preventDefault()
        focusSearchBox()
        return

      case 'j':
        e.preventDefault()
        uiStore.focusNextWorkload()
        return

      case 'k':
        e.preventDefault()
        uiStore.focusPrevWorkload()
        return

      case 'Enter': {
        const name = uiStore.focusedWorkloadName
        if (!name) return
        e.preventDefault()
        void router.push(`/workload/${encodeURIComponent(name)}`)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
}
