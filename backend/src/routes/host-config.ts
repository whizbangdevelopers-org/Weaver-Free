// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, readlink, lstat } from 'node:fs/promises'
import { isAbsolute, resolve as pathResolve, dirname } from 'node:path'
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../middleware/rbac.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'
import { nixConfigResponseSchema } from '../schemas/host-config.js'
import { parseNixConfig } from '../services/nix-config-parser.js'

// ── Mock content for demo mode ─────────────────────────────────────────────

const MOCK_CONFIG_CONTENT = `{ config, pkgs, lib, ... }: {

  # ── MicroVM workload definitions ──────────────────────────────────────────
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
      networking.interfaces.eth0.ipv4.addresses = [
        { address = "10.10.0.30"; prefixLength = 24; }
      ];
    };
  };

  # ── OCI container definitions ──────────────────────────────────────────────
  virtualisation.oci-containers.containers.redis-cache = {
    image = "redis:7-alpine";
    ports = [ "6379:6379" ];
    extraOptions = [ "--network=host" ];
  };

  virtualisation.oci-containers.containers.nginx-proxy = {
    image = "nginx:alpine";
    ports = [ "80:80" "443:443" ];
    volumes = [ "/etc/nginx/conf.d:/etc/nginx/conf.d:ro" ];
  };

  # ── Slurm node configuration ──────────────────────────────────────────────
  services.slurm.enableSlurmctld = false;
  services.slurm.enableSlurmd = true;
  services.slurm.nodeName = "worker01 CPUs=8 Sockets=1 CoresPerSocket=4 ThreadsPerCore=2 RealMemory=32768 State=UNKNOWN";

  # ── Infrastructure ────────────────────────────────────────────────────────
  networking.bridges.br-microvm.interfaces = [];
  networking.interfaces.br-microvm.ipv4.addresses = [
    { address = "10.10.0.1"; prefixLength = 24; }
  ];
  boot.kernelModules = [ "kvm-intel" "vhost_vsock" ];
  networking.nftables.enable = true;
  networking.nat.enable = true;
  networking.nat.internalInterfaces = [ "br-microvm" ];
}`

// ── Route plugin ───────────────────────────────────────────────────────────

interface HostConfigRouteOptions {
  config: DashboardConfig
}

export const hostConfigRoutes: FastifyPluginAsync<HostConfigRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { config } = opts

  app.get(
    '/',
    {
      config: { rateLimit: createRateLimit(30) },
      schema: {
        response: {
          200: nixConfigResponseSchema,
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER)],
    },
    async (_request, reply) => {
      const readAt = new Date().toISOString()

      // Demo mode: return mock content without touching the filesystem
      if (config.tier === TIERS.DEMO) {
        const sections = parseNixConfig(MOCK_CONFIG_CONTENT)
        return reply.send({
          available: true,
          rawContent: MOCK_CONFIG_CONTENT,
          sections,
          configPath: config.nixConfigPath,
          readAt,
        })
      }

      // Production: read the real configuration.nix
      try {
        const rawContent = await readFile(config.nixConfigPath, 'utf-8')
        const sections = parseNixConfig(rawContent)
        return reply.send({
          available: true,
          rawContent,
          sections,
          configPath: config.nixConfigPath,
          readAt,
        })
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code

        // Build a helpful error with actionable remediation.
        let sanitized: string
        let remediation: string | undefined
        let resolvedPath: string | undefined

        if (code === 'ENOENT') {
          sanitized = `Configuration file not found at ${config.nixConfigPath}`
          remediation =
            'Check that the file exists and that services.weaver.nixConfigPath points to it. ' +
            'The default is /etc/nixos/configuration.nix.'
        } else if (code === 'EACCES' || code === 'EPERM') {
          sanitized = `Permission denied reading ${config.nixConfigPath}`

          // Walk the path manually with lstat/readlink (not realpath)
          // because realpath requires traversal of each parent dir, which
          // fails as the weaver user when /etc/nixos symlinks into a 0700
          // home directory. lstat/readlink only need access to the symlink
          // itself, not permission to traverse the target.
          try {
            let current = config.nixConfigPath
            // Walk parent chain until we find a symlink or reach /
            while (current && current !== '/') {
              try {
                const stats = await lstat(current)
                if (stats.isSymbolicLink()) {
                  const target = await readlink(current)
                  resolvedPath = isAbsolute(target)
                    ? target
                    : pathResolve(dirname(current), target)
                  break
                }
              } catch {
                // lstat failed on this path — keep walking up
              }
              const parent = dirname(current)
              if (parent === current) break
              current = parent
            }
          } catch {
            // ignore — resolution failed, we'll show the original path
          }

          if (resolvedPath && resolvedPath !== config.nixConfigPath && resolvedPath.startsWith('/home/')) {
            // Extract the home dir for a precise remediation hint
            const homeMatch = resolvedPath.match(/^(\/home\/[^/]+)/)
            const homeDir = homeMatch ? homeMatch[1] : '/home/<user>'
            remediation =
              `The config path resolves into ${homeDir}, which is typically mode 0700 and blocks the ` +
              `weaver service user from traversing it. Allow directory traversal (not listing) with:\n` +
              `    sudo chmod o+x ${homeDir}\n` +
              `This preserves privacy (other users still cannot list the directory) while letting ` +
              `services follow symlinks into it.`
          } else {
            remediation =
              `The weaver service user needs read access to the file. ` +
              `Check permissions with: ls -lL ${config.nixConfigPath}`
          }
        } else {
          sanitized = `Unable to read NixOS configuration (${code ?? 'unknown error'})`
        }

        return reply.send({
          available: false,
          rawContent: null,
          sections: [],
          configPath: config.nixConfigPath,
          resolvedPath,
          readAt,
          error: sanitized,
          remediation,
        })
      }
    },
  )
}
