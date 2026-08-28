# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# nixos/package.nix — Single source of truth for the Weaver Nix package.
# Imported by both flake.nix and nixos/default.nix to avoid hash duplication.
#
# Uses npm workspaces: root package-lock.json covers frontend, backend, and TUI.
# Single npmDepsHash — no separate fetchNpmDeps needed.
{ pkgs }:

pkgs.buildNpmPackage rec {
  pname = "weaver";
  version = "1.0.5";

  src = ./..;

  # Single hash covers all workspace deps (root + backend + tui).
  # Paired with a lockfile-marker comment below — both must be updated together
  # when package-lock.json changes. `audit:nix-deps-hash` enforces this pairing
  # on every push. Remediation when it fails: `npm run nix:refresh-deps-hash`
  # (or manually: nix-shell -p prefetch-npm-deps --run 'prefetch-npm-deps
  # package-lock.json' → copy sha256 to npmDepsHash → update marker below).
  npmDepsHash = "sha256-drUY3crWYwB3JHg8iAb5qjUWplj8HyUPdplgR29R4DM=";
  # lockfile-marker: cd57693cfe9b75e7

  makeCacheWritable = true;
  nodejs = pkgs.nodejs_24;

  buildPhase = ''
    # Remove sass-embedded (ships pre-built dart binary that fails in Nix sandbox).
    # Vite falls back to pure-JS "sass" package which is already installed.
    rm -rf node_modules/sass-embedded node_modules/sass-embedded-*

    # Build backend (workspace — deps already installed by npmConfigHook)
    pushd backend
    patchShebangs node_modules 2>/dev/null || true
    npm run build
    popd

    # Build TUI (workspace — deps already installed by npmConfigHook)
    pushd tui
    patchShebangs node_modules 2>/dev/null || true
    npm run build
    popd

    # Auto-detect Free-tier layout: if paid-tier source trees are absent
    # (i.e. we're building from the Weaver-Free sync mirror, where these
    # paths are sync-excluded), set VITE_FREE_BUILD=true so routes.ts
    # tree-shakes the paid-tier route imports that would otherwise fail
    # with UNLOADABLE_DEPENDENCY at rolldown time. Dev builds with paid
    # tiers present leave the flag unset and get the full build.
    if [ ! -d "src/pages/fabrick" ]; then
      export VITE_FREE_BUILD=true
      echo "[package.nix] Paid-tier sources absent — VITE_FREE_BUILD=true enabled for rolldown tree-shake"
    fi

    # Stage src-pwa as a sub-package so Quasar does not go to the network for it.
    #
    # @quasar/app-vite 3 (2026-08-17, 0207b1be) treats src-pwa as its own package:
    # modes-utils.js `ensureModeDeps()` returns early ONLY when src-pwa/package.json was
    # already present (so nothing had to be created) AND src-pwa/node_modules exists.
    # Otherwise it runs `npm install` inside src-pwa — which a sandboxed build cannot
    # satisfy, and the whole derivation dies on `ENOTCACHED register-service-worker`.
    #
    # Both files are DELIBERATELY untracked (see code/.gitignore): they carry nothing
    # project-specific and would drift against the CLI template on every Quasar upgrade.
    # That decision is right and stays — it was simply verified with a network available,
    # which is the one condition a nix build never has. So satisfy the two conditions from
    # inside the closure instead of tracking generated files:
    #
    #   package.json  ← the CLI's own template, i.e. byte-identical to what Quasar would
    #                   have written (verified 2026-08-17, and again 2026-08-27)
    #   node_modules  ← the root install, which already declares every dep src-pwa needs
    #                   (register-service-worker, workbox-*) at newer ranges
    #
    # Nothing new is tracked and nothing new ships to Weaver-Free.
    # Refuse loudly if the CLI moves its template: the failure mode we are avoiding is a
    # networked install inside a sandbox, and a bare `cp` error would send the next reader
    # hunting the wrong thing.
    pwaTemplate=node_modules/@quasar/app-vite/templates/pwa/common/package.json
    if [ ! -f "$pwaTemplate" ]; then
      echo "[package.nix] ERROR: Quasar's PWA template moved — expected $pwaTemplate" >&2
      echo "[package.nix] Without it, quasar build -m pwa runs a NETWORKED npm install in" >&2
      echo "[package.nix] src-pwa and this sandboxed build dies on ENOTCACHED. Find the new" >&2
      echo "[package.nix] template path in @quasar/app-vite/lib/modes/modes-utils.js." >&2
      exit 1
    fi
    cp "$pwaTemplate" src-pwa/package.json
    ln -s ../node_modules src-pwa/node_modules

    # Build frontend PWA
    npx quasar build -m pwa
  '';

  installPhase = ''
    mkdir -p $out/lib/weaver

    # Root node_modules (hoisted workspace deps — backend and TUI both need this)
    # Remove workspace symlinks that point to source dirs (we have our own launchers)
    rm -f node_modules/.bin/microvm-tui node_modules/.bin/weaver 2>/dev/null || true
    rm -rf node_modules/weaver-backend node_modules/weaver-tui 2>/dev/null || true
    cp -r node_modules $out/lib/weaver/node_modules

    # Backend
    mkdir -p $out/lib/weaver/backend
    cp -r backend/dist/* $out/lib/weaver/backend/
    cp backend/package.json $out/lib/weaver/backend/
    # Copy backend-specific nested deps (version conflicts that weren't hoisted)
    if [ -d backend/node_modules ]; then
      cp -r backend/node_modules $out/lib/weaver/backend/node_modules
    fi

    # Shipped data files (default distro catalog)
    mkdir -p $out/lib/weaver/data
    cp backend/data/distro-catalog.json $out/lib/weaver/data/

    # Frontend PWA
    mkdir -p $out/lib/weaver/frontend
    cp -r dist/pwa/* $out/lib/weaver/frontend/

    # Compliance docs (used by backend for PDF generation)
    mkdir -p $out/lib/weaver/docs/security/compliance
    cp docs/security/SECURITY-BASELINES.md $out/lib/weaver/docs/security/
    cp docs/security/compliance/*.md $out/lib/weaver/docs/security/compliance/

    # Operator-facing docs (UPGRADE.md + UNINSTALL.md are accessible from a
    # shell when the service is down — the scenario where users need them
    # most). Also ship ADMIN and USER guides so a shell user can `cat` them
    # during recovery.
    cp docs/UPGRADE.md $out/lib/weaver/docs/
    cp docs/UNINSTALL.md $out/lib/weaver/docs/
    cp docs/ADMIN-GUIDE.md $out/lib/weaver/docs/
    cp docs/USER-GUIDE.md $out/lib/weaver/docs/

    # TUI
    mkdir -p $out/lib/weaver/tui
    cp -r tui/dist/* $out/lib/weaver/tui/
    cp tui/package.json $out/lib/weaver/tui/
    if [ -d tui/node_modules ]; then
      cp -r tui/node_modules $out/lib/weaver/tui/node_modules
    fi

    # Launcher script — NODE_PATH includes hoisted workspace deps
    mkdir -p $out/bin
    cat > $out/bin/weaver << 'LAUNCHER'
    #!${pkgs.bash}/bin/bash
    WEAVER_ROOT="$(dirname "$0")/../lib/weaver"
    export STATIC_DIR="''${STATIC_DIR:-$WEAVER_ROOT/frontend}"
    export NODE_PATH="$WEAVER_ROOT/node_modules"
    exec ${pkgs.nodejs_24}/bin/node "$WEAVER_ROOT/backend/index.js" "$@"
    LAUNCHER
    chmod +x $out/bin/weaver

    # Management scripts (shipped for NixOS module wrappers)
    mkdir -p $out/lib/weaver/scripts
    cp scripts/nix-install.sh $out/lib/weaver/scripts/
    cp scripts/nix-uninstall.sh $out/lib/weaver/scripts/
    cp scripts/nix-fresh-install.sh $out/lib/weaver/scripts/
    cp scripts/nix-rebuild-local.sh $out/lib/weaver/scripts/
    cp scripts/reset-admin-password.sh $out/lib/weaver/scripts/

    # TUI launcher script
    cat > $out/bin/microvm-tui << 'TUI_LAUNCHER'
    #!${pkgs.bash}/bin/bash
    WEAVER_ROOT="$(dirname "$0")/../lib/weaver"
    export NODE_PATH="$WEAVER_ROOT/node_modules"
    exec ${pkgs.nodejs_24}/bin/node "$WEAVER_ROOT/tui/index.js" "$@"
    TUI_LAUNCHER
    chmod +x $out/bin/microvm-tui

  '';

  meta = with pkgs.lib; {
    description = "NixOS workload isolation manager";
    homepage = "https://github.com/whizbangdevelopers-org/Weaver-Free";
    license = {
      fullName = "AGPL-3.0 with AI Training Restriction";
      spdxId = "AGPL-3.0-only";
      url = "https://github.com/whizbangdevelopers-org/Weaver-Free/blob/main/LICENSE";
      free = true;
    };
    maintainers = [ ];
    platforms = [ "x86_64-linux" ];
    mainProgram = "weaver";
  };
}
