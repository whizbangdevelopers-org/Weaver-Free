import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { StatusBar } from '../components/StatusBar.js'

describe('StatusBar', () => {
  it('shows connected indicator when connected', () => {
    const { lastFrame } = render(
      <StatusBar connected={true} tier="weaver" demo={false} vmCount={5} />
    )
    expect(lastFrame()).toContain('connected')
    expect(lastFrame()).toContain('●')
  })

  it('shows disconnected indicator when not connected', () => {
    const { lastFrame } = render(
      <StatusBar connected={false} tier="free" demo={false} vmCount={0} />
    )
    expect(lastFrame()).toContain('disconnected')
    expect(lastFrame()).toContain('○')
  })

  it('shows tier badge', () => {
    const { lastFrame } = render(
      <StatusBar connected={true} tier="fabrick" demo={false} vmCount={3} />
    )
    expect(lastFrame()).toContain('tier: fabrick')
  })

  it('shows VM count', () => {
    const { lastFrame } = render(
      <StatusBar connected={true} tier="weaver" demo={false} vmCount={8} />
    )
    expect(lastFrame()).toContain('8 VMs')
  })

  it('shows DEMO badge when demo mode is active', () => {
    const { lastFrame } = render(
      <StatusBar connected={true} tier="weaver" demo={true} vmCount={5} />
    )
    expect(lastFrame()).toContain('[DEMO]')
  })

  it('hides DEMO badge when not in demo mode', () => {
    const { lastFrame } = render(
      <StatusBar connected={true} tier="weaver" demo={false} vmCount={5} />
    )
    expect(lastFrame()).not.toContain('[DEMO]')
  })

  it('shows app title', () => {
    const { lastFrame } = render(
      <StatusBar connected={true} tier="free" demo={false} vmCount={0} />
    )
    expect(lastFrame()).toContain('Weaver')
  })
})
