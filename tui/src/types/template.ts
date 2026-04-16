// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface VmTemplate {
  id: string
  name: string
  description: string
  distro: string
  mem: number
  vcpu: number
  hypervisor: 'qemu' | 'cloud-hypervisor' | 'crosvm' | 'kvmtool' | 'firecracker'
  autostart: boolean
  tags?: string[]
  category: 'builtin' | 'custom'
}
