// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { writeFile, rename, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

/**
 * Write JSON to `filePath` atomically using a write-to-temp-then-rename pattern.
 *
 * Prevents partial reads during write and leaves the file either fully-written
 * or unchanged if the process dies mid-write. The temp file is always on the
 * same filesystem as the destination (same directory), so rename(2) is atomic.
 */
export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${randomBytes(12).toString('hex')}`
  try {
    // `flag: 'wx'` is O_CREAT|O_EXCL — it fails if the path already exists and, crucially,
    // does NOT follow a symlink at that path. Without it a pre-planted symlink named
    // `<file>.tmp-<hex>` would redirect this write, and the subsequent rename would install
    // the attacker's target as the real file. 12 random bytes rather than 4 puts guessing the
    // name out of reach in the first place. Flagged as js/insecure-temporary-file — the
    // "os temp dir" wording is wrong (this sits beside the destination, deliberately, so
    // rename(2) stays atomic on one filesystem) but the missing exclusive-create was real.
    // Mode is left at the default on purpose: rename(2) carries the temp file's permissions
    // to the destination, so hardcoding 0600 here would silently change who can read it.
    await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf-8', flag: 'wx' })
    await rename(tmpPath, filePath)
  } catch (err) {
    await unlink(tmpPath).catch(() => {})
    throw err
  }
}
