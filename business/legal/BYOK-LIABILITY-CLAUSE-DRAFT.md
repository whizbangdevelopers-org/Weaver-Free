<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->

# BYOK (Bring Your Own Key) Liability — Terms of Service Clause (Draft)

**Status:** Draft — requires attorney review before publication
**Date:** 2026-04-05
**Context:** Supplements the LICENSE file and AI Training Restriction ToS. Covers all tiers where BYOK is available (currently Weaver Free only). See Decision #30 (Insurance Principle), Decision #11 (AI agent tiers), Decision #138 (this document).

## Purpose

Weaver's BYOK feature allows users to provide their own third-party AI API key (e.g., Anthropic Claude) for AI diagnostics. The key is stored exclusively in the user's browser (localStorage) and is never transmitted to or stored on Weaver's servers. This ToS clause establishes the liability boundaries for BYOK usage.

## Background

| Aspect | Detail |
|--------|--------|
| **Feature** | BYOK — user enters their own AI vendor API key |
| **Storage** | Browser localStorage only — never leaves the client |
| **Tiers** | Weaver Free (5 req/min). Paid tiers use server-side credential vault instead (v1.4.0+) |
| **Security audit** | SEC-011 (BY-DESIGN) — localStorage is the only viable client-side persistence for PWA |
| **Insurance principle** | Decision #30 — Free tier = zero security features, zero liability exposure |

## Draft Clause

> ### Bring Your Own Key (BYOK)
>
> **1. User-Supplied API Keys.** Weaver permits you to provide your own third-party API key ("BYOK Key") for use with Weaver's AI diagnostics feature. By entering a BYOK Key, you acknowledge and agree to the following terms.
>
> **2. Client-Side Storage.** Your BYOK Key is stored exclusively in your web browser's local storage on your device. whizBANG Developers LLC ("Licensor") does not receive, transmit, store, process, or have access to your BYOK Key at any time. The Licensor cannot recover, reset, or revoke your BYOK Key.
>
> **3. Your Responsibility.** You are solely responsible for:
> - (a) the security, rotation, and revocation of your BYOK Key;
> - (b) compliance with the terms of service of the third-party API provider (e.g., Anthropic's Acceptable Use Policy, Usage Policy, and Terms of Service);
> - (c) all costs, charges, fees, and overages incurred through the use of your BYOK Key, regardless of whether such usage was authorized by you;
> - (d) ensuring your BYOK Key has appropriate rate limits, spending caps, and access restrictions as provided by your API vendor;
> - (e) not entering BYOK Keys on shared, public, or untrusted devices or browsers.
>
> **4. No Warranty for BYOK.** THE BYOK FEATURE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. THE LICENSOR MAKES NO WARRANTY REGARDING THE SECURITY OF BROWSER LOCAL STORAGE, THE AVAILABILITY OR PERFORMANCE OF THIRD-PARTY API SERVICES, OR THE ACCURACY OF AI-GENERATED OUTPUT.
>
> **5. Limitation of Liability.** IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES ARISING FROM OR RELATED TO:
> - (a) unauthorized access to or use of your BYOK Key;
> - (b) charges incurred on your third-party API account;
> - (c) loss, corruption, or unavailability of your BYOK Key due to browser data clearing, device loss, or any other cause;
> - (d) actions taken by the third-party API provider, including account suspension, rate limiting, or policy enforcement;
> - (e) the content, accuracy, or consequences of AI-generated output produced using your BYOK Key.
>
> **6. Third-Party Terms Pass-Through.** Your use of a BYOK Key constitutes a direct relationship between you and the third-party API provider. The Licensor is not a party to that relationship. The third-party provider's terms of service, acceptable use policies, and privacy policies apply to your use of their API through Weaver. The Licensor does not endorse, guarantee, or assume responsibility for any third-party API service.
>
> **7. Data Flow Transparency.** When you use a BYOK Key, Weaver sends your API key and the diagnostic request directly from your browser to the third-party API endpoint. The Licensor's servers are not involved in this communication. The Licensor does not log, intercept, or inspect BYOK API traffic.
>
> **8. Key Hygiene Recommendations.** The Licensor strongly recommends that you:
> - (a) use a dedicated API key with restricted permissions for Weaver (do not reuse keys from other applications);
> - (b) set spending caps and rate limits with your API vendor;
> - (c) rotate your BYOK Key periodically;
> - (d) clear your BYOK Key from Settings before using Weaver on any shared device;
> - (e) monitor your API vendor's usage dashboard for unexpected activity.
>
> **9. Paid Tier Alternative.** Weaver Solo, Weaver Team, and Fabrick tiers include a server-side AI credential vault managed by the Weaver administrator. This vault stores API keys in an encrypted database (SQLCipher) on the server, not in the browser. Users who require centralized key management, audit trails, or organizational control over AI API usage should upgrade to a paid tier.

## Placement (Implemented)

| Location | Status | Detail |
|----------|--------|--------|
| **In-product ToS** (`/docs/terms-of-service`) | Done | Full ToS rendered via DocsPage, linked from Compliance page |
| **Compliance page** | Done | "Terms of Service" card with link to full document |
| **Settings BYOK card** | Done | Summary disclaimer with "Full terms" link to `/docs/terms-of-service` |
| **AgentDialog BYOK prompt** | Done | Summary disclaimer with "Terms of Service" link |
| **Help page FAQ** | Done | "What is BYOK?" entry expanded with liability language |
| **Product website ToS** | Pending | Publish when WBD website Divi pages go live |
| **Demo site** | Done | Visible in both public and private demo via Compliance page |

## In-Product Disclaimer Text (Summary)

For use in the Settings page BYOK card and AgentDialog:

> **Your key, your responsibility.** Your API key is stored in your browser only — Weaver never sees or stores it. You are responsible for your key's security and all costs incurred through its use. Third-party API provider terms apply. See [Terms of Service] for full details.

## Interaction with Other Legal Documents

| Document | Interaction |
|----------|------------|
| **AGPL-3.0 LICENSE** | Generic warranty disclaimer covers BYOK; this clause adds specificity |
| **BSL-1.1 (paid tiers)** | Paid tiers don't use BYOK; credential vault has separate liability terms |
| **AI Training Restriction** | Orthogonal — BYOK usage does not grant training rights on output |
| **Security Audit (SEC-011)** | BY-DESIGN disposition references this clause as the liability framework |
| **Insurance Principle (#30)** | BYOK is Free-tier only = zero liability exposure; this clause codifies that |

## Legal Review Notes

- Attorney should confirm enforceability of the limitation of liability clause for BYOK in jurisdictions where Weaver is distributed (US, EU, UK, Australia minimum)
- Review whether the "pass-through" of third-party terms (§6) requires explicit user consent beyond ToS acceptance
- Confirm that the "AS IS" warranty disclaimer is sufficient under consumer protection laws in the EU (where such disclaimers may be limited)
- Review interaction with GDPR — the BYOK Key is personally identifiable data (it identifies the user's API account). Confirm that client-side-only storage with no server transmission satisfies "no processing by controller" under GDPR
- Consider whether BYOK usage should require a separate click-through acceptance (e.g., checkbox: "I understand my API key is stored in my browser only and I am responsible for its security and costs") or if inclusion in the ToS is sufficient
- Review whether §7 (Data Flow Transparency) needs to account for future server-side BYOK relay scenarios (e.g., if CORS restrictions ever require proxying BYOK requests through the backend)
- Confirm this clause should be batched with the LICENSE-PAID-DRAFT.md attorney review

## Decision Reference

This document formalizes **Decision #138** in the MASTER-PLAN:
- BYOK liability boundary defined and documented
- In-product disclaimers required on all BYOK UI surfaces
- Attorney review batched with LICENSE-PAID-DRAFT.md and AI-TRAINING-RESTRICTION-TOS.md
