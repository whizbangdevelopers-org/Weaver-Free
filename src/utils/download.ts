// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Browser download helpers.
 *
 * One implementation, because the object-URL dance has a step that is easy to get wrong and
 * invisible when you do: `URL.revokeObjectURL` must run, or the blob is pinned in memory for the
 * lifetime of the document. A page that downloads repeatedly leaks the full size of every file
 * the user ever exported, and nothing reports it.
 *
 * The pre-existing copy in CompliancePage revoked immediately after `a.click()`. That is the
 * common form and it is a race in principle — some browsers have historically needed the URL to
 * outlive the click — so this version defers the revoke to a macrotask, which is safe in every
 * engine and still bounded.
 */

/** Anchor-click a blob, then release the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  // Not appended to the document: a detached anchor's click() is honoured by every supported
  // browser and avoids a visible layout flash if any stylesheet ever targets bare anchors.
  a.click()
  // Deferred, not immediate — see the note above.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Download a string as a file. */
export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

/**
 * A filename-safe date stamp (YYYY-MM-DD).
 *
 * Matches what the backend puts in `Content-Disposition`, so a file saved from the UI and one
 * saved with `curl -OJ` land on the same name instead of two conventions for one artifact.
 */
export function dateStamp(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}
