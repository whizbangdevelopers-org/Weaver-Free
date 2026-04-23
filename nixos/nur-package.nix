# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# NUR package definition reference for pkgs/weaver/default.nix in the nur-packages repo.
#
# Uses fetchFromGitHub to pull from the public Weaver-Free release tag.
# This differs from nixos/package.nix (which uses src = ./.. for local builds).
#
# src.hash is placeholder — filled by release.yml → update-weaver.yml dispatch.
# npmDepsHash stays in sync with package-lock.json; audit:nix-deps-hash enforces this.
{
  lib,
  buildNpmPackage,
  fetchFromGitHub,
  nodejs_24,
  bash,
}:

buildNpmPackage rec {
  pname = "weaver";
  version = "1.0.2";

  src = fetchFromGitHub {
    owner = "whizbangdevelopers-org";
    repo = "Weaver-Free";
    rev = "v${version}";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  npmDepsHash = "sha256-iKvLuBk0RxDDGqJ1FrNgqhpkDURdt0Nbx7nIEZa2GFY=";
  # lockfile-marker: e028f925a01849a4

  makeCacheWritable = true;
  nodejs = nodejs_24;

  buildPhase = ''
    rm -rf node_modules/sass-embedded node_modules/sass-embedded-*

    pushd backend
    patchShebangs node_modules 2>/dev/null || true
    npm run build
    popd

    pushd tui
    patchShebangs node_modules 2>/dev/null || true
    npm run build
    popd

    export VITE_FREE_BUILD=true
    npx quasar build -m pwa
  '';

  installPhase = ''
    mkdir -p $out/lib/weaver

    rm -f node_modules/.bin/microvm-tui node_modules/.bin/weaver 2>/dev/null || true
    rm -rf node_modules/weaver-backend node_modules/weaver-tui 2>/dev/null || true
    cp -r node_modules $out/lib/weaver/node_modules

    mkdir -p $out/lib/weaver/backend
    cp -r backend/dist/* $out/lib/weaver/backend/
    cp backend/package.json $out/lib/weaver/backend/
    if [ -d backend/node_modules ]; then
      cp -r backend/node_modules $out/lib/weaver/backend/node_modules
    fi

    mkdir -p $out/lib/weaver/data
    cp backend/data/distro-catalog.json $out/lib/weaver/data/

    mkdir -p $out/lib/weaver/frontend
    cp -r dist/pwa/* $out/lib/weaver/frontend/

    mkdir -p $out/lib/weaver/docs/security/compliance
    cp docs/security/SECURITY-BASELINES.md $out/lib/weaver/docs/security/
    cp docs/security/compliance/*.md $out/lib/weaver/docs/security/compliance/
    cp docs/UPGRADE.md $out/lib/weaver/docs/
    cp docs/UNINSTALL.md $out/lib/weaver/docs/
    cp docs/ADMIN-GUIDE.md $out/lib/weaver/docs/
    cp docs/USER-GUIDE.md $out/lib/weaver/docs/

    mkdir -p $out/lib/weaver/tui
    cp -r tui/dist/* $out/lib/weaver/tui/
    cp tui/package.json $out/lib/weaver/tui/
    if [ -d tui/node_modules ]; then
      cp -r tui/node_modules $out/lib/weaver/tui/node_modules
    fi

    mkdir -p $out/bin
    cat > $out/bin/weaver << 'LAUNCHER'
    #!${bash}/bin/bash
    WEAVER_ROOT="$(dirname "$0")/../lib/weaver"
    export STATIC_DIR="''${STATIC_DIR:-$WEAVER_ROOT/frontend}"
    export NODE_PATH="$WEAVER_ROOT/node_modules"
    exec ${nodejs_24}/bin/node "$WEAVER_ROOT/backend/index.js" "$@"
    LAUNCHER
    chmod +x $out/bin/weaver

    mkdir -p $out/lib/weaver/scripts
    cp scripts/nix-install.sh $out/lib/weaver/scripts/
    cp scripts/nix-uninstall.sh $out/lib/weaver/scripts/
    cp scripts/nix-fresh-install.sh $out/lib/weaver/scripts/
    cp scripts/nix-rebuild-local.sh $out/lib/weaver/scripts/
    cp scripts/reset-admin-password.sh $out/lib/weaver/scripts/

    cat > $out/bin/microvm-tui << 'TUI_LAUNCHER'
    #!${bash}/bin/bash
    WEAVER_ROOT="$(dirname "$0")/../lib/weaver"
    export NODE_PATH="$WEAVER_ROOT/node_modules"
    exec ${nodejs_24}/bin/node "$WEAVER_ROOT/tui/index.js" "$@"
    TUI_LAUNCHER
    chmod +x $out/bin/microvm-tui
  '';

  meta = with lib; {
    description = "NixOS workload isolation manager for MicroVMs and containers";
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
    broken = true;
  };
}
