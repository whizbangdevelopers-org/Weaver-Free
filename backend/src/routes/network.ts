// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { listVms } from '../services/microvm.js'
import type { DashboardConfig } from '../config.js'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../constants/vocabularies.js'

interface NetworkRouteOptions {
  config: DashboardConfig
}

function deriveSubnet(ip: string): string {
  const parts = ip.split('.')
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
}

function deriveGateway(ip: string): string {
  const parts = ip.split('.')
  return `${parts[0]}.${parts[1]}.${parts[2]}.1`
}

export const networkRoutes: FastifyPluginAsync<NetworkRouteOptions> = async (fastify, opts) => {
  const { config } = opts

  fastify.get('/topology', {
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
  }, async () => {
    const vms = await listVms()

    // Group VMs by bridge, defaulting to config bridge
    const bridgeMap = new Map<string, string[]>()
    for (const vm of vms) {
      const br = vm.bridge ?? config.bridgeInterface
      if (!bridgeMap.has(br)) bridgeMap.set(br, [])
      bridgeMap.get(br)!.push(vm.ip)
    }

    // Derive bridge info from grouped VMs
    const bridges = Array.from(bridgeMap.entries()).map(([name, ips]) => {
      const refIp = ips[0] ?? config.bridgeGateway ?? ''
      return {
        name,
        gateway: deriveGateway(refIp),
        subnet: deriveSubnet(refIp),
      }
    })

    return {
      bridges,
      nodes: vms.map(vm => ({
        name: vm.name,
        ip: vm.ip,
        status: vm.status,
        hypervisor: vm.hypervisor,
        distro: vm.distro,
        bridge: vm.bridge ?? config.bridgeInterface,
        mem: vm.mem,
        vcpu: vm.vcpu,
        uptime: vm.uptime,
        description: vm.description,
        tags: vm.tags,
        autostart: vm.autostart,
      })),
    }
  })
}
