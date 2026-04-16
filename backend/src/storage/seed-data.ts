// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadDefinition } from './workload-registry.js'

/** Default VMs seeded on first run when no existing registry is found.
 *  These match the documented sample VMs and provide a starting point
 *  for users to see the dashboard in action before registering their own. */
export const DEFAULT_VMS: WorkloadDefinition[] = [
  { name: 'web-nginx',    ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu', distro: 'nixos', tags: ['web', 'proxy'], bridge: 'br-microvm' },
  { name: 'web-app',      ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos', tags: ['web', 'app'],   bridge: 'br-microvm' },
  { name: 'dev-node',     ip: '10.10.0.20', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos', tags: ['dev'],          bridge: 'br-microvm' },
  { name: 'dev-python',   ip: '10.10.0.21', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos', tags: ['dev'],          bridge: 'br-microvm' },
  { name: 'svc-postgres', ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos', tags: ['service', 'db'], bridge: 'br-microvm' },
]
