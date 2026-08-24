// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Integrity verification for downloaded distro images.
 *
 * The CATCH half is easy to write and proves little on its own: a parser that returns a digest
 * for a well-formed file is the base case. The half that matters is the refusals — the shapes
 * where returning *something* would be worse than returning nothing, because the caller would
 * then verify against the wrong artifact and report success.
 *
 * Every fixture below is the real published format, copied from the live checksum files on
 * 2026-08-23 (values truncated/altered, shapes intact). Inventing the formats would have tested
 * the parser against my assumptions rather than against Ubuntu, Debian, Fedora, Arch and Alpine.
 */

import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseChecksumFile,
  assertChecksumUrl,
  hashFile,
  normaliseExpected,
  resolveRedirect,
} from '../../src/services/image-digest.js'
import { validateExternalUrl } from '../../src/validate-url.js'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const L = 'c'.repeat(128)

describe('parseChecksumFile — the real published shapes', () => {
  it('reads the GNU binary-mode form Ubuntu publishes (hex *name)', () => {
    const text = `${A} *noble-server-cloudimg-amd64.img\n${B} *noble-server-cloudimg-arm64.img\n`
    expect(parseChecksumFile(text, 'sha256', 'noble-server-cloudimg-amd64.img')).toBe(A)
  })

  it('reads the GNU text-mode form Debian and Arch publish (hex␣␣name)', () => {
    const text = `${L}  debian-12-generic-amd64.qcow2\n`
    expect(parseChecksumFile(text, 'sha512', 'debian-12-generic-amd64.qcow2')).toBe(L)
  })

  it('reads the BSD form Fedora publishes, inside its PGP clearsign wrapper', () => {
    const text = [
      '-----BEGIN PGP SIGNED MESSAGE-----',
      'Hash: SHA256',
      '',
      '# Fedora-Cloud-Base-Generic-44-1.7.x86_64.qcow2: 583729152 bytes',
      `SHA256 (Fedora-Cloud-Base-Generic-44-1.7.x86_64.qcow2) = ${A}`,
      `SHA256 (Fedora-Cloud-Base-UEFI-UKI-44-1.7.x86_64.qcow2) = ${B}`,
      '-----BEGIN PGP SIGNATURE-----',
    ].join('\n')
    expect(
      parseChecksumFile(text, 'sha256', 'Fedora-Cloud-Base-Generic-44-1.7.x86_64.qcow2'),
    ).toBe(A)
  })

  it('reads a bare single-digest file, the Alpine .sha512 shape', () => {
    expect(parseChecksumFile(`${L}\n`, 'sha512', 'anything.qcow2')).toBe(L)
  })

  it('matches on basename, so a path prefix in the file is not a mismatch', () => {
    expect(parseChecksumFile(`${A}  ./images/thing.qcow2\n`, 'sha256', 'thing.qcow2')).toBe(A)
  })
})

describe('parseChecksumFile — the refusals, which are the point', () => {
  it('returns null rather than the FIRST digest when the file lists other artifacts', () => {
    // The failure this prevents: verifying an Ubuntu amd64 image against the arm64 digest, or
    // Fedora Generic against Fedora UEFI-UKI. Both files really do list several artifacts.
    const text = `${A} *other-image.img\n${B} *another-image.img\n`
    expect(parseChecksumFile(text, 'sha256', 'noble-server-cloudimg-amd64.img')).toBeNull()
  })

  it('does NOT fall back to the only digest present when a filename is given and disagrees', () => {
    // A one-line file is unambiguous only when it carries no filename. Once it names something
    // else, "there is only one" stops being a reason to trust it — and the file gains a second
    // line the day upstream adds an artifact.
    const text = `${A}  a-completely-different-image.qcow2\n`
    expect(parseChecksumFile(text, 'sha256', 'wanted.qcow2')).toBeNull()
  })

  it('refuses a digest of the wrong width for the algorithm', () => {
    // A sha256 line in a file being read as sha512 must not match. Truncating silently would
    // verify 64 of the 128 characters that matter.
    expect(parseChecksumFile(`${A}  thing.qcow2\n`, 'sha512', 'thing.qcow2')).toBeNull()
  })

  it('returns null for an empty file and for HTML (a 404 page served with 200)', () => {
    expect(parseChecksumFile('', 'sha256', 'thing.qcow2')).toBeNull()
    expect(
      parseChecksumFile('<!DOCTYPE HTML>\n<html><body>404</body></html>', 'sha256', 'thing.qcow2'),
    ).toBeNull()
  })

  it('ignores comment lines when deciding a file is a single bare digest', () => {
    expect(parseChecksumFile(`# a note\n${L}\n`, 'sha512', 'x')).toBe(L)
  })
})

describe('assertChecksumUrl', () => {
  it('accepts https', () => {
    expect(assertChecksumUrl('https://example.test/SHA256SUMS').protocol).toBe('https:')
  })

  it('refuses http — a digest fetched in plaintext is rewritable by whoever rewrote the image', () => {
    expect(() => assertChecksumUrl('http://example.test/SHA256SUMS')).toThrow(/must be https/)
  })

  it('refuses non-web schemes', () => {
    expect(() => assertChecksumUrl('file:///tmp/SHA256SUMS')).toThrow(/must be https/)
  })
})

describe('normaliseExpected', () => {
  it('lowercases and trims', () => {
    expect(normaliseExpected(`  ${A.toUpperCase()}  `, 'sha256')).toBe(A)
  })

  it('rejects a digest of the wrong width, naming the algorithm', () => {
    expect(() => normaliseExpected('abc123', 'sha256')).toThrow(/64 hex characters/)
    expect(() => normaliseExpected(A, 'sha512')).toThrow(/128 hex characters/)
  })

  it('rejects non-hex characters', () => {
    expect(() => normaliseExpected('z'.repeat(64), 'sha256')).toThrow(/hex characters/)
  })
})

describe('hashFile', () => {
  it('hashes real bytes, and a one-byte change changes the digest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weaver-digest-'))
    try {
      const a = join(dir, 'a.bin')
      const b = join(dir, 'b.bin')
      await writeFile(a, 'weaver')
      await writeFile(b, 'weaved')

      const ha = await hashFile(a, 'sha256')
      const hb = await hashFile(b, 'sha256')

      // KNOWN-ANSWER, computed with sha256sum/sha512sum outside this process. A shape assertion
      // (/^[0-9a-f]{64}$/) would pass against any hash function at all, including a wrong one —
      // it can only fail if the output stops looking like hex, which is not the risk.
      expect(ha).toBe('6b8af1b6071b9ff27baa9252bf80feb10b92be9dcad595d38e255a27fa36874d')
      expect(hb).toBe('5af70885ccaf7d25d1c86741f262204b036fdcfae8b0c6cdb5ea4bada8a46f14')
      expect(ha).not.toBe(hb)

      expect(await hashFile(a, 'sha512')).toBe(
        '54e3d2aaf3b98c918fe4831f08b91d1dcfee330841aa1b047b4954d5ab83289b' +
          'ceb946f472adbf743ca8f97650bcc9aa9bf23ea871b674f899e4cac6e49b04e3',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('resolveRedirect — the two refusals image integrity closed', () => {
  // The real guard, so these assert against production behaviour rather than a stand-in.
  const validate = validateExternalUrl

  it('follows an ordinary https -> https hop and resolves a relative Location', () => {
    const from = new URL('https://mirror.test/images/latest/thing.qcow2')
    expect(resolveRedirect('../v1/thing.qcow2', from, validate).href).toBe(
      'https://mirror.test/images/v1/thing.qcow2',
    )
    expect(resolveRedirect('https://other.test/thing.qcow2', from, validate).href).toBe(
      'https://other.test/thing.qcow2',
    )
  })

  it('REFUSES an https -> http downgrade', () => {
    // Before integrity verification the client was picked per-URL, so this was automatic and silent — the reason
    // "the images come over TLS" was false even for entries whose catalog URL is https.
    const from = new URL('https://mirror.test/thing.qcow2')
    expect(() => resolveRedirect('http://mirror.test/thing.qcow2', from, validate)).toThrow(
      /refusing redirect from https to http/,
    )
  })

  it('REFUSES a redirect into cloud metadata or a private range (SSRF via Location)', () => {
    // ensureImageFromUrl validated the first URL and then trusted every Location header, so an
    // allowed external host could bounce the fetch onto the metadata service.
    const from = new URL('http://mirror.test/thing.qcow2')
    expect(() => resolveRedirect('http://169.254.169.254/latest/meta-data/', from, validate)).toThrow(
      /private\/internal/,
    )
    expect(() => resolveRedirect('http://10.0.0.5/x', from, validate)).toThrow(/private\/internal/)
    expect(() => resolveRedirect('http://192.168.1.1/x', from, validate)).toThrow(/private\/internal/)
    expect(() => resolveRedirect('http://127.0.0.1/x', from, validate)).toThrow(/localhost/)
  })

  it('REFUSES a non-http scheme in Location', () => {
    const from = new URL('https://mirror.test/thing.qcow2')
    expect(() => resolveRedirect('file:///etc/passwd', from, validate)).toThrow(/scheme/)
  })

  it('applies the private-range check to a RELATIVE-looking absolute redirect too', () => {
    // //host/path inherits the scheme — easy to miss, and it is still a host change.
    const from = new URL('https://mirror.test/thing.qcow2')
    expect(() => resolveRedirect('//169.254.169.254/x', from, validate)).toThrow(/private\/internal/)
  })
})
