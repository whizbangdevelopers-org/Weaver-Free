// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface SessionData {
  userId: string
  role: string
  tokenId: string
  type: 'access' | 'refresh'
  createdAt: number
  lastActivity: number  // Updated on every authenticated request
}

export interface SessionStore {
  set(tokenId: string, data: SessionData, ttlMs: number): Promise<void>
  get(tokenId: string): Promise<SessionData | null>
  delete(tokenId: string): Promise<void>
  deleteByUser(userId: string): Promise<void>
  updateActivity(tokenId: string): Promise<void>
}
