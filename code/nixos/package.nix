# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# nixos/package.nix — Single source of truth for the Weaver Nix package.
# Imported by both flake.nix and nixos/default.nix to avoid hash duplication.
{ pkgs }:

let
  backendNpmDeps = pkgs.fetchNpmDeps {
    name = "weaver-backend-npm-deps";
    src = ./../backend;
    hash = "sha256-00ehTyVbRqbm/OP2TBlP1hLxis8sRxY1gMM/lICZeIU=";
  };
  tuiNpmDeps = pkgs.fetchNpmDeps {
    name = "weaver-tui-npm-deps";
    src = ./../tui;
    hash = "sha256-4nwaVoaEUR/mlRAN/JTtnI/sNBfGpaCusMt2u7O/9oo=";
  };
in pkgs.buildNpmPackage rec {
  pname = "weaver";
  version = "0.1.0";

  src = ./..;

  npmDepsHash = "sha256-lsX8YSSxY5VXvoP/gR2gFhKCgIkvnkB+rZc71YggEYI=";

  nodejs = pkgs.nodejs_24;

  buildPhase = ''
    # Remove sass-embedded (ships pre-built dart binary that fails in Nix sandbox).
    # Vite falls back to pure-JS "sass" package which is already installed.
    rm -rf node_modules/sass-embedded node_modules/sass-embedded-*

    # Install backend deps from pre-fetched cache (separate lock file)
    backendCache=$(mktemp -d)
    cp -r ${backendNpmDeps}/* "$backendCache/"
    chmod -R u+w "$backendCache"

    pushd backend
    npm ci --cache "$backendCache"
    patchShebangs node_modules
    npm run build
    popd

    # Install TUI deps from pre-fetched cache (separate lock file)
    tuiCache=$(mktemp -d)
    cp -r ${tuiNpmDeps}/* "$tuiCache/"
    chmod -R u+w "$tuiCache"

    pushd tui
    npm ci --cache "$tuiCache"
    patchShebangs node_modules
    npm run build
    popd

    # Build frontend SPA
    npx quasar build
  '';

  installPhase = ''
    mkdir -p $out/lib/weaver/backend
    mkdir -p $out/lib/weaver/frontend

    # Backend
    cp -r backend/dist/* $out/lib/weaver/backend/
    cp backend/package.json $out/lib/weaver/backend/
    cp -r backend/node_modules $out/lib/weaver/backend/

    # Shipped data files (default distro catalog — loaded as fallback when no persisted copy exists)
    mkdir -p $out/lib/weaver/data
    cp backend/data/distro-catalog.json $out/lib/weaver/data/

    # Frontend SPA
    cp -r dist/spa/* $out/lib/weaver/frontend/

    # Compliance docs (used by backend for PDF generation)
    mkdir -p $out/lib/weaver/docs/security/compliance
    cp docs/security/SECURITY-BASELINES.md $out/lib/weaver/docs/security/
    cp docs/security/compliance/*.md $out/lib/weaver/docs/security/compliance/

    # TUI
    mkdir -p $out/lib/weaver/tui
    cp -r tui/dist/* $out/lib/weaver/tui/
    cp tui/package.json $out/lib/weaver/tui/
    cp -r tui/node_modules $out/lib/weaver/tui/

    # Launcher script
    mkdir -p $out/bin
    cat > $out/bin/weaver << 'LAUNCHER'
    #!${pkgs.bash}/bin/bash
    export STATIC_DIR="''${STATIC_DIR:-$(dirname "$0")/../lib/weaver/frontend}"
    exec ${pkgs.nodejs_24}/bin/node "$(dirname "$0")/../lib/weaver/backend/index.js" "$@"
    LAUNCHER
    chmod +x $out/bin/weaver

    # TUI launcher script
    cat > $out/bin/microvm-tui << 'TUI_LAUNCHER'
    #!${pkgs.bash}/bin/bash
    exec ${pkgs.nodejs_24}/bin/node "$(dirname "$0")/../lib/weaver/tui/index.js" "$@"
    TUI_LAUNCHER
    chmod +x $out/bin/microvm-tui
  '';

  meta = with pkgs.lib; {
    description = "NixOS workload isolation manager";
    homepage = "https://github.com/whizbangdevelopers-org/Weaver-Free";
    license = {
      fullName = "AGPL-3.0 with Commons Clause and AI Training Restriction";
      spdxId = "AGPL-3.0-only";
      url = "https://github.com/whizbangdevelopers-org/Weaver-Free/blob/main/LICENSE";
      free = false;  # Commons Clause restricts commercial use
    };
    maintainers = [ ];
    platforms = [ "x86_64-linux" ];
    mainProgram = "weaver";
  };
}
