<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Weaver Inference Node — NixOS Module

**Decision WVR-152. Status: STUB — implementation scheduled for v1.1.0 (Forge Foundry Phase 2).**

This directory contains the NixOS flake for the Weaver Inference Node SKU and the Forge Foundry dark factory.

---

## Structure (planned — populated at v1.1.0)

```
weaver-inference-node/
  flake.nix                    # Three-profile flake entry point
  modules/
    ollama.nix                 # Ollama / llama.cpp-server serving (shared)
    base-model-loader.nix      # Base model loader (shared)
    lora-pipeline.nix          # LoRA fine-tuning pipeline (shared)
    mcp-retrieval.nix          # MCP retrieval service (shared)
    cgroup-policy.nix          # Resource partition cgroup policy (shared)
  profiles/
    forge-foundry.nix          # forge-foundry overlay (adds agent execution + CI runner)
    weaver-inference-node.nix  # weaver-inference-node overlay (customer SKU)
    dev-parity.nix             # dev-parity test profile (verifies shared modules)
```

## Three Profiles

| Profile | Purpose |
|---------|---------|
| `forge-foundry` | Developer-internal dark factory: shared modules + agent execution + self-hosted CI runner |
| `weaver-inference-node` | Customer SKU: shared modules + serving + LoRA + MCP retrieval only |
| `dev-parity` | Test profile: verifies the two above share all load-bearing modules |

Drift between `forge-foundry` and `weaver-inference-node` shared modules is caught by `audit:inference-node-parity`.

## Usage (once implemented)

```nix
# flake.nix (customer install)
{
  inputs.weaver.url = "github:whizbangdevelopers-org/Weaver-Dev";
  outputs = { weaver, ... }: {
    nixosConfigurations.my-inference-node = weaver.lib.inferenceNode {
      profile = "weaver-inference-node";
      model = "qwen2.5:7b-instruct-q4_K_M";
      loraRetrain.enable = true;
    };
  };
}
```

## Hardware Requirements

See [code/docs/ai-ops/INFERENCE-NODE-SPEC.md](../docs/ai-ops/INFERENCE-NODE-SPEC.md) for the full hardware spec, supported hardware classes, benchmark targets, and procurement checklist.

## Tier Gating

Offered at Weaver Team (128GB license unit threshold) and above. Default-included in Fabrick. Required for Compliance Pack. See Decision WVR-152 for tier details.

---

*Implementation: v1.1.0 dev phase (Forge Foundry Phase 2). Customer SKU ships at v1.4.0.*
*Full spec: [Decision WVR-152 in MASTER-PLAN.md](../../MASTER-PLAN.md)*
