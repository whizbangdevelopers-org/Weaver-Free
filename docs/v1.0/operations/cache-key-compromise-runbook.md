<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

---
runbook: cache-key-compromise
status: draft
version_target: v2.3.0
rehearsal_required: true
decision_refs: ["#147", "#149"]
compliance_refs:
  - framework: NIST 800-171
    controls: ["3.6.1", "3.6.2", "3.6.3"]
  - framework: HIPAA 164.308
    controls: ["(a)(6)(ii)"]
  - framework: CIS Controls v8.1
    controls: ["17.4"]
  - framework: PCI DSS v4.0
    controls: ["12.10.1", "12.10.3"]
  - framework: SOC 2
    controls: ["CC7.3", "CC7.4"]
api_endpoints_referenced:
  - POST /api/cache/keys/compromise
  - POST /api/cache/keys/rotate
  - POST /api/cache/keys/:id/retire
  - GET /api/cache/keys
  - GET /api/cache/health
  - GET /api/audit
systemd_units_referenced:
  - weaver-cache.service
  - weaver-cache-substituter-writer.service
  - attic-server.service
audit_events_referenced:
  - cache.key.compromise
  - cache.key.rotate
  - cache.key.retire
  - cache.approve
  - cache.build
  - cache.fetch
config_keys_referenced:
  - services.weaver.cache.dataDir
  - services.weaver.cache.signingKey.rotation.policy
sops_paths_referenced:
  - /var/lib/weaver/sops/cache-signing-key.age
---

# Runbook: Private Nix Cache Signing Key Compromise

> **⚠ DRAFT — v2.3 feature.** This runbook documents incident response procedures for a cache signing key compromise. The v2.3 Private Nix Cache feature (Decision #147) is planned for v2.3.0 and NOT YET IMPLEMENTED. This runbook will be **rehearsed in dev before v2.3 ship**, and any friction points found during rehearsal will become v2.3 code changes. The authoritative post-v2.3 version will correct any commands that differed from implementation reality.
>
> **Do not rely on this runbook for actual incident response before v2.3 ships.** If you encounter a cache key compromise in a pre-v2.3 environment, there is no private cache feature yet — the system uses standard `cache.nixos.org` substituters and no approval allowlist.

---

## 1. Purpose and Scope

This runbook covers **compromise of the Attic signing key used by the Weaver Private Nix Cache (Decision #147)**. A compromise means:

- The private signing key material has been exposed outside sops-nix (leaked, copied, exfiltrated)
- OR: an attacker has gained the ability to sign arbitrary NAR objects with the current active key
- OR: an insider with legitimate key access has been terminated/role-changed and the key must be assumed compromised

**This runbook does NOT cover:**

- Routine key rotation (see `docs/operations/cache-key-rotation-runbook.md` — separate runbook)
- Host compromise without key exposure (see generic incident response)
- Non-cache service compromise (JWT signing, sops-nix, TLS — separate runbooks)
- Data breach of backed-up cache contents (see `docs/operations/backup-incident-runbook.md` — v2.5 feature)

**Applicability:**

- **Weaver Solo:** single-host private cache; runbook applies to one cache instance
- **Weaver Team:** peer-federated cache (up to 2 peers + primary); runbook applies to the entire peer group — ALL peers must be rotated in coordination
- **FabricK:** fleet-scope caches; runbook applies to each affected cache in the fleet — v2.4 automation will orchestrate multi-cache compromise response

---

## 2. Prerequisites

Before invoking this runbook, confirm:

- **Role:** you have Admin role on the affected Weaver host(s)
- **Access:** SSH to the host, sudo access to the `weaver` service user, sops-nix age key access
- **Audit retention:** the audit log has at least 90 days of history for blast-radius analysis
- **Backup:** the Weaver configuration is backed up per `plans/v2.5.0/EXECUTION-ROADMAP.md` (Backup Weaver compliance-complete) — if not, you may lose approval records during recovery
- **Communication channel:** you have a secure out-of-band channel (phone, encrypted chat) to coordinate with other admins on Team peer groups
- **Time window:** expect 1–4 hours of downtime for the cache depending on cache size (rehearsal will calibrate actual timing)

**Do NOT start this runbook if:**

- You are a single admin on a Team peer group AND the two-person rule is enabled (`services.weaver.cache.ingestion.binaryUpload.requireTwoPersonApproval = true`) — recovery requires a second admin to approve the compromise flow. Contact your organization's secondary admin first.
- You cannot confirm whether this is a real compromise (proceed to Section 3 — Assessment).

---

## 3. Assessment — Is This Actually a Compromise?

Distinguish compromise from other incidents before starting recovery. Compromise is the **highest-cost, slowest** recovery path — don't invoke it unnecessarily.

### 3.1 Compromise indicators (any one triggers runbook)

- [ ] Sops-nix age key file has been accessed by a non-Weaver process (check `/var/log/audit/audit.log` for open events on `/var/lib/weaver/sops/cache-signing-key.age`)
- [ ] Sops-nix age key file has been copied off the host (network egress to unknown destination from the weaver service account)
- [ ] An unknown signed NAR appears in Attic that was not produced by an approved package build
- [ ] `cache.build` audit event references a `signed_by_key_id` that doesn't match the currently active key and the key hasn't been rotated recently
- [ ] A former admin (with historical sops-nix access) has been terminated and key material may have been retained
- [ ] Intelligence from a vendor, CERT, or threat-sharing group indicates the signing key has been exposed

### 3.2 NOT compromise (different runbook)

- [ ] Routine rotation interval reached → use the rotation runbook, not this one
- [ ] A dormant key alert fired but investigation shows a legitimate delayed build → see dormant-key triage note
- [ ] A package was approved in error → use the revocation procedure, not compromise

### 3.3 Decision

If any 3.1 indicator is confirmed, **proceed to Section 4**. If only 3.2 indicators are present, **stop this runbook** and invoke the appropriate other runbook. If uncertain, **stop and escalate** — over-invoking compromise is expensive but under-invoking can lose audit evidence.

---

## 4. Incident Response Steps

**Order matters.** Steps are numbered and must execute in sequence. Rollback points are marked with ⏪.

### Step 4.1 — Block new approvals (immediate, < 1 min)

Prevent any new packages from being approved while investigation is underway. This stops the attacker from signing additional malicious content if they still have access.

```bash
# Stop accepting new approvals at the API layer
curl -X POST https://{{WEAVER_HOST}}/api/cache/lock \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  -H "Content-Type: application/json" \
  -d '{"reason": "compromise-response", "runbook_step": "4.1"}'
```

Expected: HTTP 200 with `locked_at` timestamp. Verify in audit log:

```bash
curl https://{{WEAVER_HOST}}/api/audit?type=cache.lock -H "Authorization: Bearer $(cat ~/.weaver/admin-token)"
```

⏪ **Rollback point:** if assessment is wrong, `POST /api/cache/unlock` with the same auth restores approval capability.

### Step 4.2 — Snapshot current state for forensics (5–10 min)

Preserve the audit trail, the current signing key metadata, and the list of objects signed by the compromised key. This snapshot is **compliance evidence** (NIST 800-171 3.6.1 — "establish incident-handling capability") and **forensic input** for post-incident review.

```bash
# Export audit log for the last 90 days
curl "https://{{WEAVER_HOST}}/api/audit?type=cache.&limit=10000&since=$(date -d '90 days ago' -Iseconds)" \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  > /tmp/weaver-compromise-audit-$(date +%Y%m%d-%H%M%S).json

# List all signing keys (active and retired)
curl https://{{WEAVER_HOST}}/api/cache/keys \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  > /tmp/weaver-compromise-keys-$(date +%Y%m%d-%H%M%S).json

# List all objects signed by the compromised key (v2.3: filter by signed_by_key_id)
curl "https://{{WEAVER_HOST}}/api/cache/objects?signed_by_key_id={{COMPROMISED_KEY_ID}}" \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  > /tmp/weaver-compromise-objects-$(date +%Y%m%d-%H%M%S).json
```

Store these files **outside** the affected host — copy to a separate forensics-dedicated machine or encrypted cloud storage. They are your proof-of-state for the post-incident review.

⏪ **Rollback point:** none — snapshotting is additive, no state change.

### Step 4.3 — Assess blast radius (10–30 min)

How many objects are signed by the compromised key? Which hosts have pulled those objects? Which workloads are running software that was installed from those objects?

```bash
# Count affected objects
jq '.objects | length' /tmp/weaver-compromise-objects-*.json

# List downstream pulls (which hosts have fetched compromised objects)
curl "https://{{WEAVER_HOST}}/api/audit?type=cache.fetch&signed_by_key_id={{COMPROMISED_KEY_ID}}" \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  | jq '.events[].host' | sort -u
```

**Decision point:** if the blast radius includes workloads on hosts outside your immediate control (Team peer, FabricK fleet agents), contact the operators of those hosts via your out-of-band channel BEFORE proceeding to Step 4.4. Coordinated recovery is safer than independent recovery.

⏪ **Rollback point:** none.

### Step 4.4 — Generate new signing key (2 min)

Generate a new key **before** revoking the old one. The new key must exist to sign the re-signed objects in Step 4.5.

```bash
curl -X POST https://{{WEAVER_HOST}}/api/cache/keys/rotate \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "compromise-response",
    "incident_id": "{{INCIDENT_ID}}",
    "runbook_step": "4.4"
  }'
```

Expected: HTTP 200 with new `key_id`, public key, and `created_at` timestamp. The new key is added to `trusted_public_keys` alongside the compromised key (add-only model — both keys are trusted until Step 4.6 removes the compromised one).

Verify:
- New key appears in `cache_signing_keys` table with `is_active = true`
- Old (compromised) key is still `is_active = false` but present in trust list
- Audit event `cache.key.rotate` recorded with `reason = compromise-response`

⏪ **Rollback point:** if the new key generation fails or has corrupted material, `POST /api/cache/keys/:new_id/retire` removes it from the trust list and deletes its private material. The compromised key is still active — you're back where you started, try again.

### Step 4.5 — Atomic re-sign of affected objects (30 min – 3 hr)

This is the longest step. Every object signed by the compromised key must be re-signed with the new active key. During re-signing, the cache remains available for reads (objects can be pulled) but not for writes (the lock from Step 4.1 is still in effect).

```bash
curl -X POST https://{{WEAVER_HOST}}/api/cache/keys/compromise \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "compromised_key_id": "{{COMPROMISED_KEY_ID}}",
    "new_key_id": "{{NEW_KEY_ID_FROM_STEP_4_4}}",
    "incident_id": "{{INCIDENT_ID}}",
    "mode": "atomic"
  }'
```

Expected: HTTP 202 (accepted, long-running) with a `job_id`. Monitor progress:

```bash
curl "https://{{WEAVER_HOST}}/api/cache/keys/compromise/{{JOB_ID}}" \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)"
```

Status progression: `queued → running → re-signing-<N>/<total> → finalizing → complete`.

**Timing calibration (rehearsal will validate):**

- Small cache (<100 objects, ~1 GB): 30 min
- Medium cache (100–1000 objects, 1–10 GB): 1 hr
- Large cache (1000–5000 objects, 10–50 GB): 2–3 hr
- Team peer group: timings multiply by peer count (~2× for Team, 3× for 3-peer group) — federation replication amplifies work

**During re-signing:**

- DO NOT rotate keys again (second rotation during re-sign creates ordering ambiguity)
- DO NOT accept new approvals (still locked from 4.1)
- DO NOT retire the compromised key yet (Step 4.6 handles that after re-sign completes)
- Monitor the `cache.key.compromise` audit event stream for progress

⏪ **Rollback point:** if re-sign fails mid-flight, the job reports `failed` with a partial-state marker. The cache is left in a "mixed signature" state: some objects re-signed with new key, some still signed with compromised key. **DO NOT retire the compromised key in this state.** Resume with `POST /api/cache/keys/compromise/:job_id/resume` or, if resume is not possible, `POST /api/cache/keys/compromise/:job_id/rollback` to mark the new key as retired and unlock the cache in its original state. Escalate to WBD support if rollback fails.

### Step 4.6 — Retire the compromised key (1 min)

Once re-sign is complete and all objects reference the new key, remove the compromised key from the trust list. This is **irreversible** — after this step, the compromised key can no longer be used to verify any cached content.

```bash
curl -X POST https://{{WEAVER_HOST}}/api/cache/keys/{{COMPROMISED_KEY_ID}}/retire \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "compromise",
    "incident_id": "{{INCIDENT_ID}}",
    "preflight_override": false
  }'
```

The retire API runs a **preflight check**: if any object is still signed by this key, the retire is rejected with HTTP 409. If Step 4.5 completed correctly, preflight passes. If it didn't, **STOP** — do not use `preflight_override: true` unless WBD support has analyzed the mixed-signature state and determined it's safe.

Expected: HTTP 200 with confirmation that the key is removed from trust list AND sops-nix private material is deleted.

Verify the sops-nix deletion:

```bash
# The file should no longer exist
sudo -u weaver test -f /var/lib/weaver/sops/cache-signing-key-{{COMPROMISED_KEY_ID}}.age
echo $?  # Should be 1 (file not found)
```

⏪ **Rollback point:** after Step 4.6 completes, there is NO rollback. The compromised key's private material has been physically deleted from sops-nix and cannot be recovered. Any object that was not re-signed in Step 4.5 becomes unverifiable (Nix will reject it at install time).

### Step 4.7 — Unlock approvals (1 min)

Re-enable approvals so normal operations can resume.

```bash
curl -X POST https://{{WEAVER_HOST}}/api/cache/unlock \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "{{INCIDENT_ID}}",
    "runbook_step": "4.7"
  }'
```

Verify by approving a test package (use a known-safe nixpkgs derivation) and confirming the flow works end-to-end.

⏪ **Rollback point:** re-lock with `POST /api/cache/lock` if any follow-up issue appears.

### Step 4.8 — Verify Team peer group sync (Team+ only, 5 min)

If this is a Team peer-group cache, verify that all peers have converged on the new key state:

```bash
# On each peer in the group, check that:
# 1. The compromised key is NOT in cache_signing_keys table (or has is_active=false AND retired_at set)
# 2. The new key IS in cache_signing_keys with is_active=true
# 3. The approval_records table references only new_key_id for signed_by_key_id on recent entries
curl https://{{PEER_HOST}}/api/cache/keys -H "Authorization: Bearer $(cat ~/.weaver/admin-token)"
curl https://{{PEER_HOST}}/api/cache/health -H "Authorization: Bearer $(cat ~/.weaver/admin-token)"
```

If a peer shows the compromised key as still active, the peer federation replication failed — invoke the peer re-sync procedure (separate troubleshooting runbook).

### Step 4.9 — Generate post-incident evidence bundle (10 min)

Collect everything for compliance review:

```bash
INCIDENT_DIR=/tmp/weaver-compromise-$(date +%Y%m%d-%H%M%S)
mkdir -p $INCIDENT_DIR
cp /tmp/weaver-compromise-audit-*.json $INCIDENT_DIR/
cp /tmp/weaver-compromise-keys-*.json $INCIDENT_DIR/
cp /tmp/weaver-compromise-objects-*.json $INCIDENT_DIR/

curl "https://{{WEAVER_HOST}}/api/audit?incident_id={{INCIDENT_ID}}" \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  > $INCIDENT_DIR/incident-events.json

curl https://{{WEAVER_HOST}}/api/cache/health \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)" \
  > $INCIDENT_DIR/post-incident-health.json

tar czf $INCIDENT_DIR.tar.gz $INCIDENT_DIR
```

Store the evidence bundle per your organization's incident-retention policy. Minimum retention per common compliance frameworks:

- **HIPAA §164.316(b)(2)(i):** 6 years from creation or last effective date
- **PCI DSS 10.5.1:** 1 year with 3 months immediately available
- **NIST 800-171 3.3.1:** per organizational retention schedule
- **CMMC L2:** per §A.03.03.01 (equivalent to 800-171)
- **SOX § 802:** 7 years for audit-related records

---

## 5. Post-Incident Actions (next 24–72 hours)

Actions that must happen after the immediate recovery but are not part of the urgent incident timeline.

### 5.1 — Root-cause analysis

Determine how the key was compromised:

- [ ] sops-nix age key exposure (how? where? who?)
- [ ] Insider access (terminated employee retained key material)
- [ ] Host compromise (attacker gained root)
- [ ] Supply chain (compromised sops-nix dependency)
- [ ] Unknown / undeterminable

Document findings in the incident report. If the root cause is a systemic issue (e.g., sops-nix age key distribution, admin offboarding process), file a follow-up ticket.

### 5.2 — Regulatory reporting (check each framework)

Depending on the data processed by affected workloads and applicable frameworks:

- **HIPAA §164.400 Breach Notification Rule:** if ePHI-processing workloads pulled compromised binaries, this may be a reportable breach. Consult legal. 60 days max to notify affected individuals.
- **DFARS 252.204-7012:** if CUI-processing systems affected, DC3 must be notified within 72 hours. 90-day image preservation applies.
- **PCI DSS 12.10.1:** incident response plan must be followed; card brands notified if CDE affected.
- **GDPR Art. 33:** 72-hour notification to supervisory authority if personal data affected.
- **SEC Cybersecurity Disclosure Rule (2023):** material cybersecurity incidents require 8-K filing within 4 business days for public companies.
- **State breach notification laws:** varies by state; consult legal.

### 5.3 — Re-validate trust list (grep for orphans)

The audit system should flag any `cache.build` or `cache.fetch` event in the next 90 days that references the retired compromised key. There should be none. If any appear, investigate immediately — it means either (a) the retire didn't propagate correctly, or (b) a replay attack is in progress.

```bash
# Weekly check for 90 days post-incident
curl "https://{{WEAVER_HOST}}/api/audit?type=cache.build&signed_by_key_id={{COMPROMISED_KEY_ID}}&since=$(date -d '1 week ago' -Iseconds)" \
  -H "Authorization: Bearer $(cat ~/.weaver/admin-token)"
```

### 5.4 — Update this runbook

If any step surfaced friction, missing commands, or unclear ordering, update this runbook immediately while the experience is fresh. Every rehearsal and every real incident is an opportunity to improve the runbook.

---

## 6. Abort Criteria

Stop this runbook and escalate to WBD support if:

- Step 4.5 (atomic re-sign) fails and rollback also fails
- Step 4.6 (retire) preflight fails unexpectedly (indicates Step 4.5 was incomplete)
- Sops-nix shows key material that shouldn't exist (indicates backup/restore happened mid-incident)
- Team peer group refuses to converge after Step 4.8
- You cannot distinguish the compromised key from the new active key in the `cache_signing_keys` table

**Escalation path:** email `security@whizbangdevelopers.com` with the incident ID, current step number, and the full audit snapshot from Step 4.2.

---

## 7. Compliance Cross-Reference

This runbook provides evidence for the following controls:

| Framework | Control | Evidence Type |
|---|---|---|
| NIST 800-171 | 3.6.1 (Establish incident-handling capability) | Runbook existence + rehearsal log |
| NIST 800-171 | 3.6.2 (Track/report incidents) | Evidence bundle from Step 4.9 |
| NIST 800-171 | 3.6.3 (Test incident response capability) | Rehearsal requirement before v2.3 ship |
| HIPAA | §164.308(a)(6)(ii) (Response and reporting) | Runbook + regulatory reporting section (5.2) |
| PCI DSS v4.0 | 12.10.1 (Incident response plan) | Runbook text |
| PCI DSS v4.0 | 12.10.3 (Personnel available 24/7) | Escalation path in Section 6 |
| SOC 2 | CC7.3 (Incident evaluation) | Section 3 assessment procedure |
| SOC 2 | CC7.4 (Incident response) | Section 4 steps |
| CIS Controls v8.1 | 17.4 (Establish and maintain incident response process) | Runbook existence |

---

## 8. Rehearsal Log

Each rehearsal (before v2.3 ship and at least annually thereafter) should be recorded in `docs/operations/rehearsal-logs/` with:

- Date, operator, duration
- Friction points encountered
- Runbook changes applied as a result
- Timing calibration updates to Step 4.5

**Pre-ship rehearsal status:** not yet rehearsed (v2.3 in development). Rehearsal is a blocking gate for v2.3 ship per Decision #147.

---

## 9. Revision History

| Date | Change | Author |
|---|---|---|
| 2026-04-15 | Initial draft — written against v2.3 agent spec + parity check; commands untested against real implementation | Claude (session 2026-04-14/15) |

When v2.3 ships, the DRAFT banner in Section 1 is removed and this revision history gains an entry noting rehearsal-validated accuracy.
