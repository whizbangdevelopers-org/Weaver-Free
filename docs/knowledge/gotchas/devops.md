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

<!-- entry:G-devops-2026-05-13-001 -->
---
id: G-devops-2026-05-13-001
type: gotcha
domain: devops
tags: [engram-ui, quasar, spa, deploy, king]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## engram-ui is a static SPA deployed to king — changes require rebuild + rsync, not a server restart — 2026-05-13 · Claude

**Problem:** After editing `code/tools/engram-ui/src/`, the browser on king shows no change. The natural assumption is "restart the dev server," but there is no running dev server — engram-ui is a Quasar SPA built to `dist/spa/` and rsynced to `king:/var/www/engram-ui/`. No HMR, no live reload.

**Fix:** From `code/tools/engram-ui/`, run:
```bash
npm run deploy:king
```
This chains `quasar build` → `rsync -rl --delete … dist/spa/ king:/var/www/engram-ui/`. Hard-refresh the browser after the rsync completes.

**Rule:** engram-ui changes are never visible until a new build is deployed to king. If something looks unchanged after a code edit, run `deploy:king` before investigating further.

<!-- /entry -->

<!-- entry:G-devops-2026-05-13-002 -->
---
id: G-devops-2026-05-13-002
type: gotcha
domain: devops
tags: [engram-ui, rsync, permissions, king, nginx]
since_version: "1.0.5"
status: active
scope: project
related: [G-devops-2026-05-13-001]
graduated_to: ""
---

## rsync to king:/var/www/engram-ui fails with Permission Denied after initial deploy — 2026-05-13 · Claude

**Problem:** `npm run deploy:king` succeeds on first deploy, but subsequent runs fail with `Permission denied` on every file in `/var/www/engram-ui/`. The directory's files got owned by a system user (root or nginx) after the first rsync — likely because the initial deploy was run as root on king.

**Fix:** On king as root:
```bash
chown -R mark:users /var/www/engram-ui
```
Then retry `npm run deploy:king` from the dev machine — it succeeds cleanly.

**Rule:** If `deploy:king` rsync fails with permission errors, fix ownership on king before investigating further. The web root at `/var/www/engram-ui/` must be owned by `mark` for the dev-machine rsync user to write to it.

<!-- /entry -->

<!-- entry:G-devops-2026-05-18-001 -->
---
id: G-devops-2026-05-18-001
type: gotcha
domain: devops
tags: [node_modules, npm, permissions, sudo, quasar]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Running quasar dev / npm run dev with sudo leaves root-owned files in node_modules — 2026-05-18 · Claude

**Problem:** `rm -rf node_modules` fails with "Permission denied" on `node_modules/.q-cache/dev-spa/vite-spa/deps/` and `node_modules/.q-cache.broken/`. These directories are owned by root because a prior `npm run dev` or `quasar dev` was run under sudo, causing Vite's dep-optimizer to write its cache as root.

**Fix:** Restore ownership before removing:
```bash
sudo chown -R $USER:users node_modules/.q-cache node_modules/.q-cache.broken
rm -rf node_modules
npm install
```

**Rule:** Never run `npm run dev`, `quasar dev`, or any Vite-based dev server under sudo. The Vite dep-optimizer writes to `node_modules/.q-cache/` as the running user — if that user is root, the cache becomes root-owned and blocks future unprivileged `rm -rf node_modules`.

<!-- /entry -->

<!-- entry:G-devops-2026-05-18-002 -->
---
id: G-devops-2026-05-18-002
type: gotcha
domain: devops
tags: [npm, node_modules, git-restore, workspace, dotenv]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-05-18-001]
graduated_to: ""
---

## Ghost package installs survive `npm install --workspace=X` when the package directory still exists — 2026-05-18 · Claude

**Problem:** After restoring accidentally-deleted tracked files via `git ls-files -z -d | xargs -0 git checkout --`, some packages in `backend/node_modules/` had only their `.d.ts` files present but were missing their `.js` entry points (e.g. `dotenv/lib/main.js`). Running `npm install --workspace=backend` did NOT fix this — npm saw the package directory still existed (with `package.json` intact) and skipped reinstalling it, leaving the incomplete install silently in place. The breakage only surfaced at runtime inside the E2E Docker container.

**Fix:** Delete the incomplete package directory first, then reinstall:
```bash
rm -rf backend/node_modules/<package>
npm install --workspace=backend
```

**Rule:** After any bulk file-restore operation (git checkout, rsync, etc.), scan nested workspace `node_modules/` for packages whose `main` field target is absent. Don't rely on `npm install` to self-heal — it won't touch a directory that looks present.

<!-- /entry -->

<!-- entry:G-devops-2026-05-18-003 -->
---
id: G-devops-2026-05-18-003
type: gotcha
domain: devops
tags: [sqlite, wal, deployment, database, file-copy]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Copying a SQLite db over an existing file leaves stale WAL files that mask all new data — 2026-05-18 · Claude

**Problem:** When replacing a SQLite database by copying a new file over the old path (`cp new.db /path/to/old.db`), any existing `.db-wal` and `.db-shm` files at the destination survive. SQLite reads these WAL files on open and applies them on top of the new main db, rolling back or masking the new data entirely. In this case: copied a 55-entry knowledge db over an empty production db (4 KB), but the old WAL files from the empty db represented a zero-entry state — after service restart, every query returned empty despite the main db file containing 55 rows. `dbSizeBytes` reported correctly (73728), confirming the backend saw the file, but all row queries silently returned nothing.

**Fix:** Stop the service before replacing the db, then delete the stale WAL files, copy the new db, fix ownership, and restart:
```bash
systemctl stop weaver
rm -f /var/lib/weaver/engram.db-wal /var/lib/weaver/engram.db-shm
cp /tmp/staging/engram.db /var/lib/weaver/engram.db
chown weaver:weaver /var/lib/weaver/engram.db
systemctl start weaver
```

**Rule:** Any time you replace a SQLite db file in production: (1) stop the consumer first, (2) delete all WAL/SHM siblings at the destination, (3) copy, (4) restore ownership, (5) start. Never hot-swap a SQLite file by copying only the `.db` — the WAL files are part of the logical database.

<!-- /entry -->

<!-- entry:G-devops-2026-06-01-001 -->
---
id: G-devops-2026-06-01-001
type: gotcha
domain: devops
tags: [ssh, config, root, permissions]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-004]
graduated_to: ""
---

## SSH config User must be updated when PermitRootLogin changes — 2026-06-01 · Claude

**Problem:** `~/.ssh/config` aliases that use `User root` silently break when `PermitRootLogin = "no"` is deployed on the target host. The connection is refused with `Permission denied (publickey)` — no indication that the username is the problem, just an auth failure.

**Fix:** Whenever you disable root SSH on a machine, immediately update its `~/.ssh/config` alias to the correct non-root user. This is a one-liner but easy to miss in the moment.

**Rule:** Changing `PermitRootLogin` on any host is a two-file change: the NixOS config AND `~/.ssh/config`. Treat them as an atomic pair.

<!-- /entry -->
