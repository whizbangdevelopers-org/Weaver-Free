// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * VM display utilities — icon and color helpers based on vmType.
 * desktop = GUI passthrough (VNC/display), server = headless.
 */

export function vmTypeIcon(vmType: string | undefined): string {
  return vmType === 'desktop' ? 'mdi-monitor' : 'mdi-cube-outline'
}

export function vmTypeColor(vmType: string | undefined): string {
  return vmType === 'desktop' ? 'primary' : 'grey-7'
}
