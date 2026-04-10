<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Platform-Specific Documentation

Guides for building and publishing to specific platforms.

## Available Platforms

| Platform | Directory | Description |
| -------- | --------- | ----------- |
| Android | `android/` | Google Play Store publishing |
| iOS | `ios/` | Apple App Store publishing |
| Electron | `electron/` | Desktop app packaging |
| Flatpak | `flatpak/` | Flathub publishing |
| Snap | `snap/` | Snap Store publishing |
| Windows | `windows/` | Windows Store / MSI packaging |

## Adding Platform Guides

Create a directory for each platform with:

1. `README.md` - Overview and quick start
2. Build configuration files
3. Store submission guides

## Template Platform Support

| Template | Platforms |
| -------- | --------- |
| minimal | SPA only |
| electron | Desktop (Win/Mac/Linux) |
| pwa | Web (PWA) |
| mobile | iOS, Android |
| universal | All platforms |
