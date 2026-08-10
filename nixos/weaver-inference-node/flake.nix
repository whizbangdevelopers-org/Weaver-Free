# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Weaver Inference Node — NixOS Flake
#
# STUB — implementation scheduled for v1.1.0.
#
# Three profiles:
#   forge-foundry         — build profile (shared modules + agent execution + CI runner)  # published-comment-ok: names a build profile declared in this flake, not a machine
#   weaver-inference-node — customer SKU (shared modules + serving + LoRA + MCP retrieval)
#   dev-parity            — test profile (verifies shared modules across the above two)
#
# Shared load-bearing modules, required by both the build and customer profiles:
#   ollama / baseModelLoader / loraPipeline / mcpRetrieval / cgroupPolicy
#
# Run audit:inference-node-parity to verify profile parity.
{
  description = "Weaver Inference Node — three-profile NixOS flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";
    # No further inputs. A `cognee-nix` input was removed 2026-08-10: Cognee is retired and must
    # not be built against, and the input pointed at an absolute path on one developer's machine
    # (`path:/home/…`), so this flake could not evaluate for anybody who cloned the mirror.
  };

  # Outputs land at v1.1.0 with the three NixOS profiles above; see README.md for the structure.
  outputs = { ... }: {
    # Placeholder — populated at v1.1.0 implementation.
  };
}
