// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Quasar-compatible validation rules.
 * Each returns `true` on valid, or an error string on invalid.
 */

import type { WorkloadInfo } from 'src/types/workload'

/** Validate IPv4 address format (e.g. 10.10.0.40). Passes empty strings for optional fields. */
export function isValidIPv4(val: string): true | string {
  if (!val) return true
  const parts = val.split('.')
  if (parts.length !== 4) return 'Must be a valid IPv4 address (e.g. 10.10.0.40)'
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255)
      return 'Must be a valid IPv4 address (e.g. 10.10.0.40)'
  }
  return true
}

/** Validate that an IP is assignable to a host (last octet not 0 or 255). */
export function isHostIPv4(val: string): true | string {
  if (!val) return true
  const formatResult = isValidIPv4(val)
  if (formatResult !== true) return formatResult
  const lastOctet = Number(val.split('.')[3])
  if (lastOctet === 0) return 'Last octet cannot be 0 (network address)'
  if (lastOctet === 255) return 'Last octet cannot be 255 (broadcast address)'
  return true
}

/** Returns a validation rule that rejects names already used by another VM. */
export function nameNotInUse(vms: WorkloadInfo[]): (val: string) => true | string {
  return (val: string) => {
    if (!val) return true
    if (vms.some(vm => vm.name === val)) return `VM '${val}' already exists`
    return true
  }
}

/** Returns a validation rule that rejects IPs outside the bridge subnet and the gateway itself. */
export function ipOnBridgeSubnet(gateway: string | null): (val: string) => true | string {
  return (val: string) => {
    if (!val || !gateway) return true
    const gwParts = gateway.split('.')
    const valParts = val.split('.')
    if (gwParts.length !== 4 || valParts.length !== 4) return true // let format rule handle it
    const gwSubnet = gwParts.slice(0, 3).join('.')
    const valSubnet = valParts.slice(0, 3).join('.')
    if (valSubnet !== gwSubnet) return `Must be in the bridge subnet (${gwSubnet}.x)`
    if (val === gateway) return `${val} is the bridge gateway (host) address`
    return true
  }
}

/** Returns a validation rule that rejects IPs already assigned to another VM. */
export function ipNotInUse(vms: WorkloadInfo[]): (val: string) => true | string {
  return (val: string) => {
    if (!val) return true
    const conflict = vms.find(vm => vm.ip === val)
    if (conflict) return `IP already in use by '${conflict.name}'`
    return true
  }
}

/** Keypress handler that restricts input to digits and dots. */
export function onlyIPv4Chars(evt: KeyboardEvent): void {
  const ch = evt.key
  if (ch.length === 1 && !/[\d.]/.test(ch)) evt.preventDefault()
}
