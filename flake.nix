# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
{
  description = "Weaver — NixOS MicroVM Management Dashboard";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    weaver = import ./nixos/package.nix { inherit pkgs; };
  in {
    packages.${system} = {
      default = weaver;
      weaver = weaver;
    };

    nixosModules.default = ./nixos/default.nix;

    overlays.default = _final: _prev: {
      weaver = weaver;
    };

    devShells.${system}.default = pkgs.mkShell {
      packages = [
        pkgs.nodejs_22
        pkgs.cdrkit      # genisoimage for cloud-init ISOs
        pkgs.qemu         # qemu-system-x86_64, qemu-img
      ];
    };
  };
}
