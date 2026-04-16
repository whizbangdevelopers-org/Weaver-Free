// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { NotificationEvent } from '../../models/notification.js'

export interface NotificationAdapter {
  name: string
  send(event: NotificationEvent): Promise<void>
  test(): Promise<boolean>
}
