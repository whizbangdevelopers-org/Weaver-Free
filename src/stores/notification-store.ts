// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import type { NotificationEvent } from 'src/types/notification'

const MAX_NOTIFICATIONS = 100

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    notifications: [] as NotificationEvent[],
    /** IDs of notifications the user has marked as read (persisted) */
    readIds: [] as string[],
  }),

  getters: {
    readIdSet(): Set<string> {
      return new Set(this.readIds)
    },
    unreadCount(): number {
      const readSet = this.readIdSet
      return this.notifications.filter(n => !readSet.has(n.id)).length
    },
    recentNotifications(): NotificationEvent[] {
      return this.notifications.slice(0, 50)
    },
  },

  actions: {
    addNotification(event: NotificationEvent) {
      if (this.notifications.some(n => n.id === event.id)) return
      this.notifications.unshift(event)
      if (this.notifications.length > MAX_NOTIFICATIONS) {
        this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS)
      }
    },

    setNotifications(events: NotificationEvent[]) {
      this.notifications = events.slice(0, MAX_NOTIFICATIONS)
    },

    markRead(id: string) {
      if (!this.readIds.includes(id)) {
        this.readIds.push(id)
      }
      // Prevent unbounded localStorage growth
      if (this.readIds.length > MAX_NOTIFICATIONS * 2) {
        this.readIds = this.readIds.slice(-MAX_NOTIFICATIONS)
      }
    },

    markAllRead() {
      const readSet = new Set(this.readIds)
      for (const n of this.notifications) {
        if (!readSet.has(n.id)) {
          this.readIds.push(n.id)
        }
      }
    },

    removeNotification(id: string) {
      this.notifications = this.notifications.filter(n => n.id !== id)
      this.readIds = this.readIds.filter(rid => rid !== id)
    },

    removeNotifications(ids: string[]) {
      const idSet = new Set(ids)
      this.notifications = this.notifications.filter(n => !idSet.has(n.id))
      this.readIds = this.readIds.filter(rid => !idSet.has(rid))
    },

    clearAll() {
      this.notifications = []
      this.readIds = []
    },
  },

  persist: {
    paths: ['readIds'],
  },
})
