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
# The trigger is READ FROM THE HOOK, never restated here. A second copy of a pattern is a second
# thing to drift, which is the defect this file exists to catch one level down. It comes from, in
# order: the hook's `echo "$COMMAND" | grep -qE '…'` line; for a delegator, that line in the file it
# execs; or the hook's own `--classify <command>` entry point, for a hook whose trigger is a
# classifier function rather than a grep.
#
# COVERAGE is enumerated from the settings files, not hand-listed: a hook registered on Bash must
# have a case or a declared exemption, and an exemption without a reason fails. The dotclaude
# original shipped with a hand-written list and covered 5 of 8 hooks — a checker whose universe is
# narrower than its consumer's returns green for whatever it omits.
#
# BOTH TREES, KEYED ON PATH — AND WHY THAT HAD TO BE SAID TWICE
# -------------------------------------------------------------
# Until 2026-09-15 this read `.claude/settings.json` and found a declared hook with
# `find .claude/hooks -name <basename> | head -1`. `code/.claude/settings.json` loads for every
# session rooted at code/, and none of it was checked. Measured in the template and Gantry:
#
#   * 4 Bash hooks wired only from code/.claude were never checked at all;
#   * 5 hooks exist in both trees, and only the root copy was, whatever the code copy did.
#
# That is the same narrower-universe defect the paragraph above records, arrived at a second time,
# which is why a universe is now enumerated from BOTH settings files and every wired PATH is
# checked, not the first file of a name. Cases are still declared by basename, so one declaration
# serves every consumer's layout (Weaver's root hooks are flat; this template's are in core/ and
# stack/) and every copy of a pair must satisfy it.
#
# Its first run found a live defect: `code/.claude/hooks/block-sweep-staging.sh` allowed a sweep
# inside a function body, and probing why showed it allowed `git add -A; git commit` and blocked
# `git commit --amend`. And the auditor's own history is the motivating case: the dead push trigger
# `e2e-after-code-push.sh` was rebuilt for on 2026-09-12 sat in the unchecked tree.
#
# Self-test: scripts/verify-hook-forms.sh --self-test
set -uo pipefail

CODE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$CODE/.." && pwd)"

# shellcheck source=../../.claude/hooks/lib/command-forms.sh
. "$REPO/.claude/hooks/lib/command-forms.sh"

GREEN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'

# ── declarations ────────────────────────────────────────────────────────────────────────────────
# hook @@ must-BLOCK @@ must-ALLOW
VERDICT_CASES=$(cat <<'ROWS'
block-dangerous.sh@@git push --force origin main@@git -C /abs status
block-sweep-staging.sh@@git -C /abs add -A@@git -C /abs status
ROWS
)

# hook @@ a command its trigger MUST see
TRIGGER_CASES=$(cat <<'ROWS'
require-e2e-docs.sh@@git -C /abs commit -m x
e2e-review-specs.sh@@./testing/e2e-docker/scripts/run-tests.sh
e2e-inject-lessons.sh@@./testing/e2e-docker/scripts/run-tests.sh
e2e-capture-lessons.sh@@./testing/e2e-docker/scripts/run-tests.sh
e2e-after-code-push.sh@@git -C /abs push origin main
ROWS
)

FORM_EXEMPT="inject-knowledge.sh csm-post-tool-use.sh"
exempt_reason() {
  case "$1" in
    inject-knowledge.sh)  printf 'advisory — never blocks, and its trigger is match_topic, whose *substring* globs no wrapper can hide' ;;
    csm-post-tool-use.sh) printf 'advisory — records every call on its matchers (bar secret-looking ones and a 2s debounce): no relevance trigger to go blind, no verdict' ;;
    *)                    printf 'NO REASON DECLARED' ;;
  esac
}

# ── helpers ─────────────────────────────────────────────────────────────────────────────────────

# wired_hooks <repo> — every hook a matcher runs on Bash, as a REPO-RELATIVE path, one per line.
# A relative command resolves against the directory that holds THAT settings file's `.claude/`.
# A settings file that exists and does not parse prints `!unreadable <file>`: an unreadable file
# must not read as a file that wires nothing.
wired_hooks() {
  python3 - "$1" <<'PY'
import json, os, re, shlex, sys
repo = sys.argv[1]
TOOL_EVENTS = {"PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest"}

def runs_on_bash(event, matcher):
    if event not in TOOL_EVENTS:
        return False
    if matcher in ("", "*"):
        return True
    try:
        return re.fullmatch(matcher, "Bash") is not None
    except re.error:
        return "Bash" in matcher.split("|")

for rel in (".claude/settings.json", "code/.claude/settings.json"):
    path = os.path.join(repo, rel)
    if not os.path.exists(path):
        continue
    try:
        d = json.load(open(path))
    except Exception:
        print(f"!unreadable {rel}")
        continue
    project = os.path.dirname(os.path.dirname(path))
    for event, entries in (d.get("hooks") or {}).items():
        for e in entries or []:
            if not runs_on_bash(event, e.get("matcher") or ""):
                continue
            for hk in e.get("hooks") or []:
                cmd = (hk.get("command") or "").strip()
                if not cmd:
                    continue
                try:
                    words = shlex.split(cmd)
                except ValueError:
                    words = cmd.split()
                if len(words) > 1 and os.path.basename(words[0]) in ("bash", "sh"):
                    words = words[1:]
                first = words[0].replace("${CLAUDE_PROJECT_DIR}", project).replace("$CLAUDE_PROJECT_DIR", project)
                print(os.path.relpath(os.path.normpath(os.path.join(project, first)), repo))
PY
}

# hook_instances <basename> — every wired path carrying this name. A declared hook wired nowhere
# falls back to every TRACKED file of that name under either hook tree.
hook_instances() {
  local found
  found="$(printf '%s\n' "$WIRED" | awk -F/ -v b="$1" '$NF == b' | sort -u)"
  if [ -z "$found" ]; then
    found="$(git -C "$REPO" ls-files -- .claude/hooks code/.claude/hooks 2>/dev/null \
      | grep -v '/negative-tests/' | awk -F/ -v b="$1" '$NF == b' | sort -u)"
  fi
  printf '%s' "$found"
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

# delegate_of <hookpath> — the file a delegator execs, or nothing. A delegator is a hook whose body
# is `IMPL="${HOOK_DIR}/<relative>"` and `exec "$IMPL"`; its trigger lives in that file.
delegate_of() {
  grep -q '^exec "\$IMPL"' "$1" || return 0
  local rel
  rel="$(sed -n 's/^IMPL="\${HOOK_DIR}\/\(.*\)"$/\1/p' "$1" | head -1)"
  [ -n "$rel" ] || return 0
  realpath -m "$(dirname "$1")/$rel"
}

# trigger_source <hookpath> -> "grep <file>" | "classify <file>" | "missing <file>" | "none"
trigger_source() {
  local p="$1" d
  d="$(delegate_of "$p")"
  if [ -n "$d" ]; then
    [ -f "$d" ] || { printf 'missing %s' "$d"; return; }
    p="$d"
  fi
  if [ -n "$(trigger_re "$p")" ]; then printf 'grep %s' "$p"
  elif grep -q -- '"--classify"' "$p"; then printf 'classify %s' "$p"
  else printf 'none'; fi
}

# sees <kind> <file> <rendered command> -> exit 0 when that trigger matches.
# A here-string, not `printf | grep -q`: under pipefail a grep that exits on its first match can
# SIGPIPE the writer and report a found match as missing.
sees() {
  case "$1" in
    grep)     grep -qE "$(trigger_re "$2")" <<<"$3" ;;
    classify) [ -n "$(bash "$2" --classify "$3" </dev/null 2>/dev/null)" ] ;;
    *)        return 1 ;;
  esac
}

command -v jq >/dev/null 2>&1 || { echo "audit:hook-forms: jq unavailable — skipping"; exit 0; }

# ── self-test ───────────────────────────────────────────────────────────────────────────────────
# Drives every primitive against synthetic hooks and a synthetic two-tree repo, so a change to this
# checker that stops it detecting anything fails here rather than silently reporting a clean tree.
# The IGNORE half is the one that decides whether it survives: a checker that flags a correct hook
# gets switched off, after which it catches nothing at all.
if [ "${1:-}" = "--self-test" ]; then
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
  # Delegators, the shape of code/.claude's copies of root hooks.
  mkdir -p "$tmp/code"
  for pair in 'deleg-dead.sh:../deadtrig.sh' 'deleg-live.sh:../livetrig.sh' 'deleg-gone.sh:../no-such-hook.sh'; do
    printf '%s\n' '#!/usr/bin/env bash' 'HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"' \
      "IMPL=\"\${HOOK_DIR}/${pair#*:}\"" 'exec "$IMPL" "$@"' > "$tmp/code/${pair%%:*}"
  done
  # Classifiers: one that only sees a push at the very start, one that reads it anywhere.
  printf '%s\n' '#!/usr/bin/env bash' 'if [ "${1:-}" = "--classify" ]; then' \
    '  case "${2:-}" in "git "*push*) echo push ;; esac; exit 0' 'fi' > "$tmp/cls-blind.sh"
  printf '%s\n' '#!/usr/bin/env bash' 'if [ "${1:-}" = "--classify" ]; then' \
    '  case "${2:-}" in *"git "*push*) echo push ;; esac; exit 0' 'fi' > "$tmp/cls-live.sh"

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

  blind_in() { # blind_in <hookpath> <sample> -> yes|no|noregex|missing
    local src kind file
    src="$(trigger_source "$1")"; kind="${src%% *}"; file="${src#* }"
    case "$kind" in none) printf 'noregex'; return ;; missing) printf 'missing'; return ;; esac
    while read -r f; do
      sees "$kind" "$file" "$(form_render "$f" "$2")" || { printf 'yes'; return; }
    done < <(form_names)
    printf 'no'
  }

  # A two-tree repo, wired the ways a settings file can be written.
  mkdir -p "$tmp/repo/.claude" "$tmp/repo/code/.claude"
  cat > "$tmp/repo/.claude/settings.json" <<'JSON'
{"hooks":{
  "PreToolUse":[{"matcher":"Bash","hooks":[{"command":"./.claude/hooks/core/rootonly.sh"},{"command":"./.claude/hooks/core/pair.sh"}]},
                {"matcher":"Edit|Write","hooks":[{"command":"./.claude/hooks/core/editonly.sh"}]},
                {"matcher":"BashOutput","hooks":[{"command":"./.claude/hooks/core/bashoutput.sh"}]}],
  "UserPromptSubmit":[{"matcher":"","hooks":[{"command":"./.claude/hooks/core/prompt.sh"}]}]
}}
JSON
  cat > "$tmp/repo/code/.claude/settings.json" <<'JSON'
{"hooks":{
  "PreToolUse":[{"matcher":"Bash","hooks":[{"command":"./.claude/hooks/codeonly.sh"},{"command":"./.claude/hooks/pair.sh"},
                                           {"command":"bash ./.claude/hooks/viabash.sh"},
                                           {"command":"\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/viavar.sh"}]}],
  "PostToolUse":[{"matcher":"","hooks":[{"command":"./.claude/hooks/everytool.sh"}]}]
}}
JSON
  wired="$(wired_hooks "$tmp/repo")"
  has() { printf '%s\n' "$wired" | grep -qxF "$1" && printf 'yes' || printf 'no'; }
  mkdir -p "$tmp/bad/.claude"; printf '{"hooks": ' > "$tmp/bad/.claude/settings.json"

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
  t CATCH  'a delegator to a dead trigger is detected'       "$(blind_in "$tmp/code/deleg-dead.sh" 'git -C /abs commit -m x')" yes
  t IGNORE 'a delegator to a live trigger is not flagged'    "$(blind_in "$tmp/code/deleg-live.sh" 'git -C /abs commit -m x')" no
  t CATCH  'a delegator whose target is gone is reported'    "$(blind_in "$tmp/code/deleg-gone.sh" 'git -C /abs commit -m x')" missing
  t CATCH  'a blind classifier is detected'                  "$(blind_in "$tmp/cls-blind.sh" 'git -C /abs push origin main')" yes
  t IGNORE 'a live classifier is not flagged'                "$(blind_in "$tmp/cls-live.sh" 'git -C /abs push origin main')"  no
  t CATCH  'a hook wired only from code/.claude is enumerated'  "$(has code/.claude/hooks/codeonly.sh)" yes
  t CATCH  "a pair's root copy is enumerated"                   "$(has .claude/hooks/core/pair.sh)"    yes
  t CATCH  "a pair's code/.claude copy is enumerated"           "$(has code/.claude/hooks/pair.sh)"    yes
  t CATCH  'a hook run as `bash <path>` resolves to its path'   "$(has code/.claude/hooks/viabash.sh)" yes
  t CATCH  '$CLAUDE_PROJECT_DIR resolves to its own tree'       "$(has code/.claude/hooks/viavar.sh)"  yes
  t CATCH  'an empty matcher on a tool event runs on Bash'      "$(has code/.claude/hooks/everytool.sh)" yes
  t IGNORE 'an Edit|Write matcher is not enumerated'            "$(has .claude/hooks/core/editonly.sh)"   no
  t IGNORE 'a BashOutput matcher is not a Bash matcher'         "$(has .claude/hooks/core/bashoutput.sh)" no
  t IGNORE 'an empty matcher on UserPromptSubmit is not a Bash hook' "$(has .claude/hooks/core/prompt.sh)" no
  t CATCH  'an unparseable settings file is reported, not read as empty' \
    "$(wired_hooks "$tmp/bad" | grep -qxF '!unreadable .claude/settings.json' && printf yes || printf no)" yes
  # Enumerating both copies is not the same claim as CHECKING both. A `| head -1` here restores the
  # exact defect this file was widened for, and the cases above all stay green.
  WIRED="$wired"
  t CATCH  'every copy of a pair is checked, not the first found' "$(hook_instances pair.sh | grep -c .)"         2
  t IGNORE 'a name wired and tracked nowhere has no instance'     "$(hook_instances no-such-hook.sh | grep -c .)" 0

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

WIRED="$(wired_hooks "$REPO")"

echo "Hook form-invariance — a guard must not depend on how the command is SPELLED"
echo "${DIM}forms: $(form_names | tr '\n' ' ')${RESET}"
echo

while IFS= read -r bad_settings; do
  printf '  %s✗%s %s does not parse — its hooks cannot be enumerated, so none of them is checked\n' "$RED" "$RESET" "${bad_settings#!unreadable }"
  fails=$((fails+1))
done < <(printf '%s\n' "$WIRED" | grep '^!unreadable ')
WIRED="$(printf '%s\n' "$WIRED" | grep -v '^!unreadable ' | grep . | sort -u)"

# A universe that enumerated nothing cannot have checked anything. Say so rather than print PASS.
if [ -z "$WIRED" ]; then
  printf '  %s✗%s no Bash-matched hook found in .claude/settings.json or code/.claude/settings.json\n' "$RED" "$RESET"
  fails=$((fails+1))
fi

# ── verdict leg ─────────────────────────────────────────────────────────────────────────────────
while IFS= read -r row; do
  [ -n "${row:-}" ] || continue
  hook="${row%%@@*}"; rest="${row#*@@}"
  bad="${rest%%@@*}"; good="${rest#*@@}"
  instances="$(hook_instances "$hook")"
  [ -n "$instances" ] || { printf '  %s✗%s %-44s not wired, and not found under either hook tree\n' "$RED" "$RESET" "$hook"; fails=$((fails+1)); continue; }

  while IFS= read -r rel; do
    [ -f "$REPO/$rel" ] || { printf '  %s✗%s %-44s wired, but the file does not exist\n' "$RED" "$RESET" "$rel"; fails=$((fails+1)); continue; }
    ok=1; detail=""
    while read -r form; do
      checked=$((checked+1))
      vb="$(verdict "$REPO/$rel" "$(form_render "$form" "$bad")")"
      vg="$(verdict "$REPO/$rel" "$(form_render "$form" "$good")")"
      [ "$vb" = "BLOCK" ] || { ok=0; detail="$detail ${form}:should-block($vb)"; }
      [ "$vg" = "ALLOW" ] || { ok=0; detail="$detail ${form}:should-allow($vg)"; }
    done < <(form_names)

    if [ "$ok" -eq 1 ]; then
      printf '  %s✓%s %-44s verdict invariant across all forms\n' "$GREEN" "$RESET" "$rel"
    else
      fails=$((fails+1))
      printf '  %s✗%s %-44s verdict VARIES\n' "$RED" "$RESET" "$rel"
      printf '      %s%s%s\n' "$DIM" "$detail" "$RESET"
    fi
  done <<< "$instances"
done <<< "$VERDICT_CASES"

# ── trigger leg ─────────────────────────────────────────────────────────────────────────────────
while IFS= read -r row; do
  [ -n "${row:-}" ] || continue
  hook="${row%%@@*}"; sample="${row#*@@}"
  instances="$(hook_instances "$hook")"
  [ -n "$instances" ] || { printf '  %s✗%s %-44s not wired, and not found under either hook tree\n' "$RED" "$RESET" "$hook"; fails=$((fails+1)); continue; }

  while IFS= read -r rel; do
    [ -f "$REPO/$rel" ] || { printf '  %s✗%s %-44s wired, but the file does not exist\n' "$RED" "$RESET" "$rel"; fails=$((fails+1)); continue; }
    src="$(trigger_source "$REPO/$rel")"; kind="${src%% *}"; file="${src#* }"
    case "$kind" in
      none)
        printf '  %s✗%s %-44s no `echo "$COMMAND" | grep -qE ...` line and no --classify entry point to test\n' "$RED" "$RESET" "$rel"
        fails=$((fails+1)); continue ;;
      missing)
        printf '  %s✗%s %-44s delegates to %s, which does not exist\n' "$RED" "$RESET" "$rel" "${file#"$REPO"/}"
        fails=$((fails+1)); continue ;;
    esac
    via=""; [ "$file" = "$REPO/$rel" ] || via=" via ${file#"$REPO"/}"
    [ "$kind" = classify ] && via="$via (--classify)"

    ok=1; blind=""
    while read -r form; do
      checked=$((checked+1))
      sees "$kind" "$file" "$(form_render "$form" "$sample")" || { ok=0; blind="$blind $form"; }
    done < <(form_names)

    if [ "$ok" -eq 1 ]; then
      printf '  %s✓%s %-44s trigger sees the command in all forms%s%s%s\n' "$GREEN" "$RESET" "$rel" "$DIM" "$via" "$RESET"
    else
      fails=$((fails+1))
      printf '  %s✗%s %-44s trigger BLIND in:%s%s%s%s\n' "$RED" "$RESET" "$rel" "$blind" "$DIM" "$via" "$RESET"
      printf '      %sa trigger that does not match never evaluates its gate%s\n' "$DIM" "$RESET"
    fi
  done <<< "$instances"
done <<< "$TRIGGER_CASES"

# ── coverage leg ────────────────────────────────────────────────────────────────────────────────
while read -r rel; do
  [ -n "${rel:-}" ] || continue
  h="${rel##*/}"
  printf '%s\n' "$VERDICT_CASES" | cut -d'@' -f1 | grep -qxF "$h" && continue
  printf '%s\n' "$TRIGGER_CASES" | cut -d'@' -f1 | grep -qxF "$h" && continue
  case " $FORM_EXEMPT " in *" $h "*)
    r="$(exempt_reason "$h")"
    printf '  %s○%s %-44s exempt — %s\n' "$DIM" "$RESET" "$rel" "$r"
    [ "$r" = "NO REASON DECLARED" ] && { printf '  %s✗%s %-44s exempt with no reason\n' "$RED" "$RESET" "$rel"; fails=$((fails+1)); }
    continue ;;
  esac
  printf '  %s✗%s %-44s registered on Bash but has NO case and NO declared exemption\n' "$RED" "$RESET" "$rel"
  fails=$((fails+1))
done <<< "$WIRED"

echo
if [ "$fails" -gt 0 ]; then
  printf '%sRESULT: FAIL%s — %d hook(s) whose behaviour depends on how the input is SPELLED.\n' "$RED" "$RESET" "$fails"
  echo "A guard that reads a command string must be told what the string MEANS."
  echo "See .claude/hooks/lib/unwrap-interpreter.sh and .claude/hooks/lib/command-forms.sh."
  exit 1
fi
printf '%sRESULT: PASS%s — %d check(s) over %d wired hook(s), invariant across %d form(s)\n' "$GREEN" "$RESET" "$checked" "$(printf '%s\n' "$WIRED" | grep -c .)" "$(form_names | wc -l)"
