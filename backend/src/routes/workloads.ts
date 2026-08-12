// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { listVms, getVm, startVm, stopVm, restartVm, createVm, deleteVm, getWorkloadDefinitions, updateVmField, scanMicrovms, scanContainers, isContainerLogSource, getContainerLogs, cloneRejectionReason, deriveClonedDefinition, buildExportDocument } from '../services/microvm.js'
import { requireRole } from '../middleware/rbac.js'
import { requireTier } from '../license.js'
import { TIERS, TIER_ORDER, ROLES, STATUSES, PROVISIONING } from '../constants/vocabularies.js'
import { checkFreeTierCap as checkFreeTierCapPure } from '../services/free-tier-cap.js'
import type { ScanResult } from '../services/microvm.js'
import type { Provisioner } from '../services/provisioner-types.js'
import type { ImageManager } from '../services/image-manager.js'
import type { DashboardConfig } from '../config.js'
import type { AuditService } from '../services/audit.js'
import type { QuotaStore } from '../storage/quota-store.js'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import { createVmAclCheck } from '../middleware/vm-acl.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import { resolveWindowMs, SAMPLE_INTERVAL_MS, type MetricsCollector } from '../services/metrics.js'

const vmNameSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid VM name format')
})

/**
 * The export document's response schema.
 *
 * Every exportable field must be listed. Fastify validates the response and Zod strips unknown
 * keys, so an omission here silently drops the field between the service and the file the user
 * downloads — the same silent-shape failure `vmInfoResponseSchema` carries a note about, except
 * that here the loss lands in a file someone keeps and later re-imports.
 */
const exportedWorkloadSchema = z.object({
  name: z.string(),
  ip: z.string(),
  mem: z.number(),
  vcpu: z.number(),
  hypervisor: z.string(),
  diskSize: z.number().optional(),
  distro: z.string().optional(),
  guestOs: z.enum(['linux', 'windows']).optional(),
  vmType: z.string().optional(),
  macAddress: z.string().optional(),
  autostart: z.boolean().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  bridge: z.string().optional(),
  consoleType: z.enum(['serial', 'vnc']).optional(),
  imageUrl: z.string().optional(),
  imageFormat: z.enum(['qcow2', 'raw', 'iso']).optional(),
  cloudInit: z.boolean().optional(),
  runtime: z.enum(['microvm', 'docker', 'podman', 'apptainer']).optional(),
  image: z.string().optional(),
  ports: z.array(z.string()).optional(),
})

const exportDocumentSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  workloads: z.array(exportedWorkloadSchema),
})

/**
 * Metrics response.
 *
 * Every numeric field is NULLABLE, and that is the contract rather than an oversight: a sample
 * whose value could not be determined is null, never 0. Collapsing the two here would undo the
 * whole point of the service layer — a chart cannot distinguish "idle" from "unknown" once the
 * wire has turned one into the other.
 */
const metricsResponseSchema = z.object({
  name: z.string(),
  windowMs: z.number(),
  intervalMs: z.number(),
  samples: z.array(z.object({
    timestamp: z.number(),
    cpuPercent: z.number().nullable(),
    memoryBytes: z.number().nullable(),
    diskBytes: z.number().nullable(),
  })),
})

/** Filename stamp: date only, so an export downloaded twice in a day overwrites rather than piles up. */
const exportStamp = () => new Date().toISOString().slice(0, 10)

/**
 * Clone request body.
 *
 * `name` is a plain string here, NOT regex-constrained, even though the source-name param above is.
 * That is deliberate: `cloneRejectionReason` owns name validity for a clone and returns a sentence
 * a user can act on ("Name must start with a lowercase letter…"). A schema regex would reject
 * first, with Fastify's generic validation error, and the seam's message would be unreachable — so
 * the rule would exist in two places and the better of the two would never be seen.
 *
 * `ip` is optional: omitted means "allocate one from the bridge pool".
 */
const vmCloneSchema = z.object({
  name: z.string().min(1).max(64),
  ip: z.string().ip({ version: 'v4' }).optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
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
  // Network-ownership phase A. This MUST be here: Fastify validates every response against the
  // schema and Zod strips unknown keys, so an unlisted field is silently dropped between the
  // service and the client — the service computes it, the UI never receives it, and nothing
  // errors. Same silent shape as the other omissions phase A exists to surface.
  networkDivergent: z.boolean().optional(),
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
  // Network-ownership phase A — accepted on create so an already-known network can be recorded at
  // registration, not only at scan. Same name constraint as bridgeNameSchema (network.ts), since
  // this value is compared against `bridgeInterface` and may later name a real interface.
  // NOT `networkDivergent`: that is DERIVED. Accepting it would let a caller assert its own
  // conformance, which is the observation lying about itself.
  bridge: z.string().min(1).max(16).regex(/^[a-zA-Z][a-zA-Z0-9-]*$/, 'Invalid bridge name').optional(),
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

/**
 * The address allocator, as a STRUCTURAL type rather than an import.
 *
 * The implementation is `services/weaver/network-manager.ts`, which is BSL and sync-excluded from
 * the Free mirror — this file is not. A static import would make `workloads.ts` unresolvable on a
 * Free build, which is the failure mode `index.ts` already works around with a guarded dynamic
 * import. Describing the two methods we call keeps the type checking honest without binding the
 * module.
 */
interface IpAllocator {
  reserveIp(bridge: string): Promise<string | null>
  releaseIp(bridge: string, ip: string): Promise<void>
}

interface VmsRouteOptions {
  provisioner?: Provisioner | null
  imageManager?: ImageManager | null
  config?: DashboardConfig
  auditService?: AuditService
  quotaStore?: QuotaStore
  aclStore?: VmAclStore
  networkManager?: IpAllocator | null
  metricsCollector?: MetricsCollector | null
}

export const workloadsRoutes: FastifyPluginAsync<VmsRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { provisioner, imageManager, config, auditService, quotaStore, aclStore, networkManager, metricsCollector } = opts

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
      // Scan the runtimes the operator DECLARED (services.weaver.containerRuntimes), not a
      // hardcoded pair. Previously this always probed docker and podman — an exec each, on every
      // scan, on hosts that had neither — and could never probe apptainer no matter how the
      // workload was declared. Empty list = MicroVMs only; scanMicrovms still runs.
      //
      // The `docker | podman` filter that used to stand here was the placeholder for gap 1, and
      // it is gone as its own comment predicted: `ContainerRuntime` now includes apptainer, so
      // the declared list passes through unfiltered and the type system is what proves every
      // member is scannable. The Solo gate is NOT applied here — it lives in
      // scanApptainerInstances(), so it holds for every caller rather than for this route only.
      const runtimes = config?.containerRuntimes ?? ['docker', 'podman']

      // allSettled, not all (L-backend-2026-06-02-01KYSBXCJBJ6EM0XMYF613K02H — aggregate
      // independent shell commands with allSettled). Each scan already degrades a missing binary
      // to an empty result internally, so the exec path cannot reject; what CAN reject is
      // everything after it — a registry write failing mid-scan. Under Promise.all that single
      // rejection discards the other scans' results too, so a full docker inventory is lost
      // because apptainer's registry write failed. Acceptance criterion 4 ("scanning a host where
      // one runtime is missing still returns results from the others") is only actually
      // guaranteed at this level; the per-scan catch is the common case, not the contract.
      const settled = await Promise.allSettled([
        scanMicrovms(),
        ...runtimes.map((r) => scanContainers(r)),
      ])
      for (const outcome of settled) {
        if (outcome.status === 'rejected') {
          // Logged, never returned: a scan error carries binary and registry paths.
          fastify.log.error({ err: outcome.reason }, 'A workload scan failed; other scans continue')
        }
      }
      const results = settled
        .filter((o): o is PromiseFulfilledResult<ScanResult> => o.status === 'fulfilled')
        .map((o) => o.value)
      const result = {
        discovered: results.flatMap((r) => r.discovered),
        added: results.flatMap((r) => r.added),
        existing: results.flatMap((r) => r.existing),
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
          // Structured log — name goes as a field, not string-interpolated
          // into the message. Prevents log-injection if upstream validation
          // ever relaxes. Also lets log aggregators filter/facet by vmName.
          fastify.log.error({ err, vmName: request.body.name }, 'Provisioning failed')
        })
        return reply.status(202).send({ ...result, provisioningState: 'provisioning' })
      }

      return reply.status(201).send(result)
    }
  )

  // GET /api/workload/:name/metrics — resource history for one workload (all roles, Free tier)
  //
  // Free tier deliberately: "open Proxmox, see graphs; open Weaver, see nothing" is the gap this
  // closes, and it is an ADOPTION gap. The tier difference is the WINDOW, not the feature — Free
  // gets an hour, paid gets a day.
  app.get(
    '/:name/metrics',
    {
      schema: {
        params: vmNameSchema,
        querystring: z.object({ window: z.string().max(8).optional() }),
        response: { 200: metricsResponseSchema, 404: errorResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER), ...aclPreHandler],
      // Reads an in-memory buffer — no subprocess, no filesystem — so this is cheap. The 60/min
      // budget is deliberately generous: a detail page open on a chart is a legitimate poller,
      // unlike the logs route which must never be polled.
      config: { rateLimit: createRateLimit(60) },
    },
    async (request, reply) => {
      const { name } = request.params
      const definition = (await getWorkloadDefinitions())[name]
      if (!definition) {
        return reply.status(404).send({ error: `Workload '${name}' not found` })
      }

      const tier = config?.tier ?? TIERS.FREE
      const windowMs = resolveWindowMs(request.query.window, tier)

      // Absent collector (metrics disabled, or a build without it) returns an EMPTY SERIES rather
      // than 404 or 500. The distinction the UI needs is "this workload does not exist" versus
      // "there is no data for it yet", and both of those are already expressible; a 500 here
      // would render as a broken page for a feature that is merely not collecting.
      const samples = metricsCollector?.getSamples(name, windowMs) ?? []

      return {
        name,
        windowMs,
        intervalMs: SAMPLE_INTERVAL_MS,
        // Reported so the UI can label the axis with what it actually received. A Free request
        // for 24h is clamped to an hour, and a chart captioned "24 hours" over an hour of data
        // is a lie the user has no way to detect.
        samples,
      }
    }
  )

  // GET /api/workload/export — export every workload's configuration (all roles, Free tier)
  //
  // ROUTE ORDERING IS LOAD-BEARING HERE. `export` satisfies the `:name` pattern
  // (^[a-z][a-z0-9-]*$) exactly, so this path is also a legal single-workload GET. Fastify's
  // radix router prefers a static segment over a parametric one, so this wins — but that is a
  // property of the router, not of this file, and it is the kind of thing that changes under a
  // major upgrade without anyone noticing. `export-routing.spec.ts` asserts it directly: a
  // workload literally named "export" must not shadow this endpoint.
  //
  // Free tier deliberately: the docs have advertised these two endpoints with curl examples since
  // v1.0, and self-hosters who script everything try them first. Gating them now would make the
  // published documentation wrong in the other direction.
  app.get(
    '/export',
    {
      schema: { response: { 200: exportDocumentSchema } },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER)],
      config: { rateLimit: createRateLimit(10) },
    },
    async (request, reply) => {
      let visible = Object.values(await getWorkloadDefinitions())
      // Same ACL filtering the list route applies, via the same helper — an export must not
      // become the way to read workloads the UI hides. Reusing `filterVms` rather than
      // re-deriving the predicate is the point: a second implementation of "which workloads may
      // this user see" is a second place for it to be wrong.
      if (config?.tier === TIERS.FABRICK && aclStore && request.userId && request.userRole !== ROLES.ADMIN) {
        visible = aclStore.filterVms(request.userId, visible)
      }

      reply.header('Content-Disposition', `attachment; filename="weaver-export-${exportStamp()}.json"`)
      return buildExportDocument(visible, new Date().toISOString())
    }
  )

  // GET /api/workload/:name/export — export a single workload's configuration
  app.get(
    '/:name/export',
    {
      schema: { params: vmNameSchema, response: { 200: exportDocumentSchema, 404: errorResponseSchema } },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER), ...aclPreHandler],
      config: { rateLimit: createRateLimit(10) },
    },
    async (request, reply) => {
      const { name } = request.params
      const definition = (await getWorkloadDefinitions())[name]
      if (!definition) {
        return reply.status(404).send({ error: `Workload '${name}' not found` })
      }
      reply.header('Content-Disposition', `attachment; filename="weaver-${name}-${exportStamp()}.json"`)
      return buildExportDocument([definition], new Date().toISOString())
    }
  )

  // POST /api/workload/:name/clone — clone a VM definition (operator+, Solo tier)
  //
  // Clones the DEFINITION and provisions a fresh instance; it does NOT copy disk state. That is
  // deliberate, and it follows from the declarative model: the config is the source of truth and
  // the disk is derived from it, so reproducing the config reproduces the VM. A user who wants a
  // disk-level copy uses the hypervisor's own tooling. The UI must say this plainly, or "Clone"
  // is read as a full disk clone and an empty disk comes as a surprise.
  app.post(
    '/:name/clone',
    {
      schema: {
        params: vmNameSchema,
        body: vmCloneSchema,
        response: {
          201: vmActionResponseSchema,
          202: vmActionResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), ...aclPreHandler],
      // Matches the sibling create route. A clone is the same weight as a create — it provisions
      // a VM — so it gets the same budget rather than an invented one.
      config: { rateLimit: createRateLimit(30) },
    },
    async (request, reply) => {
      const { name } = request.params
      const body = request.body

      // Tier gate FIRST, and before any allocation. Cloning creates a VM, so it is Live
      // Provisioning and requires Solo. Ordering matters beyond tidiness: an address reserved
      // before a 403 has no failure path to release it and leaks silently.
      if (config) {
        try {
          requireTier(config, TIERS.SOLO)
        } catch {
          return reply.status(403).send({ error: 'VM cloning requires weaver tier' })
        }
      }

      const definitions = await getWorkloadDefinitions()
      const source = definitions[name] ?? null
      const existingNames = Object.keys(definitions)
      const info = source ? await getVm(name) : null

      // The seam decides WHETHER; the route decides which status code. Both read the same two
      // facts, so neither restates the other's policy and neither matches on the reason string.
      const reason = cloneRejectionReason({
        source,
        targetName: body.name,
        existingNames,
        status: info?.status ?? STATUSES.UNKNOWN,
      })
      if (reason) {
        const status = !source ? 404 : existingNames.includes(body.name) ? 409 : 400
        return reply.status(status).send({ error: reason })
      }

      const bridge = source!.bridge ?? config?.bridgeInterface ?? 'br-microvm'

      // Address: explicit wins, otherwise reserve one. Only the reserved branch owes a release.
      let ip: string
      let reservedIp: string | null = null
      if (body.ip) {
        if (!config?.bridgeGateway) {
          return reply.status(400).send({ error: 'Bridge network not configured. Set BRIDGE_GATEWAY in the server environment.' })
        }
        const gwSubnet = config.bridgeGateway.split('.').slice(0, 3).join('.')
        if (body.ip.split('.').slice(0, 3).join('.') !== gwSubnet) {
          return reply.status(400).send({ error: `IP must be in the bridge subnet (${gwSubnet}.x)` })
        }
        if (body.ip === config.bridgeGateway) {
          return reply.status(400).send({ error: `IP address '${body.ip}' is the bridge gateway (host) address` })
        }
        const duplicate = Object.values(definitions).find(vm => vm.ip === body.ip)
        if (duplicate) {
          return reply.status(409).send({ error: `IP address '${body.ip}' is already in use by VM '${duplicate.name}'` })
        }
        ip = body.ip
      } else {
        if (!networkManager) {
          return reply.status(400).send({ error: 'Automatic IP assignment is unavailable — specify an IP address' })
        }
        const allocated = await networkManager.reserveIp(bridge)
        if (!allocated) {
          return reply.status(400).send({ error: `No free addresses in the pool for bridge '${bridge}' — specify an IP address` })
        }
        ip = allocated
        reservedIp = allocated
      }

      // From here on every exit that is not a success must return the address. releaseIp is
      // idempotent by design, so the rollback can run without first proving the reservation.
      const releaseOnFailure = async () => {
        if (reservedIp) await networkManager!.releaseIp(bridge, reservedIp)
      }

      const cloned = deriveClonedDefinition(source!, body.name, ip)
      if (body.tags !== undefined) cloned.tags = body.tags
      if (body.description !== undefined) cloned.description = body.description

      let result: { success: boolean; message: string }
      try {
        result = await createVm(cloned)
      } catch (err) {
        await releaseOnFailure()
        // Sanitized: a registry error can carry the data directory path.
        fastify.log.error({ err, vmName: body.name, source: name }, 'Clone registration failed')
        return reply.status(500).send({ error: `Failed to register clone '${body.name}'` })
      }
      if (!result.success) {
        await releaseOnFailure()
        return reply.status(409).send({ error: result.message })
      }

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'vm.clone',
        resource: body.name,
        details: { source: name, ip, mem: cloned.mem, vcpu: cloned.vcpu, hypervisor: cloned.hypervisor },
        ip: request.ip,
        success: true,
      })

      if (provisioner && config?.provisioningEnabled) {
        provisioner.provision(body.name).catch(err => {
          fastify.log.error({ err, vmName: body.name }, 'Clone provisioning failed')
        })
        return reply.status(202).send({ ...result, provisioningState: PROVISIONING.PROVISIONING })
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

  // GET /api/workload/:name/logs — get logs (operator+)
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
      // This route SPAWNS A SUBPROCESS now (`docker logs`, or `apptainer instance list` plus two
      // file reads) where it previously only read a provisioning log off disk.
      //
      // To be precise about what this changes: the route was NOT unprotected before. index.ts
      // registers @fastify/rate-limit with `global: true` at 120/min keyed by userId ?? ip, so
      // every route without its own config inherits that — which is why 64 of 82 routes carry no
      // per-route limit and the auditor is right not to demand one. The problem is that 120/min is
      // a sensible default for reads and far too generous for something that forks a process.
      //
      // 10/min applies G-backend-2026-06-02-01KYSBXCJ6TK3E22T062RD230G: an endpoint that spawns
      // subprocesses gets an aggressive per-route limit and is NEVER polled. It sits between
      // /scan's 5 (rarer, heavier) and the 30 of the cheap action routes, because opening a few
      // workloads' logs in a row is ordinary use and must not trip it. Note per-route config
      // REPLACES the global one rather than merging, so this is the whole limit for this route.
      // The paired obligation is on the UI: fetch on demand, never on a timer.
      config: { rateLimit: createRateLimit(10) },
    },
    async (request, reply) => {
      const { name } = request.params
      const workload = await getVm(name)
      if (!workload) {
        return reply.status(404).send({ error: `Workload '${name}' not found` })
      }

      // Container runtimes: docker/podman/apptainer
      if (isContainerLogSource(workload.runtime)) {
        if (workload.runtime === 'apptainer') {
          // Apptainer requires Solo, and below Solo it is HIDDEN rather than nagged: a Free
          // user must never see an Apptainer workload or an upgrade prompt for one. So this is a
          // 404 — the same answer an unknown workload gets — and deliberately NOT requireTier(),
          // whose 403 ("requires weaver tier or higher") would advertise the feature it is meant
          // to conceal. The primary exclusion is at scan time; this is the second half,
          // because a workload that reaches the registry by another path would otherwise serve
          // its logs to a tier that cannot see the workload itself.
          // Fail CLOSED on an absent config: an indeterminate tier must not serve a Solo-gated
          // feature. Every other config read on this route falls back to a harmless default
          // (`config?.apptainerBin ?? 'apptainer'`); a tier check is the one place where a
          // permissive fallback would be the vulnerability rather than a convenience.
          if (!config || TIER_ORDER[config.tier] < TIER_ORDER[TIERS.SOLO]) {
            return reply.status(404).send({ error: `No logs found for workload '${name}'` })
          }
        }

        // The system call itself lives in the service layer, never here — see getContainerLogs().
        try {
          const log = await getContainerLogs(name, workload.runtime!)
          if (log === null) {
            return reply.status(404).send({ error: `No container logs found for '${name}'` })
          }
          return { name, log }
        } catch (err) {
          // Sanitized: the raw error carries the binary path and, for Apptainer, the log path.
          fastify.log.error({ err, workloadName: name, runtime: workload.runtime }, 'Failed to read container logs')
          return reply.status(404).send({ error: `Failed to read logs for '${name}'` })
        }
      }

      // Otherwise: provisioning log path (microvm)
      if (!provisioner) {
        return reply.status(404).send({ error: 'Provisioning not enabled' })
      }
      const log = await provisioner.getLog(name)
      if (log === null) {
        return reply.status(404).send({ error: `No logs found for workload '${name}'` })
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
