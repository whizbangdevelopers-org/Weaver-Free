// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

export function useKeyboardShortcuts() {
  const router = useRouter()

  function handler(e: KeyboardEvent) {
    // Ignore if user is typing in an input/textarea
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if ((e.target as HTMLElement).isContentEditable) return

    // ? — open help
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      void router.push('/help')
      return
    }

    // d — weaver
    if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void router.push('/weaver')
      return
    }

    // s — settings
    if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void router.push('/settings')
      return
    }

    // t — network topology
    if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void router.push('/network')
      return
    }

    // n — create new VM
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void router.push({ path: '/weaver', query: { action: 'create' } })
      return
    }

    // j — focus next VM in list
    if (e.key === 'j' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('vm:navigate', { detail: 'next' }))
      return
    }

    // k — focus previous VM in list
    if (e.key === 'k' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('vm:navigate', { detail: 'prev' }))
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handler)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handler)
  })
}
