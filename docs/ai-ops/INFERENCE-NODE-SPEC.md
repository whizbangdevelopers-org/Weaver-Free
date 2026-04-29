<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Inference Node Specification

**Decision #152.** Hardware class specification and benchmark targets for the Weaver Inference Node SKU and Forge Foundry reference platform.

> **Status: PROVISIONAL.** Benchmark numbers below are targets from vendor data. Replace with measured results once the Strix Halo box is available. Benchmark results promote this document from provisional to ratified; failure triggers a re-spec (first fallback: split into two physical boxes, one inference / one Forge).

---

## Reference Hardware

| Spec | Value |
|------|-------|
| Silicon | AMD Ryzen AI Max+ 395 (Strix Halo) |
| Cores | 16 (Zen 5) |
| NPU | XDNA 2 (50 TOPS) |
| iGPU | RDNA 3.5 (40 CUs) |
| RAM | 128GB LPDDR5x unified memory |
| Memory bandwidth | 256GB/s (256-bit bus) |
| TDP | 120W sustained |
| Form factor | Mini-ITX (Framework Desktop reference build) |
| OS | NixOS 25.11+ |

**Secondary sources (federal procurement):** HP Z2 Mini G1a, Asus ProArt P16, and other Strix Halo OEM builds. Framework Desktop is reference, not exclusive. Note Framework's batched-shipping model for federal deadlines with hard delivery dates.

---

## Benchmark Gates (PROVISIONAL — replace with measured values)

> These are Framework's marketing-derived estimates. Replace each row with measured throughput from the actual box. Run benchmarks before promoting Decision #152 from provisional to ratified.

| Benchmark | Target | Measured | Date |
|-----------|--------|----------|------|
| Base 8B Q4_K_M tokens/sec (Ollama, ROCm) | ≥40 tok/s | TBD | TBD |
| Base 70B Q4_K_M tokens/sec (llama.cpp, ROCm) | ≥4 tok/s | TBD | TBD |
| QLoRA wall time (10k-example dev corpus, 8B) | ≤4h | TBD | TBD |
| Concurrent serving + LoRA (memory headroom) | model fits in active partition | TBD | TBD |
| Playwright workers at N=4 (no starvation) | E2E suite completes without OOM | TBD | TBD |

### Benchmark procedure

```bash
# 1. Serving throughput
ollama run qwen2.5:7b-instruct-q4_K_M --benchmark

# 2. QLoRA wall time (once LoRA pipeline is wired)
systemctl start weaver-lora-retrain
time journalctl -fu weaver-lora-retrain | grep "Training complete"

# 3. Concurrent serving + Playwright
npm run e2e:docker &  # Start E2E suite
ollama run qwen2.5:7b-instruct-q4_K_M  # Concurrent serving
# Verify E2E completes without OOM kill
```

---

## Supported Hardware Classes

Any Strix Halo (AMD Ryzen AI Max+ 3xx series) device meeting:
- ≥128GB unified memory
- ROCm-compatible iGPU (RDNA 3.5+)
- NixOS 25.11+ verified

128GB is the minimum for the full inference node role (8B active serving + LoRA buffer + CI headroom). 64GB Strix Halo variants support inference serving only — no concurrent LoRA retrain.

---

## NixOS Module Options

```nix
services.weaver.inference = {
  enable = true;
  model = "qwen2.5:7b-instruct-q4_K_M";  # or llama3.1:8b-instruct-q4_K_M
  loraRetrain = {
    enable = true;
    schedule = "02:00";   # cron-gated quiet window start
    corpusPath = "/var/lib/weaver/corpus";
  };
};
```

---

## Resource Partition Policy

See [business/operations/FORGE-FOUNDRY.md](../../business/operations/FORGE-FOUNDRY.md) for the Forge Foundry partition. The `weaver-inference-node` customer profile uses the same shared modules with the inference partition maximized (no agent execution or CI overhead).

---

## Adapter Promotion Protocol

> Populated after first LoRA retrain run completes at Forge Foundry (Phase 4, v1.3.0 dev).

1. Retrain completes in quiet window, adapter written to `/var/lib/weaver/adapters/<run-id>/`
2. Automated eval against dev task set runs via `weaver-lora-eval.service`
3. If eval score ≥ baseline threshold: adapter marked `candidate`
4. Operator reviews eval report in Weaver AI dashboard
5. Operator promotes: `POST /api/inference/adapters/:id/promote`
6. Ollama reloads with promoted adapter; prior adapter archived

---

## Procurement Checklist (for SKU fulfillment)

- [ ] Framework Desktop (128GB Strix Halo) lead time: check batched-shipping availability before committing customer delivery date
- [ ] HP Z2 Mini G1a alternative: verify NixOS 25.11 compatibility before listing as secondary source
- [ ] Confirm ROCm version support for target kernel at time of order
- [ ] NixOS module version pin for customer delivery: record in customer's flake.lock

---

*See [Decision #152 in MASTER-PLAN.md](../../MASTER-PLAN.md) for the full rationale. Benchmark results belong in this document — update the table above when the Strix Halo box is available.*
