<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Rename: "Early Adopter" / "EA" → "Founding Member" / "FM"

**Decision:** #136 in MASTER-PLAN.md
**Status:** Decision made 2026-04-04. Public demo funnel pages already updated. Full codebase sweep pending.

## What to do

Replace every occurrence of "Early Adopter", "EA", "early-adopter", and "eaProgram" with "Founding Member", "FM", "founding-member", and "fmProgram" across the entire repository — code, docs, business docs, agent specs, config files, and comments.

## Already done (do not re-do)

- `code/src/config/demo.ts` — `eaProgram` → `fmProgram` ✓
- `code/src/components/DemoBanner.vue` — copy + link key ✓
- `code/src/pages/funnel/*.vue` — all four funnel pages ✓
- `MASTER-PLAN.md` — Decision #136 written ✓

## Scope of remaining work

### Code (`code/`)
- Grep for `EA` (case-sensitive, word boundary) in pricing references, license key comments, tier descriptions
- Grep for `eaProgram`, `early-adopter`, `Early Adopter`, `EA pricing`, `EA slot`, `EA lock` 
- Check `UpgradeNag.vue` — may have "beta" or "early access" copy
- Check `DemoTierSwitcher.vue` — tier option persona strings reference "$149 EA", "$99 EA", "$999 EA"
- Check `code/src/config/demo.ts` — tier stages, VM descriptions, any remaining EA references
- Check `code/src/constants/vocabularies.ts` if EA is defined there

### Business docs (`business/`)
- `business/RELEASE-ROADMAP.md`
- `business/sales/` — all vertical docs, AI inference doc, pricing docs
- `business/sales/partners/` — channel partner economics
- `business/legal/` — any EA references in legal docs
- `MIGRATION-GUIDE.md`

### Plans (`plans/`)
- All execution roadmaps that reference EA pricing or EA slots
- `plans/v1.0.0/GTM-LAUNCH-PLAN.md` — already partially updated, verify no remaining EA

### Agents (`agents/`)
- Agent specs referencing EA program, EA pricing, EA slots

### Forge (`forge/`)
- `forge/STATUS.json` — check for EA fields
- Any forge docs referencing EA

### MASTER-PLAN.md
- Tier descriptions (lines ~121-125) reference "$149/yr EA", "$99/user/yr EA", "$999/yr EA"
- Multiple decisions reference "EA pricing", "EA lock", "EA slots"
- Do NOT rewrite decision history — update the current canonical descriptions, leave historical decision text as-is with a note that "EA" in older decisions means "FM" per Decision #136

### Project root docs
- `NOTES.md` if present
- Any README references

## Rules

1. **One term everywhere:** "Founding Member" (FM). No "Early Adopter", no "EA".
2. **Case convention:** "Founding Member" (title case) in prose, "FM" as abbreviation, `fmProgram` / `founding-member` in code/URLs.
3. **License key prefixes:** If license keys embed "EA" in their format string, that changes too. Check Decision #87 for the key format.
4. **Do NOT rewrite historical decision text** in MASTER-PLAN.md — those are point-in-time records. Update current canonical descriptions (tier summary, pricing) but leave resolved decision cells as-is.
5. **Run `npm run test:compliance`** after all changes — the vocabulary auditor will catch any remaining "Early Adopter" if it's in the blocked terms list. If it's not, add it.
6. **Run `npm run test:prepush`** before committing.

## Commit message

```
feat: Decision #136 — rename "Early Adopter" / "EA" to "Founding Member" / "FM" everywhere

One term, everywhere. "Founding Member" (FM) replaces "Early Adopter" (EA)
across all code, docs, business docs, agent specs, and config — per Decision #136.
Inconsistency breeds mistakes.
```
