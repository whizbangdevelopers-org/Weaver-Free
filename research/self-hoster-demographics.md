<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Self-Hoster & Homelab Demographics: Employment & Profession Analysis

**Last updated:** 2026-02-12

> Supporting research for Weaver business planning.
> Compiled February 2026 from publicly available survey data.

## Key Finding: ~81% Work in Technology

The selfh.st annual surveys — the largest dedicated self-hosting community surveys — consistently show that approximately 80% of self-hosters work in technology-related fields.

| Year | In Tech Field | Not in Tech Field | Total Responses |
|------|--------------|-------------------|-----------------|
| 2023 | **79%** (1,481) | 21% (388) | ~1,900 |
| 2024 | **82%** (2,780) | 18% (620) | ~3,700 |
| 2025 | **81%** (3,227) | 19% (778) | 4,081 |

Sources: [selfh.st 2025](https://selfh.st/survey/2025-results/), [2024](https://selfh.st/survey/2024-results/), [2023](https://selfh.st/survey/2023-results/)

## NixOS User Demographics

NixOS users are significantly more tech-professional than the general self-hosting community.

**Nix Community Survey 2024** (2,290 responses):

| Metric | Value |
|--------|-------|
| Full-stack developers | 20% |
| Students | 19% |
| Backend developers | 14% |
| Other technical roles | ~47% combined |
| 10+ years programming experience | 52% |
| Never programmed | ~3% |
| Use Nix for home servers | 55% |
| Use Nix for work | 57% |
| Use Nix for personal projects | 88% |

The gap between personal use (88%) and work use (57%) suggests many NixOS users want to use it at work but either deem it not ready or it isn't part of their employer's stack.

**NixOS as self-hosting OS** (deployn.de surveys 2024-2025):
- ~3% of self-hosters use NixOS as their server OS
- ~3.8% use NixOS as their daily-driver Linux distro
- Ranks 4th behind Debian, Ubuntu, and Arch

Sources: [Nix Survey 2024](https://discourse.nixos.org/t/nix-community-survey-2024-results/55403), [Nix Survey 2023](https://discourse.nixos.org/t/nix-community-survey-2023-results/33124), [deployn.de 2025](https://selfhosted-survey-2025.deployn.de/)

## Self-Hosting Usage Context

From the deployn.de surveys, self-hosters use their infrastructure for:

| Purpose | % of Respondents |
|---------|-----------------|
| Personal/private use | 93-98% |
| Family | 66-69% |
| Friends | 36-42% |
| Business | 11.2% |
| Work | 8.1% |

Note: Only 8-11% use their self-hosted setup for business/work purposes, despite ~80% working in tech professionally. Self-hosting is primarily a personal/hobby activity.

## Estimated Employment Breakdown

No single survey breaks down the "81% in tech" into sub-categories. The following estimates are synthesized from cross-referencing multiple sources:

| Category | Estimated % | Evidence Basis |
|----------|------------|----------------|
| IT/tech companies (employed professionally) | ~50-55% | selfh.st tech field data + Nix survey role distribution |
| IT/tech department at non-IT business | ~15-20% | Subset of selfh.st "tech field"; sysadmins, internal IT, corporate DevOps |
| Students (CS/IT related) | ~10-15% | Nix survey: 19% students; deployn surveys show younger demographic |
| Own business (IT consulting, MSP, freelance) | ~5-10% | deployn: 11% self-host for business; market research identifies this segment |
| Non-IT professionals (self-hosting as hobby) | ~15-20% | selfh.st: consistent 19-21% in non-technology fields |
| Retired IT professionals | ~3-5% | Average age 38-39 suggests small but present retired segment |

## Homelab Market Segmentation (Commercial Research)

From market.us and Market Research Future reports:

- **Professionals**: >57% of market share by spending (2023)
- **Home users**: ~43% (tech enthusiasts, self-hosters, students, DIY)

Note: This is by revenue/spending, not headcount. Professionals spend more per person, so the headcount split skews further toward home users.

Sources: [market.us Homelab Report](https://market.us/report/homelab-market/)

## Community Growth

| Community | Size | Growth |
|-----------|------|--------|
| r/homelab | 903k members | 3.6x in 6 years |
| r/selfhosted | 136k+ members | 62% growth in 1 year |
| Self-hosting market | $15.6B (2024) | Projected $85.2B by 2034 (18.5% CAGR) |
| Homelab market | $6.8B (2025) | Projected $13.4B by 2035 |

## Other Demographics

From deployn.de surveys (2024-2025):

- **Average age**: 38-39 years
- **Experience**: 30.5% have 1-3 years; 12.6% have 10+ years
- **Containerization**: 98.3% use containers
- **Internet exposure**: 68.3% expose services to the internet
- **Motivation**: Fun/hobby (31%), privacy (17%), independence (17%), data control (12%), learning (12%)
- **Survey source**: 88-92% of respondents came from Reddit

## Data Gaps & Opportunities

The following data points are **not available** from any published survey:

1. **Detailed role breakdown** within "technology field" (developer vs sysadmin vs DevOps vs IT support vs management)
2. **Company size** where self-hosters are employed
3. **Income/budget** for self-hosting infrastructure
4. **IT business vs IT department at non-IT company** distinction
5. **Self-employed vs employed** within the tech category
6. **Geographic distribution** of employment types

These gaps present an opportunity: running a targeted demographic survey as part of Weaver community engagement could provide unique market intelligence while building early community relationships.

## Caveats

1. **Self-selection bias**: Survey respondents (especially from Reddit) are likely more technically engaged than the broader self-hosting population.
2. **Binary question limitation**: The selfh.st "technology field yes/no" question does not distinguish between sub-categories of tech employment.
3. **NixOS skew**: NixOS community demographics should not be directly applied to self-hosters broadly — NixOS users are significantly more developer-heavy.
4. **No r/homelab census**: Despite 903k members, r/homelab has not conducted a formal published demographic survey.
5. **No YouTube creator data**: Homelab YouTubers (Techno Tim, Jeff Geerling, NetworkChuck) have not published audience demographic breakdowns.
