// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Shared rate limit configuration helper.
 * Centralizes the DISABLE_RATE_LIMIT / production guard pattern
 * so route files don't duplicate the logic.
 */
const rateLimitDisabled =
  process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production'

export function createRateLimit(max: number, timeWindow = '1 minute') {
  return {
    max: rateLimitDisabled ? 1_000_000 : max,
    timeWindow,
  }
}
