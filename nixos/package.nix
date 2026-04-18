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
  version = "1.0.1";

  src = ./..;

  # Single hash covers all workspace deps (root + backend + tui)
  npmDepsHash = "sha256-UlUtKz8JQBrLHPFdVUXMe/BALJ0U5+lW5+Lq626qfmY=";

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
