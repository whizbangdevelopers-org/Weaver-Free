# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Weaver Inference Node — NixOS Flake
#
# Decision WVR-152. STUB — implementation scheduled for v1.1.0 (Forge Foundry Phase 2).
#
# Three profiles:
#   forge-foundry         — dark factory (shared modules + agent execution + CI runner)
#   weaver-inference-node — customer SKU (shared modules + serving + LoRA + MCP retrieval)
#   dev-parity            — test profile (verifies shared modules across the above two)
#
# Shared load-bearing modules (must appear in both forge-foundry and weaver-inference-node):
#   ollama / baseModelLoader / loraPipeline / mcpRetrieval / cgroupPolicy
#
# Run audit:inference-node-parity to verify profile parity.
{
  description = "Weaver Inference Node — three-profile NixOS flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";

    # cognee-nix: Nix packaging for the cognee AI memory sidecar (uv2nix, Python 3.12).
    # Use the `cognee-api` output (core + FastAPI/uvicorn) for services.weaver.cognee.
    # Local flake path until cognee-nix is published; switch to URL when available.
    # Source: ~/Projects/active/cognee-nix  Ref: Forge/research/cognee-nix.md
    cognee-nix.url = "path:/home/mark/Projects/active/cognee-nix";
    cognee-nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  # TODO (v1.1.0): implement outputs with three NixOS profiles.
  # See README.md for the planned structure.
  outputs = { ... }: {
    # Placeholder — populated at v1.1.0 implementation.
  };
}
