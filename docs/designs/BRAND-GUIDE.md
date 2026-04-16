<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Weaver — Brand Guide

## Brand Hierarchy

```
whizBANG! Developers LLC (parent company)
  Mark: bomb (lit fuse)
  Color: #7AB800 (chartreuse green)
  Role: card borders, footer, copyright, about section, login attribution
  |
  |-- Weaver
  |     Mark: amber spark (born from the bomb's fuse)
  |     Color: #FF6B35 (amber)
  |     Role: header icon, nav highlights, action buttons, PWA icon
  |
  |-- Qepton (backfill)
  |     Mark: TBD + blue fuse spark on bomb
  |     Color: blue (existing)
  |
  |-- Gantry
  |     Mark: TBD + own fuse spark color on bomb
  |
  |-- Future products ...
        Pattern: own product mark + color, green company frame, bomb in footer/login/about
```

## Design Philosophy

**Two-tone brand system.** Every whizBANG! product has two color layers:

1. **Product color** — owns the header, nav, interactive controls, and the product mark. This is the identity users interact with daily.
2. **Company color** — owns the frame: card borders, footer badge, copyright, login attribution, about section. This is the subtle signature that says "a whizBANG! Developers LLC product."

The **bomb's fuse spark** is the bridge between the two. The fuse spark always matches the current product's color. The spark icon for Weaver literally came from the bomb's fuse — that's the narrative origin.

## Origin Story

Qepton (personal project, learn AI tooling) → Weaver (first commercial product, accidentally built the Forge methodology) → Gantry (first product conceived with the methodology). The brand system was established with Weaver and applies retroactively to all products.

## Color Tokens

### Product: Amber (Weaver)

| Token | Hex | Usage |
|-------|-----|-------|
| `$product-deep` | `#A83A08` | Spark base, dark gradients |
| `$product-on-light` | `#E8520D` | Primary on light backgrounds |
| `$product-primary` | `#FF6B35` | Header icon, nav highlight, buttons, active states |
| `$product-core` | `#FFB088` | Spark inner core glow |
| `$product-tip` | `#FFF0D0` | Spark white-hot tip |

### Fabrick — Deep Cobalt
- Hex: `#2E5CC8`
- Usage: Fabrick fleet control plane UI elements, Fabrick toolbar background, fleet-scope indicators
- Token: `$fabrick-color` / `.bg-fabrick`
- Emotion: authority, scale, trust — signals "you are now managing a fleet"

### Dual-Toolbar Pattern
When the Fabrick control plane bar sits above the Weaver workload bar, the two brand colors communicate hierarchy without text:
- **Cobalt bar** (top): fleet-scope context — you are in Fabrick
- **Amber bar** (below): host-scope context — you are in Weaver on this node

The color boundary alone communicates the context switch. No label needed.

### Company: Green (whizBANG!)

| Token | Hex | Usage |
|-------|-----|-------|
| `$company-primary` | `#7AB800` | whizBANG! wordmark, bomb ring |
| `$company-text-dk` | `#5A8A20` | "whiz" italic on dark backgrounds |
| `$company-text-lt` | `#4A7A10` | "BANG!" bold on light backgrounds |
| `$company-muted` | `#4A6A30` | Copyright text, "a ... product" text |
| `$company-border-dk` | `#2A4A20` | Card borders on dark mode |
| `$company-border-lt` | `#B8D4A8` | Card borders on light mode |
| `$company-divider-lt` | `#C0D8B0` | Divider lines on light mode |
| `$company-bg-dk` | `#1A2E10` | GitHub avatar background, badge bg |

### Semantic (Unchanged from Quasar)

| Token | Hex | Usage |
|-------|-----|-------|
| `$positive` | `#21ba45` | Running status, success states |
| `$negative` | `#c10015` | Failed status, errors, stop button |
| `$warning` | `#f2c037` | Warning states |
| `$secondary` | `#26a69a` | Secondary actions (existing teal) |
| `$dark` | `#1d1d1d` | Card backgrounds (dark mode) |
| `$dark-page` | `#121212` | Page background (dark mode) |

## Product Mark: Amber Spark

The spark is a geometric, angular flame — not organic curves. Built from overlapping triangular shapes with radiating spark particles. References the Firecracker microVM hypervisor without being derivative.

### Gradient (dark mode, top to bottom)
1. `#FFF0D0` — white-hot tip
2. `#FF6B35` — primary amber body
3. `#E8520D` — mid-tone
4. `#A83A08` — deep base

### Gradient (light mode, top to bottom)
1. `#FFB868` — warm tip
2. `#FF6B35` — primary
3. `#E8520D` — mid
4. `#A83A08` — base

### Inner core gradient
- White → `#FFD8B8` → `#FFB088` (the "hot center" effect)

### Spark particles
- 2-4 dots radiating from the flame body
- Same amber tones at reduced opacity (0.4–0.7)

### SVG glow filter (dark mode only)
- `feGaussianBlur` stdDeviation 2–3 on the body
- Optional corona: stdDeviation 6–8 at 12% opacity for large placements

### Sizes
| Context | Size | Detail level |
|---------|------|-------------|
| Toolbar icon | 28px | Body + core + 2 particles |
| PWA icon | 80px in 128px frame | Body + core + glow + 4 particles |
| Splash / marketing | 96px+ | Full detail: corona, glow, tip, particles |
| Favicon | 16–32px | Body only, no particles |

## Company Mark: Bomb

The bomb from the whizBANG! logo. Round black body with a lit fuse. The fuse spark color matches the current product.

### Construction
- **Body:** Dark radial gradient (`#3A3A3A` center → `#1A1A1A` edge), 1.5px stroke `#444`
- **Shine:** Offset ellipse at ~30% from center, `#444` at 40% opacity
- **Fuse nub:** Small rounded rect at the top-right of the body
- **Fuse:** Curved path (quadratic bezier) from nub upward, `#666` stroke
- **Fuse spark:** Product-colored circle with lighter inner dot
- **Green ring:** 0.5px stroke in `$company-border-dk` at 60% opacity around the body (optional, for larger sizes)

### Fuse Spark Color Rule
The bomb's fuse spark always matches the **current product's primary color**:
- Weaver: `#FF6B35` (amber)
- Qepton: blue (TBD exact value)
- Gantry: TBD
- The bomb body, fuse, and green ring stay constant across all products

### Sizes
| Context | Size | Detail level |
|---------|------|-------------|
| Footer badge | 16–18px | Body + fuse + spark dot |
| Login attribution | 14–16px | Body + fuse + spark dot |
| Help/about section | 72px | Full detail: shine, nub, spark particles, green ring |
| GitHub org avatar | 100px in circle | Full detail on dark green background |
| README badge | 12px | Body + fuse + spark dot (simplified) |
| 20px inline | 14px | Maximally simplified |

## Wordmark

### Product wordmark
- `Weaver` — Inter 600 (semibold), bright text (`#E0E0E0` dark / `#2A2A2A` light)

### Company wordmark
- `whiz` — Inter 400 italic, `$company-text-dk` / `$company-text-lt`
- `BANG` — Inter 700 bold, `$company-primary` dark / `$company-text-lt` light
- `!` — Same as BANG
- `Developers` — Inter 400, `$company-muted`

## Placement Rules

### Where the bomb appears
1. **App footer** — "a whizBANG! [bomb] Developers product" badge with green divider above
2. **Login page** — Company attribution below the form, separated by green divider
3. **Help page about section** — Full company info card with large bomb, description, and links
4. **PWA splash / loading** — Small, understated below the product mark at reduced opacity
5. **GitHub org avatar** — The org-level profile image on dark green circle
6. **README badges** — Shield-style repo badges (green left + product-colored right)
7. **whizbangdevelopers.com** — Site favicon and primary logo

### Where the bomb does NOT appear
- App header / toolbar (product spark territory)
- Navigation items
- VM cards or dashboard content area
- PWA app icon (that's the product spark)
- Anywhere it would compete with the product mark

### Card border rule
- All VM cards get `$company-border-dk` / `$company-border-lt` borders (whizBANG green frame)
- **Exception:** Failed VMs override to red-tinted border (`#4A2020` dark / `#E0B8B8` light)
- Stopped VMs keep green border (same as running — the green is company frame, not status)

### Footer structure
```
[green gradient divider line]
a  whizBANG! [bomb]  Developers product  |  (c) 2026 whizBANG Developers LLC
```

### Login page structure
```
[product spark icon — large]
[product wordmark]

[username field]
[password field]
[Sign In button in product color]

[green divider]
by whizBANG! [bomb] Developers
```

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Product name (`Weaver`) | Inter | 600 | 18px toolbar, 28-32px lockup |
| Company name (`whizBANG!`) | Inter | 400 italic + 700 | 11-12px footer, 20px about |
| Company label (`Developers`) | Inter | 400 | 10-16px |
| VM names | JetBrains Mono | 500 | 13px |
| Metadata (IP, memory) | System / Inter | 400 | 11px |

## Dark vs Light Mode Adaptations

| Element | Dark Mode | Light Mode |
|---------|-----------|------------|
| Spark gradient | White tip → amber → deep | Warm tip → amber → deep |
| Spark glow filter | Yes (stdDeviation 2-3) | No |
| Spark corona | Optional for large sizes | No |
| Product primary | `#FF6B35` | `#E8520D` |
| Company border | `#2A4A20` | `#B8D4A8` |
| Company text | `#7AB800` / `#5A8A20` | `#4A7A10` / `#5A8A20` |
| Bomb body | `#1A1A1A`–`#3A3A3A` | `#2A2A2A`–`#555` |
| Bomb fuse | `#666` stroke | `#888` stroke |
| Footer bg | `#161616` | `#F5F5F5` |
| Card bg | `#1d1d1d` | `#FFFFFF` |
| Page bg | `#121212` | `#FAFAFA` |

## Asset Files

All design mockups are in `docs/designs/`:

| File | Contents |
|------|----------|
| `brand-option3-spark.html` | Original amber spark exploration (icon, wordmark, TUI art, in-context) |
| `brand-option3-lightning.html` | Lightning/electric color variants (A: arc, B: iridescent, C: plasma) |
| `brand-header-compare.html` | Side-by-side: original amber vs electric arc (full app mockup) |
| `brand-header-green.html` | Green spark variant, dark + light (full app mockup) |
| `brand-header-amber-green.html` | Two-tone: amber spark + green chrome (full app mockup) |
| `brand-final-amber-wb.html` | Final direction: amber + whizBANG green frame (full app + color system) |
| `brand-final-with-bomb.html` | **Complete brand system** with bomb placements (footer, login, about, GitHub, README, PWA splash, placement rules, hierarchy) |
| `whizbang-brand-sheet.html` | **whizBANG! Developers LLC company brand sheet** (logo lockup with bomb below "!", bomb construction layers, fuse spark color rule, size guide, color palette, inline variants, GitHub avatar, README badges, usage rules, monochrome variants) |
| `brand-animation-phase1.html` | Phase 1 brand animation prototype (spark → fuse → explosion → product reveal) |

## Brand Animation (Future)

### Overview
Animated intro sequence: spark lights the bomb fuse → fuse burns → bomb explodes → product marks emerge from the blast. Built with SVG + GSAP (GreenSock). Usable as demo site intro, splash screen, or marketing asset.

### Phased Delivery

**Phase 1 — Weaver v1.0 Demo Site**
Single-product version. Ships with the demo site as the intro/splash animation.

Sequence:
1. Spark appears (fade in + glow pulse on dark background)
2. Spark travels along a motion path to the bomb's fuse
3. Fuse burns down (stroke-dashoffset animation with glowing orange trail)
4. Bomb swells (subtle scale pulse, anticipation)
5. Explosion (radial particle burst, bomb body dissolves)
6. Weaver amber spark emerges from the center, lands at hero position
7. `Weaver` wordmark resolves alongside the spark
8. Subtle "more coming soon" text fades in at reduced opacity
9. whizBANG! [bomb] badge fades in at the bottom

Duration target: 3–4 seconds. Skippable (click/tap to jump to end state).

**Phase 2 — Post-Gantry v1.0**
Multi-product version. The explosion spawns multiple product marks that fly outward and land in a grid or orbit.

Sequence (extends Phase 1 at step 6):
6. Multiple product marks emerge from explosion, each with a colored trail:
   - Amber spark (Weaver)
   - Blue mark (Qepton)
   - [color] mark (Gantry)
   - Additional products as they ship
7. Products land in a radial layout around the center
8. whizBANG! wordmark + bomb resolve at the center
9. "A collection of developers building tools for infrastructure, AI, and project management."

### Technical Approach

| Layer | Technology | Notes |
|-------|-----------|-------|
| Graphics | SVG | All marks, bomb, particles as SVG paths |
| Animation | GSAP (GreenSock) | Timeline sequencing, easing, stagger, motion paths |
| Particles | GSAP + manual scatter | Explosion particles: 20-30 SVG circles with randomized trajectories |
| Export (future) | Lottie via LottieFiles | After GSAP version is final, export to Lottie JSON for native app/mobile use |

### Implementation Notes
- Single self-contained HTML file (SVG + GSAP CDN)
- GSAP is free for non-commercial files, MIT-licensed for open source — verify license for demo site use
- `MotionPathPlugin` for spark-to-fuse travel, `DrawSVGPlugin` for fuse burn (Club GreenSock — evaluate free alternatives if needed)
- Skippable: click/tap handler jumps timeline to end state
- Responsive: SVG viewBox scales, animation timings stay constant
- Dark background only (matches demo site)

### Blocked Until
- Phase 1: Ready to implement now (Weaver v1.0 demo site work)
- Phase 2: After Gantry v1.0 ships (need 3+ product marks to justify the multi-product version)

## Template Pattern (for future products)

When creating a new whizBANG! product:

1. Choose a **product color** (not green — that's the company frame)
2. Design a **product mark** (icon shape unique to the product)
3. Apply the product color to: header, nav, buttons, PWA icon, action states
4. Apply the green frame to: card borders, footer badge, login attribution, about section
5. Set the bomb's fuse spark to the product color
6. Use the standard footer: "a whizBANG! [bomb] Developers product"
7. Use the standard login attribution: "by whizBANG! [bomb] Developers"
8. Add the bomb to the help/about section with company description

The product mark shape is unique per product. The structural template (where marks go, what colors go where) is universal.
