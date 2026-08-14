#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# The ONE post-build step for every demo SPA build.
#
# WHY THIS EXISTS
# ---------------
# There were three independent implementations of "build the demo SPA" and none called another:
# the local build script, the deploy workflow, and the E2E entrypoint. They had already drifted,
# and the drift was invisible because each one worked perfectly on its own terms:
#
#                        local build   deploy workflow   E2E entrypoint
#   VITE_DEMO_MODE            yes            yes              yes
#   NODE_ENV=production       yes             -                -
#   .nojekyll                 yes            yes               -
#   LICENSE, robots.txt        -             yes               -
#   noai meta, CSP meta        -             yes               -
#
# The sharp end was the CSP. GitHub Pages cannot set HTTP headers, so the meta tag injected here
# IS the entire content-security policy of the live demo — and only the deploy workflow injected
# it. The E2E suite therefore validated an artifact that structurally could not exhibit a CSP
# regression: a broken or absent policy would have shipped green. Nothing anywhere asserted it
# (the security spec asserts CSP on API *response headers* via the request fixture, against the
# backend, so it never sees the demo's index.html at all).
#
# With one shared step the tested artifact is the deployed artifact, and the E2E entrypoint can
# assert the CSP meta and have that assertion mean something.
#
# CONTRACT
# --------
#   demo-postbuild.sh <dist-dir>
#
# Idempotent: safe to run twice, injects each meta tag at most once. Verifies its own output and
# exits non-zero if an injection did not land — a sed that silently matched nothing is the failure
# mode this must not have, since every caller would still report success.
set -euo pipefail

# Refuse a policy containing a directive a <meta> element cannot deliver. An inert directive is
# worse than an absent one: it reads as protection in code review, and the browser logs an error
# on every page load. Defined as a function so the self-test can prove it actually fires.
assert_meta_deliverable() {
  local policy="$1" d
  for d in frame-ancestors report-uri report-to sandbox; do
    case "$policy" in
      *"$d"*)
        echo "demo-postbuild: '$d' is header-only and is IGNORED in a <meta> CSP." >&2
        echo "  Remove it. If the protection is genuinely needed it requires a host that can set" >&2
        echo "  HTTP headers — GitHub Pages cannot." >&2
        return 1
        ;;
    esac
  done
  return 0
}

# The single definition of the demo's content-security policy. On Pages this meta tag is the
# policy — there is no HTTP-header layer to fall back on.
#
# WHAT THIS POLICY DELIBERATELY DOES NOT CONTAIN
# ----------------------------------------------
# Three CSP directives are HEADER-ONLY by specification and are ignored inside a <meta
# http-equiv>: frame-ancestors, report-uri/report-to, and sandbox. A browser does not merely skip
# them quietly — it logs "The Content Security Policy directive 'frame-ancestors' is ignored when
# delivered via a <meta> element" on every page load.
#
# This policy previously carried `frame-ancestors 'none'`, with a comment claiming it superseded
# X-Frame-Options. That is true of the HEADER and false of the meta, so the policy named a
# protection that could never apply — the same shape as the anchor bug above, one directive
# deeper, and it only became visible once the CSP started reaching the browser at all.
#
# CONSEQUENCE, stated plainly rather than buried: the Pages-hosted demo has NO clickjacking
# protection and cannot have any, because neither frame-ancestors nor X-Frame-Options can be
# delivered without an HTTP layer. Restoring it requires hosting that sets headers.
#
# This does NOT relax the product's baseline. The application sets frameAncestors 'none' through
# Helmet, which emits a real Content-Security-Policy HTTP header where the directive is fully
# effective — see backend/src/index.ts. It is this deployment target that cannot meet the
# baseline, not the baseline that is wrong.
#
# Adding a header-only directive back is refused at build time below, so this cannot regress into
# a silently-inert policy again.
CSP="default-src 'self'; script-src 'self' https://js.hcaptcha.com https://*.hcaptcha.com; style-src 'self' 'unsafe-inline' https://*.hcaptcha.com; img-src 'self' data: blob: https://*.hcaptcha.com; font-src 'self' data:; connect-src 'self' https://*.hcaptcha.com; frame-src https://*.hcaptcha.com https://newassets.hcaptcha.com; form-action 'self'; base-uri 'self'; object-src 'none'"

# ── Self-test ────────────────────────────────────────────────────────────────────────────────
# `demo-postbuild.sh --self-test` proves the injection lands on every index.html shape the
# builder can emit. The MINIFIED case is a regression test for a real production defect: the
# anchor was written against the SOURCE quoting (`<meta charset="utf-8">`) while Vite emits
# `<meta charset=utf-8>`, so it matched nothing, applied nothing, and returned success — for the
# life of the deploy workflow. Do not delete these cases to make a change easier.
if [ "${1:-}" = "--self-test" ]; then
  SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  TMP=$(mktemp -d); pass=0; fail=0
  _mk() { rm -rf "$TMP/d"; mkdir -p "$TMP/d"; printf '%s' "$1" > "$TMP/d/index.html"; }
  _applied() {
    grep -q 'name="robots" content="noai, noimageai"' "$TMP/d/index.html" &&
    grep -q 'http-equiv="Content-Security-Policy"' "$TMP/d/index.html"
  }
  _case() { # name, html
    _mk "$2"
    if "$SELF" "$TMP/d" >/dev/null 2>&1 && _applied; then
      echo "  PASS  $1"; pass=$((pass+1))
    else
      echo "  FAIL  $1"; fail=$((fail+1))
    fi
  }
  echo "demo-postbuild self-test"
  _case 'quoted   <meta charset="utf-8">'  '<html><head><meta charset="utf-8"><title>W</title></head><body></body></html>'
  _case 'MINIFIED <meta charset=utf-8>'    '<html><head><title>W</title><meta charset=utf-8><meta name=description content="x"></head><body></body></html>'
  _case "single-quoted charset"            "<html><head><meta charset='utf-8'></head><body></body></html>"
  _case 'uppercase tags and attributes'    '<html><HEAD><META CHARSET=UTF-8></HEAD><body></body></html>'
  _case 'no charset meta -> <head> fallback' '<html><head><title>none</title></head><body></body></html>'

  # Idempotent: a second run must not duplicate either tag.
  _mk '<html><head><meta charset=utf-8></head><body></body></html>'
  "$SELF" "$TMP/d" >/dev/null 2>&1; "$SELF" "$TMP/d" >/dev/null 2>&1
  c=$(grep -c 'http-equiv="Content-Security-Policy"' "$TMP/d/index.html")
  n=$(grep -c 'name="robots" content="noai, noimageai"' "$TMP/d/index.html")
  if [ "$c" -eq 1 ] && [ "$n" -eq 1 ]; then echo "  PASS  idempotent (csp=$c noai=$n)"; pass=$((pass+1))
  else echo "  FAIL  duplicated (csp=$c noai=$n)"; fail=$((fail+1)); fi

  # The header-only guard must FIRE on each inert directive and HOLD on a clean policy. Without
  # the second half a guard that rejects everything looks identical to one that works.
  for d in frame-ancestors report-uri report-to sandbox; do
    if assert_meta_deliverable "default-src 'self'; $d 'none'" 2>/dev/null; then
      echo "  FAIL  header-only guard missed '$d'"; fail=$((fail+1))
    else
      echo "  PASS  header-only guard rejects '$d'"; pass=$((pass+1))
    fi
  done
  if assert_meta_deliverable "default-src 'self'; frame-src https://x; form-action 'self'" 2>/dev/null; then
    echo "  PASS  header-only guard accepts a clean policy"; pass=$((pass+1))
  else
    echo "  FAIL  header-only guard rejected a legitimate policy"; fail=$((fail+1))
  fi
  # And the shipped policy itself must satisfy it.
  if assert_meta_deliverable "$CSP" 2>/dev/null; then
    echo "  PASS  shipped CSP is meta-deliverable"; pass=$((pass+1))
  else
    echo "  FAIL  shipped CSP contains a header-only directive"; fail=$((fail+1))
  fi

  # robots.txt is the PRIMARY AI Training Restriction enforcement, so its absence must FAIL rather
  # than skip. This is tested by pointing the script at a dist whose source tree has no robots.txt,
  # which is exactly what the `if [ -f ]` copy guard used to swallow.
  FAKE=$(mktemp -d); mkdir -p "$FAKE/scripts" "$FAKE/dist"
  cp "$SELF" "$FAKE/scripts/demo-postbuild.sh"   # a code-root with no demo/robots.txt and no LICENSE
  printf '%s' '<html><head><meta charset=utf-8></head><body></body></html>' > "$FAKE/dist/index.html"
  if "$FAKE/scripts/demo-postbuild.sh" "$FAKE/dist" >/dev/null 2>&1; then
    echo "  FAIL  shipped without robots.txt/LICENSE and said nothing"; fail=$((fail+1))
  else
    echo "  PASS  refuses when robots.txt/LICENSE cannot be copied"; pass=$((pass+1))
  fi
  rm -rf "$FAKE"

  # Present-but-useless is not protection: an empty robots.txt must fail too.
  FAKE2=$(mktemp -d); mkdir -p "$FAKE2/scripts" "$FAKE2/demo" "$FAKE2/dist"
  cp "$SELF" "$FAKE2/scripts/demo-postbuild.sh"
  : > "$FAKE2/demo/robots.txt"; : > "$FAKE2/LICENSE"
  printf '%s' '<html><head><meta charset=utf-8></head><body></body></html>' > "$FAKE2/dist/index.html"
  if "$FAKE2/scripts/demo-postbuild.sh" "$FAKE2/dist" >/dev/null 2>&1; then
    echo "  FAIL  accepted an empty robots.txt as protection"; fail=$((fail+1))
  else
    echo "  PASS  rejects an empty robots.txt"; pass=$((pass+1))
  fi
  rm -rf "$FAKE2"

  # The IGNORE half: it must still REFUSE when it genuinely cannot inject, rather than pass.
  rm -rf "$TMP/e"; mkdir -p "$TMP/e"; printf '%s' '<html><body>no head</body></html>' > "$TMP/e/index.html"
  if "$SELF" "$TMP/e" >/dev/null 2>&1; then echo "  FAIL  should refuse with no anchor"; fail=$((fail+1))
  else echo "  PASS  refuses when no anchor exists"; pass=$((pass+1)); fi

  # The real built artifact, when one is present.
  REAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist/spa/index.html"
  if [ -f "$REAL" ]; then
    rm -rf "$TMP/d"; mkdir -p "$TMP/d"; cp "$REAL" "$TMP/d/index.html"
    if "$SELF" "$TMP/d" >/dev/null 2>&1 && _applied; then echo "  PASS  real dist/spa/index.html"; pass=$((pass+1))
    else echo "  FAIL  real dist/spa/index.html"; fail=$((fail+1)); fi
  else
    echo "  SKIP  no local build at dist/spa"
  fi

  rm -rf "$TMP"
  echo "  $pass passed, $fail failed"
  [ "$fail" -eq 0 ] || exit 1
  exit 0
fi

DIST="${1:?usage: demo-postbuild.sh <dist-dir> | --self-test}"

# Resolve assets relative to THIS script, never the caller's cwd — the four callers run from four
# different directories (code/, the repo root in CI, /app in Docker, and a template checkout).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_ROOT="$(cd "$HERE/.." && pwd)"

if [ ! -d "$DIST" ]; then
  echo "demo-postbuild: dist dir not found: $DIST" >&2
  exit 1
fi
INDEX="$DIST/index.html"
if [ ! -f "$INDEX" ]; then
  echo "demo-postbuild: no index.html in $DIST" >&2
  exit 1
fi


assert_meta_deliverable "$CSP"

echo "demo-postbuild: finishing $DIST"

# 1. GitHub Pages: do not run the output through Jekyll.
touch "$DIST/.nojekyll"

# 2. Licence travels with the distributed build.
if [ -f "$CODE_ROOT/LICENSE" ]; then
  cp "$CODE_ROOT/LICENSE" "$DIST/LICENSE"
fi

# 3. Block AI crawlers from treating the demo as training data.
if [ -f "$CODE_ROOT/demo/robots.txt" ]; then
  cp "$CODE_ROOT/demo/robots.txt" "$DIST/robots.txt"
fi

# 4 + 5. Inject the noai and CSP metas, once each.
#
# THE ANCHOR MUST NOT ASSUME THE BUILDER'S QUOTING. The source template writes
# `<meta charset="utf-8">`, but Vite minifies the built output to `<meta charset=utf-8>` — no
# quotes. An anchor written against the SOURCE form therefore matches nothing in the BUILD, applies
# nothing, and returns success.
#
# That is not hypothetical: it is what the deploy workflow did for its whole life. Verified against
# the live site — robots.txt and LICENSE (plain copies) are present, while the CSP and noai metas
# (both seds) are absent, so the deployed demo has been running with NO content-security policy at
# all. On Pages there is no header layer to fall back on, so the meta tag was the entire policy.
#
# So: match the charset meta with either quoting style, and fall back to <head> — which is plain in
# every minifier — if the charset meta is absent or renamed. The verification block below is still
# the real guarantee; these anchors only decide whether it passes on the first try.
inject_after() { # $1 = ERE for the anchor, $2 = html to insert after it
  sed -i -E "s|($1)|\1\n    $2|I" "$INDEX"
}

CHARSET_RE='<meta charset=[^>]*>'
HEAD_RE='<head[^>]*>'
ANCHOR="$CHARSET_RE"
grep -qiE "$CHARSET_RE" "$INDEX" || ANCHOR="$HEAD_RE"

if ! grep -q 'name="robots" content="noai, noimageai"' "$INDEX"; then
  inject_after "$ANCHOR" '<meta name="robots" content="noai, noimageai">'
fi
if ! grep -q 'http-equiv="Content-Security-Policy"' "$INDEX"; then
  inject_after "$ANCHOR" "<meta http-equiv=\"Content-Security-Policy\" content=\"${CSP}\">"
fi

# Verify rather than assume. A sed whose pattern stopped matching (a Quasar template change, a
# different charset spelling) fails silently and every caller still reports success — which is
# precisely how the CSP came to be absent from two of the three build paths unnoticed.
missing=""
grep -q 'name="robots" content="noai, noimageai"' "$INDEX" || missing="$missing noai-meta"
grep -q 'http-equiv="Content-Security-Policy"' "$INDEX" || missing="$missing csp-meta"
[ -f "$DIST/.nojekyll" ] || missing="$missing .nojekyll"

# robots.txt and LICENSE are COPIES, and a copy whose source is absent skips silently under the
# `if [ -f ]` guards above. They were originally left unverified because a copy "obviously works" —
# the same assumption that let a no-op sed ship a policy-less demo for the life of the workflow.
#
# robots.txt is the PRIMARY enforcement of the AI Training Restriction; the noai meta is the
# belt-and-braces layer. Verifying only the meta checks the weaker of the two and lets the stronger
# one vanish without a word. audit:legal expects all three of LICENSE / robots.txt / noai meta to
# reach the deployed tree, so all three are verified here.
[ -f "$DIST/robots.txt" ] || missing="$missing robots.txt"
[ -f "$DIST/LICENSE" ] || missing="$missing LICENSE"

# An empty or truncated robots.txt is a file that exists and protects nothing, so presence is not
# sufficient — require the AI-crawler directives to actually be in it.
if [ -f "$DIST/robots.txt" ]; then
  grep -qi 'GPTBot' "$DIST/robots.txt" || missing="$missing robots.txt:no-ai-crawler-rules"
  grep -qi 'Disallow' "$DIST/robots.txt" || missing="$missing robots.txt:no-disallow"
fi

if [ -n "$missing" ]; then
  echo "demo-postbuild: FAILED to apply:$missing" >&2
  echo "  A missing robots.txt means the AI Training Restriction has no enforcement on the" >&2
  echo "  deployed site; its source is <code-root>/demo/robots.txt." >&2
  echo "  The meta anchors are the charset meta (any quoting) then <head>." >&2
  echo "  If the built index.html no longer contains them, fix the anchors here —" >&2
  echo "  do not let the build proceed without a policy." >&2
  exit 1
fi

echo "demo-postbuild: ok — .nojekyll, LICENSE, robots.txt, noai meta, CSP meta"
