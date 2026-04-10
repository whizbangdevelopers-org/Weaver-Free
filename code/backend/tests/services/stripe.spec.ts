// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach } from 'vitest'
import { initProductMap, tierForProduct } from '../../src/services/stripe.js'
import { TIERS } from '../../src/constants/vocabularies.js'

describe('Stripe service', () => {
  describe('product → tier mapping', () => {
    beforeEach(() => {
      initProductMap({
        soloProductId: 'prod_solo_test',
        teamProductId: 'prod_team_test',
        fabrickProductId: 'prod_fabrick_test',
      })
    })

    it('maps solo product to weaver tier', () => {
      expect(tierForProduct('prod_solo_test')).toBe(TIERS.WEAVER)
    })

    it('maps team product to weaver tier', () => {
      expect(tierForProduct('prod_team_test')).toBe(TIERS.WEAVER)
    })

    it('maps fabrick product to fabrick tier', () => {
      expect(tierForProduct('prod_fabrick_test')).toBe(TIERS.FABRICK)
    })

    it('returns null for unknown product', () => {
      expect(tierForProduct('prod_unknown')).toBeNull()
    })
  })
})
