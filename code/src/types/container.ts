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
}

export interface ContainerActionResult {
  success: boolean
  message: string
}
