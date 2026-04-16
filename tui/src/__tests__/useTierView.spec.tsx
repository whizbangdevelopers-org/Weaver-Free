import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { Text } from 'ink'
import { useTierView, _resetTierViewCache } from '../hooks/useTierView.js'
import type { TierViewConfig } from '../config/tier-views.js'

const tick = () => new Promise(r => setTimeout(r, 50))

function FakeComponent() { return null }

function makeConfig(overrides?: Partial<TierViewConfig>): TierViewConfig {
  return {
    minimumTier: 'weaver',
    loader: async () => ({ FakeComponent }),
    exportName: 'FakeComponent',
    featureName: 'Test Feature',
    featureDescription: 'A test feature.',
    features: ['Feature A', 'Feature B'],
    ...overrides,
  }
}

/** Test harness: renders hook result as text for inspection */
function HookHarness({ viewKey, config, tier }: { viewKey: string; config: TierViewConfig; tier: string }) {
  const result = useTierView(viewKey, config, tier)
  return (
    <>
      {result.isNag && <Text>{`NAG:${result.nagMeta.featureName}:${result.nagMeta.requiredTier}`}</Text>}
      {result.Component && <Text>COMPONENT:loaded</Text>}
      {result.loading && <Text>LOADING</Text>}
    </>
  )
}

describe('useTierView', () => {
  beforeEach(() => {
    _resetTierViewCache()
  })

  it('returns nag when tier is insufficient (free < weaver)', () => {
    const config = makeConfig({ minimumTier: 'weaver' })
    const { lastFrame } = render(<HookHarness viewKey="t1" config={config} tier="free" />)
    expect(lastFrame()).toContain('NAG:Test Feature:weaver')
  })

  it('returns nag when tier is insufficient (weaver < fabrick)', () => {
    const config = makeConfig({ minimumTier: 'fabrick' })
    const { lastFrame } = render(<HookHarness viewKey="t2" config={config} tier="weaver" />)
    expect(lastFrame()).toContain('NAG:Test Feature:fabrick')
  })

  it('loads component when tier is sufficient', async () => {
    const config = makeConfig({ minimumTier: 'weaver' })
    const { lastFrame } = render(<HookHarness viewKey="t3" config={config} tier="weaver" />)
    await tick()
    expect(lastFrame()).toContain('COMPONENT:loaded')
  })

  it('loads component for fabrick tier accessing weaver feature', async () => {
    const config = makeConfig({ minimumTier: 'weaver' })
    const { lastFrame } = render(<HookHarness viewKey="t4" config={config} tier="fabrick" />)
    await tick()
    expect(lastFrame()).toContain('COMPONENT:loaded')
  })

  it('demo tier bypasses all gates', async () => {
    const config = makeConfig({ minimumTier: 'fabrick' })
    const { lastFrame } = render(<HookHarness viewKey="t5" config={config} tier="demo" />)
    await tick()
    expect(lastFrame()).toContain('COMPONENT:loaded')
  })

  it('returns nag when loader fails (simulates free repo)', async () => {
    const config = makeConfig({
      minimumTier: 'weaver',
      loader: async () => { throw new Error('Module not found') },
    })
    const { lastFrame } = render(<HookHarness viewKey="t6" config={config} tier="weaver" />)
    await tick()
    expect(lastFrame()).toContain('NAG:Test Feature:weaver')
  })

  it('returns nag when loader returns wrong export name', async () => {
    const config = makeConfig({
      minimumTier: 'weaver',
      loader: async () => ({ WrongName: FakeComponent }),
      exportName: 'FakeComponent',
    })
    const { lastFrame } = render(<HookHarness viewKey="t7" config={config} tier="weaver" />)
    await tick()
    expect(lastFrame()).toContain('NAG:Test Feature:weaver')
  })

  it('unknown tier defaults to nag', () => {
    const config = makeConfig({ minimumTier: 'weaver' })
    const { lastFrame } = render(<HookHarness viewKey="t8" config={config} tier="unknown" />)
    expect(lastFrame()).toContain('NAG:Test Feature:weaver')
  })
})
