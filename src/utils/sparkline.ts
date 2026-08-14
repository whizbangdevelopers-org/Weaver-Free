// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * SVG path maths for metric sparklines. Pure: numbers in, path strings out.
 *
 * No charting library. The demo has drawn sparklines with inline SVG paths since v1.1's mock
 * layer, so the technique is already proven in this codebase — and on an airgapped fleet a new
 * runtime dependency costs a Verdaccio mirror entry, a licence audit and a lockfile audit for
 * something fifty lines of arithmetic already does.
 *
 * The whole reason this is a separate module is the null handling below. It is the one piece of
 * the chart that can be *silently* wrong: a line drawn straight through a gap looks exactly like
 * a line drawn through data.
 */

/** A series point. `null` means the sample exists but its value could not be determined. */
export type SeriesPoint = number | null

export interface SparklineGeometry {
  /** Stroked line. Contains a `M` per contiguous run, so gaps are genuinely absent. */
  line: string
  /** Closed area under the line, for the gradient fill. Empty when nothing is drawable. */
  fill: string
}

export interface SparklineOptions {
  width?: number
  height?: number
  /** Fixed upper bound. Omit to scale to the data. CPU passes 100 so charts stay comparable. */
  max?: number
  /** Fixed lower bound. Defaults to 0 — a memory chart that starts at min hides its own scale. */
  min?: number
}

/**
 * The value range to plot against.
 *
 * Defaults the floor to 0 rather than the data minimum. Auto-flooring is the more "efficient" use
 * of vertical space and it lies: a workload sitting between 4.0 and 4.2 GB renders as a dramatic
 * mountain range, and a user reads volatility that is not there. A fixed floor makes two charts
 * on the same page comparable, which is the entire point of putting them there.
 *
 * When every value is identical the range would be zero-height — the line is placed at the
 * BOTTOM for an all-zero series (idle, and it should look idle) and mid-height otherwise, rather
 * than dividing by zero.
 */
export function resolveRange(values: number[], opts: SparklineOptions = {}): { min: number; max: number } {
  const min = opts.min ?? 0
  if (opts.max !== undefined) return { min, max: opts.max }
  const dataMax = values.length > 0 ? Math.max(...values) : 0
  return { min, max: Math.max(dataMax, min) }
}

/**
 * Build the line and fill paths for a series.
 *
 * NULLS BREAK THE LINE. Each contiguous run of real values gets its own `M`, so a gap in
 * collection renders as a gap. Filtering nulls out instead — the obvious implementation — draws a
 * straight segment across the missing period that is indistinguishable from steady data, which
 * would quietly turn "we did not measure this" into "nothing happened here". That inversion is
 * precisely what the backend's null-not-zero handling exists to prevent, and it would be undone
 * here in one line.
 *
 * A single real value surrounded by nulls still renders, as a dot-length segment — a workload
 * with one reading has genuinely been measured once and should not look unmeasured.
 */
export function buildSparkline(points: SeriesPoint[], opts: SparklineOptions = {}): SparklineGeometry {
  const width = opts.width ?? 300
  const height = opts.height ?? 50

  if (points.length === 0) return { line: '', fill: '' }

  const real = points.filter((p): p is number => p !== null)
  if (real.length === 0) return { line: '', fill: '' }

  const { min, max } = resolveRange(real, opts)
  const span = max - min

  // x is positioned by INDEX across the full series, including nulls, so a gap occupies its real
  // width on the time axis. Compressing the surviving points would misplace every later sample.
  const xAt = (i: number) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width)
  const yAt = (v: number) => {
    if (span === 0) return v <= min ? height : height / 2
    const clamped = Math.max(min, Math.min(max, v))
    return height - ((clamped - min) / span) * height
  }

  const segments: { i: number; x: number; y: number }[][] = []
  let current: { i: number; x: number; y: number }[] = []
  for (let i = 0; i < points.length; i++) {
    const v = points[i]
    if (v === null || v === undefined) {
      if (current.length > 0) segments.push(current)
      current = []
      continue
    }
    current.push({ i, x: xAt(i), y: yAt(v) })
  }
  if (current.length > 0) segments.push(current)

  const fmt = (n: number) => Number(n.toFixed(2))

  const line = segments
    .map(seg => seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' '))
    .join(' ')

  // The fill closes each segment down to the baseline independently, so a gap is not filled
  // either — a shaded region under missing data would reassert the same false continuity the
  // broken line avoids.
  const fill = segments
    .map(seg => {
      const first = seg[0]!
      const last = seg[seg.length - 1]!
      const body = seg.map(p => `L${fmt(p.x)} ${fmt(p.y)}`).join(' ')
      return `M${fmt(first.x)} ${fmt(height)} ${body} L${fmt(last.x)} ${fmt(height)} Z`
    })
    .join(' ')

  return { line, fill }
}

/** The most recent real value, or null when the series has none. */
export function latestValue(points: SeriesPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]
    if (v !== null && v !== undefined) return v
  }
  return null
}

/** Bytes as a human-readable string. Returns an em dash for null, never "0 B". */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** Percent for display. Em dash for null — an unknown reading must not render as 0%. */
export function formatPercent(pct: number | null): string {
  return pct === null ? '—' : `${pct >= 10 ? Math.round(pct) : Number(pct.toFixed(1))}%`
}

/**
 * A byte-per-second rate for display, e.g. `2.2 MB/s`.
 *
 * Decimal units (1000), not binary (1024), because throughput is conventionally quoted in decimal
 * and the demo's own figures are MB/s in that sense. Using 1024 here would render the same number
 * ~5% lower than every other tool the reader compares against, which reads as the graph being
 * wrong rather than differently-defined.
 *
 * Em dash for null, never `0 B/s`: an unmeasurable interval and a genuinely idle disk are
 * different facts, and this whole pipeline keeps them apart from the cgroup read onward.
 */
export function formatRate(bps: number | null): string {
  if (bps === null) return '—'
  if (bps < 1000) return `${Math.round(bps)} B/s`
  const units = ['KB/s', 'MB/s', 'GB/s', 'TB/s']
  let value = bps / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  // `.toFixed(1)` as a STRING, not `Number(...)`: the numeric form drops the trailing zero, so
  // 1000 B/s renders "1 KB/s" beside a memory chip reading "1.0 KB". Matches formatBytes above,
  // and matches the chip this restores, which always showed one decimal.
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/**
 * A sampling interval as a readable cadence, e.g. `30-sec intervals`, `1-min intervals`.
 *
 * Takes the interval the server actually SERVED rather than a tier assumption. The demo layer
 * carries its own `resolution: '1m' | '5m'`, and captioning real 30-second samples with it would
 * be a claim the reader cannot verify — the same reason the window badge shows what was served.
 */
export function formatInterval(ms: number): string {
  if (!(ms > 0)) return ''
  if (ms < 60_000) return `${Math.round(ms / 1000)}-sec intervals`
  const mins = ms / 60_000
  return `${mins >= 10 ? Math.round(mins) : Number(mins.toFixed(1))}-min intervals`
}
