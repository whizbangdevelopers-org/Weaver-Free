// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Format an ISO timestamp as a human-readable relative duration (e.g. "2d 5h 13m").
 * Returns null if the input is falsy or invalid.
 */
export function formatUptime(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null
  try {
    const started = new Date(isoTimestamp).getTime()
    if (isNaN(started)) return null
    const diff = Date.now() - started
    if (diff < 0) return 'just now'

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  } catch {
    return null
  }
}
