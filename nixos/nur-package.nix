# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# NUR package definition for weaver
# This file is the reference for pkgs/weaver/default.nix in nur-packages repo
#
# Unlike Qepton (AppImage), this uses buildNpmPackage to build from source release tarball.
# The release.yml workflow triggers repository_dispatch to update the nur-packages repo
# with the new version and hash.
{
  lib,
  buildNpmPackage,
  fetchFromGitHub,
  nodejs_24,
}:

buildNpmPackage rec {
  pname = "weaver";
  version = "0.1.0";

  src = fetchFromGitHub {
    owner = "whizbangdevelopers-org";
    repo = "Weaver";
    rev = "v${version}";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  nodejs = nodejs_24;

  buildPhase = ''
    # Build backend
    cd backend
    npm run build
    cd ..

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

    # Frontend SPA
    cp -r dist/spa/* $out/lib/weaver/frontend/

    # Launcher
    mkdir -p $out/bin
    cat > $out/bin/weaver << 'LAUNCHER'
    #!/usr/bin/env bash
    export STATIC_DIR="''${STATIC_DIR:-$(dirname "$0")/../lib/weaver/frontend}"
    exec ${nodejs_24}/bin/node "$(dirname "$0")/../lib/weaver/backend/index.js" "$@"
    LAUNCHER
    chmod +x $out/bin/weaver
  '';

  meta = with lib; {
    description = "NixOS MicroVM Management Dashboard";
    homepage = "https://github.com/whizbangdevelopers-org/Weaver-Free";
    license = licenses.mit;
    maintainers = [ ];
    platforms = platforms.linux;
    mainProgram = "weaver";
  };
}
