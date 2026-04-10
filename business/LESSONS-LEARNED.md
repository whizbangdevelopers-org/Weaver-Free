<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->

# Business Lessons Learned

Discoveries from pricing, positioning, and investor readiness work. The business equivalent of `code/docs/development/KNOWN-GOTCHAS.md`.

> **Audience:** Founders, future business hires, investors (selectively). These are the non-obvious things we learned the hard way or caught before they became expensive.

---

## Pricing & Revenue

### 1. Feature decisions change the pricing math retroactively

**What happened:** Decisions #113–#119 (March 2026) added 48 features to the product — fleet bridge, GPU scheduling, inference platform, model deployment, snapshot provisioning. These were designed *after* the FM pricing and version-stepped price schedule were set.

**The gotcha:** The TCO analysis showed 3-year value delivered at 20 nodes jumped from $449K to $1.02M — but the pricing steps didn't move. Capture rate stayed flat at ~13% across every version milestone. An investor looking at this sees "you don't know how to price your enterprise product."

**Rule:** Every batch of architectural decisions that adds significant capability (>10 features) must trigger a pricing review. Not "should we raise prices" — but "does the capture rate at each version milestone still make sense?" If a single session adds $500K in delivered value, the pricing schedule from before that session is wrong by definition.

---

### 2. FM programs without quantity caps have unbounded downside

**What happened:** Fabrick FM had hard caps (20/10 seats). Solo and Team had only version windows — "closes when v1.2 ships." If launch went viral (front-page HN), unlimited customers could lock in at $149/yr forever.

**The gotcha:** In the base case, ~10 Solo customers would be in the FM window. No problem. But the FM program was designed for the base case, not the best case. A viral launch could lock 500+ customers at $149 — permanently compressing blended ASP and making Solo revenue look anemic to investors.

**Rule:** Every FM tier needs two closing triggers: version cap AND quantity cap. Whichever fires first. The version cap protects against shipping slowly. The quantity cap protects against growing fast. Both failure modes are real. Decision #121.

**Bonus insight:** Quantity caps are a GTM feature, not just risk mitigation. "First 200" creates urgency. "Until v1.2 ships" creates procrastination.

---

### 3. AI/inference capabilities are never "included" — they're always a separate revenue stream

**What happened:** The v2.0 model deployment and v2.2 GPU scheduling features were originally part of the base product — included in the FM lock. An FM Solo customer at $149/yr would get model deployment (market rate: $6,000/yr) for free. An FM Fabrick customer at $999/node would get GPU scheduling (market rate: $5,000/node) for free.

**The gotcha:** At scale, this creates a $1M+/yr value leak. Every cloud provider, every GPU scheduling vendor, every MLOps platform prices AI/inference separately. It's genuinely new product scope — not an incremental feature improvement.

**Rule:** AI/inference capabilities are always gated as extensions, never bundled into base pricing. AI Base (BYOK diagnostics) stays free — it's the hook. AI Pro ($99/yr) and AI Fleet ($499/yr/node) are separate line items. Decision #120.

**Corollary:** This applies to future capability expansions too. When a batch of decisions creates a new product surface (not just features on an existing surface), it should be priced as an extension, not absorbed into the base.

---

### 4. The Champion Credit is cheaper than the goodwill it buys

**What happened:** Gating AI Pro for Solo FM customers felt like nickel-and-diming ($99 add-on on a $149 product = 66% increase). But not gating it leaked $5.4K/yr in the base case.

**The solution:** Champion Credit — FM customers who have demonstrably advocated for Weaver (enterprise referral, testimonial, community contribution, org has Fabrick subscription) get AI Pro waived permanently.

**Why it works:** A Solo FM customer who refers a $46K/yr Fabrick deal gets $99/yr waived = 465:1 ROI on the waiver. The people who earn the waiver are exactly the people whose goodwill is worth far more than $99. Self-selecting, measurable, automatically scalable.

**Rule:** When a pricing decision creates friction for your best customers, look for a behavior-gated waiver before removing the gate entirely. The behavior you want to incentivize (championing) should pay for the waiver. Decision #120.

---

### 5. Value capture rate is the investor metric, not price

**What happened:** We asked "are we priced too low?" The answer wasn't about the absolute price — it was about the ratio of price to delivered value (capture rate).

**The insight:** Solo at $249/yr is *deliberately* low (1.9% capture). That's fine — it's pipeline. But Fabrick at $10,700/yr is *accidentally* low (12.8% capture). Industry norm is 20–35%. An investor sees Solo's capture rate and thinks "smart GTM." They see Fabrick's and think "why aren't you charging more for the thing that's supposed to make money?"

**Rule:** Track capture rate per tier at every version milestone. Solo should stay low (pipeline). Fabrick should trend toward 20% by v3.0. If capture rate stays flat while value doubles, the pricing steps aren't big enough. Communicate this to investors as "pricing headroom" — an asset, not a problem — but only if you can show the mechanism to close the gap (version steps, extension gating, success program repricing).

---

## Document Architecture

### 6. Product-level and corporate-level pitch decks are different documents

**What happened:** The Weaver pitch deck was sitting at the corporate level in the corp repo. It told the product story, not the company story.

**The gotcha:** An investor wants the company story first (portfolio thesis, Forge as multiplier, combined TAM, team, the ask). The product deep dive (TCO, competitive moat, feature architecture) is an appendix or a follow-up conversation. Having only a product deck at the corporate level meant the first thing an investor saw was "here's our NixOS VM product" instead of "here's why this company can build a product portfolio."

**Rule:** Three-deck model. Product decks own TCO, competitive landscape, and feature architecture. Corporate deck synthesizes portfolio thesis, Forge, combined financials, team, the ask. Corporate deck references product decks, never duplicates. When a product number changes, the corporate deck pulls the update — one source of truth per metric.

---

### 7. TCO analysis must be revised when architectural decisions change the value delivered

**What happened:** The TCO was written before Decisions #113–119. It showed $449K in 3-year value at 20 nodes. After the fleet bridge and inference platform decisions, the real number was $1.02M — but the TCO document still said $449K.

**The gotcha:** Every downstream document — V4 Funding Gap Analysis, PRICING-POWER-ANALYSIS, cashflow projections, pitch deck — referenced the old TCO numbers. The pricing looked reasonable against the old value; it looked severely underpriced against the new value. But no one noticed because the TCO wasn't updated.

**Rule:** TCO revision is a required output of any session that adds >$50K in annual value delivery. Not optional. Not "we'll get to it." The TCO feeds every pricing and investor document — stale TCO = stale everything downstream.

---

## FM Program Design

### 8. FM scope must be defined before features ship, not after

**What happened:** Decision #120 (AI extension gating) was made before v2.0 ships. No FM customer has received AI capabilities at their base rate. The gating can be announced cleanly as "new scope, separate pricing."

**The counterfactual:** If AI features had shipped as part of the base product first, then been gated retroactively, FM customers would rightfully feel cheated. "You gave me this, then took it away and charged for it" is a trust-destroying move.

**Rule:** Extension scope must be defined in the FM program documentation before the first feature in that extension ships. The announcement window is between "decision made" and "feature available." Once a feature is delivered at the base rate, it cannot be retroactively gated without breaking trust.

---

### 9. FM pricing that touches every document is a 25+ file change

**What happened:** Decision #121 (quantity caps) required updating 27 files across two repos — MASTER-PLAN, FM program, TIER-MANAGEMENT, RELEASE-ROADMAP, 2 value propositions, 11 vertical sales docs, IT-FOCUS master doc, cashflow-inputs.json, V4 gap analysis, pricing power analysis, cashflow projection, revenue waterfall, pitch deck, channel partner pitch.

**The gotcha:** Missing even one file means a sales doc or investor document contradicts the FM terms. An investor reading the pitch deck sees "first 200" but the channel partner pitch says "unlimited." That's a credibility problem.

**Rule:** FM pricing changes require a grep-based audit across both repos before marking complete. Pattern: `grep -rl '$149/yr' business/` and verify every hit has the cap. This is a mechanical process — build a checklist before making the change, not after.

---

## Investor Readiness

### 10. The architecture convergence story is the moat story

**What happened:** The feature growth chart showed volume (cumulative feature count per tier). But it didn't show *intent* — that every Weaver feature is a deliberate building block for Fabrick.

**The insight:** Five architectural threads (networking → fleet bridge, GPU → fleet scheduling, AI → fleet inference, storage → fleet snapshots, single host → clustering → HA) run from v1.0 through v3.0. Each starts as a Weaver capability and matures into Fabrick infrastructure. This isn't a feature-of-the-month product — it's a platform with compounding architectural value.

**Rule:** For investor conversations, lead with the convergence diagram, not the feature count. The convergence diagram answers "why should I believe v3.0 will work?" (because every piece is being built incrementally). The feature count chart answers "how much stuff do you have?" (which is less compelling).

---

### 11. Revenue waterfall > monthly cashflow for investor conversations

**What happened:** The cashflow projection showed monthly cash in/out. Useful for operations. Useless for investors — they can't see *which revenue streams are compounding* or *where the growth levers are*.

**The insight:** The revenue waterfall shows 7 distinct streams (software licensing, AI extensions, compliance export, success programs, channel partners, professional services) layering on top of each other across version milestones. An investor can see that v2.0 adds AI Pro, v2.2 adds AI Fleet + Team + Compliance Export, and success programs compound with enterprise attachment. That's a story. "$X MRR in month 18" is a number.

**Rule:** Build the waterfall before the investor conversation, even if the cashflow projection already exists. They answer different questions. Cashflow: "can you pay the bills?" Waterfall: "where does growth come from?"

---

## Operations

### 12. Directory reorgs silently break cross-references

**What happened:** The `business/` directory was reorganized from flat (`business/TIER-MANAGEMENT.md`) into functional subdirectories (`business/product/TIER-MANAGEMENT.md`, `business/legal/SECURITY-AUDIT.md`, etc.). Six automated checks — pricing cross-references, license key validation, tier matrix sync, cashflow freshness, and FM price verification — silently stopped running because the auditor scripts still referenced the old flat paths. The auditors printed "not found — skipping" and reported PASS.

**The gotcha:** The reorg was correct for organizational clarity. But the tooling that enforced consistency across those documents was hardcoded to the old structure. The checks that caught pricing drift, license key mismatches, and tier table divergence were the exact checks that went dark. For weeks, TIER-MANAGEMENT.md could have diverged from MASTER-PLAN.md with no automated signal.

**Rule:** Directory reorganizations are refactors — they need the same "grep for old references" discipline as a code rename. Before merging any directory move: (1) grep all scripts for the old path, (2) grep all markdown files for relative links to the old location, (3) run the full auditor suite and confirm the same number of checks execute before and after. If the "checks passed" count drops, something went quiet.

---

### 13. "Moved to X" stubs guarantee drift — use canonical-at-source + automated sync

**What happened:** When pitch decks were migrated from the product repo to the corporate repo, the product repo files were replaced with 6-line stubs ("Moved to Corp — canonical location: `wbd-corp-project/...`"). The full content now lived only in corp, away from the domain expertise.

**The gotcha:** Two failure modes:
1. **Content drifts from domain expertise.** The product repo is where tier strategy, competitive positioning, and technical differentiators are maintained daily. Moving the pitch deck to corp meant product updates (pricing changes, new features, new verticals) required going to a different repo to update the pitch deck — which nobody remembered to do.
2. **Stubs have no enforcement.** Nothing verified that corp's copy was current when product strategy changed. The stub said "moved to corp" but the corp copy could be months stale with no signal.

**Fix:** Canonical-at-source + automated sync. Product repos own the full pitch decks (10 slides, speaker notes, appendices). Corp runs `npm run sync:pitch-decks` via pre-commit hook to auto-generate reduced-footprint summaries (key capabilities, tier table, gaps, revenue line). Decision #12 (corp).

**Rule:** When the same document is needed in multiple repos, keep the canonical version where the domain expertise lives — not in the consuming repo. Automate the sync. Never use "moved to X" stubs — they are a promise with no enforcement. The pattern: canonical source → extraction script → reduced-footprint copy → auto-staged by hook.

**Corollary:** This is the same pattern as Weaver's sync-to-free workflow (dev repo → public mirror), but for documents instead of code. The principle is identical: one source of truth, automated propagation, consuming repo never directly edited.
