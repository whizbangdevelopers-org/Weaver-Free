// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { listVms, getVm, startVm, stopVm, restartVm, createVm, deleteVm, getWorkloadDefinitions, updateVmField, scanMicrovms, scanContainers } from '../services/microvm.js'
import { requireRole } from '../middleware/rbac.js'
import { requireTier } from '../license.js'
import { TIERS, ROLES, STATUSES, PROVISIONING } from '../constants/vocabularies.js'
import { checkFreeTierCap as checkFreeTierCapPure } from '../services/free-tier-cap.js'
import type { Provisioner } from '../services/provisioner-types.js'
import type { ImageManager } from '../services/image-manager.js'
import type { DashboardConfig } from '../config.js'
import type { AuditService } from '../services/audit.js'
import type { QuotaStore } from '../storage/quota-store.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import { createVmAclCheck } from '../middleware/vm-acl.js'
import { createRateLimit } from '../middleware/rate-limit.js'

const vmNameSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid VM name format')
})

// Response schemas for fast-json-stringify serialization
const vmInfoResponseSchema = z.object({
  name: z.string(),
  status: z.enum([STATUSES.RUNNING, STATUSES.IDLE, STATUSES.STOPPED, STATUSES.FAILED, STATUSES.UNKNOWN]),
  ip: z.string(),
  mem: z.number(),
  vcpu: z.number(),
  hypervisor: z.string(),
  diskSize: z.number().optional(),
  uptime: z.string().nullable(),
  distro: z.string().optional(),
  guestOs: z.enum(['linux', 'windows']).optional(),
  provisioningState: z.enum([PROVISIONING.REGISTERED, PROVISIONING.PROVISIONING, PROVISIONING.PROVISIONED, PROVISIONING.PROVISION_FAILED, PROVISIONING.DESTROYING]).optional(),
  provisioningError: z.string().optional(),
  autostart: z.boolean().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  bridge: z.string().optional(),
  macAddress: z.string().optional(),
  tapInterface: z.string().optional(),
  imageUrl: z.string().optional(),
  runtime: z.enum(['microvm', 'docker', 'podman', 'apptainer']).optional(),
  containerId: z.string().optional(),
  image: z.string().optional(),
  ports: z.array(z.string()).optional(),
})

const vmActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  provisioningState: z.string().optional(),
})

const errorResponseSchema = z.object({
  error: z.string(),
})

const CLOUD_DISTROS = ['arch', 'fedora', 'ubuntu', 'debian', 'alpine']
const CONTAINER_HYPERVISORS = ['docker', 'podman', 'apptainer'] as const

const vmCreateSchema = z.object({
  name: z.string()
    .regex(/^[a-z][a-z0-9-]*$/, 'VM name must start with lowercase letter, contain only lowercase letters, digits, and hyphens')
    .min(2, 'VM name must be at least 2 characters')
    .max(63, 'VM name must be at most 63 characters'),
  ip: z.string(),
  mem: z.number().int().min(0).max(65536, 'Maximum 65536 MB'),
  vcpu: z.number().int().min(0).max(32, 'Maximum 32 vCPUs'),
  hypervisor: z.enum(['qemu', 'cloud-hypervisor', 'crosvm', 'kvmtool', 'firecracker', 'docker', 'podman', 'apptainer']),
  diskSize: z.number().int().min(5, 'Minimum 5 GB').max(500, 'Maximum 500 GB').optional(),
  distro: z.string().min(1).max(32).optional(),
  vmType: z.enum(['server', 'desktop']).optional(),
  autostart: z.boolean().optional(),
  description: z.string().max(500).optional(),
  tags: z.array(
    z.string().min(1).max(30).regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags must be lowercase alphanumeric with hyphens')
  ).max(10).optional(),
  imageUrl: z.string().regex(/^(https?|file):\/\/.+/, 'Must be a valid URL (http://, https://, or file://)').optional(),
  imageFormat: z.enum(['qcow2', 'raw', 'iso']).optional(),
  cloudInit: z.boolean().optional(),
  runtime: z.enum(['microvm', 'docker', 'podman', 'apptainer']).optional(),
  containerId: z.string().optional(),
  image: z.string().optional(),
  ports: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  const isContainer = (CONTAINER_HYPERVISORS as readonly string[]).includes(data.hypervisor)
  if (!isContainer) {
    // VM workloads require valid IPv4, min 64 MB, min 1 vCPU
    const ipResult = z.string().ip({ version: 'v4' }).safeParse(data.ip)
    if (!ipResult.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid IPv4 address', path: ['ip'] })
    }
    if (data.mem < 64) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum 64 MB', path: ['mem'] })
    }
    if (data.vcpu < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum 1 vCPU', path: ['vcpu'] })
    }
    // VM-only distro constraints
    if (data.distro && CLOUD_DISTROS.includes(data.distro) && data.hypervisor !== 'qemu') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cloud distros require QEMU hypervisor', path: ['hypervisor'] })
    }
    if (data.vmType === 'desktop' && data.hypervisor !== 'qemu') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Desktop mode requires QEMU hypervisor', path: ['vmType'] })
    }
    if (data.distro === 'other' && (!data.imageUrl || data.imageUrl.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Image URL is required when distro is "Other"', path: ['imageUrl'] })
    }
    if (data.distro === 'other' && data.hypervisor !== 'qemu') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"Other" distro requires QEMU hypervisor', path: ['hypervisor'] })
    }
  }
})

interface VmsRouteOptions {
  provisioner?: Provisioner | null
  imageManager?: ImageManager | null
  config?: DashboardConfig
  auditService?: AuditService
  quotaStore?: QuotaStore
  aclStore?: VmAclStore
}

export const workloadsRoutes: FastifyPluginAsync<VmsRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { provisioner, imageManager, config, auditService, quotaStore, aclStore } = opts

  // Per-VM ACL check middleware (fabrick only, admin bypass)
  const aclCheck = (aclStore && config) ? createVmAclCheck(aclStore, config) : undefined
  const aclPreHandler = aclCheck ? [aclCheck] : []

  /**
   * Free-tier cap wrapper — fetches current registry state then delegates
   * to the pure function. See `services/free-tier-cap.ts` for the logic.
   */
  async function checkFreeTierCap(
    targetName: string,
  ): ReturnType<typeof checkFreeTierCapPure> extends infer R ? Promise<R> : never {
    if (!config) return null
    const all = await listVms()
    return checkFreeTierCapPure(targetName, all, config.tier)
  }

  // GET /api/workload — list all VMs (with ACL filtering for fabrick)
  app.get('/', { schema: { response: { 200: z.array(vmInfoResponseSchema) } } }, async (request) => {
    let vms = await listVms()
    // Fabrick ACL filtering: non-admin users with ACL entries see only assigned VMs
    if (config?.tier === TIERS.FABRICK && aclStore && request.userId && request.userRole !== ROLES.ADMIN) {
      vms = aclStore.filterVms(request.userId, vms)
    }
    return vms
  })

  // POST /api/workload/scan — discover microvm@* systemd services (admin only)
  app.post(
    '/scan',
    {
      schema: {
        response: {
          200: z.object({
            discovered: z.array(z.string()),
            added: z.array(z.string()),
            existing: z.array(z.string()),
          }),
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
      config: { rateLimit: createRateLimit(5) },
    },
    async (request) => {
      const [microvmResult, dockerResult, podmanResult] = await Promise.all([
        scanMicrovms(),
        scanContainers('docker'),
        scanContainers('podman'),
      ])
      const result = {
        discovered: [...microvmResult.discovered, ...dockerResult.discovered, ...podmanResult.discovered],
        added: [...microvmResult.added, ...dockerResult.added, ...podmanResult.added],
        existing: [...microvmResult.existing, ...dockerResult.existing, ...podmanResult.existing],
      }

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.scan',
        resource: 'system',
        ip: request.ip,
        success: true,
      })

      return result
    }
  )

  // POST /api/workload — create a VM (with optional provisioning)
  app.post(
    '/',
    {
      schema: {
        body: vmCreateSchema,
        response: { 200: vmActionResponseSchema, 201: vmActionResponseSchema, 202: vmActionResponseSchema, 400: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
      config: { rateLimit: createRateLimit(30) },
    },
    async (request, reply) => {
      // Tier gate: VM creation/provisioning requires weaver tier
      if (config) {
        try {
          requireTier(config, TIERS.SOLO)
        } catch {
          return reply.status(403).send({ error: 'VM creation requires weaver tier' })
        }
      }

      // Fabrick quota enforcement
      if (config && config.tier === TIERS.FABRICK && request.userId && quotaStore) {
        const allVms = await getWorkloadDefinitions()
        const vmList = Object.values(allVms)
        const currentUsage = {
          totalVms: vmList.length,
          totalMemoryMB: vmList.reduce((sum, vm) => sum + vm.mem, 0),
          totalVcpus: vmList.reduce((sum, vm) => sum + vm.vcpu, 0),
        }
        const quotaCheck = quotaStore.checkQuota(
          request.userId,
          request.body.mem,
          request.body.vcpu,
          currentUsage
        )
        if (!quotaCheck.allowed) {
          return reply.status(403).send({ error: quotaCheck.reason ?? 'Quota exceeded' })
        }
      }

      const body = { ...request.body } as typeof request.body & { guestOs?: 'linux' | 'windows' }
      const isContainerWorkload = (CONTAINER_HYPERVISORS as readonly string[]).includes(body.hypervisor)

      // Ad-hoc "other" distro: apply defaults (schema already validated imageUrl + qemu)
      if (body.distro === 'other') {
        body.imageFormat = body.imageFormat ?? 'qcow2'
        body.cloudInit = body.cloudInit ?? (body.imageFormat !== 'iso')
      }

      // Validate distro constraints when image manager is available (VM workloads only)
      if (!isContainerWorkload && body.distro && body.distro !== 'other' && imageManager) {
        const source = imageManager.getDistroSource(body.distro)
        if (source?.guestOs === 'windows') {
          body.guestOs = 'windows'
          if (body.hypervisor !== 'qemu') {
            return reply.status(400).send({ error: 'Windows guests require QEMU hypervisor' })
          }
          if (body.vmType !== 'desktop') {
            body.vmType = 'desktop'
          }
        }

        // Cloud/ISO distros require QEMU
        if ((imageManager.isCloudDistro(body.distro) || imageManager.isIsoDistro(body.distro)) && body.hypervisor !== 'qemu') {
          return reply.status(400).send({ error: 'Cloud and ISO distros require QEMU hypervisor' })
        }

        // Firecracker is incompatible with NixOS MicroVMs (no virtiofs/9p store sharing)
        if (imageManager.isFlakeDistro(body.distro) && body.hypervisor === 'firecracker') {
          return reply.status(400).send({ error: 'Firecracker is incompatible with NixOS MicroVMs (no virtiofs/9p support)' })
        }
      }

      // Bridge network and IP validation — VM workloads only (containers have no bridge IP)
      if (!isContainerWorkload) {
        if (!config?.bridgeGateway) {
          return reply.status(400).send({ error: 'Bridge network not configured. Set BRIDGE_GATEWAY in the server environment.' })
        }

        const gwSubnet = config.bridgeGateway.split('.').slice(0, 3).join('.')
        const vmSubnet = body.ip.split('.').slice(0, 3).join('.')
        if (vmSubnet !== gwSubnet) {
          return reply.status(400).send({ error: `IP must be in the bridge subnet (${gwSubnet}.x)` })
        }
        if (body.ip === config.bridgeGateway) {
          return reply.status(400).send({ error: `IP address '${body.ip}' is the bridge gateway (host) address` })
        }

        const existingVms = await getWorkloadDefinitions()
        const duplicateIp = Object.values(existingVms).find(vm => vm.ip === body.ip)
        if (duplicateIp) {
          return reply.status(409).send({ error: `IP address '${body.ip}' is already in use by VM '${duplicateIp.name}'` })
        }
      }

      const result = await createVm(body)
      if (!result.success) {
        return reply.status(409).send({ error: result.message })
      }

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.create',
        resource: request.body.name,
        details: { ip: request.body.ip, mem: request.body.mem, vcpu: request.body.vcpu, hypervisor: request.body.hypervisor },
        ip: request.ip,
        success: true,
      })

      // Fire-and-forget provisioning when provisioner is available
      if (provisioner && config?.provisioningEnabled) {
        provisioner.provision(request.body.name).catch(err => {
          fastify.log.error(err, `Provisioning failed for ${request.body.name}`)
        })
        return reply.status(202).send({ ...result, provisioningState: 'provisioning' })
      }

      return reply.status(201).send(result)
    }
  )

  // DELETE /api/workload/:name — destroy and remove VM (admin + weaver)
  app.delete(
    '/:name',
    {
      schema: { params: vmNameSchema, response: { 200: vmActionResponseSchema, 400: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema } },
      preHandler: [requireRole(ROLES.ADMIN)],
      config: { rateLimit: createRateLimit(30) },
    },
    async (request, reply) => {
      // Tier gate: VM deletion requires weaver tier
      if (config) {
        try {
          requireTier(config, TIERS.SOLO)
        } catch {
          return reply.status(403).send({ error: 'VM deletion requires weaver tier' })
        }
      }

      const { name } = request.params

      // When provisioner is available, use full destroy (stop + cleanup files + remove from registry)
      if (provisioner && config?.provisioningEnabled) {
        try {
          await provisioner.destroy(name)
          await auditService?.log({
            userId: request.userId ?? null,
            username: request.username ?? 'unknown',
            action: 'vm.delete',
            resource: name,
            ip: request.ip,
            success: true,
          })
          return { success: true, message: `VM '${name}' destroyed` }
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'Unknown error'
          fastify.log.error(err, `Failed to destroy VM '${name}'`)
          await auditService?.log({
            userId: request.userId ?? null,
            username: request.username ?? 'unknown',
            action: 'vm.delete',
            resource: name,
            details: { error: detail },
            ip: request.ip,
            success: false,
          })
          if (detail.includes('not found')) {
            return reply.status(404).send({ error: `VM '${name}' not found` })
          }
          return reply.status(400).send({ error: `Failed to delete VM '${name}'. Check server logs for details.` })
        }
      }

      // Fallback: registry-only removal
      const result = await deleteVm(name)

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.delete',
        resource: name,
        ip: request.ip,
        success: result.success,
      })

      if (!result.success) {
        if (result.message.includes('not found')) {
          return reply.status(404).send({ error: result.message })
        }
        return reply.status(400).send({ error: result.message })
      }
      return result
    }
  )

  // GET /api/workload/:name — get single VM
  app.get(
    '/:name',
    { schema: { params: vmNameSchema, response: { 200: vmInfoResponseSchema, 404: errorResponseSchema } }, preHandler: [...aclPreHandler] },
    async (request, reply) => {
      const { name } = request.params
      const vm = await getVm(name)
      if (!vm) {
        return reply.status(404).send({ error: `VM '${name}' not found` })
      }
      return vm
    }
  )

  // GET /api/workload/:name/logs — get provisioning logs (operator+)
  app.get(
    '/:name/logs',
    {
      schema: {
        params: vmNameSchema,
        response: {
          200: z.object({ name: z.string(), log: z.string() }),
          404: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler],
    },
    async (request, reply) => {
      const { name } = request.params
      if (!provisioner) {
        return reply.status(404).send({ error: 'Provisioning not enabled' })
      }
      const log = await provisioner.getLog(name)
      if (log === null) {
        return reply.status(404).send({ error: `No logs found for VM '${name}'` })
      }
      return { name, log }
    }
  )

  // POST /api/workload/:name/start — start VM (operator+)
  app.post(
    '/:name/start',
    { schema: { params: vmNameSchema, response: { 200: vmActionResponseSchema, 400: errorResponseSchema, 403: errorResponseSchema } }, preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler], config: { rateLimit: createRateLimit(30) } },
    async (request, reply) => {
      const { name } = request.params

      // Free-tier cap check (observer pattern — alphabetical-first-N controllable + 64GB memory ceiling).
      const capError = await checkFreeTierCap(name)
      if (capError) {
        await auditService?.log({
          userId: request.userId ?? null,
          username: request.username ?? 'unknown',
          action: 'vm.start',
          resource: name,
          ip: request.ip,
          success: false,
        })
        return reply.status(capError.status).send({ error: capError.error })
      }

      const result = await startVm(name)

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.start',
        resource: name,
        ip: request.ip,
        success: result.success,
      })

      if (!result.success) {
        return reply.status(400).send({ error: result.message })
      }
      return result
    }
  )

  // POST /api/workload/:name/stop — stop VM (operator+)
  app.post(
    '/:name/stop',
    { schema: { params: vmNameSchema, response: { 200: vmActionResponseSchema, 400: errorResponseSchema } }, preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler], config: { rateLimit: createRateLimit(30) } },
    async (request, reply) => {
      const { name } = request.params
      const result = await stopVm(name)

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.stop',
        resource: name,
        ip: request.ip,
        success: result.success,
      })

      if (!result.success) {
        return reply.status(400).send({ error: result.message })
      }
      return result
    }
  )

  // POST /api/workload/:name/restart — restart VM (operator+)
  app.post(
    '/:name/restart',
    { schema: { params: vmNameSchema, response: { 200: vmActionResponseSchema, 400: errorResponseSchema, 403: errorResponseSchema } }, preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler], config: { rateLimit: createRateLimit(30) } },
    async (request, reply) => {
      const { name } = request.params

      // Free-tier cap check (same rules as start).
      const capError = await checkFreeTierCap(name)
      if (capError) {
        await auditService?.log({
          userId: request.userId ?? null,
          username: request.username ?? 'unknown',
          action: 'vm.restart',
          resource: name,
          ip: request.ip,
          success: false,
        })
        return reply.status(capError.status).send({ error: capError.error })
      }

      const result = await restartVm(name)

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.restart',
        resource: name,
        ip: request.ip,
        success: result.success,
      })

      if (!result.success) {
        return reply.status(400).send({ error: result.message })
      }
      return result
    }
  )

  // PUT /api/workload/:name/autostart — toggle autostart (operator+)
  app.put(
    '/:name/autostart',
    {
      schema: {
        params: vmNameSchema,
        body: z.object({ autostart: z.boolean() }),
        response: { 200: z.object({ success: z.boolean(), autostart: z.boolean() }), 404: errorResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler],
    },
    async (request, reply) => {
      const { name } = request.params
      const { autostart } = request.body
      const result = await updateVmField(name, { autostart })
      if (!result.success) {
        return reply.status(404).send({ error: result.message })
      }
      return { success: true, autostart }
    }
  )

  // PUT /api/workload/:name/description — set description (operator+)
  app.put(
    '/:name/description',
    {
      schema: {
        params: vmNameSchema,
        body: z.object({ description: z.string().max(500) }),
        response: { 200: z.object({ success: z.boolean(), description: z.string() }), 404: errorResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler],
    },
    async (request, reply) => {
      const { name } = request.params
      const description = request.body.description.trim()
      const result = await updateVmField(name, { description: description || undefined })
      if (!result.success) {
        return reply.status(404).send({ error: result.message })
      }
      return { success: true, description }
    }
  )

  // PUT /api/workload/:name/tags — set tags (operator+)
  app.put(
    '/:name/tags',
    {
      schema: {
        params: vmNameSchema,
        body: z.object({
          tags: z.array(
            z.string().min(1).max(30).regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags must be lowercase alphanumeric with hyphens')
          ).max(10),
        }),
        response: { 200: z.object({ success: z.boolean(), tags: z.array(z.string()) }), 404: errorResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler],
    },
    async (request, reply) => {
      const { name } = request.params
      // Deduplicate tags
      const tags = [...new Set(request.body.tags)]
      const result = await updateVmField(name, { tags: tags.length > 0 ? tags : undefined })
      if (!result.success) {
        return reply.status(404).send({ error: result.message })
      }
      return { success: true, tags }
    }
  )
}
