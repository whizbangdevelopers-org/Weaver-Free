// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Orthogonal (90-degree elbow) edge routing for network topology.
 *
 * Core Weaver Solo/Fabrick feature (v1.1.0). Separate file so future plugin
 * overlays (Firewall, DNS) can import path geometry without depending on
 * NetworkMapPage.
 */

export interface Point {
  x: number
  y: number
}

export type ElbowEdgeType = 'infra' | 'route'

/**
 * Compute an SVG path string for orthogonal (90-degree elbow) routing.
 *
 * - 'infra': vertical hierarchy edge (host→bridge, bridge→VM).
 *   Routes: vertical from source → horizontal at midpoint → vertical to target.
 *
 * - 'route': same-layer cross-bridge edge (VM→VM).
 *   Routes: vertical up from source → horizontal routing channel → vertical down to target.
 */
export function computeElbowPath(
  source: Point,
  target: Point,
  edgeType: ElbowEdgeType,
): string {
  // Same X = straight vertical, no elbow needed
  if (Math.abs(source.x - target.x) < 1) {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  }

  if (edgeType === 'infra') {
    const midY = (source.y + target.y) / 2
    return `M ${source.x} ${source.y} L ${source.x} ${midY} L ${target.x} ${midY} L ${target.x} ${target.y}`
  }

  // Route: routing channel above VM layer
  const channelY = Math.min(source.y, target.y) - 40
  return `M ${source.x} ${source.y} L ${source.x} ${channelY} L ${target.x} ${channelY} L ${target.x} ${target.y}`
}

/**
 * Get the waypoints (elbows) of an orthogonal path — useful for plugin overlays
 * that need to place indicators (firewall rules, DNS labels) along the path.
 */
export function getElbowWaypoints(
  source: Point,
  target: Point,
  edgeType: ElbowEdgeType,
): Point[] {
  if (Math.abs(source.x - target.x) < 1) {
    return [source, target]
  }

  if (edgeType === 'infra') {
    const midY = (source.y + target.y) / 2
    return [
      source,
      { x: source.x, y: midY },
      { x: target.x, y: midY },
      target,
    ]
  }

  const channelY = Math.min(source.y, target.y) - 40
  return [
    source,
    { x: source.x, y: channelY },
    { x: target.x, y: channelY },
    target,
  ]
}

/**
 * Compute a point at a given fraction (0–1) along the elbow path.
 * Plugins use this to position decorations (e.g., firewall shield icon at 0.5 = midpoint).
 */
export function pointAlongElbow(
  source: Point,
  target: Point,
  edgeType: ElbowEdgeType,
  fraction: number,
): Point {
  const waypoints = getElbowWaypoints(source, target, edgeType)
  const segments: number[] = []
  let totalLength = 0
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x
    const dy = waypoints[i].y - waypoints[i - 1].y
    const len = Math.sqrt(dx * dx + dy * dy)
    segments.push(len)
    totalLength += len
  }
  let targetDist = fraction * totalLength
  for (let i = 0; i < segments.length; i++) {
    if (targetDist <= segments[i]) {
      const t = segments[i] === 0 ? 0 : targetDist / segments[i]
      return {
        x: waypoints[i].x + t * (waypoints[i + 1].x - waypoints[i].x),
        y: waypoints[i].y + t * (waypoints[i + 1].y - waypoints[i].y),
      }
    }
    targetDist -= segments[i]
  }
  return target
}
