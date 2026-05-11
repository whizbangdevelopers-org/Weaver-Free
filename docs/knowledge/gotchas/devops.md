<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — devops

Known gotchas in the **devops** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-devops-2026-05-10-001 -->
---
id: G-devops-2026-05-10-001
type: gotcha
domain: devops
tags: [bash, heredoc, for-loop, shell]
since_version: "1.0.5"
status: active
related: []
graduated_to: ""
---

## bash heredoc closing delimiter must be flush-left inside for loops — 2026-05-10 · Claude

**Problem:** A bash `for` loop that uses heredoc to write file content silently fails when the closing `EOF` marker has leading whitespace (spaces or tabs from indentation). Bash does not recognise an indented `EOF` as the heredoc terminator, so it continues consuming the rest of the loop body — and sometimes subsequent iterations — as literal heredoc text instead of executing them. The result: only one file is created, named after the concatenated loop variable values, with garbage content.

```bash
# BROKEN — indented EOF is not recognised as terminator
for domain in frontend backend testing; do
  cat > "lessons/${domain}.md" <<EOF
    # ${domain}
    EOF   ← bash does not see this as EOF (indented)
done
```

**Fix:** The closing delimiter must be flush-left (column 0), with no leading whitespace:

```bash
for domain in frontend backend testing; do
  cat > "lessons/${domain}.md" <<EOF
# ${domain}
EOF
done
```

Alternatively, use `printf '%s\n'` which has no delimiter issues:

```bash
for domain in frontend backend testing; do
  printf '%s\n' "# ${domain}" > "lessons/${domain}.md"
done
```

**Rule:** Never indent heredoc closing delimiters inside loops or functions. If indentation is needed for readability, use `<<-EOF` (strips leading tabs only, not spaces) or switch to `printf`.

<!-- /entry -->
