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
  const tmpPath = `${filePath}.tmp-${randomBytes(4).toString('hex')}`
  try {
    await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    await rename(tmpPath, filePath)
  } catch (err) {
    await unlink(tmpPath).catch(() => {})
    throw err
  }
}
