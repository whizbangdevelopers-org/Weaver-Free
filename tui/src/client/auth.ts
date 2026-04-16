// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import Conf from 'conf'

export interface StoredCredentials {
  username: string
  token: string
  refreshToken: string
  host: string
}

interface CredentialSchema {
  credentials: StoredCredentials | null
}

const store = new Conf<CredentialSchema>({
  projectName: 'weaver',
  defaults: { credentials: null },
})

export function loadCredentials(): StoredCredentials | null {
  return store.get('credentials')
}

export function saveCredentials(creds: StoredCredentials): void {
  store.set('credentials', creds)
}

export function clearCredentials(): void {
  store.set('credentials', null)
}
