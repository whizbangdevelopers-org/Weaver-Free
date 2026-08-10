// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export type ContainerRuntime = 'docker' | 'podman' | 'apptainer'

// ContainerStatus includes container-specific states beyond WorkloadStatus
import { STATUSES } from 'src/constants/vocabularies'

export type ContainerStatus = typeof STATUSES.RUNNING | typeof STATUSES.STOPPED | 'paused' | 'exited' | typeof STATUSES.UNKNOWN

export interface ContainerPort {
  hostPort: number
  containerPort: number
  protocol: 'tcp' | 'udp'
}

export interface ContainerMount {
  source: string
  destination: string
  readonly: boolean
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  runtime: ContainerRuntime
  status: ContainerStatus
  created: string
  ports?: ContainerPort[]
  mounts?: ContainerMount[]
  memoryUsageMb?: number
  memoryLimitMb?: number
  cpuPercent?: number
  labels?: Record<string, string>
  /** Network-ownership phase A — the network Weaver OBSERVED for this container. */
  bridge?: string
  /**
   * Network-ownership phase A — `bridge` is set and is not the Weaver-managed bridge.
   * Computed by the backend; the frontend has no access to `bridgeInterface` and must not
   * re-derive it (one comparison site, so the UI and phase B's enforcement cannot disagree).
   */
  networkDivergent?: boolean
}

export interface ContainerActionResult {
  success: boolean
  message: string
}
