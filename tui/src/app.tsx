// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import type { TuiConfig } from './index.js'
import type { VmInfo, VmCreateInput } from './types/vm.js'
import { TuiApiClient } from './client/api.js'
import { TuiWsClient } from './client/ws.js'
import { loadCredentials, saveCredentials, clearCredentials } from './client/auth.js'
import { createDemoApiClient, createDemoWsClient, setDemoTier, DEMO_TIER_CYCLE, DEMO_VERSIONS, setDemoVersion, resolveInternalTier } from './demo/mock.js'
import { TIERS } from './constants/vocabularies.js'
import { LoginPrompt } from './components/LoginPrompt.js'
import { RegisterPrompt } from './components/RegisterPrompt.js'
import { CreateVmForm } from './components/CreateVmForm.js'
import { DistrosView } from './components/DistrosView.js'
import { HelpView } from './components/HelpView.js'
import { VmList } from './components/VmList.js'
import { VmDetail } from './components/VmDetail.js'
import { AgentDialog } from './components/AgentDialog.js'
import { StatusBar } from './components/StatusBar.js'
import { DemoBanner } from './components/DemoBanner.js'
import { UpgradeNag } from './components/nag/UpgradeNag.js'
import { TIER_VIEWS } from './config/tier-views.js'
import { useTierView } from './hooks/useTierView.js'

type View =
  | 'connecting' | 'login' | 'register'                // auth
  | 'list' | 'detail' | 'agent' | 'create' | 'help' | 'distros' // free
  | 'network' | 'templates' | 'host-detail'              // premium
  | 'notifications' | 'settings'                        // premium
  | 'users' | 'audit' | 'user-detail' | 'fleet-bridges' // fabrick

interface AppState {
  view: View
  vms: VmInfo[]
  selectedVm: string | null
  selectedUser: string | null
  connected: boolean
  tier: string
  /** Display tier for the banner — includes 'weaver-team' as a distinct step */
  displayTier: string
  version: string
  error: string | null
}

export function App({ config }: { config: TuiConfig }) {
  const { exit } = useApp()
  const [state, setState] = useState<AppState>({
    view: config.demo ? 'list' : 'connecting',
    vms: [],
    selectedVm: null,
    selectedUser: null,
    connected: false,
    tier: config.demo ? config.tier : 'unknown',
    displayTier: config.demo ? config.tier : 'unknown',
    version: config.demo ? config.version : '1.0',
    error: null,
  })

  const [api] = useState<TuiApiClient>(() =>
    config.demo
      ? createDemoApiClient(config.tier)
      : new TuiApiClient(config.host, () => loadCredentials()?.token ?? null)
  )

  const [wsClient] = useState<TuiWsClient>(() =>
    config.demo
      ? createDemoWsClient(config.tier)
      : new TuiWsClient(config.host)
  )

  // Dynamic tier views — hooks must be called unconditionally (React rules)
  const networkView = useTierView('network', TIER_VIEWS.network!, state.tier)
  const templatesView = useTierView('templates', TIER_VIEWS.templates!, state.tier)
  const hostDetailView = useTierView('host-detail', TIER_VIEWS['host-detail']!, state.tier)
  const notificationsView = useTierView('notifications', TIER_VIEWS.notifications!, state.tier)
  const settingsView = useTierView('settings', TIER_VIEWS.settings!, state.tier)
  const usersView = useTierView('users', TIER_VIEWS.users!, state.tier)
  const userDetailView = useTierView('user-detail', TIER_VIEWS['user-detail']!, state.tier)
  const auditView = useTierView('audit', TIER_VIEWS.audit!, state.tier)
  const fleetBridgesView = useTierView('fleet-bridges', TIER_VIEWS['fleet-bridges']!, state.tier)

  // Demo mode: Tab cycles tiers, Left/Right steps versions
  useInput((_input, key) => {
    if (!config.demo) return
    if (key.tab) {
      const idx = DEMO_TIER_CYCLE.indexOf(state.displayTier as typeof DEMO_TIER_CYCLE[number])
      const next = DEMO_TIER_CYCLE[(idx + 1) % DEMO_TIER_CYCLE.length]!
      const internalTier = resolveInternalTier(next)
      setDemoTier(internalTier)
      setState(s => ({ ...s, tier: internalTier, displayTier: next }))
    }
    // Version stepping with left/right arrow keys (only on list view)
    if (state.view === 'list' && (key.leftArrow || key.rightArrow)) {
      const versions = DEMO_VERSIONS
      const curIdx = versions.findIndex(v => v.version === state.version)
      if (curIdx === -1) return
      const nextIdx = key.rightArrow
        ? Math.min(curIdx + 1, versions.length - 1)
        : Math.max(curIdx - 1, 0)
      const nextVer = versions[nextIdx]!
      setDemoVersion(nextVer.version)
      // Auto-adjust tier when crossing tier ceilings
      let newTier = state.tier
      if (nextVer.tierCeiling === TIERS.FREE && state.tier === TIERS.FREE) {
        // Stepping past free ceiling → auto-upgrade to weaver
        const verNum = parseFloat(nextVer.version)
        if (verNum > parseFloat(versions.find(v => v.tierCeiling === TIERS.FREE)?.version ?? '99')) {
          newTier = TIERS.SOLO
          setDemoTier(newTier)
        }
      }
      setState(s => ({ ...s, version: nextVer.version, tier: newTier }))
    }
  })

  // WebSocket: subscribe to VM status updates
  useEffect(() => {
    const unsub = wsClient.onVmStatus((vms) => {
      setState(s => ({ ...s, vms }))
    })
    const unsubConnect = wsClient.onConnect(() => {
      setState(s => ({ ...s, connected: true }))
    })
    const unsubDisconnect = wsClient.onDisconnect(() => {
      setState(s => ({ ...s, connected: false }))
    })
    const unsubKicked = wsClient.onSessionKicked(() => {
      clearCredentials()
      setState(s => ({
        ...s,
        view: 'login',
        vms: [],
        connected: false,
        tier: 'unknown',
        error: 'Session ended — logged in from another location',
      }))
    })

    return () => {
      unsub()
      unsubConnect()
      unsubDisconnect()
      unsubKicked()
      wsClient.disconnect()
    }
  }, [wsClient])

  // Auto-connect if we have credentials or in demo mode
  useEffect(() => {
    if (config.demo) {
      wsClient.connect('')
      // Load initial VMs via API
      void api.listVms().then(result => {
        if (result.status === 200) {
          setState(s => ({ ...s, vms: result.data as VmInfo[] }))
        }
      })
      return
    }

    // Fetch tier (unauthenticated) + check if first-run setup is needed
    void Promise.all([
      api.getHealth(),
      api.checkSetupRequired(),
    ]).then(([healthResult, setupResult]) => {
      // Store tier early — available on login screen for forgot-password hint
      if (healthResult.status === 200) {
        setState(s => ({ ...s, tier: (healthResult.data as { tier?: string }).tier ?? 'unknown' }))
      }

      if (setupResult.status === 200) {
        const { setupRequired } = setupResult.data as { setupRequired: boolean }
        if (setupRequired) {
          setState(s => ({ ...s, view: 'register' }))
          return
        }
      }

      // Not first-run — validate saved credentials before trusting them
      // (token may be stale after fresh install / JWT secret rotation)
      const creds = loadCredentials()
      if (!creds) {
        setState(s => ({ ...s, view: 'login' }))
        return
      }

      void api.listVms().then(result => {
        if (result.status === 200) {
          wsClient.connect(creds.token)
          setState(s => ({ ...s, view: 'list', vms: result.data as VmInfo[] }))
        } else {
          // Token invalid — clear stale credentials, show login
          clearCredentials()
          setState(s => ({ ...s, view: 'login' }))
        }
      })
    })
  }, [api, wsClient, config.demo])

  const handleLogin = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password)
    if (result.status === 200) {
      const data = result.data as { token: string; refreshToken: string }
      saveCredentials({
        username,
        token: data.token,
        refreshToken: data.refreshToken,
        host: config.host,
      })
      wsClient.connect(data.token)
      setState(s => ({ ...s, view: 'list', error: null }))
      // Fetch tier
      const health = await api.getHealth()
      if (health.status === 200) {
        const h = health.data as { tier?: string }
        const t = h.tier ?? 'unknown'
        setState(s => ({ ...s, tier: t, displayTier: t }))
      }
    } else {
      const data = result.data as { error?: string }
      throw new Error(data.error ?? 'Login failed')
    }
  }, [api, wsClient, config.host])

  const handleRegister = useCallback(async (username: string, password: string) => {
    const result = await api.register(username, password)
    if (result.status === 201) {
      const data = result.data as { token: string; refreshToken: string }
      saveCredentials({
        username,
        token: data.token,
        refreshToken: data.refreshToken,
        host: config.host,
      })
      wsClient.connect(data.token)
      setState(s => ({ ...s, view: 'list', error: null }))
      // Fetch tier
      const health = await api.getHealth()
      if (health.status === 200) {
        const h = health.data as { tier?: string }
        const t = h.tier ?? 'unknown'
        setState(s => ({ ...s, tier: t, displayTier: t }))
      }
    } else {
      const data = result.data as { error?: string; details?: string[] }
      const msg = data.details ? data.details.join(' ') : data.error ?? 'Registration failed'
      throw new Error(msg)
    }
  }, [api, wsClient, config.host])

  const handleAction = useCallback(async (vmName: string, action: 'start' | 'stop' | 'restart') => {
    const methods = { start: api.startVm, stop: api.stopVm, restart: api.restartVm } as const
    const result = await methods[action].call(api, vmName)
    if (result.status !== 200) {
      const data = result.data as { error?: string }
      setState(s => ({ ...s, error: data.error ?? `${action} failed` }))
    }
  }, [api])

  const handleCreateVm = useCallback(async (input: VmCreateInput) => {
    const result = await api.createVm(input)
    if (result.status === 201 || result.status === 200 || result.status === 202) {
      setState(s => ({ ...s, view: 'list', error: null }))
    } else {
      const data = result.data as { error?: string; details?: string[] }
      const msg = data.details ? data.details.join(' ') : data.error ?? 'Create VM failed'
      setState(s => ({ ...s, error: msg }))
    }
  }, [api])

  const handleDeleteVm = useCallback(async (vmName: string) => {
    const result = await api.deleteVm(vmName)
    if (result.status === 200) {
      setState(s => ({ ...s, view: 'list', selectedVm: null, error: null }))
    } else {
      const data = result.data as { error?: string }
      setState(s => ({ ...s, error: data.error ?? 'Delete failed' }))
    }
  }, [api])

  const handleScanVms = useCallback(async () => {
    const result = await api.scanVms()
    if (result.status !== 200) {
      const data = result.data as { error?: string }
      setState(s => ({ ...s, error: data.error ?? 'Scan failed' }))
    }
    return result
  }, [api])

  const handleQuit = useCallback(() => {
    // Call server logout to revoke session, then clean up locally
    void api.logout().finally(() => {
      clearCredentials()
      wsClient.disconnect()
      exit()
    })
  }, [api, wsClient, exit])

  const handleLogout = useCallback(() => {
    // Call server logout to revoke session, then clean up locally
    void api.logout().finally(() => {
      clearCredentials()
      wsClient.disconnect()
      setState(s => ({ ...s, view: 'login', vms: [], connected: false, tier: 'unknown' }))
    })
  }, [api, wsClient])

  const goList = useCallback(() => setState(s => ({ ...s, view: 'list' })), [])

  return (
    <Box flexDirection="column" width="100%">
      <StatusBar
        connected={state.connected}
        tier={state.tier}
        demo={config.demo}
        vmCount={state.vms.length}
      />

      {config.demo && <DemoBanner tier={state.displayTier} version={state.version} />}

      {state.error && (
        <Box marginLeft={1}>
          <Text color="red">{state.error}</Text>
        </Box>
      )}

      {state.view === 'connecting' && (
        <Box paddingX={2} paddingY={1}>
          <Text color="yellow">Connecting to {config.host}...</Text>
        </Box>
      )}

      {state.view === 'login' && (
        <LoginPrompt
          onLogin={handleLogin}
          onQuit={handleQuit}
          initialUsername={config.username}
          initialPassword={config.password}
          tier={state.tier}
        />
      )}

      {state.view === 'register' && (
        <RegisterPrompt
          onRegister={handleRegister}
          onLogin={() => setState(s => ({ ...s, view: 'login', error: null }))}
        />
      )}

      {state.view === 'list' && (
        <VmList
          vms={state.vms}
          onAction={handleAction}
          onSelect={(name) => setState(s => ({ ...s, view: 'detail', selectedVm: name }))}
          onAgent={(name) => setState(s => ({ ...s, view: 'agent', selectedVm: name }))}
          onCreateVm={() => setState(s => ({ ...s, view: 'create' }))}
          onScan={handleScanVms}
          onHelp={() => setState(s => ({ ...s, view: 'help' }))}
          onNetwork={() => setState(s => ({ ...s, view: 'network' }))}
          onDistros={() => setState(s => ({ ...s, view: 'distros' }))}
          onTemplates={() => setState(s => ({ ...s, view: 'templates' }))}
          onHostInfo={() => setState(s => ({ ...s, view: 'host-detail' }))}
          onNotifications={() => setState(s => ({ ...s, view: 'notifications' }))}
          onSettings={() => setState(s => ({ ...s, view: 'settings' }))}
          onUsers={() => setState(s => ({ ...s, view: 'users' }))}
          onAudit={() => setState(s => ({ ...s, view: 'audit' }))}
          onFleetBridges={() => setState(s => ({ ...s, view: 'fleet-bridges' }))}
          onQuit={handleQuit}
          onLogout={handleLogout}
          version={state.version}
          isDemo={config.demo}
        />
      )}

      {state.view === 'detail' && state.selectedVm && (
        <VmDetail
          vm={state.vms.find(v => v.name === state.selectedVm) ?? null}
          api={api}
          onBack={() => setState(s => ({ ...s, view: 'list', selectedVm: null }))}
          onAction={handleAction}
          onAgent={() => setState(s => ({ ...s, view: 'agent' }))}
          onDelete={handleDeleteVm}
        />
      )}

      {state.view === 'agent' && state.selectedVm && (
        <AgentDialog
          vmName={state.selectedVm}
          api={api}
          wsClient={wsClient}
          onBack={() => setState(s => ({ ...s, view: 'detail' }))}
        />
      )}

      {state.view === 'create' && (
        <CreateVmForm
          onSubmit={handleCreateVm}
          onBack={() => setState(s => ({ ...s, view: 'list', error: null }))}
        />
      )}

      {state.view === 'help' && (
        <HelpView
          tier={state.tier}
          onBack={goList}
        />
      )}

      {/* Weaver Solo views — dynamic import with nag fallback */}
      {state.view === 'network' && (
        networkView.isNag
          ? <UpgradeNag {...networkView.nagMeta} onBack={goList} />
          : networkView.Component
            ? <networkView.Component api={api} tier={state.tier} onBack={goList} />
            : null
      )}

      {state.view === 'distros' && (
        <DistrosView api={api} tier={state.tier} onBack={goList} />
      )}

      {state.view === 'templates' && (
        templatesView.isNag
          ? <UpgradeNag {...templatesView.nagMeta} onBack={goList} />
          : templatesView.Component
            ? <templatesView.Component api={api} tier={state.tier} onBack={goList} />
            : null
      )}

      {state.view === 'host-detail' && (
        hostDetailView.isNag
          ? <UpgradeNag {...hostDetailView.nagMeta} onBack={goList} />
          : hostDetailView.Component
            ? <hostDetailView.Component api={api} tier={state.tier} onBack={goList} />
            : null
      )}

      {state.view === 'notifications' && (
        notificationsView.isNag
          ? <UpgradeNag {...notificationsView.nagMeta} onBack={goList} />
          : notificationsView.Component
            ? <notificationsView.Component api={api} tier={state.tier} onBack={goList} />
            : null
      )}

      {state.view === 'settings' && (
        settingsView.isNag
          ? <UpgradeNag {...settingsView.nagMeta} onBack={goList} />
          : settingsView.Component
            ? <settingsView.Component api={api} tier={state.tier} demo={config.demo} host={config.host} onBack={goList} />
            : null
      )}

      {/* Fabrick views — dynamic import with nag fallback */}
      {state.view === 'users' && (
        usersView.isNag
          ? <UpgradeNag {...usersView.nagMeta} onBack={goList} />
          : usersView.Component
            ? <usersView.Component
                api={api}
                tier={state.tier}
                onBack={goList}
                onSelectUser={(userId: string) => setState(s => ({ ...s, view: 'user-detail', selectedUser: userId }))}
              />
            : null
      )}

      {state.view === 'audit' && (
        auditView.isNag
          ? <UpgradeNag {...auditView.nagMeta} onBack={goList} />
          : auditView.Component
            ? <auditView.Component api={api} tier={state.tier} onBack={goList} />
            : null
      )}

      {state.view === 'user-detail' && state.selectedUser && (
        userDetailView.isNag
          ? <UpgradeNag {...userDetailView.nagMeta} onBack={() => setState(s => ({ ...s, view: 'users', selectedUser: null }))} />
          : userDetailView.Component
            ? <userDetailView.Component
                userId={state.selectedUser}
                api={api}
                onBack={() => setState(s => ({ ...s, view: 'users', selectedUser: null }))}
              />
            : null
      )}

      {state.view === 'fleet-bridges' && (
        fleetBridgesView.isNag
          ? <UpgradeNag {...fleetBridgesView.nagMeta} onBack={goList} />
          : fleetBridgesView.Component
            ? <fleetBridgesView.Component api={api} tier={state.tier} onBack={goList} />
            : null
      )}
    </Box>
  )
}
