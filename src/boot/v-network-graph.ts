// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { boot } from 'quasar/wrappers'
import VNetworkGraph from 'v-network-graph'
import 'v-network-graph/lib/style.css'

export default boot(({ app }) => {
  app.use(VNetworkGraph)
})
