<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Terms of Service — Weaver Solo / Team / Fabrick

**Effective date:** 2026-04-05
**Last updated:** 2026-04-25
**Licensor:** whizBANG Developers LLC
**Applies to:** Weaver Solo, Weaver Team, and Fabrick tiers

These Terms of Service ("Terms") govern your use of Weaver under a commercial license, including the software, documentation, and any associated services provided by whizBANG Developers LLC ("Licensor," "we," "us").

By installing, accessing, or using Weaver under a commercial license key, you agree to these Terms. If you do not agree, do not use the software.

---

## 1. License

Weaver Solo, Team, and Fabrick tiers are distributed under the Business Source License 1.1 (BSL-1.1) with an AI Training Restriction add-on.

The complete license text is included with the software in the LICENSE file. These Terms supplement — but do not replace — the applicable license. Your license key identifies your tier and is non-transferable.

## 2. AI Training Restriction

You may not use any portion of the Software, its source code, documentation, API responses, or output data to train, fine-tune, or otherwise develop artificial intelligence or machine learning models. This restriction applies regardless of how the Software is accessed — via source code, binary, hosted service, API, or documentation.

**Exceptions:** (a) Using Weaver's built-in AI features (AI diagnostics, BYOK agent, AI Fleet) as intended; (b) Weaver's own development process under whizBANG Developers authorization.

## 3. Bring Your Own Key (BYOK)

### 3.1 User-Supplied API Keys

Weaver permits you to provide your own third-party API key ("BYOK Key") for use with the AI diagnostics feature. By entering a BYOK Key, you acknowledge and agree to the following terms.

### 3.2 Server-Side Credential Vault

Weaver Solo, Team, and Fabrick tiers include a server-side AI credential vault managed by the Weaver administrator. API keys stored in the vault are encrypted in the server database and accessible only to authorized users as configured by the administrator. The Licensor does not have access to vault contents.

### 3.3 Browser-Side BYOK Storage

For users who configure BYOK Keys directly in the browser (as opposed to using the server vault), those keys are stored in browser local storage on the user's device. The Licensor does not receive, transmit, store, process, or have access to browser-side BYOK Keys.

### 3.4 Your Responsibility

You are solely responsible for:

- (a) the security, rotation, and revocation of all API keys, whether vault-stored or browser-stored;
- (b) compliance with the terms of service of the third-party API provider (e.g., Anthropic's Acceptable Use Policy, Usage Policy, and Terms of Service);
- (c) all costs, charges, fees, and overages incurred through use of API keys under your account;
- (d) ensuring keys have appropriate rate limits, spending caps, and access restrictions;
- (e) the security of the server hosting the Weaver credential vault.

### 3.5 Third-Party Terms Pass-Through

Your use of a BYOK Key constitutes a direct relationship between you and the third-party API provider. The Licensor is not a party to that relationship.

### 3.6 Data Flow Transparency

When a BYOK Key is used, Weaver sends the key and diagnostic request directly to the third-party API endpoint — either from the server (vault mode) or from your browser (browser BYOK mode). The Licensor's servers are not involved in this communication.

## 4. Disclaimer of Warranty

THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. THE LICENSOR MAKES NO WARRANTY REGARDING THE SECURITY OF THE CREDENTIAL VAULT, THE AVAILABILITY OR PERFORMANCE OF THIRD-PARTY API SERVICES, OR THE ACCURACY OF AI-GENERATED OUTPUT.

This disclaimer extends to all features of the Software, including but not limited to BYOK, AI diagnostics, workload management, network topology, and all configuration interfaces.

## 5. Limitation of Liability

IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES ARISING FROM OR RELATED TO:

- (a) your use of or inability to use the Software;
- (b) unauthorized access to or use of API keys or credentials;
- (c) charges incurred on your third-party API account;
- (d) loss, corruption, or unavailability of data, configuration, or credentials;
- (e) actions taken by third-party service providers;
- (f) the content, accuracy, or consequences of AI-generated output;
- (g) any modification, suspension, or discontinuation of the Software.

## 6. Compliance Documents

Weaver provides security control mappings to industry standards (NIST 800-171, HIPAA, PCI DSS, CIS Benchmarks, SOC 2). These documents describe technical controls implemented in the software. They are **not** certification claims, audit attestations, or guarantees of compliance with any regulatory framework. You are responsible for verifying controls against your specific compliance requirements.

## 7. Changes to These Terms

We may update these Terms from time to time. The "Last updated" date at the top of this page reflects the most recent revision. Continued use of the Software after changes constitutes acceptance of the revised Terms.

## 8. Contact

For questions about these Terms, contact whizBANG Developers LLC at the address listed on the product website.

---
