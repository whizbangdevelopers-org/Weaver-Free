<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v2-capacitor — Capacitor Mobile Build + Push Notifications

**Plan:** [V2-MULTINODE-PLAN](../../plans/v2.0.0/V2-MULTINODE-PLAN.md) (Track 2)
**Parallelizable:** Yes (independent of agent extraction and template editor)
**Blocks:** None

---

## Scope

Add Capacitor build targets for iOS and Android. Implement push notifications for critical events (VM failures, node offline). Add biometric authentication and secure token storage for mobile.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `quasar.config.cjs` | Build configuration to extend |
| `src/services/ws.ts` | WebSocket singleton for push event source |
| `src/stores/auth-store.ts` | Auth to extend with biometric |
| `src/composables/useVmStatus.ts` | VM status events (push trigger source) |
| `src/layouts/MainLayout.vue` | Layout adaptations for native |
| `package.json` | Dependencies to add |
| `../../plans/v2.0.0/V2-MULTINODE-PLAN.md` | Multi-node plan (project level) |

---

## Phase 1: Capacitor Build Target

### Outputs

| File | Type | Description |
|------|------|-------------|
| `quasar.config.cjs` | Modify | Add Capacitor configuration section |
| `capacitor.config.ts` | New | App ID, server URL, plugin list |
| `src-capacitor/` | New (generated) | iOS and Android native projects |
| `package.json` | Modify | Add build scripts: `build:capacitor`, `build:ios`, `build:android` |
| `.gitignore` | Modify | Ignore Capacitor build artifacts |

### Setup Steps

```bash
quasar mode add capacitor
# Generates src-capacitor/ directory
# Configure capacitor.config.ts
```

### Capacitor Config

```typescript
// capacitor.config.ts
export default {
  appId: 'dev.microvm.dashboard',
  appName: 'Weaver',
  webDir: 'dist/spa',  // Quasar SPA output
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    BiometricAuth: {},
    SecureStoragePlugin: {},
  },
  server: {
    // For dev: connect to local backend
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    cleartext: process.env.NODE_ENV === 'development',
  },
}
```

---

## Phase 2: Push Notifications

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/push.ts` | New | PushService: send to FCM/APNs |
| `backend/src/services/push-triggers.ts` | New | Event listeners → push notifications |
| `backend/src/routes/push.ts` | New | POST /api/push/register, DELETE /api/push/unregister |
| `backend/src/storage/push-store.ts` | New | Device token storage (userId, token, platform) |
| `backend/src/schemas/push.ts` | New | Zod schemas for push registration |

### Frontend (Capacitor)

| File | Type | Description |
|------|------|-------------|
| `src/services/push.ts` | New | Capacitor PushNotifications plugin wrapper |
| `src/composables/usePushNotifications.ts` | New | Register, handle tap, permission request |
| `src/pages/SettingsPage.vue` | Modify | Push notification preferences section |

### Push Events

| Event | Trigger | Priority | Payload |
|-------|---------|----------|---------|
| VM failed | VM status → 'failed' | High | VM name, node |
| Node offline | 3 missed heartbeats | High | Node name |
| Provisioning complete | VM status → 'provisioned' | Normal | VM name |
| Provisioning failed | VM status → 'failed' during provisioning | High | VM name, error |
| AI diagnostic ready | Agent operation complete | Normal | VM name |
| License expiry warning | 30 days before expiry | Normal | Days remaining |

### Push Service Architecture

```
Backend event (VM status change)
  → PushTriggers evaluates event
  → PushService.send(userId, notification)
  → FCM/APNs API call
  → Device receives notification

Native app tap on notification
  → Deep link: microvm://vm/{name}
  → App navigates to VM detail page
```

### Firebase Setup (FCM)

| Resource | Purpose |
|----------|---------|
| Firebase project | Push notification relay |
| Server key | Backend sends to FCM API |
| google-services.json | Android native config |
| GoogleService-Info.plist | iOS native config |
| FCM free tier | Up to 500 devices (sufficient for launch) |

---

## Phase 3: Biometric Auth + Secure Storage

### Outputs

| File | Type | Description |
|------|------|-------------|
| `src/services/biometric.ts` | New | Capacitor BiometricAuth plugin wrapper |
| `src/services/secure-storage.ts` | New | Capacitor SecureStorage for tokens |
| `src/composables/useAuth.ts` | Modify | Use secure storage on native, localStorage on web |
| `src/pages/LoginPage.vue` | Modify | "Use Face ID / Fingerprint" button on native |

### Behavior

| Platform | Token Storage | Login Enhancement |
|----------|--------------|-------------------|
| Web (PWA) | localStorage | None |
| iOS (Capacitor) | Keychain via SecureStorage | Face ID / Touch ID |
| Android (Capacitor) | Keystore via SecureStorage | Fingerprint / Face Unlock |

---

## Phase 4: Mobile Polish

### Outputs

| File | Type | Description |
|------|------|-------------|
| `src/services/haptics.ts` | New | Capacitor Haptics plugin wrapper |
| Various components | Modify | Add haptic feedback on VM actions |
| `src/services/background-task.ts` | New | Capacitor BackgroundTask for periodic status polling |
| `src/composables/useOfflineCache.ts` | New | Cache last-known VM state for offline viewing |

---

## Capacitor Dependencies

| Plugin | Purpose |
|--------|---------|
| @capacitor/push-notifications | FCM/APNs push |
| @nicepay/capacitor-biometric-auth | Face ID, fingerprint |
| @nicepay/capacitor-secure-storage | Keychain/Keystore |
| @capacitor/haptics | Vibration feedback |
| @capacitor/app | Deep links, app lifecycle |
| @capacitor/status-bar | Status bar styling |
| @capacitor/splash-screen | Launch screen |

---

## Flow Notes

Phase 1: `quasar build -m capacitor` produces native projects. Capacitor wraps existing SPA in a native WebView. Backend URL configured in capacitor.config.ts.
Phase 2: Backend VM status change → PushTriggers evaluates → PushService.send() → FCM/APNs → device notification. Tap → deep link `microvm://vm/{name}` → app navigates to VmDetailPage.
Phase 3: LoginPage detects native platform via `usePlatform()` → shows biometric button → Capacitor BiometricAuth → on success, retrieves JWT from SecureStorage → auto-login.
Phase 4: Haptic feedback on VM action buttons. BackgroundTask polls /api/health every 5 min for offline cache refresh.

---

## Safety Rules

1. Push notification device tokens must be stored per-user, not globally — token deletion on user logout
2. Firebase server key must never be exposed to the frontend — backend-only
3. Biometric auth must fall back gracefully to password login if biometric is unavailable or fails
4. Secure storage must be used for JWT tokens on native — never localStorage
5. Deep links must validate the VM name parameter before navigating (prevent open redirect)
6. Push trigger evaluation must be rate-limited to prevent notification spam during flapping VM status

---

## Tier Blind Spot Mitigation

**Native features are weaver-only.** Standard dev/E2E runs as PWA at weaver.

**Mitigation:**
- Phase 1 (Capacitor build) can only be validated on actual device/simulator — manual pre-release checklist
- Phase 2 (push) backend unit tests mock FCM API — testable at any tier. Push registration endpoint has `requireTier('premium')` gate
- Phase 3 (biometric) requires native platform — unit test the secure-storage abstraction, manual test on device
- E2E Docker tests the PWA path — verify push registration endpoint returns 403 on free tier
- All web functionality must continue to work unchanged (no regressions from Capacitor additions)

---

## E2E Notes

- **Web-only E2E:** All existing E2E specs run against PWA. Capacitor-specific features (push, biometric, haptics) cannot be tested in E2E Docker
- **Push backend E2E:** Can test push registration/unregistration API endpoints (POST/DELETE /api/push/*) without a real device
- **Shared state risk:** Push token registration is per-user — use createTempUser() if testing push registration to avoid polluting shared users
- **Manual test checklist:** iOS simulator + Android emulator tests are manual, not automated. Checklist in the Tests section below

---

## Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/services/push.spec.ts` | New | Push send (mocked FCM), device registration |
| `backend/tests/services/push-triggers.spec.ts` | New | Event → notification mapping |
| `backend/tests/routes/push.spec.ts` | New | Register/unregister device tokens |
| Unit tests | Verify | All existing web tests still pass |

Note: Native mobile testing requires device/simulator — not part of automated CI. Manual test checklist:
- [ ] iOS: build, launch, login, receive push, biometric
- [ ] Android: build, launch, login, receive push, biometric

---

## Acceptance Criteria

1. `quasar build -m capacitor -T ios` produces an Xcode project
2. `quasar build -m capacitor -T android` produces an Android project
3. iOS app launches in simulator, connects to backend, shows dashboard
4. Android app launches in emulator, connects to backend, shows dashboard
5. Push registration stores device token on backend
6. VM failure triggers push notification on registered device
7. Tap on notification opens app to relevant VM detail
8. Biometric auth works on iOS (Face ID) and Android (fingerprint)
9. Tokens stored in secure storage (not localStorage) on native
10. All web tests still pass (no regressions)

---

## Tier Gating

| Feature | Weaver Free (PWA) | Weaver (Native) |
|---------|:----------:|:----------------:|
| Weaver, workload control | Yes | Yes |
| Push notifications | No | Yes |
| Biometric auth | No | Yes |
| Background polling | No | Yes |
| Secure token storage | No | Yes |

Push registration endpoint: `requireTier(config, 'premium')`

---

## Estimated Effort

Capacitor setup + build: 1–2 days
Push notifications (backend + frontend): 3–4 days
Biometric + secure storage: 1–2 days
Mobile polish (haptics, offline): 1–2 days
Firebase setup: 0.5 days
Tests: 1 day
Total: **8–12 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add Capacitor build targets, push notification architecture, biometric auth flow |
| `src/pages/HelpPage.vue` | Add "Mobile App" section: push notifications, biometric login (premium) |
| `CLAUDE.md` | Add /api/push/* endpoints to API table |
| `docs/development/LESSONS-LEARNED.md` | Capacitor + Quasar integration patterns, FCM setup |
