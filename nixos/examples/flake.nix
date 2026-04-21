# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Example NixOS flake.nix with Weaver
# ====================================
# Copy this to /etc/nixos/flake.nix and adjust:
#   - Replace "weaver-free" with your hostname (we suggest weaver-<tier>:
#     weaver-free, weaver-solo, weaver-team, or weaver-fabrick)
#   - Adjust the nixpkgs version if needed
#
# Then:
#   cd /etc/nixos
#   git add flake.nix    # Flakes only see git-tracked files!
#   sudo nixos-rebuild switch --flake .#weaver-free
{
  description = "NixOS system configuration with Weaver";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

    # Weaver — NixOS workload management
    weaver.url = "github:whizbangdevelopers-org/Weaver-Free";
    weaver.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, weaver, ... }@inputs: {
    nixosConfigurations.weaver-free = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        weaver.nixosModules.default
      ];
      # Pass inputs to modules (needed if you use a separate weaver.nix module)
      specialArgs = { inherit inputs; };
    };
  };
}
