# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
{
  description = "Weaver — NixOS MicroVM Management Dashboard";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs = { nixpkgs, ... }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    weaver = import ./nixos/package.nix { inherit pkgs; };
  in {
    packages.${system} = {
      default = weaver;
      inherit weaver;
    };

    nixosModules.default = ./nixos/default.nix;

    overlays.default = _final: _prev: {
      inherit weaver;
    };

    devShells.${system}.default = pkgs.mkShell {
      packages = [
        pkgs.nodejs_22
        pkgs.cdrkit      # genisoimage for cloud-init ISOs
        pkgs.qemu         # qemu-system-x86_64, qemu-img
        # audit:taint's engine. It is in the devShell because that auditor now FAILS when semgrep
        # is absent instead of skipping green — and it is the only taint analysis in the project
        # (test:compliance runs from the git hooks; no workflow runs semgrep). Without it here,
        # fail-closed would just be friction; with it, `nix develop` is the fix the error names.
        pkgs.semgrep
      ];
    };
  };
}
