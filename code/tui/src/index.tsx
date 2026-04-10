#!/usr/bin/env node
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { parseArgs } from 'node:util'
import { writeFileSync } from 'node:fs'
import { render } from 'ink'
import React from 'react'
import { App } from './app.js'
import { TuiApiClient } from './client/api.js'
import { loadCredentials } from './client/auth.js'
import { createDemoApiClient } from './demo/mock.js'
import { TIERS } from './constants/vocabularies.js'

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: 'http://localhost:3100' },
    demo: { type: 'boolean', default: false },
    tier: { type: 'string', default: TIERS.WEAVER },
    version: { type: 'string', default: '1.0' },
    username: { type: 'string' },
    password: { type: 'string' },
    export: { type: 'boolean', default: false },
    output: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
})

if (values.help) {
  console.log(`
Weaver TUI

Usage: microvm-tui [options]

Options:
  --host <url>      Backend URL (default: http://localhost:3100)
  --demo            Demo mode — no backend needed
  --tier <name>     Demo tier: demo|free|weaver|fabrick (default: weaver)
  --version <v>     Demo version: 1.0–3.3 (default: 1.0). Use ←/→ to step.
  --username <u>    Skip login prompt (for scripting)
  --password <p>    Skip login prompt (for scripting)
  --export          Export all VM configs as JSON and exit
  --output <file>   Write export to file instead of stdout
  -h, --help        Show this help message

Examples:
  microvm-tui                          Connect to localhost:3100
  microvm-tui --host http://host:3110  Connect to a remote backend
  microvm-tui --demo                   Run with mock data (no backend)
  microvm-tui --demo --tier free       Demo with free tier gating
  microvm-tui --export --demo          Export demo VM configs as JSON
  microvm-tui --export --output vms.json  Export to file
`)
  process.exit(0)
}

export interface TuiConfig {
  host: string
  demo: boolean
  tier: string
  version: string
  username?: string
  password?: string
}

const config: TuiConfig = {
  host: values.host ?? 'http://localhost:3100',
  demo: values.demo ?? false,
  tier: values.tier ?? TIERS.WEAVER,
  version: values.version ?? '1.0',
  username: values.username,
  password: values.password,
}

// Non-interactive export mode
if (values.export) {
  const api = config.demo
    ? createDemoApiClient(config.tier)
    : new TuiApiClient(config.host, () => loadCredentials()?.token ?? null)

  void api.listVms().then(result => {
    if (result.status !== 200) {
      console.error('Failed to fetch VMs:', JSON.stringify(result.data))
      process.exit(1)
    }
    const json = JSON.stringify(result.data, null, 2)
    if (values.output) {
      writeFileSync(values.output, json + '\n')
      console.error(`Exported to ${values.output}`)
    } else {
      console.log(json)
    }
    process.exit(0)
  })
} else {
  render(<App config={config} />)
}
