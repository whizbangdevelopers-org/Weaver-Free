// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// IMMUTABLE CONTRACT — forge-loop fixture for sample v1.1-container-logs.
// Implement the pure helpers in src/services/microvm.ts to satisfy this. Do NOT modify this file.
//
// "Immutable" scopes the EXECUTE phase: the executor may not edit the contract to make its own
// output pass. It does not freeze the file forever. Two REVIEW-phase changes are recorded here so
// the provenance stays honest rather than merely claiming to be untouched:
//   1. The apptainerLogPaths fixture was replaced with real captured stdout (see its comment) —
//      the executor's was invented, which WVR-206 names as the failure mode for these slices.
//   2. The `isApptainerInstanceLogPath` block at the bottom is NEW, covering a guard added during
//      review after audit:taint flagged reading a path supplied by another process. It was never
//      part of what the executor was asked to satisfy.
// Everything in the first describe block is the original contract, unweakened.
//
// Gap 2 of agents/v1.1.0/container-visibility.md. `GET /api/workload/:name/logs` calls
// provisioner.getLog(), which reads the PROVISIONING log — it has no relationship to `docker logs`.
// A container has no log surface at all today.
//
// Everything here is a PURE function over captured input, so the suite is deterministic and needs
// no docker/podman/apptainer installed (L-backend-2026-06-02-01KYSBXCJBJ6EM0XMYF613K02H).
import { describe, it, expect } from 'vitest'
import {
  containerLogArgs,
  apptainerLogPaths,
  isContainerLogSource,
  isApptainerInstanceLogPath,
} from '../../src/services/microvm.js'

describe('container log dispatch', () => {
  describe('isContainerLogSource', () => {
    it('claims the three container runtimes', () => {
      for (const r of ['docker', 'podman', 'apptainer']) {
        expect(isContainerLogSource(r)).toBe(true)
      }
    })

    // An absent runtime is a microvm and must keep the provisioning-log path.
    it('does not claim microvm or an absent runtime', () => {
      expect(isContainerLogSource('microvm')).toBe(false)
      expect(isContainerLogSource(undefined)).toBe(false)
    })
  })

  describe('containerLogArgs — docker/podman', () => {
    it('builds a bounded tail, never an unbounded stream', () => {
      const a = containerLogArgs('docker', 'redis-cache', 200)
      expect(a).toEqual(['logs', '--tail', '200', 'redis-cache'])
      // -f/--follow would hang the request forever; the route is not a stream.
      expect(a).not.toContain('-f')
      expect(a).not.toContain('--follow')
    })

    it('podman takes the same argv — they are CLI-compatible here', () => {
      expect(containerLogArgs('podman', 'api-worker', 50)).toEqual(['logs', '--tail', '50', 'api-worker'])
    })

    it('clamps a missing or absurd line count instead of trusting the caller', () => {
      expect(containerLogArgs('docker', 'x')).toEqual(['logs', '--tail', '200', 'x'])
      expect(containerLogArgs('docker', 'x', 0)).toEqual(['logs', '--tail', '1', 'x'])
      expect(containerLogArgs('docker', 'x', 999999)).toEqual(['logs', '--tail', '10000', 'x'])
    })
  })

  describe('apptainerLogPaths', () => {
    // Apptainer has no `logs` subcommand — `instance list --json` carries the paths instead.
    //
    // This is REAL CAPTURED STDOUT, verbatim, not a fixture written from documentation. Decision
    // WVR-206 made that distinction a prerequisite for these slices: captured stdout is an INPUT
    // to an immutable test, so a fixture invented from docs does not fail when it is wrong — it
    // silently inverts the contract and the implementation is then written to match the invention.
    //
    // Provenance: apptainer-slim 1.5.0 on lab1, 2026-07-31, from a live instance started with
    //   apptainer instance start docker://alpine:latest testinst
    //   apptainer instance list --json
    // WVR-206 recorded that no fleet host had Apptainer, so the real shape could not be captured;
    // lab1 now runs it (services.weaver.containerRuntimes = [ "apptainer" ]), which is what closes
    // that prerequisite. `img` and `ip` are kept exactly as emitted — they are unused by the parser,
    // and keeping them proves it ignores fields it does not consume rather than being tuned to a
    // trimmed shape.
    const LIST = `{
	"instances": [
		{
			"instance": "testinst",
			"pid": 6199,
			"img": "/root/.apptainer/cache/oci-tmp/6dfa7c8a3a99172fc36e13d2e17d1f73fb8cc5fe0cc2540c1027a8c134329184",
			"ip": "",
			"logErrPath": "/root/.apptainer/instances/logs/lab1/root/testinst.err",
			"logOutPath": "/root/.apptainer/instances/logs/lab1/root/testinst.out"
		}
	]
}`

    it('resolves both log paths for a listed instance', () => {
      expect(apptainerLogPaths(LIST, 'testinst')).toEqual({
        out: '/root/.apptainer/instances/logs/lab1/root/testinst.out',
        err: '/root/.apptainer/instances/logs/lab1/root/testinst.err',
      })
    })

    // The empty list is also captured verbatim — it is what the binary emits with no instances
    // running, and it is the single most common real input this parser will ever see.
    it('returns null against the real empty-list output', () => {
      expect(apptainerLogPaths('{\n\t"instances": []\n}', 'testinst')).toBeNull()
    })

    it('returns null for an unlisted instance', () => {
      expect(apptainerLogPaths(LIST, 'gone')).toBeNull()
    })

    // A missing binary and a failing binary both surface as unusable stdout — neither may throw.
    it('returns null on unparseable output rather than throwing', () => {
      expect(apptainerLogPaths('', 'sif-hpc')).toBeNull()
      expect(apptainerLogPaths('FATAL: command not found', 'sif-hpc')).toBeNull()
      expect(apptainerLogPaths('{ not json', 'sif-hpc')).toBeNull()
    })
  })
})

// The path guard, both directions. A validator only ever tested on what it must REJECT is
// indistinguishable from one that rejects everything — which here would mean Apptainer logs
// silently never resolve, reported to the caller as an ordinary 404.
describe('isApptainerInstanceLogPath', () => {
  // The real emitted path, captured from apptainer-slim 1.5.0 on lab1 (2026-07-31).
  const REAL = '/root/.apptainer/instances/logs/lab1/root/testinst.out'

  it('ACCEPTS the path Apptainer actually emits', () => {
    expect(isApptainerInstanceLogPath(REAL, 'testinst', 'out')).toBe(true)
    expect(isApptainerInstanceLogPath(REAL.replace(/\.out$/, '.err'), 'testinst', 'err')).toBe(true)
  })

  it('accepts it under a service-user home too, not just root', () => {
    expect(isApptainerInstanceLogPath(
      '/var/lib/weaver/.apptainer/instances/logs/lab1/weaver/sif-hpc.out', 'sif-hpc', 'out')).toBe(true)
  })

  it('REJECTS traversal, a foreign directory, and a mismatched instance name', () => {
    const cases: [string, string, 'out' | 'err'][] = [
      ['/root/.apptainer/instances/logs/../../../../etc/shadow', 'testinst', 'out'],
      ['/etc/shadow', 'testinst', 'out'],
      ['/root/.apptainer/instances/logs/lab1/root/other.out', 'testinst', 'out'],   // another instance
      ['/root/instances/logs/lab1/root/testinst.out', 'testinst', 'out'],           // not under .apptainer
      ['root/.apptainer/instances/logs/lab1/root/testinst.out', 'testinst', 'out'], // relative
      ['/root/.apptainer/instances/logs/lab1/root/testinst.err', 'testinst', 'out'],// wrong stream
    ]
    for (const [p, name, ext] of cases) {
      expect(isApptainerInstanceLogPath(p, name, ext), p).toBe(false)
    }
  })

  // apptainerLogPaths must ENFORCE the guard, not merely define it beside itself.
  it('is enforced by apptainerLogPaths — a hostile path yields null, not a read', () => {
    const hostile = JSON.stringify({
      instances: [{ instance: 'testinst', logOutPath: '/etc/shadow', logErrPath: '/etc/shadow' }],
    })
    expect(apptainerLogPaths(hostile, 'testinst')).toBeNull()
  })
})
