<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: {ID} — {Campaign / Content Name}

**Plan:** [{PLAN-NAME}]({path-to-plan})
**Parallelizable:** {Yes (independent) / After {dependency}}
**Blocks:** {None / {what depends on this}}

---

## Scope

{What content or infrastructure is being created and why. 1-3 paragraphs.}
{What launch moment or milestone does this support?}

---

## Target Audience

<!-- WHO consumes this content. Be specific — different audiences need different messaging. -->

| Segment | Profile | Key message |
|---------|---------|-------------|
| {e.g., NixOS users} | {technical level, motivations} | {what resonates with them} |
| {e.g., homelab enthusiasts} | {technical level, motivations} | {what resonates with them} |

---

## Context to Read Before Starting

<!-- Research and positioning docs the agent needs before writing anything. -->
<!-- Include: business analysis, competitive analysis, demographics, existing content. -->

| File | Why |
|------|-----|
| {README, existing content} | Current state to improve or replace |
| {business/marketing analysis} | Positioning, taglines, segment messaging |
| {competitive analysis} | Differentiators, fair comparison data |
| {demographics/audience research} | Who we're talking to |
| {launch plan} | Timeline, channels, coordinated messaging |

---

## Inputs

<!-- What must exist before this agent starts. Product state, research, assets. -->

- {v1.0 feature set complete (or: feature list finalized)}
- {Business analysis with positioning statements}
- {Competitive analysis with feature comparisons}
- {Screenshots / demo site available for linking}

---

## Outputs

<!-- Group by content type. Each group gets its own table. -->
<!-- Be specific about format, length, and target channel for each piece. -->

### {Content Category 1: e.g., README Files}

| File / Artifact | Target | Description |
|-----------------|--------|-------------|
| {file path or artifact name} | {repo / channel / platform} | {what it contains, format, length} |

### {Content Category 2: e.g., Blog Posts}

| # | Title | Length | Target Channel |
|---|-------|--------|----------------|
| 1 | {title} | {~N words} | {dev.to, blog, etc.} |

### {Content Category 3: e.g., Community Posts}

| Channel | Format | Key Message |
|---------|--------|-------------|
| {r/NixOS, HN, Discourse, etc.} | {text post, image+text, link post} | {1-line pitch for this audience} |

### {Content Category 4: e.g., Comparison Pages}

| File | Content |
|------|---------|
| {path} | {what's compared, format} |

### {Content Category 5: e.g., Build & Deploy Infrastructure}

<!-- If the GTM agent builds infrastructure (demo site, deploy workflows), list here. -->

| File | Type | Description |
|------|------|-------------|
| {scripts/, .github/workflows/} | New/Modify | {what it does} |

---

## Content Guidelines

<!-- Quality gate for all content produced by this agent. -->
<!-- Equivalent to Safety Rules in feature agents. -->

- **Tone:** {e.g., Technical but approachable. Not corporate. Developer-to-developer.}
- **Honesty:** {e.g., Don't overstate capabilities. Be upfront about limitations.}
- **Comparisons:** {e.g., Fair and factual. Acknowledge competitor strengths.}
- **Accuracy:** {e.g., All feature claims must match current shipped product, not roadmap.}
- **CTA:** {e.g., Every piece includes link to: repo, demo site, docs.}
- **Confidentiality:** {e.g., No internal-only information in public-facing content. No pricing before launch.}

---

## Distribution Channels

<!-- WHERE and WHEN content gets published. -->
<!-- Coordinated timing matters for launch impact. -->

| Channel | Content piece | Timing | Notes |
|---------|--------------|--------|-------|
| {GitHub} | {README} | {Day 0: release tag} | {auto-published via sync workflow} |
| {r/NixOS} | {community post} | {Day 1: morning} | {text post, not link spam} |
| {Hacker News} | {Show HN} | {Day 1: afternoon} | {link to blog post or demo} |

---

## Acceptance Criteria

<!-- Content quality checks. Each deliverable should have a verifiable criterion. -->

1. {Content renders correctly on target platform (GitHub markdown, blog CMS, etc.)}
2. {All links resolve (repo, demo, docs, install guide)}
3. {Screenshots current and match shipped product}
4. {No internal-only information in public-facing content}
5. {Tone consistent across all pieces}
6. {Each piece reviewed against Content Guidelines}
7. {All content reviewed for consistency with business positioning}

---

## Estimated Effort

| Deliverable | Estimate |
|-------------|----------|
| {Content category 1} | {time} |
| {Content category 2} | {time} |
| {Review + screenshots} | {time} |
| **Total** | **{time}** |
