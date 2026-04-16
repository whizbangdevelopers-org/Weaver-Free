<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# hCaptcha Setup Guide

Weaver uses hCaptcha to gate access to the public demo deployment. This prevents automated abuse while allowing legitimate users to try the dashboard.

## Overview

hCaptcha is used only for the demo mode login flow. It is not required for self-hosted or NixOS deployments.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │     │   Backend    │     │  hCaptcha    │
│              │     │   API        │     │  Service     │
│  1. User     │     │              │     │              │
│     solves   │────>│  2. Verify   │────>│  3. Validate │
│     captcha  │     │     token    │     │     token    │
│              │<────│              │<────│              │
│  5. Grant    │     │  4. Receive  │     │   Response   │
│     access   │     │     result   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Creating an hCaptcha Account

1. Go to [https://www.hcaptcha.com/signup-interstitial](https://www.hcaptcha.com/signup-interstitial).
2. Sign up for a free account (the free tier is sufficient for demo usage).
3. Verify your email address.
4. Log in to the hCaptcha dashboard.

## Getting Your Site Key and Secret

### Site Key (Public)

1. In the hCaptcha dashboard, go to **Sites**.
2. Click **New Site**.
3. Enter your demo domain: `weaver-demo.github.io`.
4. Select difficulty level (recommended: **Easy** for a demo).
5. Save and copy the **Site Key**.

The site key is safe to include in frontend code -- it identifies your site to hCaptcha.

### Secret Key (Private)

1. In the hCaptcha dashboard, go to **Settings**.
2. Copy your **Secret Key**.

The secret key must never be exposed in frontend code or committed to the repository. It is used only on the backend to verify captcha tokens.

## Environment Variables

### Backend Configuration

Set these environment variables for the Fastify backend:

```bash
# .env (backend)
HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000
HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000000
DEMO_MODE=true
```

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `HCAPTCHA_SECRET` | Yes (demo) | Secret key from hCaptcha dashboard |
| `HCAPTCHA_SITEKEY` | Yes (demo) | Site key from hCaptcha dashboard |
| `DEMO_MODE` | Yes (demo) | Must be `true` to enable demo login flow |

### Frontend Configuration

The site key is provided to the frontend via Vite environment variables:

```bash
# .env (frontend)
VITE_HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000000
VITE_DEMO_MODE=true
```

### GitHub Actions Secrets

For the demo deployment workflow, add these secrets to the repository:

| Secret | Description |
| ------ | ----------- |
| `HCAPTCHA_SECRET` | hCaptcha secret key |
| `HCAPTCHA_SITEKEY` | hCaptcha site key |

Go to **Settings > Secrets and variables > Actions** in the repository to add them.

## Demo Mode Configuration

### How Demo Mode Works

When `DEMO_MODE=true`:

1. The login page shows an hCaptcha widget.
2. The user solves the captcha.
3. The frontend sends the captcha token to the backend.
4. The backend verifies the token with the hCaptcha API.
5. On success, the user is granted a session to use the demo dashboard.
6. The demo dashboard uses mock VM data (no real systemctl calls).

### Enabling Demo Mode Locally

```bash
# Terminal 1: Start backend in demo mode
DEMO_MODE=true HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000 npm run dev:backend

# Terminal 2: Start frontend in demo mode
VITE_DEMO_MODE=true VITE_HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000000 npm run dev
```

### Disabling hCaptcha for Local Development

For local development without hCaptcha verification, you can use the hCaptcha test keys:

| Key Type | Test Value |
| -------- | ---------- |
| Site Key | `10000000-ffff-ffff-ffff-000000000000` |
| Secret Key | `0x0000000000000000000000000000000000000000` |

These test keys always pass verification without showing a real captcha widget. See the [hCaptcha documentation](https://docs.hcaptcha.com/#integration-testing-test-keys) for details.

## Testing with Test Keys

hCaptcha provides special test keys for development and CI:

### Always-Pass Key

```
Site Key:   10000000-ffff-ffff-ffff-000000000000
Secret Key: 0x0000000000000000000000000000000000000000
```

The captcha widget will always auto-solve. Use this for:
- Local development
- E2E testing
- CI pipelines

### Always-Fail Key

```
Site Key:   20000000-ffff-ffff-ffff-000000000000
Secret Key: 0x0000000000000000000000000000000000000000
```

The captcha widget will always fail. Use this for:
- Testing error handling
- Verifying the login flow rejects invalid captchas

### Always-Challenge Key

```
Site Key:   30000000-ffff-ffff-ffff-000000000000
```

Forces a visual challenge every time. Use this for:
- Manual testing of the captcha UX
- Accessibility testing

## Verification Flow (Backend)

The backend verifies captcha tokens by making a POST request to the hCaptcha API:

```
POST https://api.hcaptcha.com/siteverify
Content-Type: application/x-www-form-urlencoded

secret=<HCAPTCHA_SECRET>&response=<TOKEN_FROM_CLIENT>&sitekey=<HCAPTCHA_SITEKEY>
```

**Success response:**
```json
{
  "success": true,
  "challenge_ts": "2026-01-15T12:00:00.000Z",
  "hostname": "weaver-demo.github.io"
}
```

**Failure response:**
```json
{
  "success": false,
  "error-codes": ["invalid-input-response"]
}
```

## Troubleshooting

### Captcha widget does not appear

- Verify `VITE_HCAPTCHA_SITEKEY` is set in the frontend environment.
- Verify `VITE_DEMO_MODE` is set to `true`.
- Check browser console for JavaScript errors.
- Ensure the hCaptcha script is loading (check network tab).

### Verification always fails

- Verify `HCAPTCHA_SECRET` is correct on the backend.
- Ensure the domain matches what was configured in the hCaptcha dashboard.
- Check backend logs for error responses from the hCaptcha API.
- For local development, use the test keys documented above.

### Rate limiting

hCaptcha may rate-limit verification requests if too many are made in a short period. The free tier allows approximately 1000 verifications per day. For production demo usage, this is typically more than sufficient.

## Security Notes

- The secret key should only exist as an environment variable or GitHub secret. Never commit it to the repository.
- The site key is public and safe to include in frontend code.
- hCaptcha tokens are single-use and expire after a short time.
- Always verify tokens on the backend, never trust client-side validation alone.
