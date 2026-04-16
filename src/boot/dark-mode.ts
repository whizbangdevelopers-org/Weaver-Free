// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { boot } from 'quasar/wrappers'
import { Dark } from 'quasar'
import { useSettingsStore } from 'stores/settings-store'

export default boot(() => {
  const settings = useSettingsStore()
  Dark.set(settings.darkMode === 'auto' ? 'auto' : settings.darkMode === 'dark')
})
