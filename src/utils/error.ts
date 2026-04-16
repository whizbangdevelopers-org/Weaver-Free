// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import axios from 'axios'

/**
 * Extract a meaningful error message from an unknown caught value.
 * For Axios errors, prefers the backend response body (e.g. { error: "..." })
 * over the generic "Request failed with status code 400".
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    // Backend returns { error: "meaningful message" } on 4xx/5xx
    const data = err.response?.data as Record<string, unknown> | undefined
    if (data && typeof data.error === 'string') return data.error
    if (data && typeof data.message === 'string') return data.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
