#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Proprietary and confidential. Do not distribute.
#
# verify-rule-frontmatter — every NEW OR EDITED rule file carries WVR-191 frontmatter.
#
# WHY THIS EXISTS
# ---------------
# FORGE-36 (Agent-governance substrate is vendor-neutral from row one — Engram rows, projected
# per consumer) makes always-loaded rules into Engram rows carrying the WVR-191 scope ladder, and
# states the convention "effective immediately and ahead of any build". It was recorded as a
# convention with nothing enforcing it, and a control you have to remember is not a control —
# measured 2026-08-04: 108 rule files across the portfolio, 0 carrying `scope:`.
#
# Migration cost is per-artifact, not calendar-based: it scales with UNCLASSIFIED always-loaded
# content, because the migration is rules->rows and a row needs the ladder. Classifying at edit
# time is therefore free; classifying later is a sweep nobody schedules.
#
# WHY IT CHECKS ONLY STAGED FILES
# -------------------------------
# FORGE-36 is explicit: "Existing files are retrofitted when touched, never swept." A checker that
# demanded frontmatter on all 108 would fail on every commit until someone did the sweep the
# decision forbids — and a guard that fires on correct, untouched work is one that gets disabled
# on its first real run (~/.claude/rules/never-game-auditors.md).
#
# Staged-only makes the convention exactly what it says: touch a rule, classify it. It is also why
# this is a git hook rather than an agent hook — FORGE-36 layer (4): enforcement is git hooks and
# auditors, never the agent, so it fires regardless of which AI wrote the change, or whether one
# did.
#
# USAGE
#   verify-rule-frontmatter.sh              # validate STAGED rule files (git hook mode)
#   verify-rule-frontmatter.sh FILE...      # validate the named files
#   verify-rule-frontmatter.sh --self-test  # run the corpus, prove the matcher works

set -uo pipefail

# ── WVR-191 vocabulary (mirrors the structured_entries CHECK constraints) ──────────────────────
VALID_SCOPE='universal|language|language-version|domain|project|task'
VALID_LAYER='L1-dev|L2-product'
VALID_STATUS='active|superseded|retired'
# A rule file is a rule. `type` is still required and still validated, because these files become
# rows in the same table as lessons/gotchas and the column is shared.
VALID_TYPE='rule'

# Which paths count as rule files. Both the global store and per-project stores.
RULE_PATH_RE='(^|/)\.claude/rules/.*\.md$|(^|/)rules/[^/]*\.md$'

fail_count=0

# Validate one file's frontmatter. Prints diagnostics; returns 1 on failure.
# Reads from stdin so it works on both a worktree file and a staged blob.
check_frontmatter() {
  local label="$1" content="$2" missing=() bad=()

  # Frontmatter must be the first NON-PREAMBLE thing in the file. Preamble is blank lines and
  # HTML comments only — WBD rule files open with a copyright header
  # (`<!-- Copyright (c) ... -->`), so demanding `---` on line 1 would reject every correctly
  # classified rule file in weaver, the template and Gantry. A checker that fires on correct work
  # is one that gets switched off on its first real run.
  #
  # Prose is still not preamble: a `# Heading` before the `---` means that `---` is a horizontal
  # rule, not frontmatter, and accepting it would let an unclassified file pass because it happens
  # to contain a table or a section break.
  local body_start
  body_start="$(printf '%s\n' "$content" | awk '
    /^[[:space:]]*$/ { next }
    /^[[:space:]]*<!--/ { next }
    { print NR; exit }')"
  [ -z "$body_start" ] && body_start=1

  if [ "$(printf '%s\n' "$content" | sed -n "${body_start}p")" != "---" ]; then
    echo "  ✗ $label — no YAML frontmatter block (expected '---' as the first line after any"
    echo "      copyright/comment preamble)"
    return 1
  fi

  # Everything between the opening --- and the next --- .
  local fm
  fm="$(printf '%s\n' "$content" | awk -v s="$body_start" 'NR<=s{next} /^---[[:space:]]*$/{exit} {print}')"

  local key re
  for key in scope layer type status; do
    case "$key" in
      scope)  re="$VALID_SCOPE" ;;
      layer)  re="$VALID_LAYER" ;;
      type)   re="$VALID_TYPE" ;;
      status) re="$VALID_STATUS" ;;
    esac
    local line
    line="$(printf '%s\n' "$fm" | grep -E "^${key}:" | head -1)"
    if [ -z "$line" ]; then
      missing+=("$key")
      continue
    fi
    local val
    val="$(printf '%s' "$line" | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//; s/^\"//; s/\"$//")"
    if ! printf '%s' "$val" | grep -qE "^(${re})$"; then
      bad+=("$key='$val' (expected one of: ${re//|/, })")
    fi
  done

  if [ ${#missing[@]} -gt 0 ] || [ ${#bad[@]} -gt 0 ]; then
    echo "  ✗ $label"
    [ ${#missing[@]} -gt 0 ] && echo "      missing: ${missing[*]}"
    local b
    for b in "${bad[@]:-}"; do [ -n "$b" ] && echo "      invalid: $b"; done
    return 1
  fi
  return 0
}

# ── Self-test. An auditor with no corpus only ever reports that it found nothing; it can never
# report that it CANNOT find anything, and from outside those are identical. Both halves are
# asserted — what it MUST reject and what it MUST accept — because a checker that rejects
# everything gets switched off exactly as fast as one that rejects nothing.
GOOD_FM='---
scope: universal
layer: L1-dev
type: rule
status: active
---

# A rule
'

self_test() {
  local fails=0 out

  must_reject() {
    if check_frontmatter "$1" "$2" >/dev/null 2>&1; then
      echo "  MUST REJECT but accepted: $1"; fails=$((fails + 1))
    fi
  }
  must_accept() {
    if ! out="$(check_frontmatter "$1" "$2" 2>&1)"; then
      echo "  MUST ACCEPT but rejected: $1 -> $out"; fails=$((fails + 1))
    fi
  }

  must_reject "no frontmatter at all"      "# Just a heading"$'\n'"body"
  must_reject "missing scope"              "---"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"
  must_reject "missing layer"              "---"$'\n'"scope: universal"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"
  must_reject "missing type"               "---"$'\n'"scope: universal"$'\n'"layer: L1-dev"$'\n'"status: active"$'\n'"---"
  must_reject "missing status"             "---"$'\n'"scope: universal"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"---"
  must_reject "retired scope vocabulary"   "---"$'\n'"scope: transferable"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"
  must_reject "retired status vocabulary"  "---"$'\n'"scope: universal"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: graduated"$'\n'"---"
  must_reject "wrong type for a rule file" "---"$'\n'"scope: universal"$'\n'"layer: L1-dev"$'\n'"type: lesson"$'\n'"status: active"$'\n'"---"
  # The frontmatter must OPEN the file. A '---' further down is a horizontal rule in prose, and
  # accepting it would let an unclassified file pass because it happened to contain a table.
  must_reject "--- not on line 1"          "# Heading"$'\n'"---"$'\n'"scope: universal"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"

  must_accept "complete frontmatter"       "$GOOD_FM"
  must_accept "quoted values"              "---"$'\n'"scope: \"universal\""$'\n'"layer: \"L1-dev\""$'\n'"type: \"rule\""$'\n'"status: \"active\""$'\n'"---"
  must_accept "extra keys alongside"       "---"$'\n'"description: whatever"$'\n'"scope: project"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"paths:"$'\n'"  - src/**"$'\n'"---"
  must_accept "narrower scope rung"        "---"$'\n'"scope: language-version"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"
  must_accept "superseded but classified"  "---"$'\n'"scope: domain"$'\n'"layer: L2-product"$'\n'"type: rule"$'\n'"status: superseded"$'\n'"---"
  # WBD rule files open with a copyright header. This case exists because the first cut of this
  # matcher demanded `---` on line 1 and would have rejected every rule file in weaver, the
  # template and Gantry — found by running it against real files, not by reading it.
  must_accept "copyright preamble first"   "<!-- Copyright (c) 2026 whizBANG Developers LLC. -->"$'\n'"<!-- Proprietary. -->"$'\n'"---"$'\n'"scope: project"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"
  must_accept "blank lines before"         ""$'\n'"---"$'\n'"scope: universal"$'\n'"layer: L1-dev"$'\n'"type: rule"$'\n'"status: active"$'\n'"---"

  if [ "$fails" -gt 0 ]; then
    echo "✗ SELF-TEST FAILED ($fails) — refusing to run with a broken matcher"
    return 1
  fi
  echo "  ✓ self-test: 9 reject + 7 accept cases"
  return 0
}

# ── Entry ─────────────────────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi

self_test >/dev/null || { self_test; exit 1; }

if [ "$#" -gt 0 ]; then
  for f in "$@"; do
    [ -f "$f" ] || { echo "  ✗ $f — not a file"; fail_count=$((fail_count + 1)); continue; }
    check_frontmatter "$f" "$(cat "$f")" || fail_count=$((fail_count + 1))
  done
else
  # Hook mode: STAGED rule files only. Read the staged BLOB, not the worktree file — they differ
  # whenever something is partially staged, and the blob is what the commit will actually contain.
  staged="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E "$RULE_PATH_RE" || true)"
  [ -z "$staged" ] && exit 0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    check_frontmatter "$f" "$(git show ":$f" 2>/dev/null)" || fail_count=$((fail_count + 1))
  done <<< "$staged"
fi

if [ "$fail_count" -gt 0 ]; then
  cat <<'MSG'

✋ FORGE-36: every new or edited rule file carries WVR-191 frontmatter.

   ---
   scope: universal | language | language-version | domain | project | task
   layer: L1-dev | L2-product
   type: rule
   status: active | superseded | retired
   ---

   Classifying at edit time is free; the migration to Engram rows needs the ladder either
   way, and doing it later is a sweep nobody schedules. Untouched files are NOT swept.
MSG
  exit 1
fi
exit 0
