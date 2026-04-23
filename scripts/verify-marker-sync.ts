// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Marker Sync Auditor
 *
 * Thin wrapper that invokes sync-markers.ts in check mode. Exists as a
 * separate script because test:compliance lists auditors by name and
 * we want the name to be explicit: audit:marker-sync. The real logic
 * lives in sync-markers.ts and lib/marker-sync.ts.
 *
 * Invocation:
 *   npm run audit:marker-sync
 */

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SYNC_SCRIPT = resolve(__dirname, 'sync-markers.ts')

// Spawn tsx against sync-markers.ts --check. Inherit stdio so the user
// sees the violations directly.
const child = spawn('npx', ['tsx', SYNC_SCRIPT, '--check'], {
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
