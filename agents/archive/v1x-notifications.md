<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1x-notifications — Alerts & Push Notifications

**Plan:** [FEATURE-GAPS](../plans/FEATURE-GAPS.md) (High Value)
**Parallelizable:** Yes (independent of other v1x tracks)
**Blocks:** None

---

## Scope

Notify users when VMs change state (started, stopped, failed, provisioning complete). In-app notification center for all tiers, ntfy.sh push adapter for Premium, additional adapters (Firebase, Gotify, Pushover) for Enterprise. Adapter interface enables future additions without core changes.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/ws.ts` | WebSocket broadcast loop — status change detection goes here |
| `backend/src/services/microvm.ts` | VM status polling, current state tracking |
| `backend/src/config.ts` | Config pattern for env vars |
| `../business/archive/TIER-STRATEGY.md` | Infrastructure tiering for notifications |
| `../business/product/TIER-MANAGEMENT.md` | Feature gating table |
| `src/stores/vm-store.ts` | VM state updates — frontend notification trigger point |
| `src/stores/settings-store.ts` | Settings persistence pattern |
| `src/pages/SettingsPage.vue` | Settings UI pattern |
| `src/layouts/MainLayout.vue` | Toolbar — bell icon goes here |

---

## Inputs

- WebSocket already broadcasts VM status every 2 seconds
- No notification infrastructure exists today
- Tier strategy already assigns: Premium = ntfy.sh, Enterprise = all adapters

---

## Outputs

### Backend — Notification Engine

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/notification.ts` | New | NotificationService: detect state changes, dispatch to adapters |
| `backend/src/services/adapters/notification-adapter.ts` | New | Interface: `NotificationAdapter { send(event: NotificationEvent): Promise<void> }` |
| `backend/src/services/adapters/ntfy-adapter.ts` | New | ntfy.sh adapter (Premium+): HTTP POST to ntfy topic |
| `backend/src/services/adapters/gotify-adapter.ts` | New | Gotify adapter (Enterprise): HTTP POST to Gotify server |
| `backend/src/services/adapters/pushover-adapter.ts` | New | Pushover adapter (Enterprise): HTTP POST to Pushover API |
| `backend/src/services/adapters/webhook-adapter.ts` | New | Generic webhook adapter (Enterprise): HTTP POST to user-defined URL |
| `backend/src/models/notification.ts` | New | NotificationEvent type, NotificationConfig, adapter registry |
| `backend/src/routes/notifications.ts` | New | GET /api/notifications (recent), POST /api/notifications/test, DELETE /api/notifications/:id |
| `backend/src/schemas/notifications.ts` | New | Zod schemas for notification config and test payload |
| `backend/src/storage/notification-store.ts` | New | Recent notifications (ring buffer, last 100, JSON file) |
| `backend/src/index.ts` | Modify | Register notification service and routes |
| `backend/src/config.ts` | Modify | Add notification config (adapter settings, enabled events) |

### Backend — State Change Detection

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/ws.ts` | Modify | Track previous status per VM; on change, emit to NotificationService |

### Frontend — Notification Center

| File | Type | Description |
|------|------|-------------|
| `src/types/notification.ts` | New | NotificationEvent type, NotificationConfig |
| `src/stores/notification-store.ts` | New | Recent notifications, unread count, mark-read |
| `src/composables/useNotifications.ts` | New | Listen for notification events on WebSocket, update store |
| `src/components/NotificationBell.vue` | New | Toolbar bell icon with unread badge, dropdown panel |
| `src/components/NotificationPanel.vue` | New | Scrollable list of recent notifications with timestamps |
| `src/layouts/MainLayout.vue` | Modify | Add NotificationBell to right side of toolbar |

### Frontend — Notification Settings

| File | Type | Description |
|------|------|-------------|
| `src/pages/SettingsPage.vue` | Modify | Add "Notifications" section: enabled events, adapter config |
| `src/components/settings/NotificationSettings.vue` | New | Event toggles + adapter config (ntfy topic/server, webhook URL, etc.) |

### WebSocket Protocol Addition

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/ws.ts` | Modify | New message type: `{ type: "notification", event: NotificationEvent }` |

### NixOS Module

| File | Type | Description |
|------|------|-------------|
| `nixos/default.nix` | Modify | Add `notifications.ntfy.url`, `notifications.ntfy.topic`, `notifications.webhook.url` options |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/services/notification.spec.ts` | New | State change detection, adapter dispatch, event filtering |
| `backend/tests/services/adapters/ntfy-adapter.spec.ts` | New | HTTP POST format, error handling, retry |
| `backend/tests/routes/notifications.spec.ts` | New | GET recent, POST test, tier gating |
| `testing/unit/stores/notification-store.spec.ts` | New | Add, mark read, unread count |
| `testing/e2e/notifications.spec.ts` | New | In-app notification appears on VM state change, settings config |

---

## Notification Events

| Event | Trigger | Severity | Default |
|-------|---------|----------|---------|
| `vm:started` | VM status → running | info | enabled |
| `vm:stopped` | VM status → stopped | info | disabled |
| `vm:failed` | VM status → failed | error | enabled |
| `vm:provisioned` | Provisioning → provisioned | success | enabled |
| `vm:provision-failed` | Provisioning → failed | error | enabled |
| `vm:recovered` | VM status failed → running | success | enabled |

Users configure which events trigger push notifications (all events always appear in the in-app notification center).

---

## Notification Event Schema

```typescript
interface NotificationEvent {
  id: string              // UUID
  timestamp: string       // ISO 8601
  event: string           // e.g., 'vm:started'
  vmName: string          // Target VM
  severity: 'info' | 'success' | 'error'
  message: string         // Human-readable: "web-nginx started"
  details?: Record<string, unknown>
}
```

---

## Adapter Interface

```typescript
interface NotificationAdapter {
  name: string
  send(event: NotificationEvent): Promise<void>
  test(): Promise<boolean>  // Used by "Send test notification" button
}
```

### ntfy.sh Adapter (Premium)

```typescript
// POST https://ntfy.sh/<topic>  (or self-hosted ntfy URL)
{
  title: `Weaver: ${event.vmName}`,
  message: event.message,
  priority: event.severity === 'error' ? 4 : 3,
  tags: [event.event.replace(':', '-')],
}
```

Config: `NTFY_URL` (default: `https://ntfy.sh`), `NTFY_TOPIC` (required), `NTFY_TOKEN` (optional, for auth)

### Gotify Adapter (Enterprise)

```typescript
// POST https://gotify-server/message
{
  title: `MicroVM: ${event.vmName}`,
  message: event.message,
  priority: event.severity === 'error' ? 8 : 4,
}
```

Config: `GOTIFY_URL`, `GOTIFY_TOKEN`

### Pushover Adapter (Enterprise)

Config: `PUSHOVER_USER_KEY`, `PUSHOVER_APP_TOKEN`

### Webhook Adapter (Enterprise)

Generic HTTP POST to user-defined URL with full NotificationEvent as JSON body. Config: `WEBHOOK_URL`, `WEBHOOK_SECRET` (HMAC signature in header).

---

## State Change Detection

```typescript
// In WebSocket broadcast loop (ws.ts)
const previousStatus = new Map<string, string>()

function detectChanges(currentVms: VmInfo[]): NotificationEvent[] {
  const events: NotificationEvent[] = []
  for (const vm of currentVms) {
    const prev = previousStatus.get(vm.name)
    if (prev && prev !== vm.status) {
      events.push(createEvent(vm, prev, vm.status))
    }
    previousStatus.set(vm.name, vm.status)
  }
  return events
}
```

---

## Settings UI

```
┌─ Notifications ──────────────────────────────────────┐
│                                                       │
│  Events to notify:                                    │
│  ☑ VM started   ☐ VM stopped   ☑ VM failed           │
│  ☑ Provisioned  ☑ Provision failed  ☑ VM recovered   │
│                                                       │
│  Push adapter:  [ntfy.sh  ▼]           🔒 Premium     │
│    Server URL:  [https://ntfy.sh      ]              │
│    Topic:       [weaver    ]              │
│    Token:       [••••••••] (optional)                │
│                                                       │
│  [Send Test Notification]                             │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Tier Gating

| Feature | Demo | Free | Premium | Enterprise |
|---------|:----:|:----:|:-------:|:----------:|
| In-app notification center | Yes | Yes | Yes | Yes |
| In-app notification bell + badge | Yes | Yes | Yes | Yes |
| Event filtering (which events trigger push) | No | No | Yes | Yes |
| ntfy.sh adapter | No | No | Yes | Yes |
| Gotify adapter | No | No | No | Yes |
| Pushover adapter | No | No | No | Yes |
| Webhook adapter | No | No | No | Yes |
| Notification settings page | No | No | Yes | Yes |

---

## Acceptance Criteria

1. In-app notification bell shows unread count badge
2. Notification panel lists recent events with timestamp and severity icon
3. VM state changes (running → stopped, etc.) create notification events
4. ntfy.sh adapter sends push when configured (Premium+)
5. "Send Test Notification" button works for each configured adapter
6. Notification event filtering works (enable/disable per event type)
7. Notifications persist across page refresh (stored backend-side)
8. WebSocket broadcasts notification events to connected clients
9. Adapters handle errors gracefully (log, don't crash)
10. Demo/Free users see the in-app center but not push adapter settings
11. All existing tests pass
12. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Human | Claude Code |
|------|-------|-------------|
| Backend (notification engine + state detection) | 2 days | 1.5 hrs |
| Backend (ntfy adapter) | 0.5 days | 30 min |
| Backend (enterprise adapters) | 1 day | 1 hr |
| Frontend (notification center + bell) | 1.5 days | 1 hr |
| Frontend (settings UI) | 1 day | 45 min |
| Tests | 1.5 days | 1 hr |
| **Total** | **7–8 days** | **5–6 hrs** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add Notifications section: adapter interface, adding custom adapters |
| `src/pages/HelpPage.vue` | Add "Notifications" help section: setup ntfy.sh, event types |
| `CLAUDE.md` | Add notification API endpoints to API table |
