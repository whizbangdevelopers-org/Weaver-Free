// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

export interface OrganizationIdentity {
  /** Organization display name (shown in header, login, browser tab) */
  name: string
  /** Logo URL or base64 data URI (shown in header and login page) */
  logoUrl: string | null
  /** Contact email (shown on help page) */
  contactEmail: string | null
  /** Contact phone (shown on help page) */
  contactPhone: string | null
}
