// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/// <reference types="@quasar/app-vite" />
/// <reference types="vite/client" />

// Global type declarations

declare const __APP_VERSION__: string

// Extend Window for platform-specific APIs
interface Window {
  // Electron preload API (if using Electron)
  electronAPI?: {
    // Add your Electron IPC methods here
  }
}
