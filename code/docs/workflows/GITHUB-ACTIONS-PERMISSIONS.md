<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# GitHub Actions Permissions

Required permissions, secrets, and token scopes for Weaver CI/CD workflows.

## Workflow Permissions Overview

| Workflow | File | Permissions Needed | Secrets Used |
| -------- | ---- | ------------------ | ------------ |
| Tests | `test.yml` | `contents: read` | `GIST_TOKEN`, `TEST_BADGE_GIST_ID` |
| Release | `release.yml` | `contents: write` | (default `GITHUB_TOKEN`) |
| Sync to Free | `sync-to-free.yml` | `contents: read` | `FREE_REPO_TOKEN` |
| CodeQL | `codeql.yml` | `security-events: write` | (default `GITHUB_TOKEN`) |
| Security Scan | `security-scan.yml` | `contents: read` | None |
| Stale | `stale.yml` | `issues: write`, `pull-requests: write` | (default `GITHUB_TOKEN`) |

## Per-Workflow Details

### test.yml

**Trigger:** Push to `main`, pull requests targeting `main`.

**Permissions:**
```yaml
permissions:
  contents: read
```

**Secrets:**
- `GIST_TOKEN` -- Personal Access Token with `gist` scope. Used to update the CI status badge gist after test runs complete.
- `TEST_BADGE_GIST_ID` -- The ID of the GitHub Gist that stores the badge JSON. This is a plain string, not a token.

**Steps requiring elevated access:**
- Badge update step uses `GIST_TOKEN` to POST to the Gist API.

### release.yml

**Trigger:** Push of tags matching `v*` pattern.

**Permissions:**
```yaml
permissions:
  contents: write
```

**Secrets:**
- Uses the default `GITHUB_TOKEN` (automatically provided by GitHub Actions).
- The `contents: write` permission allows creating GitHub Releases and uploading assets.

**Steps requiring elevated access:**
- Creating the GitHub Release (`gh release create`).
- Uploading build artifacts to the release.

### sync-to-free.yml

**Trigger:** Push of tags matching `v*` pattern, manual workflow dispatch.

**Permissions:**
```yaml
permissions:
  contents: read
```

**Secrets:**
- `FREE_REPO_TOKEN` -- Personal Access Token with `repo` scope. Required to push to the separate Free (public) repository. The default `GITHUB_TOKEN` only has access to the current repository.

**Steps requiring elevated access:**
- `git push` to `whizbangdevelopers-org/Weaver-Free` using the PAT.

### codeql.yml

**Trigger:** Push to `main`, weekly schedule.

**Permissions:**
```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

**Secrets:**
- Uses the default `GITHUB_TOKEN`.
- The `security-events: write` permission is required to upload CodeQL SARIF results.

### security-scan.yml

**Trigger:** Push to `main`, pull requests.

**Permissions:**
```yaml
permissions:
  contents: read
```

**Secrets:**
- None. Only runs `npm audit` and reports results.

### stale.yml

**Trigger:** Daily schedule.

**Permissions:**
```yaml
permissions:
  issues: write
  pull-requests: write
```

**Secrets:**
- Uses the default `GITHUB_TOKEN`.
- Needs `issues: write` and `pull-requests: write` to add labels and close stale items.

## Secret Management

### Adding a New Secret

1. Go to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**.
3. Enter the name and value.
4. Click **Add secret**.

### Rotating Secrets

When rotating a token:

1. Generate the new token first.
2. Update the repository secret with the new value.
3. Trigger a test workflow to verify the new token works.
4. Revoke the old token.

### Token Scopes

| Token | Required Scopes | Notes |
| ----- | --------------- | ----- |
| `GIST_TOKEN` | `gist` | Only needs gist read/write |
| `FREE_REPO_TOKEN` | `repo` | Full repo access to push to Free repo |
| `GITHUB_TOKEN` | (automatic) | Scoped to current repo, no configuration needed |

### Token Expiration

- GitHub PATs can be set to expire. Use 90-day expiration for security.
- Set a calendar reminder to rotate tokens before expiration.
- The workflow will fail with a 401 error if a token has expired.

## Default GITHUB_TOKEN Permissions

The repository should be configured with **restrictive default permissions**:

1. Go to **Settings > Actions > General**.
2. Under **Workflow permissions**, select **Read repository contents and packages permissions**.
3. Each workflow explicitly requests the permissions it needs via the `permissions` key.

This follows the principle of least privilege.

## Environment Protection Rules

For production deployments, consider adding environment protection:

1. Go to **Settings > Environments**.
2. Create a `production` environment.
3. Add required reviewers.
4. Add deployment branch restrictions (only `main`).

Currently, Weaver does not use GitHub Environments, but this is recommended for future production deployment workflows.

## Troubleshooting

### Workflow fails with "Resource not accessible by integration"

The workflow is requesting permissions that the `GITHUB_TOKEN` does not have. Check:
- The `permissions` block in the workflow YAML.
- The repository's default workflow permissions setting.

### Workflow fails with 401 Unauthorized

A secret token has expired or is incorrect. Check:
- Token expiration date on GitHub.
- The secret value in repository settings.
- Token scopes match what the workflow needs.

### Sync workflow fails to push

The `FREE_REPO_TOKEN` may lack `repo` scope or the token owner may not have push access to the Free repository. Verify:
- Token has `repo` scope.
- Token owner is a collaborator on `whizbangdevelopers-org/Weaver-Free`.
