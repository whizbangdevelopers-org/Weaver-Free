// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// IMMUTABLE CONTRACT — forge-loop fixture for sample v1.1-container-parsers.
// Implement the pure parsers in src/services/microvm.ts to satisfy this. Do NOT modify this file.
//
// (Amended 2026-08-04, slice 2: the two SLICE-BOUNDARY assertions at the bottom named their own
// expiry — "that is the NEXT slice" — and that slice has now landed, so they were inverted rather
// than deleted. The parser contract above is untouched and remains immutable. See the comment on
// the `slice discipline` block for why this is the auditor being wrong for the current state and
// not the input being reworded around it.)
//
// Container visibility, gap 1 — parser half (slice 1 of the slice table).
// `scanContainers()` parses `docker ps` output INLINE inside a function that also execs and writes
// to the registry, so the parsing — the part with all the shape assumptions — cannot be tested
// without a container runtime installed. Apptainer has no parser at all.
//
// EVERY fixture below is REAL CAPTURED STDOUT, pasted verbatim. That was made a prerequisite for
// these slices, and the reason is on the record twice now:
//   - The Apptainer log-path paragraph in the agent spec was written from reading
//     instance_linux.go and was WRONG about runtime values (corrected 7208e033, verified against
//     the binary itself). Source-reading gave the SHAPE correctly and the VALUES incorrectly.
//   - A fixture invented from documentation does not fail when it is wrong. It inverts the
//     contract, and the implementation is then written to match the invention.
import { describe, it, expect } from 'vitest'
import {
  parseDockerPsLine,
  parseApptainerInstances,
} from '../../src/services/microvm.js'

// ── Real capture: `docker ps -a --format '{{json .}}'`, 2026-07-31 ────────────────────────────
// One object per line. Note `Names` has NO leading slash in this format (the existing inline
// parser strips one defensively; that is harmless, and this fixture is why we know it is not
// load-bearing). `Ports` is an empty STRING, not an absent key, for a container publishing none.
const DOCKER_PS_LINE =
  '{"Command":"\\"/entrypoint.sh\\"","CreatedAt":"2026-07-23 09:12:41 -0400 EDT",' +
  '"HealthStatus":"","ID":"eee66ae5c09b","Image":"e2e-docker-playwright-tests","Labels":"",' +
  '"LocalVolumes":"0","Mounts":"","Names":"quasar-playwright-tests","Networks":"bridge",' +
  '"Platform":"linux","Ports":"","RunningFor":"8 days ago","Size":"0B","State":"exited",' +
  '"Status":"Exited (0) 8 days ago"}'

describe('parseDockerPsLine', () => {
  it('pulls name, id, image and state out of a real docker record', () => {
    const r = parseDockerPsLine(DOCKER_PS_LINE)
    expect(r).not.toBeNull()
    expect(r!.name).toBe('quasar-playwright-tests')
    expect(r!.id).toBe('eee66ae5c09b')
    expect(r!.image).toBe('e2e-docker-playwright-tests')
    expect(r!.state).toBe('exited')
  })

  it('returns [] for ports when the field is an empty string, never [""]', () => {
    expect(parseDockerPsLine(DOCKER_PS_LINE)!.ports).toEqual([])
  })

  it('splits a multi-port mapping and trims each entry', () => {
    const line = JSON.stringify({
      Names: 'web', ID: 'abc123', Image: 'nginx:alpine', State: 'running',
      Ports: '0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp',
    })
    expect(parseDockerPsLine(line)!.ports).toEqual(['0.0.0.0:80->80/tcp', '0.0.0.0:443->443/tcp'])
  })

  // --- Network-ownership phase A: the Networks field the parser used to discard ---

  it('returns networks: ["bridge"] for the captured fixture', () => {
    // The captured record says "Networks":"bridge" — docker0, NOT br-microvm. The divergence
    // phase A exists to observe has been sitting in this repo's own test data all along; the
    // parser simply threw the evidence away.
    expect(parseDockerPsLine(DOCKER_PS_LINE)!.networks).toEqual(['bridge'])
  })

  it('returns [] for networks when the field is an empty string, never [""]', () => {
    // The Ports precedent. A [''] would make an unnetworked container look like one attached to
    // a network literally named "" — and would then be compared against bridgeInterface as a
    // real value rather than treated as unknown.
    const line = JSON.stringify({ Names: 'n', ID: 'i', Image: 'x', State: 'running', Ports: '', Networks: '' })
    expect(parseDockerPsLine(line)!.networks).toEqual([])
  })

  it('returns [] for networks when the field is absent entirely', () => {
    // Podman's ps output has omitted Networks in some versions. Absent and empty must agree.
    const line = JSON.stringify({ Names: 'n', ID: 'i', Image: 'x', State: 'running', Ports: '' })
    expect(parseDockerPsLine(line)!.networks).toEqual([])
  })

  it('splits and trims a multi-network value', () => {
    const line = JSON.stringify({
      Names: 'web', ID: 'abc123', Image: 'nginx:alpine', State: 'running',
      Ports: '', Networks: 'br-microvm, frontend ,backend',
    })
    expect(parseDockerPsLine(line)!.networks).toEqual(['br-microvm', 'frontend', 'backend'])
  })

  // Podman prefixes names with '/' in some versions; docker's {{json .}} does not. Accept both.
  it('strips a leading slash when one is present', () => {
    const line = JSON.stringify({ Names: '/legacy', ID: 'd1', Image: 'x', State: 'running', Ports: '' })
    expect(parseDockerPsLine(line)!.name).toBe('legacy')
  })

  // A parser that throws inside a scan loop aborts the whole scan and loses every other container.
  it('returns null instead of throwing on junk, and never invents a nameless record', () => {
    for (const bad of ['', '   ', 'not json', '{ truncated', '{}', '{"ID":"x"}', '{"Names":""}', '{"Names":"/"}']) {
      expect(parseDockerPsLine(bad), bad).toBeNull()
    }
  })
})

// ── Real capture: `apptainer instance list --json`, apptainer-slim 1.5.0, 2026-07-31 ──────────
// Tab-indented exactly as emitted. logOutPath/logErrPath ARE populated under --json — the agent
// spec claimed they serialize empty here and that claim was wrong; the correction is recorded
// with the spec.
const APPTAINER_LIST = `{
	"instances": [
		{
			"instance": "logtest",
			"pid": 6554,
			"img": "/root/.apptainer/cache/oci-tmp/6dfa7c8a3a99172fc36e13d2e17d1f73fb8cc5fe0cc2540c1027a8c134329184",
			"ip": "",
			"logErrPath": "/root/.apptainer/instances/logs/lab1/root/logtest.err",
			"logOutPath": "/root/.apptainer/instances/logs/lab1/root/logtest.out"
		}
	]
}`

// Real capture with nothing running. This is the single most common input this parser will see.
const APPTAINER_EMPTY = `{
	"instances": []
}`

describe('parseApptainerInstances', () => {
  it('parses a real instance record — name from `instance`, image from `img`', () => {
    const r = parseApptainerInstances(APPTAINER_LIST)
    expect(r).toHaveLength(1)
    expect(r[0]!.name).toBe('logtest')
    expect(r[0]!.image).toBe('/root/.apptainer/cache/oci-tmp/6dfa7c8a3a99172fc36e13d2e17d1f73fb8cc5fe0cc2540c1027a8c134329184')
    expect(r[0]!.pid).toBe(6554)
  })

  it('returns [] for the real empty-list output', () => {
    expect(parseApptainerInstances(APPTAINER_EMPTY)).toEqual([])
  })

  // Apptainer has no daemon and no stopped-instance record: an instance either exists (running)
  // or is absent entirely. There is nothing to report as 'exited' or 'failed', so the parser must
  // not invent a state field — presence IS the state, and the caller decides what that means.
  it('reports presence only — it does not synthesise a docker-style state', () => {
    const r = parseApptainerInstances(APPTAINER_LIST)[0]!
    expect(r).not.toHaveProperty('state')
    expect(Object.keys(r).sort()).toEqual(['image', 'name', 'pid'])
  })

  // A missing binary, a permission error and a FATAL all surface as unusable stdout. None may
  // throw: scanContainers treats "cannot scan" as an empty result, never an error (spec, Design).
  it('returns [] rather than throwing on unusable output', () => {
    for (const bad of ['', '   ', 'FATAL:   Unknown command', '{ not json', 'null', '[]', '{"instances":"x"}']) {
      expect(parseApptainerInstances(bad), bad).toEqual([])
    }
  })

  // Robustness against a future version, not doubt about this one: every field in instanceInfo is
  // non-omitempty today, so all keys are always present. Skip records missing `instance` and keep
  // the rest — one malformed entry must not lose the instances either side of it.
  it('skips records without an instance name and keeps the others', () => {
    const mixed = JSON.stringify({
      instances: [
        { pid: 1, img: 'a' },
        { instance: 'good', pid: 2, img: 'b' },
        { instance: '', pid: 3, img: 'c' },
      ],
    })
    expect(parseApptainerInstances(mixed).map(r => r.name)).toEqual(['good'])
  })

  it('tolerates unknown extra fields rather than being tuned to a trimmed shape', () => {
    const future = JSON.stringify({
      instances: [{ instance: 'x', pid: 9, img: 'i', ip: '', someNewField: true }],
      someNewTopLevel: 1,
    })
    expect(parseApptainerInstances(future).map(r => r.name)).toEqual(['x'])
  })

  it('is pure — same input, same output, no I/O', () => {
    expect(JSON.stringify(parseApptainerInstances(APPTAINER_LIST)))
      .toBe(JSON.stringify(parseApptainerInstances(APPTAINER_LIST)))
  })
})

// ── The EXTRACTION must be real, and the slice must not grow into the next one ────────────────
// These read the source because that is where the property lives: "scanContainers calls the
// parser" is not observable from the parser's own return value. They were originally shell
// conditions in the sample's gate string, which the FI-16 allowlist rightly refused — a gate is
// AI-authorable and runs as `bash gate.sh` on the executor before review, so `$(...)` in one is
// indistinguishable from an injection, and the `|` inside a quoted type union looks like a pipe.
// Contract assertions belong in the contract, where they can say what they mean.
describe('slice discipline', () => {
  const read = () => import('node:fs/promises')
    .then(fs => fs.readFile(new URL('../../src/services/microvm.ts', import.meta.url), 'utf-8'))

  it('scanContainers CALLS parseDockerPsLine rather than keeping a private copy of the parsing', async () => {
    const src = await read()
    const scan = src.slice(src.indexOf('export async function scanContainers'))
    const body = scan.slice(0, scan.indexOf('\nexport ', 1))
    expect(body, 'scanContainers must delegate to the extracted parser').toContain('parseDockerPsLine')
    // The tell-tale of the inline version: reaching into the raw docker record by key.
    expect(body, 'inline docker parsing must be GONE from scanContainers, not duplicated')
      .not.toMatch(/parsed\[['"]Names['"]\]/)
  })

  // SUPERSEDED 2026-08-04 — this assertion was the inverse of what follows: "ContainerRuntime must
  // stay docker|podman, isContainerDef must not learn apptainer yet — that is the NEXT slice." It
  // was a slice BOUNDARY guard, and its own comment named its own expiry. Slice 2 (Apptainer scan +
  // dispatch + tier gate) is now the slice under review, so the boundary it protected no longer
  // exists. Retiring it is the auditor being wrong for the current state, not the input being
  // reworded to dodge it (~/.claude/rules/never-game-auditors.md) — and it is INVERTED rather than
  // deleted, so the property stays checked in the direction that is now true.
  //
  // Its union half was also HALF-BLIND and never caught anything: `toMatch(/… 'docker' \| 'podman'/)`
  // is a substring match, so it passed unchanged against `'docker' | 'podman' | 'apptainer'`. Only
  // the isContainerDef half ever fired. The replacement anchors to end-of-line, so it can fail in
  // both directions — a guard that cannot fail is not a guard.
  it('widens ContainerRuntime and isContainerDef to apptainer — slice 2 landed', async () => {
    const src = await read()
    expect(src, 'ContainerRuntime must carry all three runtimes, anchored so a fourth is visible')
      .toMatch(/^type ContainerRuntime = 'docker' \| 'podman' \| 'apptainer'$/m)
    const guard = src.slice(src.indexOf('function isContainerDef'))
    expect(guard.slice(0, guard.indexOf('}')), 'isContainerDef must route apptainer down the container path')
      .toContain('apptainer')
  })

  // The scan branch is the other half of slice 2, and the same delegation property applies: the
  // Apptainer scan must call the extracted parser, not re-derive the shape inline.
  it('scanApptainerInstances CALLS parseApptainerInstances rather than parsing inline', async () => {
    const src = await read()
    const scan = src.slice(src.indexOf('export async function scanApptainerInstances'))
    const body = scan.slice(0, scan.indexOf('\nexport ', 1))
    expect(body, 'the apptainer scan must delegate to the extracted parser')
      .toMatch(/listApptainerInstances|parseApptainerInstances/)
    expect(body, 'inline apptainer parsing must never appear').not.toMatch(/JSON\.parse/)
  })
})
