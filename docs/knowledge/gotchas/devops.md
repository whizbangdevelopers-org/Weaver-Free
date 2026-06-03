<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — devops

Known gotchas in the **devops** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-devops-2026-05-10-001 -->
---
id: G-devops-2026-05-10-001
scope: transferable
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

<!-- entry:G-devops-2026-06-02-001 -->
---
id: G-devops-2026-06-02-001
type: gotcha
domain: devops
tags: [nfs, synology, ds214play, permissions, nat, nfsv3]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-001]
graduated_to: ""
---

## Synology DS214play NFS: v3-only, and mangles a 777 share root to 000 for NAT'd clients — 2026-06-02 · Claude

**Problem:** Two DS214play NFS surprises. (1) No NFSv4.1 — a v4.1 mount fails `Protocol not supported`; this model is NFSv3-only regardless of the DSM NFSv4 toggle. (2) The export root `/volume1/<share>`, mode `0777` on the NAS, was presented to a NAT-masqueraded client as mode `000` — root could traverse (ignores perms) but a *service user* got EACCES on the directory even though the file inside was world-readable. `ls -ld` showed `d---------` on the consumer while the NAS and a same-subnet client both saw `drwxrwxrwx`.

**Fix:** (1) Mount v3: `nfsvers=3,nolock`. (2) `chmod 755` the share dir and `644` the files (from a host with rw access) — `755` passes the NAS's NFS perm mapping cleanly where `777` got mangled to `000`. Persist it; files later downloaded into the share need the same chmod.

**Rule:** On Synology NFS prefer `755/644` over `777` — `777` can come across the wire as `000` for masqueraded/mapped clients — and treat DS214play as NFSv3-only. Diagnosis: if root reads a file fine but a service user gets EACCES, check the mount-root dir mode the *service user* sees (`ls -ld`), not the file's mode.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-002 -->
---
id: G-devops-2026-06-02-002
type: gotcha
domain: devops
tags: [npm-workspaces, npm-ci, ci, devdependencies, pruning]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `cd <workspace> && npm ci` prunes root devDependencies in a workspaces project — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-17)

**Problem:** A CI workflow runs `npm ci` at root, then `cd backend && npm ci`, then `cd tui && npm ci`. The next step (`npm run build`) fails with `sh: 1: quasar: not found` even though `quasar` is a root-level devDependency. With npm workspaces and a single root lockfile, running `npm ci` inside a workspace subdirectory reinstalls the hoisted root `node_modules` filtered to that workspace's closure — effectively *pruning* root-only devDeps like `@quasar/app-vite`.

**Fix:** A workspaces project needs exactly one `npm ci`, at the root. Remove every per-workspace `cd && npm ci` step.

```yaml
# Wrong — second/third steps prune root devDeps
- run: npm ci
- run: cd backend && npm ci
- run: cd tui && npm ci
- run: npm run build:all   # quasar: not found

# Right — single root install covers all workspaces
- run: npm ci
- run: npm run build:all
```

**Rule:** In a workspaces project `npm ci` runs exactly once at the root. When converting to workspaces, grep every workflow and script for `cd <workspace> && npm ci` and `--prefix <workspace> install` and migrate them in the same commit — they prune root deps now.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-003 -->
---
id: G-devops-2026-06-02-003
type: gotcha
domain: devops
tags: [github-actions, jobs, checkout, runner, filesystem]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## GitHub Actions jobs run on fresh runners — no shared filesystem between jobs — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-18)

**Problem:** A multi-job workflow has an `update-nur` job that greps `code/nixos/package.nix` for a hash. It passes until the workflow is refactored to add a job before it — then `code/nixos/package.nix` is missing and grep fails with "No such file or directory." Each job runs on a separate, freshly-provisioned runner; files checked out in one job do not carry over to any other.

**Fix:** Add an explicit `uses: actions/checkout@<sha>` step at the top of every job that reads repo files. Match the `path:` used by other jobs and reference files through it:

```yaml
- name: Checkout repository
  uses: actions/checkout@<sha>
  with:
    path: dev
# then read dev/code/nixos/package.nix, not code/nixos/package.nix
```

**Rule:** Every job that touches the filesystem needs its own checkout step. Never assume a prior job's working tree is available. When adding a new job to a workflow, audit every subsequent job for a missing checkout.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-004 -->
---
id: G-devops-2026-06-02-004
type: gotcha
domain: devops
tags: [github-actions, setup-node, cache, working-directory, monorepo, subdir]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Workflows for `code/`-subdirectory repos need cache-dependency-path + working-directory on every step — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-10)

**Problem:** `actions/setup-node` with `cache: 'npm'` searches the repo root for `package-lock.json`. When code lives in a `code/` subdirectory, it fails with "Dependencies lock file is not found." A workflow written for a flat layout then fails step-by-step: `npm ci` and build commands run from root, and `dist/spa` references are root-relative.

**Fix:** Set `cache-dependency-path: code/package-lock.json` on `setup-node`, add `working-directory: code` (or `defaults.run.working-directory: code`) to install/build steps, and prefix all path references (`dist/spa` → `code/dist/spa`). Note `path:` in `upload-artifact`/`download-artifact` is repo-root-relative and does NOT inherit `working-directory` — artifact paths need explicit `code/` prefixes.

**Rule:** Any workflow job that builds, installs, or references files from a `code/` subdirectory must set `cache-dependency-path`, set `working-directory`, and use full paths everywhere else. When copying a workflow from a template or flat-layout project, audit every path assumption before the first real run.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-005 -->
---
id: G-devops-2026-06-02-005
type: gotcha
domain: devops
tags: [rsync, sync-exclude, delete-excluded, anchor, git-protect, mirror]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-004]
graduated_to: ""
---

## rsync `--exclude` semantics: leave cruft, match at any depth, and trash `.git` under `--delete-excluded` — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** Three compounding rsync traps broke rebuild-from-source on the Free mirror. (1) `--delete --exclude=X` only stops *copying* X — it does NOT delete a previously-synced X already on the destination, so adding an exclude after the fact leaves invisible cruft that breaks downstream builds (`UNLOADABLE_DEPENDENCY: Could not load src/pages/fabrick/LoomPage.vue`). (2) An exclude pattern without a leading `/` matches at ANY depth — `- data/` killed both top-level `data/` and `backend/data/distro-catalog.json` (a real shipped file). (3) Once `--delete-excluded` is added to clean cruft, combining it with `--exclude='.git'` deletes the destination clone's own `.git`, leaving "not a git repository."

**Fix:** (1) Pair `--delete` with `--delete-excluded` so the destination reflects current exclusion state. (2) Anchor top-level-only patterns with a leading `/` (`- /data/`, `- /reports/`); omit the slash only when you genuinely want any-depth matching (e.g. `dist/` to also catch `backend/dist/`). (3) Protect structural destination paths with `--filter='P /.git'` placed BEFORE the exclude rules — protect rules must precede excludes in rsync's filter chain.

**Rule:** Every entry in a sync-exclude list needs a deliberate anchor decision, and every `--delete-excluded` rsync into a git working tree needs `--filter='P /.git'`. `--delete-excluded` is a force multiplier — it escalates every latent exclude bug from silent-skip to active-delete, so audit existing exclude patterns before flipping it on. `audit:sync-exclude-cruft` enforces `--delete-excluded` presence.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-006 -->
---
id: G-devops-2026-06-02-006
type: gotcha
domain: devops
tags: [rsync, release, sync-to-free, source-path, content-leak, parity]
since_version: "1.0.5"
status: active
scope: project
related: [G-devops-2026-06-02-005]
graduated_to: ""
---

## release.yml and sync-to-free.yml must share source-path semantics or internal content leaks — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** `sync-to-free.yml` correctly rsynced `source/code/ target/` (Dev's `code/` → Free root), but `release.yml` had a parallel copy that rsynced `dev/ free/` (Dev's whole repo → Free root). The exclude patterns are `code/`-relative, so Dev-root content (`MASTER-PLAN.md`, `business/`, `portfolio/`, `agents/`, `NOTES.md`) fell through and landed on Free. The bug was latent for multiple releases because `--delete-excluded` was absent; adding it flipped rsync into "make destination match source" mode and the first release commit added 72,807 lines of internal strategy to the public mirror.

**Fix:** Change `rsync ... dev/ free/` → `rsync ... dev/code/ free/`. Sync repo-root `.github/` config in a SEPARATE step (`dev/.github/ free/.github/`) with its own exclude set.

**Rule:** Any time two workflows both "sync Dev → Free," they MUST share identical source-path semantics — ideally via a reusable workflow or composite action both call. Short of that, `audit:release-rsync-paths` statically verifies every rsync invocation uses `dev/code/` (or `dev/.github/`) as its source, never `dev/`. `--delete-excluded` escalates *every* latent source-path bug from silent-skip to active-overwrite.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-007 -->
---
id: G-devops-2026-06-02-007
type: gotcha
domain: devops
tags: [nix, fetchfromgithub, nar-hash, sri, nur, dispatch]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-02-010]
graduated_to: ""
---

## fetchFromGitHub wants the NAR hash in SRI format — not the tarball's hex sha256 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-18)

**Problem:** A CI step computes a source hash with `curl -sL <url> | sha256sum` and dispatches it to a NUR receiver. The Nix build fails with "hash mismatch in fixed-output derivation." Two distinct mistakes hide here: (1) `fetchFromGitHub` expects **SRI format** (`sha256-<base64>`), not raw hex; and (2) it passes the tarball through `fetchzip`, which *unpacks* the archive and computes the **NAR hash of the extracted tree** — a completely different value from the raw tarball bytes that `sha256sum` produces.

**Fix:** Compute the unpacked NAR hash and convert to SRI in one step:

```bash
NIX32=$(nix-prefetch-url --unpack --type sha256 \
  "https://github.com/OWNER/REPO/archive/refs/tags/${VERSION}.tar.gz")
SRI=$(nix hash convert --hash-algo sha256 --from nix32 --to sri "$NIX32")
```

Then dispatch `$SRI`; the receiver's `sed` drops it into `hash = "sha256-..."`.

**Rule:** Never compute a `fetchFromGitHub`/`fetchzip`/`fetchurl { unpack = true; }` hash with `curl | sha256sum`. Use `nix-prefetch-url --unpack` (NAR hash) and emit SRI. A "hash mismatch" for a tarball-based fetcher is almost always hash-type confusion (raw tarball vs NAR) or format confusion (hex vs SRI). A documented-but-unenforced version of this gotcha let `release.yml` keep using `curl | sha256sum` and broke NUR for several releases — pair the rule with an auditor.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-008 -->
---
id: G-devops-2026-06-02-008
type: gotcha
domain: devops
tags: [npm-deps-hash, package-lock, nur, audit-fix, nix]
since_version: "1.0.5"
status: active
scope: project
related: [G-nixos-2026-06-02-010, G-devops-2026-06-02-007]
graduated_to: ""
---

## Any package-lock.json change requires an npmDepsHash bump or NUR builds fail — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** Ran `npm audit fix` (or `npm update`, or a dep add/remove). Dev typechecks and builds fine, but NUR dispatch fails with "hash mismatch in fixed-output derivation" for `-npm-deps`. `npmDepsHash` in `code/nixos/package.nix` is a content-addressed hash of the resolved lockfile tree — any lockfile change changes it, and even a non-breaking `audit fix` updates the lockfile.

**Fix:** Update `npmDepsHash` in `code/nixos/package.nix` to the new value: run a Nix build with the old hash and copy the "got" hash from the error, or trigger the NUR update workflow with an explicit `npmDepsHash` input. `audit:nix-deps-hash` enforces the package.nix-matches-lockfile pairing on every push.

**Rule:** Treat `npmDepsHash` as a generated artifact tied to `package-lock.json`. Any lockfile change — non-breaking audit fix included — requires an `npmDepsHash` bump in the same commit. It is load-bearing for downstream Nix builds; never ship a dep change without it.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-009 -->
---
id: G-devops-2026-06-02-009
type: gotcha
domain: devops
tags: [github-actions, rerun, tag-trigger, ci-fix, workflow-file]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-005]
graduated_to: ""
---

## `gh run rerun` replays the original workflow file, not current main — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-10)

**Problem:** A CI fix is merged to `main` but rerunning a failed workflow on an existing tag still fails with the same error. `gh run rerun <id>` (and the UI "Re-run all jobs") replays the workflow at *the commit that originally triggered the run* — for a tag-triggered workflow, the commit the tag points to. A workflow-file change on `main` does not reach reruns of tag-triggered jobs.

**Fix:** Pick a non-destructive option: (a) `git worktree add /tmp/build <tag>` at the tagged commit, build artifacts with the fixed approach, and `gh release upload`; (b) add a `workflow_dispatch` trigger and dispatch with a tag input; or (c) cut a new patch tag (v1.0.1) that includes the fix. Only move the tag (`git tag -f`) if no published release points to it — otherwise it's destructive.

**Rule:** When fixing a broken CI workflow for an already-tagged release, don't expect rerun to pick up the fix. Choose worktree-build-and-upload, manual dispatch, or a new patch tag. Don't force-move tags that already have published releases.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-010 -->
---
id: G-devops-2026-06-02-010
type: gotcha
domain: devops
tags: [github-actions, secrets, if-expression, schema, workflow-file-issue]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `secrets.*` in an `if:` expression is a schema violation that fails every push silently — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** A badge-update step had `if: github.ref == 'refs/heads/main' && ... && secrets.GIST_TOKEN != ''`. GitHub Actions rejected the workflow schema with a generic "This run likely failed because of a workflow file issue" on every push for weeks — the workflow never actually ran. The pre-push hook was the only gate, and nobody spot-checked the Actions tab.

**Fix:** Remove `secrets.*` from `if:` (GitHub blocks it to prevent secret-existence leaks). Use `env:` indirection at job level, or check the token inside a `run:` step. Steps with `continue-on-error: true` will fail silently on a missing token and let the workflow complete.

**Rule:** `secrets.*` is valid in `with:` / `run:` / `env:` blocks, NOT in `if:`. When you see "workflow file issue" on every push, check for `secrets.*` in `if:` first — before parsing YAML or chasing action SHAs. Also set up CI-status monitoring beyond the pre-push hook so "failed every push for weeks" can't be the first signal.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-011 -->
---
id: G-devops-2026-06-02-011
type: gotcha
domain: devops
tags: [github-secrets, naming-convention, workflow, pat, drift]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-004]
graduated_to: ""
---

## Secret-name drift between workflows fails the release with "Input required and not supplied" — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** `release.yml` referenced `secrets.WEAVER_SYNC` while `sync-to-free.yml` referenced `secrets.WEAVER_FREE_SYNC`. The actual secret is `WEAVER_FREE_SYNC`, so release.yml's "Release to Free Repo" job failed with "Input required and not supplied: token" — `WEAVER_SYNC` doesn't exist, and a non-existent secret resolves to empty.

**Fix:** Align secret names across all workflows to the `${PRODUCT}_${TIER}_${PURPOSE}` convention — `WEAVER_FREE_SYNC` (product Weaver, tier Free, purpose Sync). When release automation blocks mid-flight on this, the right fallback is to do the failed step manually (create the Free tag via API, download Dev artifacts, `gh release create` on Free) and commit the workflow fix separately.

**Rule:** When adding a secret reference to a workflow, grep existing workflows for sibling references and match the name exactly — don't invent a shorter abbreviation. The naming convention doc is canonical; one PAT per target repo, tier-prefixed.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-012 -->
---
id: G-devops-2026-06-02-012
type: gotcha
domain: devops
tags: [github-attestation, private-repo, openssf, continue-on-error, pragma]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## GitHub attestation fails on private repos (free plan) — soft-fail with a documented pragma — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-10)

**Problem:** `actions/attest-build-provenance` calls the GitHub Attestations API, available only on public repos or orgs with a paid plan. On a private repo (free org plan) it fails with "Feature not available for the organization," breaking the release job.

**Fix:** Add `continue-on-error: true` to the attestation step PLUS an explicit pragma so the OpenSSF baseline auditor recognizes it as intentional, not a hidden regression:

```yaml
# openssf-baseline-allow: attest-continue-on-error (private repo + free org plan)
- name: Attest build provenance
  uses: actions/attest-build-provenance@<sha>
  continue-on-error: true
```

`audit:openssf-baseline`'s Signed-Releases check passes when the `openssf-baseline-allow: attest-continue-on-error` pragma is present and fails when `continue-on-error: true` appears without it.

**Rule:** Use the documented pragma when a soft-fail is intentional and constraint-driven (billing, repo visibility). Remove both the pragma and `continue-on-error` together when the constraint lifts (org upgrade, or the workflow moves to the public mirror). Undocumented `continue-on-error: true` silently hides real regressions — never game the auditor by adding it bare.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-013 -->
---
id: G-devops-2026-06-02-013
type: gotcha
domain: devops
tags: [cachix, install-nix-action, sha-pin, floating-tag, stale-pin]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-012]
graduated_to: ""
---

## cachix/install-nix-action SHA pins go stale when upstream force-moves major-version tags — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Problem:** A GitHub Action pinned by SHA (`cachix/install-nix-action@<sha>`) fails with "unable to find version `<sha>`" when the upstream repo rewrites or deletes commits. Cachix uses floating major-version tags (e.g. `v31`) they periodically move forward — rewriting history under any SHA derived from the old tag object, making the pin unreachable.

**Fix:** Re-pin to the latest *patch* release SHA, not the floating major tag's current deref:

```bash
# Latest patch SHA directly (stable — preferred):
gh api repos/cachix/install-nix-action/tags --jq '.[0] | {name, sha: .commit.sha}'
```

Use a `vX.Y.Z` patch-tag commit (e.g. `v31.10.5`), never the floating `vX` tag, to avoid the next force-move.

**Rule:** At every SHA-pin renewal cycle, verify the pinned SHA is still reachable (`gh api repos/<owner>/<repo>/commits/<sha>`). For `cachix/install-nix-action` specifically, pin to the latest patch-tag commit. `audit:openssf-baseline` verifies actions are pinned but not that the pin is still reachable — add a rotation reminder at the same cadence to catch stale pins before CI breaks.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-014 -->
---
id: G-devops-2026-06-02-014
type: gotcha
domain: devops
tags: [cosign, sigstore, version-pin, sign-blob, signed-releases]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## cosign v3 dropped legacy sign-blob output flags — pin the installer to v2.x — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** `release.yml` used `cosign sign-blob --output-signature "${file}.sig" --output-certificate "${file}.pem"`. With `sigstore/cosign-installer` unpinned, GitHub installed cosign v3.0.5, which made sign-blob require `--bundle <path>` or `--new-bundle-format`. The legacy flags became an error: `must provide --new-bundle-format or --bundle where applicable`. `--new-bundle-format=false` was also rejected (v3 treats `=false` as "not provided").

**Fix:** Pin cosign to v2.x in the installer:

```yaml
- name: Install Cosign
  uses: sigstore/cosign-installer@<sha>
  with:
    cosign-release: 'v2.5.3'  # preserves --output-signature / --output-certificate
```

**Rule:** Version-pin any unpinned tool that emits to a stable artifact contract (cosign outputs consumed by README + downstream verifiers). Migrating to cosign v3's `--bundle` format is a deliberate change requiring coordinated updates to README verification examples and consumer scripts — not something to absorb silently from an upstream minor bump. Track major-version jumps of SHA-pinned actions at renewal time.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-015 -->
---
id: G-devops-2026-06-02-015
type: gotcha
domain: devops
tags: [branch-protection, force-push, admin, github-api, emergency-reset]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Branch protection blocks admin force-push when allow_force_pushes=false — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** Emergency containment required force-resetting the Free mirror's `main` to a pre-release commit (to scrub a content leak). Even as an admin with `enforce_admins: false`, the force-push was rejected with HTTP 422 `Changes must be made through a pull request. Cannot force-push to this branch`. `allow_force_pushes: false` applies to admins too.

**Fix:** A three-step atomic procedure — back up protection, loosen minimally, reset, re-lock:

```bash
gh api "repos/OWNER/REPO/branches/main/protection" > /tmp/bp-backup.json
gh api -X PUT "repos/OWNER/REPO/branches/main/protection" --input - <<'EOF'
{ "required_status_checks": null, "enforce_admins": false,
  "required_pull_request_reviews": null, "restrictions": null,
  "allow_force_pushes": true, "allow_deletions": false }
EOF
gh api -X PATCH "repos/OWNER/REPO/git/refs/heads/main" -f sha="<target>" -F force=true
# then PUT protection back with allow_force_pushes: false
```

**Rule:** Emergency reset of a protected branch is loosen → reset → re-lock, kept as short as possible. The procedure needs admin token scope — document who has admin rights and how to reach them, since an incident at 3am otherwise stalls. Never leave `allow_force_pushes: true` enabled longer than the reset itself.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-016 -->
---
id: G-devops-2026-06-02-016
type: gotcha
domain: devops
tags: [dependabot, sync-mirror, one-way, dep-bump, scorecard]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-004]
graduated_to: ""
---

## Dependabot PRs on a one-way sync mirror cannot be merged usefully — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** `.github/dependabot.yml` was un-excluded from the Dev→Free sync so Scorecard's Dependency-Update-Tool check would see it on the Free mirror. As a side effect Dependabot also runs on Free and opens its own PRs. Merging any of them is wasted effort — the next Dev→Free sync force-overwrites Free's main (with `--delete`), wiping the merged bumps.

**Fix:** Apply dep bumps manually on Dev (edit package.json / workflow YAMLs, `npm install`, commit on Dev); let Free's Dependabot PRs auto-close when the next sync brings Dev's bumped lockfile. OR disable Dependabot on the Free repo at the GitHub-settings level while keeping `.github/dependabot.yml` present for Scorecard detection.

**Rule:** For one-way sync-mirror repos, never merge dep bumps (or any automation PR) on the mirror — the authoritative repo is the source. Mirror PRs exist only because Dependabot can't know the repo is a mirror; treat them as informational, close them, or disable the feature on the mirror.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-017 -->
---
id: G-devops-2026-06-02-017
type: gotcha
domain: devops
tags: [pat, gist, fine-grained, classic, account-scoped, 403]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Fine-grained PATs fail with 403 on gists despite correct permissions — use a classic PAT — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Problem:** `schneegans/dynamic-badges-action` (writes badge JSON to a gist) returned `403 Forbidden` with a fine-grained PAT correctly configured (owner = gist owner, `Gists: Read and write`). The token was recognized in logs but the Gists API PATCH was rejected. A classic PAT with only `gist` scope worked identically-configured. A related trap: after switching PATs, the action returned `404` because the gist ID belonged to a different account than the new PAT — GitHub returns 404 (not 403) when a token can't write to a gist it doesn't own.

**Fix:** Use a **classic PAT with only the `gist` scope** for any Action that writes to gists, and ensure the gist ID and the PAT are owned by the **same GitHub account**. When migrating gist ownership, recreate the gist under the new account and update both the gist-ID secret and the PAT secret atomically.

**Rule:** For account-scoped GitHub resources (gists, user projects, starred lists), default to a classic PAT with minimum scope — fine-grained PATs have known-inconsistent behavior there. Fine-grained tokens are correct for repo-scoped resources (Contents, Pull requests, Actions). When a gist-writing Action returns 403 and the config looks right, suspect PAT *type* before PAT *scope*; a 404 means the gist/PAT accounts don't match.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-018 -->
---
id: G-devops-2026-06-02-018
type: gotcha
domain: devops
tags: [quasar, pwa, build-output, dist-path, artifact]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Quasar PWA build outputs to dist/pwa/, not dist/spa/ — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-10)

**Problem:** `quasar build -m pwa` outputs to `dist/pwa/`, not `dist/spa/`. A workflow (or deploy script) referencing `dist/spa/` fails the tarball/artifact step with "Cannot open: No such file or directory."

**Fix:** Match every downstream path to the actual build mode's output directory: PWA → `dist/pwa/`, SPA → `dist/spa/`.

**Rule:** When changing the Quasar build mode, update all downstream paths together — tarball steps, artifact uploads, deployment scripts, and any nginx/web-root sync.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-019 -->
---
id: G-devops-2026-06-02-019
type: gotcha
domain: devops
tags: [docker, build-context, entrypoint, module-not-found, guard]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Docker entrypoints fail on scripts that live outside the build context — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-06)

**Problem:** `npm run generate:versions` calls `npx tsx ../scripts/delivery-projection.ts`. The Docker build context is `code/`, so a script at the project root (`scripts/`) is never copied into the image — the entrypoint fails with `ERR_MODULE_NOT_FOUND`.

**Fix:** Guard the call so it no-ops when the out-of-context script is absent (the generated output is checked into source, so skipping regeneration in Docker is safe):

```bash
if [ -f "../scripts/delivery-projection.ts" ]; then npm run generate:versions; fi
```

**Rule:** Docker entrypoints must handle scripts that live outside the build context — either copy them in via the Dockerfile, or guard with an existence check when the generated artifact is already committed.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-020 -->
---
id: G-devops-2026-06-02-020
type: gotcha
domain: devops
tags: [docker, playwright, chromium, shm-size, segfault, e2e]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Playwright Chromium SIGSEGV in Docker — raise shm_size and mem_limit — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-06)

**Problem:** Playwright Chromium crashes with `Received signal 11 SI_KERNEL` (segfault) during demo E2E tests in Docker, causing flaky failures. The default 2g shared memory is insufficient for Chromium with the full SPA build.

**Fix:** Increase container resources in `docker-compose.yml`: `shm_size: '4g'` and `mem_limit: '8g'`.

**Rule:** When Playwright shows random browser crashes in Docker, raise `shm_size` and `mem_limit` before investigating test logic — Chromium segfaults under shared-memory pressure are a resource symptom, not a test-logic bug.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-021 -->
---
id: G-devops-2026-06-02-021
type: gotcha
domain: devops
tags: [git, sudo, identity, ssh-alias, safe-directory]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## git under sudo breaks identity, SSH host aliases, and safe.directory — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-04)

**Problem:** `sudo ./script.sh` runs git as root and hits three failures: (1) root has no `user.name`/`user.email`; (2) custom SSH host aliases (e.g. `github.com-wriver4`) live in the calling user's SSH config, not root's; (3) git refuses to operate on a repo owned by another user (`safe.directory`).

**Fix:** Split commit from push. Commit as root with exported identity read from `$SUDO_USER`'s config (`GIT_AUTHOR_NAME`/`GIT_COMMITTER_NAME`/email) and process-scoped `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` for safe.directory; push as `sudo -u $SUDO_USER` so the calling user's SSH config and keys apply. Remove nested `sudo` calls so the env vars propagate.

**Rule:** When a script needs git under sudo, never assume root inherits the invoking user's git/SSH context — commit (root + exported identity) and push (calling user + SSH keys) are separate steps with separate environments.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-022 -->
---
id: G-devops-2026-06-02-022
type: gotcha
domain: devops
tags: [nur, meta-broken, placeholder-hash, nix-instantiate, registration]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-007]
graduated_to: ""
---

## NUR packages with placeholder hashes need meta.broken=true and two-step registration — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Problem:** Two NUR surprises. (1) A package with a placeholder `src.hash` (`sha256-AAAA...`) passes `nix-instantiate` (what NUR's evaluator runs) but fails at fetch time for anyone running `nix-build` — and NUR guidelines require packages to either build or declare `meta.broken = true`, else NUR shows it as installable then fails users. (2) A working `nur-packages` repo with green CI does NOT make packages available via `pkgs.nur.repos.<name>.*` — NUR needs a separate one-time PR to `nix-community/NUR`'s `repos.json` registering the namespace; until merged, the lookup silently fails for everyone.

**Fix:** (1) Set `meta.broken = true` until real hashes are committed; the release update workflow removes it (`sed -i '/broken = true/d'`) alongside the real hashes. In CI, use `nix-instantiate -A <pkg>` for broken packages and `nix-build` only after real hashes land. (2) After CI passes on all channels, open a clean PR to `nix-community/NUR` adding exactly one alphabetically-sorted entry to `repos.json` (1 commit, 1 file, 2–4 line diff — never touch `repos.json.lock` or NUR infra).

**Rule:** A NUR package without a live release tarball carries `meta.broken = true`, removed only by the update workflow with the real hashes. CI green ≠ publicly available — registration in `nix-community/NUR/repos.json` is a separate required step.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-023 -->
---
id: G-devops-2026-06-02-023
type: gotcha
domain: devops
tags: [nur, repos-json, jq, formatter, ci]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-022]
graduated_to: ""
---

## NUR repos.json CI: `jq -S .` is the wrong formatter (2-space vs Python's 4-space) — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Problem:** A PR to `nix-community/NUR` fails CI with "repos.json was not formatted before committing." The CI error recommends `jq -S . repos.json > repos.json.formatted`, but running it produces no local diff — yet CI still fails. NUR's `ci/nur/format_manifest.py` uses Python's `json.dump(..., indent=4, sort_keys=True)` with a trailing newline (4-space indent); `jq -S .` defaults to 2-space indent. They are not equivalent, so jq produces no diff while CI's formatter produces a whole-file diff.

**Fix:** Run NUR's own formatter — either `nix run . -- format-manifest`, or the Python equivalent:

```bash
python3 -c "
import json, shutil
manifest = json.load(open('repos.json'))
with open('repos.json.tmp', 'w+') as f:
    json.dump(manifest, f, indent=4, sort_keys=True); f.write('\n')
shutil.move('repos.json.tmp', 'repos.json')
"
```

**Rule:** Never format NUR's `repos.json` with `jq`. NUR's CI uses `format_manifest.py` (4-space + trailing newline); use the Python one-liner or `nix run . -- format-manifest` directly.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-024 -->
---
id: G-devops-2026-06-02-024
type: gotcha
domain: devops
tags: [nur, pull-request, base-branch, master-main, ci-stuck]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-022]
graduated_to: ""
---

## NUR PRs default to the master base and stall CI; rebases replay spurious upstream commits — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Three NUR PR mechanics bite. (1) A new PR's base defaults to NUR's old `master` branch; the diff shows a conflict `>>>>>>> master` containing `builtins.throw "The NUR master branch has been renamed to main"`, and CI never runs because the branch is conflicted. (2) After a force push or base change, required checks sit at "Expected — Waiting for status to be reported" indefinitely because the `synchronize` webhook didn't fire. (3) A `git rebase upstream/main` sometimes replays intermediate upstream commits as new commits (git matches patch content, not hashes; changed context defeats the match), leaving the branch ahead of `upstream/main` with confusing extra commits.

**Fix:** (1) On the PR page, Edit → change `base:` from `master` to `main` (no git changes needed). (2) Push an empty commit to force `synchronize`: `git commit --allow-empty -m "chore: re-trigger CI" && git push`. (3) After any rebase, check `git log --oneline upstream/main..your-branch` — it should show only your commits; drop spurious ones with `git rebase --onto upstream/main <last-spurious-hash> your-branch`.

**Rule:** When opening or reviewing a NUR PR, confirm `base: main` before submitting (a `>>>>>>> master` conflict is always a base misconfiguration, not real code conflict); re-trigger stuck checks with an empty commit after 3 minutes; and verify commit count after every rebase so the PR diff stays your delta only.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-025 -->
---
id: G-devops-2026-06-02-025
type: gotcha
domain: devops
tags: [eslint, shebang, copyright, esbuild, npx-tsx]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Shebangs after copyright headers break esbuild; coverage output dirs need ESLint ignores — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Problem:** Two build-time lint/parse traps. (1) A script with copyright headers on lines 1–3 and `#!/usr/bin/env npx tsx` on line 4 fails under newer esbuild with `Syntax error "!"` — a shebang is only valid on line 1. (2) A coverage/build output directory (e.g. `coverage-free/`) containing Istanbul-generated JS with `/* eslint-disable */` makes ESLint 9's unused-disable-directive check fire on every lint run, because no real rule triggers on the generated third-party JS.

**Fix:** (1) Remove shebangs from scripts invoked via `npx tsx scripts/...` in npm scripts; keep a shebang only when the script is run directly as `./script.ts` (then the copyright header follows the shebang). (2) Add the generated output directory to the global `ignores` array in `eslint.config.mjs`.

**Rule:** A shebang must be line 1 or absent — never after a copyright header on a script run via `npx tsx`. Add any new coverage/build output directory to ESLint global ignores immediately; generated files should never be linted.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-026 -->
---
id: G-devops-2026-06-02-026
type: gotcha
domain: devops
tags: [ts-ignore, eslint, ban-ts-comment, sync-exclude, dev-vs-free, typecheck]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## @ts-ignore conflicts with ESLint ban-ts-comment — pair it with eslint-disable, not @ts-expect-error — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** `@ts-ignore` on a dynamic import to a sync-excluded path (needed because `tsc` can't resolve the file at Dev typecheck time) triggers `@typescript-eslint/ban-ts-comment`, and lint blocks the push. `@ts-expect-error` is not a fix either: on Dev where the file exists there is no error to consume, so lint fails for an *unused* `ts-expect-error` directive; on Free where the file is absent it would be correct — but the SAME source tree must pass lint on both.

**Fix:** Suppress the ban rule for that one line with a two-line comment stack — `eslint-disable-next-line` applies to the next line of actual code, and ESLint treats the `@ts-ignore` comment as "next":
```typescript
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - <reason: sync-excluded path, resolvable only on Dev>
const mod = await import('./sync-excluded-path.js')
```

**Rule:** When a file's static types differ between Dev and a downstream Free build (sync-excluded imports), use `@ts-ignore` + `eslint-disable-next-line @typescript-eslint/ban-ts-comment`. Never `@ts-expect-error` — it produces a different error on Dev than on Free.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-027 -->
---
id: G-devops-2026-06-02-027
type: gotcha
domain: devops
tags: [nur, vite, rolldown, tree-shake, free-build, buildphase, sync-exclude]
since_version: "1.0.5"
status: active
scope: project
related: [G-devops-2026-06-02-026]
graduated_to: ""
---

## VITE_FREE_BUILD must be exported in the NUR buildPhase or rolldown fails on sync-excluded routes — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** The NUR `weaver-free` package builds the frontend, but rolldown fails to resolve `pages/fabrick/LoomPage.vue` (sync-excluded from the Free repo). The `VITE_FREE_BUILD` ternary guard in `routes.ts` is supposed to tree-shake those paid-tier route imports — but the NUR buildPhase never set the env var, so rolldown still tries to resolve the absent files.

**Fix:** Export `VITE_FREE_BUILD=true` before `npm run build` in the NUR package's buildPhase:
```nix
buildPhase = ''
  # VITE_FREE_BUILD=true tells routes.ts to tree-shake paid-tier route imports.
  # Without this, rolldown tries to resolve sync-excluded files and fails.
  export VITE_FREE_BUILD=true
  npm run build
'';
```

**Rule:** Any build environment consuming the Free repo source must explicitly `export VITE_FREE_BUILD=true` — NUR's buildPhase, the release workflow's free-tarball test build, and any future "build from Free source" context all need it. The `verify-release-builds` auditor already sets it in its sandbox.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-028 -->
---
id: G-devops-2026-06-02-028
type: gotcha
domain: devops
tags: [openssf, scorecard, badge, api-domain, shields, rename]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## OpenSSF Scorecard API domain changed securityscorecards.dev → scorecard.dev — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** A badge URL `https://api.securityscorecards.dev/projects/github.com/<owner>/<repo>/badge` returns HTTP 405 with `UnknownHttpMethodForPath_/projects/{platform}/{org}/{repo}/badge`. The misleading error suggests the repo path is wrong when the path is correct — the API hostname was retired in the 2024+ domain rename.

**Fix:** Use `api.scorecard.dev` (302-redirects to `img.shields.io`) for the badge and `scorecard.dev/viewer/` for the linked viewer:
```markdown
<!-- Right (current) -->
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/OWNER/REPO/badge)](https://scorecard.dev/viewer/?uri=github.com/OWNER/REPO)
```

**Rule:** OpenSSF Scorecard badges use `api.scorecard.dev` (API) and `scorecard.dev/viewer/` (link target) since the 2024+ rename. A 405 with `UnknownHttpMethodForPath` on the old `securityscorecards.dev` host is the signature — fix the hostname, not the repo path.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-029 -->
---
id: G-devops-2026-06-02-029
type: gotcha
domain: devops
tags: [github-actions, demo, dead-code, static-spa, workflow, billing]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ".claude/rules/workflow-review.md"
---

## Demo-reset workflow is dead code for a static mock demo — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** A `demo-reset.yml` workflow (reset gists + redeploy weekly) was scaffolded and kept through multiple sessions without being challenged. It assumed a live-data demo where users pollute state through real API calls. The actual demo is a static mock SPA — the directories it checked for (`demo/sample-data`, `demo/sample-gists`) never existed. Every scheduled run was a billing charge for a no-op.

**Fix:** Delete demo-reset workflows when the demo is stateless. Deploy-on-tag (`demo-deploy.yml`) is the only CI a static mock demo needs.

**Rule:** When inheriting or scaffolding a demo workflow, ask: is the demo stateful (real API, real data) or stateless (static mock)? Stateless demos cannot be polluted — no reset workflow, no sample-data directories, deploy-only CI.

<!-- /entry -->

<!-- entry:G-devops-2026-06-02-030 -->
---
id: G-devops-2026-06-02-030
type: gotcha
domain: devops
tags: [llama-cpp, tool-calling, peg-native, claude-code, anthropic-endpoint, qwen]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-014]
graduated_to: ""
---

## llama.cpp peg-native leaks tool calls as text on preamble; Anthropic endpoint doesn't parse tools at all — 2026-06-02 · Claude

**Problem:** llama.cpp's `peg-native` tool-call parser (auto-selected for Qwen chat templates) fails to extract calls in two cases: (1) the model writes explanatory text BEFORE the `<tool_call>` — the PEG root expects the call at the start, so any preamble breaks it (upstream #20260); (2) some models emit a near-miss tag (Qwen2.5-Coder emitted `<tools>` not `<tool_call>`). In both, the call lands in `message.content` as raw text with `finish_reason: stop` and `tool_calls: null` — so Claude Code never sees a `tool_use` and nothing executes. Confirmed independent of streaming and toolset size; reproduces exactly when the model preambles. Separately: llama.cpp's Anthropic `/v1/messages` endpoint does NOT translate tool calls (text only) even when the OpenAI `/v1/chat/completions` endpoint on the same server parses them fine.

**Fix (cleanest first):** (1) use a model whose agentic tool-calling is already fixed (Qwen3.5 ships community-fixed templates) — newer wins, see [[L-devops-2026-06-02-014]]; (2) a chat template that forbids preamble + does C++/minijinja-safe `<function=>` parsing (froggeric Qwen-Fixed-Chat-Templates); (3) a thin proxy that routes through the OpenAI endpoint and regex-extracts `<function=NAME><parameter=K>V</parameter></function>` from leaked content into `tool_use`. `--chat-template-file` of the official template alone does NOT help (peg-native overrides the template's tool handling) and there is no flag to force a different parser.

**Rule:** For Claude Code + local llama.cpp, route through the **OpenAI `/v1/chat/completions`** endpoint (it parses tools; the Anthropic endpoint doesn't), and choose a model with known-good agentic tool-calling instead of fighting peg-native. Symptom signature: the tool call appears as raw `<function=>`/`<tool_call>` text in the reply, `finish_reason: stop`, no structured `tool_calls`.

<!-- /entry -->

<!-- entry:G-devops-2026-06-03-001 -->
---
id: G-devops-2026-06-03-001
type: gotcha
domain: devops
tags: [llama-cpp, prompt-caching, prefix-cache, billing-header, proxy, agentic]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-030, L-devops-2026-06-02-014]
graduated_to: ""
---

## Local agentic loop reprocesses the full prompt every turn — a per-request system-prompt header (NOT a llama limit) breaks the prefix cache — 2026-06-03 · Claude

**Problem:** Driving Claude Code against a local llama.cpp server, each agent turn reprocesses the FULL ~21K-token prompt (system + tool schemas) before generating (~45s/turn on Strix Halo gfx1151 Vulkan) — a ~15-turn task spends ~12 min in pure re-prefill and times out. It *looks* like llama can't cache. **It can** — a controlled test (send a prompt, then prompt+appended) reuses the prefix perfectly: `prompt_tokens_details.cached_tokens` jumps to 3525/3548, llama "restored context checkpoint", processes only the ~23 new tokens. The real cause: the agent's prompt **prefix is not byte-stable across turns**. Dumping the proxy's outgoing requests and diffing consecutive turns shows the divergence at **~char 75 of the system message**: Claude Code prepends a per-request line `x-anthropic-billing-header: cc_version=2.1.160.<X>; cc_entrypoint=sdk-cli; cch=<hash>;` whose `cc_version` suffix and `cch` hash **change every single turn**. That breaks the cache match at ~token 20 → full reprefill. Compounded by `parallel>1`: the agent's turns bounce between slots, so even a stable prefix half-misses on a cold slot (intermittent full reprocess). (Red herrings: `--cache-reuse` being rejected by flash-attn+quant-KV, ROCm vs Vulkan, KV type — none of these were the cause; basic prefix caching already works.)

**Fix (both, proxy/config-side):** (1) In the Anthropic→OpenAI proxy, strip the billing header from the system message: `sys = sys.replace(/^(?:x-)?anthropic-billing-header:[^\n]*\n/, '')` — note the `x-` prefix (without it the regex silently no-ops). (2) `parallel = 1` on the agent's llama instance (one warm slot, no bouncing; fine when that instance serves only the agent). Result: turns 2+ reuse the ~20K prefix and process only the new tokens — **~45s/turn → ~0.5–2s/turn** (measured: 326/524/1035-token turns). The unavoidable FIRST (cold) turn still pays a full prefill; ROCm would speed *that* but isn't needed for the per-turn wall.

**Rule:** When a local agentic loop reprocesses the whole prompt every turn, do NOT assume a llama KV/flash-attn/cache-reuse limitation. First prove caching works in isolation (request, then request+append; check `cached_tokens`). If it works alone but not for the agent, the **prefix is changing across turns** — dump the proxy's outgoing requests and diff them; the culprit is usually a per-request header/timestamp near the START of the system prompt (here: Claude Code's `x-anthropic-billing-header`). Strip it, and pin the agent to one slot (`parallel=1`).

<!-- /entry -->

<!-- entry:G-devops-2026-06-03-002 -->
---
id: G-devops-2026-06-03-002
type: gotcha
domain: devops
tags: [ssh, nohup, setsid, background-process, systemd]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A nohup'd process launched over non-interactive SSH dies with the channel; use setsid (or systemd) — 2026-06-03 · Claude

**Problem:** `ssh host 'nohup proc > log 2>&1 &'` followed by the SSH command returning does NOT reliably keep `proc` alive — it shows up in `pgrep` briefly, then the listener is gone and later connects get ConnectionRefused. The non-interactive remote shell exiting tears down the session, and nohup alone did not keep the backgrounded job running across that teardown. Two such "completed with no output" SSH calls in a row were the symptom.

**Fix:** Use `setsid proc > log 2>&1 &` so the process gets its own session/process group and survives the SSH channel closing. For anything load-bearing, don't hand-launch it at all — make it a **systemd service** (`Restart=always`), which is what the forge-proxy became.

**Rule:** Over non-interactive SSH, `nohup … &` is not dependable; reach for `setsid` to detach, and for any process that's part of an architecture, a managed systemd unit — never a setsid/nohup process as the foundation.

<!-- /entry -->
