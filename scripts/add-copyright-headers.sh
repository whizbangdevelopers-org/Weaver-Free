#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Proprietary and confidential. Do not distribute.
#
# Adds copyright headers to all project files.
# Two flavors: AGPL (code/) and Proprietary (everything else).
# Safe to re-run — skips files that already have the header.
#
# Usage:
#   ./scripts/add-copyright-headers.sh          # Dry run (report only)
#   ./scripts/add-copyright-headers.sh --apply   # Apply headers
#   ./scripts/add-copyright-headers.sh --check   # Exit 1 if any missing (CI mode)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dry}"
MISSING=0
APPLIED=0
SKIPPED=0

# --- Header text (no comment delimiters) ---

AGPL_LINE1="Copyright (c) 2026 whizBANG Developers LLC. All rights reserved."
AGPL_LINE2="Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE."
AGPL_LINE3=""

PROP_LINE1="Copyright (c) 2026 whizBANG Developers LLC. All rights reserved."
PROP_LINE2="Proprietary and confidential. Do not distribute."

# --- Detect if file is under code/ ---

is_code_file() {
  [[ "$1" == "$PROJECT_ROOT/code/"* ]]
}

# --- Check if file already has copyright header ---

has_copyright() {
  head -10 "$1" 2>/dev/null | grep -q "Copyright (c) 2026 whizBANG Developers LLC" 2>/dev/null
}

# --- Prepend text to file ---

prepend_to_file() {
  local header="$1"
  local file="$2"
  local tmpfile
  tmpfile="$(mktemp)"
  printf '%s\n' "$header" | cat - "$file" > "$tmpfile"
  chmod --reference="$file" "$tmpfile"  # preserve permissions
  mv "$tmpfile" "$file"
}

# --- Insert after shebang (for .sh files) ---

insert_after_shebang() {
  local header="$1"
  local file="$2"
  local tmpfile
  tmpfile="$(mktemp)"
  local first_line
  first_line="$(head -1 "$file")"
  if [[ "$first_line" == "#!"* ]]; then
    {
      echo "$first_line"
      printf '%s\n' "$header"
      tail -n +2 "$file"
    } > "$tmpfile"
  else
    printf '%s\n' "$header" | cat - "$file" > "$tmpfile"
  fi
  chmod --reference="$file" "$tmpfile"  # preserve permissions
  mv "$tmpfile" "$file"
}

# --- Build header for file type ---

build_header() {
  local file="$1"
  local ext="${file##*.}"
  local basename
  basename="$(basename "$file")"

  local line1 line2 line3=""
  if is_code_file "$file"; then
    line1="$AGPL_LINE1"
    line2="$AGPL_LINE2"
    line3="$AGPL_LINE3"
  else
    line1="$PROP_LINE1"
    line2="$PROP_LINE2"
  fi

  case "$ext" in
    md|html)
      if [[ -n "$line3" ]]; then
        printf '<!-- %s -->\n<!-- %s -->\n<!-- %s -->\n' "$line1" "$line2" "$line3"
      else
        printf '<!-- %s -->\n<!-- %s -->\n' "$line1" "$line2"
      fi
      ;;
    ts|tsx|js|jsx|mjs|cjs)
      if [[ -n "$line3" ]]; then
        printf '// %s\n// %s\n// %s\n' "$line1" "$line2" "$line3"
      else
        printf '// %s\n// %s\n' "$line1" "$line2"
      fi
      ;;
    vue)
      if [[ -n "$line3" ]]; then
        printf '<!-- %s -->\n<!-- %s -->\n<!-- %s -->\n' "$line1" "$line2" "$line3"
      else
        printf '<!-- %s -->\n<!-- %s -->\n' "$line1" "$line2"
      fi
      ;;
    css|scss)
      if [[ -n "$line3" ]]; then
        printf '/* %s */\n/* %s */\n/* %s */\n' "$line1" "$line2" "$line3"
      else
        printf '/* %s */\n/* %s */\n' "$line1" "$line2"
      fi
      ;;
    nix)
      if [[ -n "$line3" ]]; then
        printf '# %s\n# %s\n# %s\n' "$line1" "$line2" "$line3"
      else
        printf '# %s\n# %s\n' "$line1" "$line2"
      fi
      ;;
    sh|bash)
      if [[ -n "$line3" ]]; then
        printf '# %s\n# %s\n# %s\n' "$line1" "$line2" "$line3"
      else
        printf '# %s\n# %s\n' "$line1" "$line2"
      fi
      ;;
    yml|yaml)
      if [[ -n "$line3" ]]; then
        printf '# %s\n# %s\n# %s\n' "$line1" "$line2" "$line3"
      else
        printf '# %s\n# %s\n' "$line1" "$line2"
      fi
      ;;
    *)
      # Unknown extension — skip
      return 1
      ;;
  esac
}

# --- Process a single file ---

process_file() {
  local file="$1"
  local relpath="${file#$PROJECT_ROOT/}"

  if has_copyright "$file"; then
    ((SKIPPED++)) || true
    return
  fi

  local header
  if ! header="$(build_header "$file")"; then
    return  # unsupported extension
  fi

  ((MISSING++)) || true

  if [[ "$MODE" == "--apply" ]]; then
    local ext="${file##*.}"
    if [[ "$ext" == "sh" || "$ext" == "bash" ]]; then
      insert_after_shebang "$header" "$file"
    else
      prepend_to_file "$header" "$file"
    fi
    ((APPLIED++)) || true
  else
    echo "  MISSING: $relpath"
  fi
}

# --- Skip patterns ---

should_skip() {
  local file="$1"
  local relpath="${file#$PROJECT_ROOT/}"
  local basename
  basename="$(basename "$file")"

  # Skip directories
  [[ "$relpath" == *"/node_modules/"* ]] && return 0
  [[ "$relpath" == *"/dist/"* ]] && return 0
  [[ "$relpath" == *"/.quasar/"* ]] && return 0
  [[ "$relpath" == *"/.git/"* ]] && return 0
  [[ "$relpath" == *"/coverage/"* ]] && return 0
  [[ "$relpath" == *"/.output/"* ]] && return 0
  [[ "$relpath" == *"/e2e-docker/output/"* ]] && return 0
  [[ "$relpath" == *"/test-results/"* ]] && return 0
  [[ "$relpath" == *"/playwright-report/"* ]] && return 0

  # Skip specific files
  [[ "$basename" == "LICENSE" ]] && return 0
  [[ "$basename" == "LICENSE.md" ]] && return 0
  [[ "$basename" == ".gitkeep" ]] && return 0
  [[ "$basename" == ".gitignore" ]] && return 0
  [[ "$basename" == ".env"* ]] && return 0
  [[ "$basename" == "package-lock.json" ]] && return 0

  # Skip binary / data files (no comment syntax)
  [[ "$basename" == *.json ]] && return 0
  [[ "$basename" == *.png ]] && return 0
  [[ "$basename" == *.jpg ]] && return 0
  [[ "$basename" == *.ico ]] && return 0
  [[ "$basename" == *.svg ]] && return 0
  [[ "$basename" == *.woff2 ]] && return 0
  [[ "$basename" == *.ttf ]] && return 0
  [[ "$basename" == *.map ]] && return 0
  [[ "$basename" == *.lock ]] && return 0
  [[ "$basename" == *.patch ]] && return 0

  # Skip empty files
  [[ ! -s "$file" ]] && return 0

  return 1
}

# --- Main ---

echo "Copyright Header Scanner"
echo "========================"
echo "Project: $PROJECT_ROOT"
echo "Mode: ${MODE}"
echo ""

# Find all text files
while IFS= read -r -d '' file; do
  should_skip "$file" && continue
  process_file "$file"
done < <(find "$PROJECT_ROOT" -type f \
  \( -name '*.md' -o -name '*.ts' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \
     -o -name '*.vue' -o -name '*.css' -o -name '*.scss' -o -name '*.nix' \
     -o -name '*.sh' -o -name '*.bash' -o -name '*.yml' -o -name '*.yaml' \
     -o -name '*.html' \) \
  -not -path '*/.git/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/.quasar/*' \
  -print0 2>/dev/null | sort -z)

echo ""
echo "Results:"
echo "  Already has header: $SKIPPED"
echo "  Missing header:     $MISSING"
if [[ "$MODE" == "--apply" ]]; then
  echo "  Headers applied:    $APPLIED"
fi

if [[ "$MODE" == "--check" && "$MISSING" -gt 0 ]]; then
  echo ""
  echo "FAIL: $MISSING files missing copyright headers."
  exit 1
fi

if [[ "$MODE" != "--apply" && "$MISSING" -gt 0 ]]; then
  echo ""
  echo "Run with --apply to add headers."
fi
