// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// microvm.nix auto-import — parsing the DECLARATION rather than the generated run script.
//
// The distinction this whole feature rests on: `readMicrovmSpecs()` reads
// /var/lib/microvms/<name>/current/bin/microvm-run, which exists only AFTER a rebuild. A guest
// declared this morning has no unit and no run script, so `scanMicrovms()` cannot see it — which
// is exactly the state the provisioner's error message leaves a user in.
//
// The parser is deliberately line-based and deliberately partial. Most of what is asserted below
// is what it must NOT claim: a value it cannot read comes back `undefined`, never guessed, because
// a confidently wrong 512 is worse than a visible gap.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseMicrovmDeclarations } from '../../src/services/nix-config-parser.js'
import { scanNixDeclarations, setRegistry, setConfig } from '../../src/services/microvm.js'
import type { WorkloadRegistry, WorkloadDefinition } from '../../src/storage/workload-registry.js'
import type { DashboardConfig } from '../../src/config.js'

const CONFIG = `
{ config, pkgs, ... }:
{
  microvm.vms.web-nginx = {
    config = {
      microvm.hypervisor = "qemu";
      microvm.mem = 256;
      microvm.vcpu = 1;
      networking.interfaces.eth0.ipv4.addresses = [
        { address = "10.10.0.10"; prefixLength = 24; }
      ];
    };
  };

  microvm.vms.svc-postgres = {
    config = {
      microvm.hypervisor = "cloud-hypervisor";
      microvm.mem = 2048;
      microvm.vcpu = 2;
    };
  };

  virtualisation.oci-containers.containers.redis-cache = {
    image = "redis:7-alpine";
  };
}
`

describe('parseMicrovmDeclarations', () => {
  it('finds every declared guest and no containers', () => {
    const found = parseMicrovmDeclarations(CONFIG)
    expect(found.map(d => d.name).sort()).toEqual(['svc-postgres', 'web-nginx'])
  })

  it('reads the specs that are stated on their own line', () => {
    const web = parseMicrovmDeclarations(CONFIG).find(d => d.name === 'web-nginx')!
    expect(web).toEqual({ name: 'web-nginx', mem: 256, vcpu: 1, hypervisor: 'qemu', ip: '10.10.0.10' })
  })

  it('omits the IP when the declaration states none', () => {
    // undefined, not ''. The caller decides what an absent address becomes in the registry; the
    // parser must not make that choice by emitting a value the declaration never contained.
    const pg = parseMicrovmDeclarations(CONFIG).find(d => d.name === 'svc-postgres')!
    expect(pg.ip).toBeUndefined()
    expect(pg.hypervisor).toBe('cloud-hypervisor')
  })

  it('returns nothing for a config with no microvm guests', () => {
    expect(parseMicrovmDeclarations('{ services.nginx.enable = true; }')).toEqual([])
  })

  it('returns nothing for empty input rather than throwing', () => {
    expect(parseMicrovmDeclarations('')).toEqual([])
  })

  describe('what it must NOT claim', () => {
    it('leaves a value defined elsewhere undefined instead of guessing', () => {
      // `let memSize = 512; ... microvm.mem = memSize;` is perfectly valid Nix and completely
      // opaque to a line-based reader. The honest answer is "not stated here".
      const d = parseMicrovmDeclarations(`
        microvm.vms.indirect = {
          config = {
            microvm.mem = memSize;
            microvm.vcpu = cpuCount;
          };
        };
      `)[0]!
      expect(d.name).toBe('indirect')
      expect(d.mem).toBeUndefined()
      expect(d.vcpu).toBeUndefined()
    })

    it('drops a declared zero — a guest with 0 MB does not exist', () => {
      const d = parseMicrovmDeclarations(`
        microvm.vms.zeroed = {
          config = {
            microvm.mem = 0;
            microvm.vcpu = 0;
          };
        };
      `)[0]!
      expect(d.mem).toBeUndefined()
      expect(d.vcpu).toBeUndefined()
    })

    it('refuses a hypervisor microvm.nix cannot run', () => {
      // An unknown string would flow into the registry and then into a run command.
      const d = parseMicrovmDeclarations(`
        microvm.vms.bogus = {
          config = {
            microvm.hypervisor = "virtualbox";
          };
        };
      `)[0]!
      expect(d.hypervisor).toBeUndefined()
    })

    it('does not read config.microvm.mem as microvm.mem', () => {
      // The boundary that keeps the widened anchor honest — a bare substring match would take it.
      const d = parseMicrovmDeclarations(`
        microvm.vms.qualified = {
          config = {
            somewhere.config.microvm.mem = 4096;
          };
        };
      `)[0]!
      expect(d.mem).toBeUndefined()
    })

    it.each(['qemu', 'cloud-hypervisor', 'crosvm', 'kvmtool', 'firecracker'])(
      'accepts the real hypervisor %s', (hv) => {
        const d = parseMicrovmDeclarations(`
          microvm.vms.g = {
            config = {
              microvm.hypervisor = "${hv}";
            };
          };
        `)[0]!
        expect(d.hypervisor).toBe(hv)
      })

    it('reads a guest declared entirely on ONE line', () => {
      // extractBlocks treats this as a one-line block. The first version of the parser anchored
      // every field at line start and could read nothing here — which made three of the
      // must-not-claim tests above pass for a reason that had nothing to do with their subject.
      const d = parseMicrovmDeclarations(
        'microvm.vms.compact = { config = { microvm.mem = 512; microvm.vcpu = 2; microvm.hypervisor = "qemu"; }; };'
      )[0]!
      expect(d).toEqual({ name: 'compact', mem: 512, vcpu: 2, hypervisor: 'qemu', ip: undefined })
    })

    it('takes only the FIRST address when several are declared', () => {
      // The registry holds one `ip`. Picking among several silently would make which one arbitrary.
      const d = parseMicrovmDeclarations(`
        microvm.vms.multi = {
          config = {
            networking.interfaces.eth0.ipv4.addresses = [
              { address = "10.10.0.10"; prefixLength = 24; }
              { address = "10.10.0.11"; prefixLength = 24; }
            ];
          };
        };
      `)[0]!
      expect(d.ip).toBe('10.10.0.10')
    })

    it('does not read a neighbouring guest\'s values into this one', () => {
      // The failure a naive whole-file regex would produce: every guest inherits the first one's
      // memory. Block boundaries are what prevent it, so they are asserted.
      const found = parseMicrovmDeclarations(CONFIG)
      expect(found.find(d => d.name === 'svc-postgres')!.mem).toBe(2048)
      expect(found.find(d => d.name === 'web-nginx')!.mem).toBe(256)
    })
  })
})


// ── Adoption ────────────────────────────────────────────────────────────────────────────────────

function makeRegistry(initial: Record<string, WorkloadDefinition> = {}): WorkloadRegistry {
  const vms: Record<string, WorkloadDefinition> = { ...initial }
  return {
    init: async () => {},
    getAll: async () => ({ ...vms }),
    get: async (n) => vms[n] ?? null,
    has: async (n) => n in vms,
    add: async (vm) => { if (vms[vm.name]) return false; vms[vm.name] = vm; return true },
    remove: async (n) => { if (!vms[n]) return false; delete vms[n]; return true },
    update: async (n, f) => { if (!vms[n]) return false; vms[n] = { ...vms[n]!, ...f }; return true },
  }
}

describe('scanNixDeclarations', () => {
  let dir: string
  let nixPath: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nix-import-'))
    nixPath = join(dir, 'configuration.nix')
    setConfig({ nixConfigPath: nixPath } as unknown as DashboardConfig)
  })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('adopts a guest that is declared but has no systemd unit yet', async () => {
    // The whole point: this guest has never been built, so scanMicrovms() cannot see it.
    await writeFile(nixPath, CONFIG)
    const reg = makeRegistry()
    setRegistry(reg)

    const r = await scanNixDeclarations()
    expect(r.added.sort()).toEqual(['svc-postgres', 'web-nginx'])
    expect(await reg.get('web-nginx')).toMatchObject({
      name: 'web-nginx', ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu',
    })
  })

  it('does NOT set provisioningState — an adopted guest is not one Weaver provisioned', async () => {
    // Matching scanMicrovms() exactly. Setting `registered` would flip isProvisionedOrLegacy()
    // and quietly change how existing code treats the row.
    await writeFile(nixPath, CONFIG)
    const reg = makeRegistry()
    setRegistry(reg)
    await scanNixDeclarations()
    expect((await reg.get('web-nginx'))!.provisioningState).toBeUndefined()
  })

  it('never overwrites a row the run script already populated', async () => {
    // A built guest's specs come from what is RUNNING; the declaration is what someone intends to
    // run. When they disagree the running value wins, so this reports `existing` and touches
    // nothing. Without this, a stale declaration would silently rewrite live specs on every scan.
    await writeFile(nixPath, CONFIG)
    const reg = makeRegistry({
      'web-nginx': { name: 'web-nginx', ip: '10.10.0.99', mem: 9999, vcpu: 8, hypervisor: 'crosvm' },
    })
    setRegistry(reg)

    const r = await scanNixDeclarations()
    expect(r.existing).toContain('web-nginx')
    expect(r.added).not.toContain('web-nginx')
    expect(await reg.get('web-nginx')).toMatchObject({ mem: 9999, vcpu: 8, hypervisor: 'crosvm', ip: '10.10.0.99' })
  })

  it('records unreadable specs as the UNKNOWN sentinel, not as invented numbers', async () => {
    await writeFile(nixPath, `
      microvm.vms.indirect = {
        config = {
          microvm.mem = memSize;
        };
      };
    `)
    const reg = makeRegistry()
    setRegistry(reg)
    await scanNixDeclarations()
    expect(await reg.get('indirect')).toMatchObject({ mem: 0, vcpu: 0, hypervisor: 'unknown', ip: '' })
  })

  it('returns an empty result when configuration.nix does not exist', async () => {
    // Plenty of hosts have no file at the configured path. Not an error, same as a missing
    // container binary — a scan that threw here would take the other scans down with it.
    setConfig({ nixConfigPath: join(dir, 'nope.nix') } as unknown as DashboardConfig)
    setRegistry(makeRegistry())
    await expect(scanNixDeclarations()).resolves.toEqual({ discovered: [], added: [], existing: [] })
  })

  it('returns an empty result when no path is configured at all', async () => {
    setConfig({} as unknown as DashboardConfig)
    setRegistry(makeRegistry())
    await expect(scanNixDeclarations()).resolves.toEqual({ discovered: [], added: [], existing: [] })
  })

  it('is idempotent — a second scan adds nothing', async () => {
    await writeFile(nixPath, CONFIG)
    setRegistry(makeRegistry())
    await scanNixDeclarations()
    const second = await scanNixDeclarations()
    expect(second.added).toEqual([])
    expect(second.existing.sort()).toEqual(['svc-postgres', 'web-nginx'])
  })
})
