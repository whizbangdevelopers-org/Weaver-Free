# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Example Weaver service module
# ==============================
# Copy this to /etc/nixos/modules/services/weaver.nix (or wherever
# you keep service modules) and import it from configuration.nix:
#
#   imports = [
#     ./modules/services/weaver.nix
#     # ... your other modules
#   ];
#
# This file requires 'inputs' in specialArgs (see example flake.nix).
#
# IMPORTANT: After creating this file, run:
#   cd /etc/nixos && git add modules/services/weaver.nix
# Nix flakes only see git-tracked files!
{ inputs, ... }:

{
  imports = [
    inputs.weaver.nixosModules.default
  ];

  config = {
    services.weaver = {
      enable = true;

      # -- Basics --
      # port = 3100;          # Default: 3100
      # host = "127.0.0.1";   # Default: 127.0.0.1 (localhost only)
      # openFirewall = false;  # Default: false (set true to allow LAN access)

      # -- Secrets (recommended for production) --
      # jwtSecretFile = "/var/lib/weaver/.jwt-secret";
      # initialAdminPasswordFile = "/var/lib/weaver/.admin-password";

      # -- VM Provisioning (create VMs from the UI) --
      # provisioningEnabled = true;   # Default: true
      # microvmsDir = "/var/lib/microvms";
      # bridgeInterface = "br-microvm";
      # bridgeGateway = "10.10.0.1";

      # -- AI Agent (optional, BYOK also works from UI) --
      # aiApiKeyFile = "/run/secrets/ai-api-key";  # sops-nix recommended
      # aiVendor = "anthropic";
    };
  };
}
