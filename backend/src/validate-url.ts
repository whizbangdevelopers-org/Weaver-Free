// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Validates that a URL is safe for server-side fetching.
 * Blocks private/internal IPs to prevent SSRF attacks.
 */
export function validateExternalUrl(raw: string): URL {
  const url = new URL(raw)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Invalid URL scheme "${url.protocol}" — only http/https allowed`)
  }

  const hostname = url.hostname.toLowerCase()

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('URL must not point to localhost')
  }

  // Block private/reserved IP ranges (RFC 1918, RFC 6598, link-local, metadata)
  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname.startsWith('100.64.') ||      // RFC 6598 (CGNAT)
    hostname.startsWith('169.254.') ||      // Link-local / cloud metadata
    hostname.startsWith('fd') ||            // IPv6 ULA
    hostname.startsWith('fe80')             // IPv6 link-local
  ) {
    throw new Error('URL must not point to private/internal networks')
  }

  return url
}
