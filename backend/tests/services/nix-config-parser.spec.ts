// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import {
  extractMicrovmBlocks,
  extractOciContainerBlocks,
  extractSlurmBlocks,
  parseNixConfig,
} from '../../src/services/nix-config-parser.js'

// ── extractMicrovmBlocks ───────────────────────────────────────────────────

describe('extractMicrovmBlocks', () => {
  it('extracts a single microvm.vms block', () => {
    const content = `{ ... }:
microvm.vms.web-nginx = {
  config = {
    microvm.mem = 256;
  };
};`
    const lines = content.split('\n')
    const blocks = extractMicrovmBlocks(lines)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].name).toBe('web-nginx')
    expect(blocks[0].lineStart).toBe(2)
    expect(blocks[0].lineEnd).toBe(6)
  })

  it('extracts multiple microvm.vms blocks', () => {
    const content = `microvm.vms.web = {
  config.microvm.mem = 256;
};
microvm.vms.db = {
  config.microvm.mem = 2048;
};`
    const lines = content.split('\n')
    const blocks = extractMicrovmBlocks(lines)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].name).toBe('web')
    expect(blocks[1].name).toBe('db')
  })

  it('returns empty array when no microvm blocks', () => {
    const content = `{ networking.firewall.enable = true; }`
    const lines = content.split('\n')
    expect(extractMicrovmBlocks(lines)).toHaveLength(0)
  })
})

// ── extractOciContainerBlocks ──────────────────────────────────────────────

describe('extractOciContainerBlocks', () => {
  it('extracts a single OCI container block', () => {
    const content = `virtualisation.oci-containers.containers.redis = {
  image = "redis:7-alpine";
  ports = [ "6379:6379" ];
};`
    const lines = content.split('\n')
    const blocks = extractOciContainerBlocks(lines)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].name).toBe('redis')
  })

  it('extracts multiple OCI container blocks', () => {
    const content = `virtualisation.oci-containers.containers.redis = {
  image = "redis:7-alpine";
};
virtualisation.oci-containers.containers.nginx = {
  image = "nginx:alpine";
};`
    const lines = content.split('\n')
    const blocks = extractOciContainerBlocks(lines)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].name).toBe('redis')
    expect(blocks[1].name).toBe('nginx')
  })

  it('returns empty array when no OCI container blocks', () => {
    const lines = ['networking.firewall.enable = true;']
    expect(extractOciContainerBlocks(lines)).toHaveLength(0)
  })
})

// ── extractSlurmBlocks ─────────────────────────────────────────────────────

describe('extractSlurmBlocks', () => {
  it('groups services.slurm.* lines into one block', () => {
    const content = `services.slurm.enableSlurmd = true;
services.slurm.enableSlurmctld = false;
services.slurm.nodeName = "worker01 CPUs=8";`
    const lines = content.split('\n')
    const blocks = extractSlurmBlocks(lines)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].name).toBe('slurm')
    expect(blocks[0].lineStart).toBe(1)
    expect(blocks[0].lineEnd).toBe(3)
  })

  it('returns empty array when no slurm config', () => {
    const lines = ['networking.firewall.enable = true;']
    expect(extractSlurmBlocks(lines)).toHaveLength(0)
  })
})

// ── parseNixConfig (integration) ──────────────────────────────────────────

describe('parseNixConfig', () => {
  const SAMPLE_CONFIG = `{ config, pkgs, ... }: {

  microvm.vms.web-nginx = {
    config.microvm.mem = 256;
  };

  virtualisation.oci-containers.containers.redis = {
    image = "redis:7-alpine";
  };

  services.slurm.enableSlurmd = true;

  networking.bridges.br-microvm.interfaces = [];
}`

  it('identifies microvm sections', () => {
    const sections = parseNixConfig(SAMPLE_CONFIG)
    const microvm = sections.filter(s => s.type === 'microvm')
    expect(microvm).toHaveLength(1)
    expect(microvm[0].id).toBe('microvm-web-nginx')
    expect(microvm[0].label).toBe('web-nginx (MicroVM)')
  })

  it('identifies oci-container sections', () => {
    const sections = parseNixConfig(SAMPLE_CONFIG)
    const oci = sections.filter(s => s.type === 'oci-container')
    expect(oci).toHaveLength(1)
    expect(oci[0].id).toBe('oci-redis')
    expect(oci[0].label).toBe('redis (OCI Container)')
  })

  it('identifies slurm sections', () => {
    const sections = parseNixConfig(SAMPLE_CONFIG)
    const slurm = sections.filter(s => s.type === 'slurm')
    expect(slurm).toHaveLength(1)
    expect(slurm[0].type).toBe('slurm')
    expect(slurm[0].label).toBe('Slurm Node Config')
  })

  it('identifies infrastructure section', () => {
    const sections = parseNixConfig(SAMPLE_CONFIG)
    const infra = sections.filter(s => s.type === 'infrastructure')
    expect(infra).toHaveLength(1)
    expect(infra[0].id).toBe('infrastructure')
  })

  it('returns empty sections for empty config', () => {
    const sections = parseNixConfig('')
    expect(sections).toHaveLength(0)
  })

  it('returns only infrastructure for config with no workloads', () => {
    const sections = parseNixConfig('networking.firewall.enable = true;\nboot.kernelModules = [];')
    const types = sections.map(s => s.type)
    expect(types).not.toContain('microvm')
    expect(types).not.toContain('oci-container')
    expect(types).not.toContain('slurm')
    expect(types).toContain('infrastructure')
  })

  it('sections have 1-indexed line numbers', () => {
    const sections = parseNixConfig(SAMPLE_CONFIG)
    for (const s of sections) {
      expect(s.lineStart).toBeGreaterThanOrEqual(1)
      expect(s.lineEnd).toBeGreaterThanOrEqual(s.lineStart)
    }
  })

  it('does not crash on malformed Nix (unclosed brace)', () => {
    const malformed = `microvm.vms.broken = {
  config.microvm.mem = 256;`
    expect(() => parseNixConfig(malformed)).not.toThrow()
  })

  it('extracts rawNix for each section', () => {
    const sections = parseNixConfig(SAMPLE_CONFIG)
    for (const s of sections) {
      expect(s.rawNix.trim().length).toBeGreaterThan(0)
    }
  })
})
