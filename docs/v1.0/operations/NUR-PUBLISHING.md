<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# NUR Package Publishing

NUR (Nix User Repository) is the community index that lets NixOS users install
`whizbangdevelopers-org` packages via `pkgs.nur.repos.whizbangdevelopers-org.*`.
This doc covers the one-time registration PR, how ongoing updates work, and what
to do when things go wrong.

## How it works

| Step | What happens | How often |
|------|-------------|-----------|
| Registration PR | Add an entry to `nix-community/NUR:repos.json` | Once per org |
| Auto-update | `build.yml` POSTs to the NUR update webhook after a successful build | Every merged package change |

After the registration PR merges, no further NUR PRs are needed. Updates are
fully automatic via the webhook on line 61 of `.github/workflows/build.yml` in
the `whizbangdevelopers-org/nur-packages` repo.

## Registration PR (one-time)

### Repos involved

| Repo | Purpose |
|------|---------|
| `whizbangdevelopers-org/nur-packages` | Our packages repo — the source NUR fetches |
| `wriver4/NUR` | Fork of `nix-community/NUR` — where the registration PR lives |
| `nix-community/NUR` | Upstream NUR registry |

### The entry we add

In `repos.json` (alphabetical order, between `wenjinnn` and `whs`):

```json
"whizbangdevelopers-org": {
    "github-contact": "wriver4",
    "url": "https://github.com/whizbangdevelopers-org/nur-packages"
}
```

---

## Rebase procedure

NUR's CI won't run on a PR that is behind `upstream/main`. When a maintainer
asks you to rebase:

```bash
cd ~/Projects/active/NUR   # the wriver4/NUR fork

# 1. Fetch latest upstream (remote is already configured)
git fetch upstream

# 2. Rebase your branch onto upstream/main
git rebase upstream/main

# 3. Resolve any conflicts (see below), then force-push
git push --force-with-lease origin add-whizbangdevelopers-org
```

### Conflict resolution patterns

**`flake.nix` conflict** — upstream intermediate commits sometimes replay against
the modern HEAD config. Keep HEAD (our side); discard the incoming deprecation
snippet:

```bash
git checkout --ours flake.nix
git add flake.nix
git rebase --continue
```

**`repos.json` whole-file conflict** — take HEAD (upstream's latest) and re-insert
our entry manually in alphabetical order, then continue:

```bash
git checkout --ours repos.json
# re-insert the whizbangdevelopers-org block between wenjinnn and whs
git add repos.json
git rebase --continue
```

**Formatting commit conflict** — if the last commit on the branch was a
formatting cleanup, it will conflict against the now-rebased file. Take ours
(the file is already correctly formatted):

```bash
git checkout --ours repos.json
git add repos.json
git rebase --continue
```

### Dropping spurious replayed upstream commits

Git's patch-content matching sometimes misses upstream commits that have
equivalent changes (different context), causing them to be replayed instead of
skipped. After the rebase, verify only your commit is ahead:

```bash
git log --oneline upstream/main..add-whizbangdevelopers-org
# Should show exactly: feat: add whizbangdevelopers-org NUR repository
```

If you see extra upstream commits (e.g. `Removed SomeUser's repository`), drop
them with `--onto`:

```bash
# <extra-commit-hash> = the last spurious commit to drop
git rebase --onto upstream/main <extra-commit-hash> add-whizbangdevelopers-org
```

---

## Troubleshooting

### Wrong base branch (master instead of main)

**Symptom:** GitHub PR shows a conflict against `>>>>>>> master` with a
`builtins.throw "The NUR master branch has been renamed to main"` on the
incoming side.

**Cause:** GitHub defaulted the PR base to `master` (NUR's old default) when
the PR was first opened.

**Fix:** On the GitHub PR page, click **Edit** next to the PR title and change
`base:` from `master` to `main`. No git changes needed — the branch is already
rebased onto `upstream/main`.

---

### CI checks stuck at "Waiting for status to be reported"

**Symptom:** After a force push (or base branch change), `nixfmt-check` and
`tests` show "Expected — Waiting for status to be reported" for more than
2–3 minutes.

**Cause:** GitHub's CI event didn't fire, or the runner queue is backed up.
Common after a base branch change — GitHub may not generate a `synchronize`
event reliably in that case.

**Fix:** Push an empty commit to force a new `synchronize` event:

```bash
git -C ~/Projects/active/NUR commit --allow-empty -m "chore: re-trigger CI"
git -C ~/Projects/active/NUR push origin add-whizbangdevelopers-org
```

The checks should move to "in progress" within 60 seconds. If they still don't
start, NUR's runners may be backed up — check
`https://github.com/nix-community/NUR/actions` for queue activity.

---

### nixfmt-check fails

**Symptom:** The `nixfmt-check` CI job fails on a `.nix` file you touched.

**Fix:** Run nixfmt locally and push:

```bash
nix-env -f '<nixpkgs>' -iAP nixfmt-rfc-style   # if not already installed
nixfmt flake.nix
git add flake.nix
git commit --amend --no-edit   # or a new commit
git push --force-with-lease origin add-whizbangdevelopers-org
```

Our PR only modifies `repos.json` (not a Nix file), so this should never fire
for the registration PR. If it does, the conflict resolution accidentally
modified `flake.nix` — check the diff.

---

### tests job fails

**Symptom:** The `tests` job fails running `./ci/test.sh`.

**Cause:** Almost always a malformed `repos.json` entry (syntax error, wrong
indentation, missing comma).

**Fix:** Validate the JSON before pushing:

```bash
python3 -m json.tool repos.json > /dev/null && echo "valid"
```

Fix any syntax errors, commit, and push.
