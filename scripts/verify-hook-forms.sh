#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# audit:hook-forms — a command-parsing hook must behave the SAME however the command is written.
#
# THE FAILURE THIS EXISTS FOR
# ---------------------------
# `.claude/hooks/core/block-dangerous.sh` scanned only the unquoted shell skeleton, which is right
# for a commit message that NAMES a command and catastrophic for `bash -c '…'`, where the whole
# command lives inside those quotes. Measured 2026-08-25: force-push, `git reset --hard`,
# `git clean -f`, `rm -rf /etc` and bare Playwright were ALL allowed when wrapped, in this template
# and in two projects descended from it.
#
# It is worse than an ordinary gap because `standardize-on-bash.md` INSTRUCTS that wrapper — the
# Bash tool runs zsh, so shell logic is supposed to be written `bash -c '…'`. Obeying one rule
# disarmed another, and nothing connected them because the assumption was a COMMENT.
#
# A separate instance the same day, and not a wrapping bug at all: `require-e2e-docs.sh` triggered
# on `git\s+commit`, which never matches `git -C /abs commit` — the form
# `enforce-absolute-git-cwd` REQUIRES. The two controls were mutually exclusive and that gate had
# been dead in four repos. Same shape: one rule falsified another's assumption, silently.
#
# THE TWO LEGS
# ------------
#   VERDICT  — for a hook with a decidable block: a command it MUST block and one it MUST allow,
#              rendered in every form. The verdict may not vary with the form.
#   TRIGGER  — for a hook that EARLY-EXITS unless the command looks relevant: its own trigger must
#              still SEE the command in every form. A trigger that does not match never evaluates
#              its gate, so the gate's correctness is irrelevant — it never runs.
#
# The trigger regex is EXTRACTED from the hook, never restated here. A second copy of a pattern is
# a second thing to drift, which is the defect this file exists to catch one level down.
#
# COVERAGE is enumerated from .claude/settings.json, not hand-listed: a hook registered on Bash
# must have a case or a declared exemption, and an exemption without a reason fails. The dotclaude
# original shipped with a hand-written list and covered 5 of 8 hooks — a checker whose universe is
# narrower than its consumer's returns green for whatever it omits.
#
# Self-test: scripts/verify-hook-forms.sh --self-test
set -uo pipefail

CODE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$CODE/.." && pwd)"
HOOKS="$REPO/.claude/hooks"
SETTINGS="$REPO/.claude/settings.json"

# shellcheck source=../../.claude/hooks/lib/command-forms.sh
. "$HOOKS/lib/command-forms.sh"

GREEN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'

# ── declarations ────────────────────────────────────────────────────────────────────────────────
# hook @@ must-BLOCK @@ must-ALLOW
VERDICT_CASES=$(cat <<'ROWS'
block-dangerous.sh@@git push --force origin main@@git -C /abs status
ROWS
)

# hook @@ a command its trigger MUST see
TRIGGER_CASES=$(cat <<'ROWS'
require-e2e-docs.sh@@git -C /abs commit -m x
e2e-review-specs.sh@@./testing/e2e-docker/scripts/run-tests.sh
ROWS
)

FORM_EXEMPT="e2e-inject-lessons.sh e2e-capture-lessons.sh"
exempt_reason() {
  case "$1" in
    e2e-inject-lessons.sh)  printf 'advisory — no block path, so there is no verdict to be invariant' ;;
    e2e-capture-lessons.sh) printf 'advisory — PostToolUse, records only' ;;
    *)                      printf 'NO REASON DECLARED' ;;
  esac
}

# ── helpers ─────────────────────────────────────────────────────────────────────────────────────
hook_path() { # hook_path <basename> -> absolute path, or empty
  find "$HOOKS" -name "$1" -type f 2>/dev/null | head -1
}

bash_matched_hooks() {
  python3 - "$SETTINGS" <<'PY'
import json, os, shlex, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
for event, entries in (d.get("hooks") or {}).items():
    for e in entries:
        if "Bash" not in (e.get("matcher") or "").split("|"):
            continue
        for hk in e.get("hooks") or []:
            cmd = (hk.get("command") or "").strip()
            if not cmd:
                continue
            try:
                first = shlex.split(cmd)[0]
            except ValueError:
                first = cmd.split()[0]
            print(os.path.basename(first))
PY
}

verdict() { # verdict <hookpath> <command> -> BLOCK|ALLOW
  local payload
  payload=$(jq -nc --arg c "$2" '{tool_input:{command:$c}}' 2>/dev/null) || { printf 'ERR'; return; }
  if printf '%s' "$payload" | bash "$1" >/dev/null 2>&1; then printf 'ALLOW'; else printf 'BLOCK'; fi
}

# Extract the hook's own early-exit trigger regex. Derived, never restated — a copy here would be
# a second pattern to drift, which is the class this file exists to catch.
trigger_re() { # trigger_re <hookpath>
  sed -n "s/.*echo \"\$COMMAND\" | grep -qE '\([^']*\)'.*/\1/p" "$1" | head -1
}

command -v jq >/dev/null 2>&1 || { echo "audit:hook-forms: jq unavailable — skipping"; exit 0; }

# ── self-test ───────────────────────────────────────────────────────────────────────────────────
# Drives BOTH primitives against synthetic hooks, so a change to this checker that stops it
# detecting anything fails here rather than silently reporting a clean tree. The IGNORE half is
# the one that decides whether it survives: a checker that flags a correct hook gets switched off,
# after which it catches nothing at all.
if [ "${1:-}" = "--self-test" ]; then
  command -v jq >/dev/null 2>&1 || { echo "audit:hook-forms self-test: jq unavailable"; exit 0; }
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  fails=0; catch=0; ignore=0

  # A hook blind to wrapping: it only sees the token at the START of the raw command.
  cat > "$tmp/blind.sh" <<'EOS'
#!/usr/bin/env bash
c="$(cat | jq -r '.tool_input.command // empty')"
printf '%s' "$c" | grep -qE '^git push --force' && exit 2
exit 0
EOS
  # A hook immune to it: it greps the raw string anywhere.
  cat > "$tmp/immune.sh" <<'EOS'
#!/usr/bin/env bash
c="$(cat | jq -r '.tool_input.command // empty')"
printf '%s' "$c" | grep -qE 'git push --force' && exit 2
exit 0
EOS
  # Triggers: the dead one, and the corrected one.
  printf '%s\n' '#!/usr/bin/env bash' 'if ! echo "$COMMAND" | grep -qE '"'"'git\s+commit'"'"'; then exit 0; fi' > "$tmp/deadtrig.sh"
  printf '%s\n' '#!/usr/bin/env bash' 'if ! echo "$COMMAND" | grep -qE '"'"'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+commit'"'"'; then exit 0; fi' > "$tmp/livetrig.sh"

  varies() { # varies <hookpath> <violating-cmd> -> yes|no
    local p="$1" c="$2" seen_block=0 seen_allow=0
    while read -r f; do
      case "$(verdict "$p" "$(form_render "$f" "$c")")" in
        BLOCK) seen_block=1 ;;
        *)     seen_allow=1 ;;
      esac
    done < <(form_names)
    [ "$seen_block" -eq 1 ] && [ "$seen_allow" -eq 1 ] && printf 'yes' || printf 'no'
  }

  blind_in() { # blind_in <hookpath> <sample> -> yes|no
    local re; re="$(trigger_re "$1")"
    [ -n "$re" ] || { printf 'noregex'; return; }
    while read -r f; do
      printf '%s' "$(form_render "$f" "$2")" | grep -qE "$re" || { printf 'yes'; return; }
    done < <(form_names)
    printf 'no'
  }

  t() { # t <CATCH|IGNORE> <label> <actual> <expected>
    if [ "$1" = "CATCH" ]; then catch=$((catch+1)); else ignore=$((ignore+1)); fi
    if [ "$3" = "$4" ]; then printf '  ok    %-8s %s\n' "$1" "$2"
    else printf '  FAIL  %-8s %s (want %s, got %s)\n' "$1" "$2" "$4" "$3"; fails=$((fails+1)); fi
  }

  t CATCH  'a wrap-blind hook is detected'      "$(varies "$tmp/blind.sh" 'git push --force origin main')"  yes
  t IGNORE 'a wrap-immune hook is not flagged'  "$(varies "$tmp/immune.sh" 'git push --force origin main')" no
  t CATCH  'a dead trigger is detected'         "$(blind_in "$tmp/deadtrig.sh" 'git -C /abs commit -m x')"  yes
  t IGNORE 'a live trigger is not flagged'      "$(blind_in "$tmp/livetrig.sh" 'git -C /abs commit -m x')"  no
  t CATCH  'a hook with no trigger is reported' "$(blind_in "$tmp/immune.sh" 'git -C /abs commit -m x')"    noregex

  echo
  if [ "$fails" -eq 0 ]; then
    echo "auditor-contract: catch=$catch ignore=$ignore"
    echo "audit:hook-forms self-test PASS ($((catch+ignore)) cases)"
    exit 0
  fi
  echo "audit:hook-forms self-test FAILED ($fails)"
  exit 1
fi


fails=0
checked=0

echo "Hook form-invariance — a guard must not depend on how the command is SPELLED"
echo "${DIM}forms: $(form_names | tr '\n' ' ')${RESET}"
echo

# ── verdict leg ─────────────────────────────────────────────────────────────────────────────────
while IFS= read -r row; do
  [ -n "${row:-}" ] || continue
  hook="${row%%@@*}"; rest="${row#*@@}"
  bad="${rest%%@@*}"; good="${rest#*@@}"
  path="$(hook_path "$hook")"
  [ -n "$path" ] || { printf '  %s✗%s %-24s not found under .claude/hooks/\n' "$RED" "$RESET" "$hook"; fails=$((fails+1)); continue; }

  ok=1; detail=""
  while read -r form; do
    checked=$((checked+1))
    vb="$(verdict "$path" "$(form_render "$form" "$bad")")"
    vg="$(verdict "$path" "$(form_render "$form" "$good")")"
    [ "$vb" = "BLOCK" ] || { ok=0; detail="$detail ${form}:should-block($vb)"; }
    [ "$vg" = "ALLOW" ] || { ok=0; detail="$detail ${form}:should-allow($vg)"; }
  done < <(form_names)

  if [ "$ok" -eq 1 ]; then
    printf '  %s✓%s %-24s verdict invariant across all forms\n' "$GREEN" "$RESET" "$hook"
  else
    fails=$((fails+1))
    printf '  %s✗%s %-24s verdict VARIES\n' "$RED" "$RESET" "$hook"
    printf '      %s%s%s\n' "$DIM" "$detail" "$RESET"
  fi
done <<< "$VERDICT_CASES"

# ── trigger leg ─────────────────────────────────────────────────────────────────────────────────
while IFS= read -r row; do
  [ -n "${row:-}" ] || continue
  hook="${row%%@@*}"; sample="${row#*@@}"
  path="$(hook_path "$hook")"
  [ -n "$path" ] || { printf '  %s✗%s %-24s not found under .claude/hooks/\n' "$RED" "$RESET" "$hook"; fails=$((fails+1)); continue; }
  re="$(trigger_re "$path")"
  if [ -z "$re" ]; then
    printf '  %s✗%s %-24s no `echo "$COMMAND" | grep -qE ...` trigger found to test\n' "$RED" "$RESET" "$hook"
    fails=$((fails+1)); continue
  fi

  ok=1; blind=""
  while read -r form; do
    checked=$((checked+1))
    printf '%s' "$(form_render "$form" "$sample")" | grep -qE "$re" || { ok=0; blind="$blind $form"; }
  done < <(form_names)

  if [ "$ok" -eq 1 ]; then
    printf '  %s✓%s %-24s trigger sees the command in all forms\n' "$GREEN" "$RESET" "$hook"
  else
    fails=$((fails+1))
    printf '  %s✗%s %-24s trigger BLIND in:%s\n' "$RED" "$RESET" "$hook" "$blind"
    printf '      %sa trigger that does not match never evaluates its gate%s\n' "$DIM" "$RESET"
  fi
done <<< "$TRIGGER_CASES"

# ── coverage leg ────────────────────────────────────────────────────────────────────────────────
while read -r h; do
  [ -n "${h:-}" ] || continue
  printf '%s\n' "$VERDICT_CASES" | cut -d'@' -f1 | grep -qxF "$h" && continue
  printf '%s\n' "$TRIGGER_CASES" | cut -d'@' -f1 | grep -qxF "$h" && continue
  case " $FORM_EXEMPT " in *" $h "*)
    r="$(exempt_reason "$h")"
    printf '  %s○%s %-24s exempt — %s\n' "$DIM" "$RESET" "$h" "$r"
    [ "$r" = "NO REASON DECLARED" ] && { printf '  %s✗%s %-24s exempt with no reason\n' "$RED" "$RESET" "$h"; fails=$((fails+1)); }
    continue ;;
  esac
  printf '  %s✗%s %-24s registered on Bash but has NO case and NO declared exemption\n' "$RED" "$RESET" "$h"
  fails=$((fails+1))
done < <(bash_matched_hooks | sort -u)

echo
if [ "$fails" -gt 0 ]; then
  printf '%sRESULT: FAIL%s — %d hook(s) whose behaviour depends on how the input is SPELLED.\n' "$RED" "$RESET" "$fails"
  echo "A guard that reads a command string must be told what the string MEANS."
  echo "See .claude/hooks/lib/unwrap-interpreter.sh and .claude/hooks/lib/command-forms.sh."
  exit 1
fi
printf '%sRESULT: PASS%s — %d check(s), invariant across %d form(s)\n' "$GREEN" "$RESET" "$checked" "$(form_names | wc -l)"
