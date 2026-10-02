// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * The dev server's dependency optimizer, started where the browser starts.
 *
 * WHY THIS EXISTS
 * ---------------
 * Vite pre-bundles an app's dependencies from a scan it runs when the dev server starts. Quasar
 * hands that scan `optimizeDeps.entries: ['index.html']` (`@quasar/app-vite`'s `config-tools.js`),
 * and Quasar's index.html carries no script tag: the app's entry is injected when the page is
 * served. So the scan has nothing to follow. Measured 2026-10-02 in Gantry on a fresh cache:
 * "Scan completed in 64.63ms: no dependencies found". Every dependency was then found only when a
 * page first imported it, and a find can make the dev server reload the page. One did, mid sign-in:
 * the page came back on the sign-in URL, and an E2E case waited thirty seconds for a home page it
 * was never sent to. Every app scaffolded from this template has the same index.html and the same
 * Quasar, so the defect is portfolio-wide by construction, and so is this fix.
 *
 * WHAT IT DOES
 * ------------
 * `configureDepOptimizer(viteConf)`, called from `extendViteConf`:
 *
 *   - starts the scan from the dev server's own client entry. Quasar generates that file and names
 *     it in `server.warmup.clientFiles` before `extendViteConf` runs. It imports everything the
 *     browser loads at start: App.vue, the store, the router (whose routes import every page), each
 *     boot file, and what Quasar generates from the config, such as an icon set. The first version
 *     of this module listed App.vue, the router, the store and the boot files by hand. Weaver's
 *     scan then still missed `quasar/icon-set/mdi-v7.js`, which only the generated file imports,
 *     so the list became the file it was approximating;
 *   - lists outright every package a `#`-prefixed alias names. The scan does not follow a `#`
 *     specifier, and Quasar aliases `#q-app` to `@quasar/app-vite`, which boot files and the router
 *     import;
 *   - gives the dev server a cache of its own when QUASAR_VITE_CACHE_DIR is set. An E2E harness that
 *     bind-mounts the checkout otherwise shares node_modules/.q-cache with the developer's own dev
 *     server, and with any second server it starts.
 *
 * Only the dev server runs the optimizer, so a build is left as it is.
 *
 * REFUSE, DON'T DEGRADE
 * ---------------------
 * In development, no client entry to start from means `@quasar/app-vite` changed how it starts the
 * dev server, and the scan would be back to finding nothing with no error anywhere. So it throws.
 *
 * WHAT KEEPS IT TRUE
 * ------------------
 * The E2E harness runs each dev server with DEBUG=vite:deps and fails the run, naming the
 * dependency, when one is found late (testing/e2e-docker/config/late-deps.sh).
 */

/** The files the dev server warms up: Quasar's generated client entry. */
export function devClientEntries(viteConf) {
  const files = viteConf?.server?.warmup?.clientFiles
  return Array.isArray(files) ? files.filter(f => typeof f === 'string' && f !== '') : []
}

/** A bare package specifier: `name` or `@scope/name`, with no path after it. */
const BARE_PACKAGE = /^(@[^/.][^/]*\/)?[^/.][^/]*$/

/**
 * Every package a `#`-prefixed alias names, from the alias map Quasar hands Vite. An alias given as
 * an array of `{ find, replacement }` is read the same way.
 */
export function packagesBehindHashAliases(alias) {
  if (!alias) return []
  const pairs = Array.isArray(alias)
    ? alias.map(a => [a?.find, a?.replacement])
    : Object.entries(alias)
  return [
    ...new Set(
      pairs
        .filter(([key]) => typeof key === 'string' && key.startsWith('#'))
        .map(([, target]) => target)
        .filter(target => typeof target === 'string' && BARE_PACKAGE.test(target))
    )
  ]
}

/**
 * Point the dev server's dependency optimizer at what the browser loads. Call from
 * `extendViteConf`; it adds to what Quasar set and removes nothing.
 */
export function configureDepOptimizer(viteConf, { env = process.env } = {}) {
  viteConf.optimizeDeps = viteConf.optimizeDeps || {}
  if (viteConf.mode === 'development') {
    const clientEntries = devClientEntries(viteConf)
    if (clientEntries.length === 0) {
      throw new Error(
        'quasar.scan: Quasar named no client entry in server.warmup.clientFiles, so the dev ' +
          "server's dependency scan has nothing to start from. @quasar/app-vite has changed how " +
          'it starts the dev server; read its lib/config-tools.js before changing this.'
      )
    }
    // Vite takes a single string as well as an array; spreading a string would split it into
    // letters.
    const existing = viteConf.optimizeDeps.entries
    const before = existing == null ? [] : Array.isArray(existing) ? existing : [existing]
    viteConf.optimizeDeps.entries = [...new Set([...before, ...clientEntries])]
  }
  viteConf.optimizeDeps.include = [
    ...new Set([
      ...(viteConf.optimizeDeps.include || []),
      ...packagesBehindHashAliases(viteConf.resolve?.alias)
    ])
  ]
  if (env.QUASAR_VITE_CACHE_DIR) viteConf.cacheDir = env.QUASAR_VITE_CACHE_DIR
  return viteConf
}
