<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Workflow Patterns

Reusable patterns, conventions, and best practices for GitHub Actions workflows in Weaver.

## Common Patterns

### Node.js Setup Pattern

All workflows that run Node.js use this consistent setup:

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '22'
      cache: 'npm'

  - name: Install dependencies
    run: |
      npm ci
      cd backend && npm ci && cd ..
```

Key points:
- Use `npm ci` (not `npm install`) in CI for reproducible builds.
- Cache npm dependencies with `cache: 'npm'` for faster runs.
- Always install both root and backend dependencies.

### Conditional Step Pattern

Run steps only when specific conditions are met:

```yaml
- name: Update badge
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: |
    # Only update badge on main branch pushes, not PRs
    curl -X PATCH ...
```

### Artifact Upload Pattern

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: spa-build
    path: dist/spa/
    retention-days: 7
```

### Matrix Strategy Pattern

For testing across multiple Node.js versions (if needed):

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
  fail-fast: false

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

## Error Handling

### Continue on Error

For non-critical steps (like badge updates), use `continue-on-error`:

```yaml
- name: Update CI badge
  continue-on-error: true
  run: |
    curl -X PATCH "$GIST_URL" ...
```

### Fail Fast

For critical validation steps, fail immediately:

```yaml
strategy:
  fail-fast: true
```

### Timeout Protection

Set timeouts to prevent runaway jobs:

```yaml
jobs:
  test:
    timeout-minutes: 15
    steps:
      - name: Run unit tests
        timeout-minutes: 5
        run: npm run test:unit:run
```

## Composite Actions

### Reusable Setup Action

If multiple workflows share the same setup steps, consider creating a composite action:

```yaml
# .github/actions/setup/action.yml
name: 'Setup Weaver'
description: 'Install Node.js and project dependencies'
runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'

    - name: Install dependencies
      shell: bash
      run: |
        npm ci
        cd backend && npm ci && cd ..
```

Usage in workflows:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/setup
  - run: npm run test:unit:run
```

## Secret Usage Pattern

### Accessing Secrets

```yaml
env:
  GIST_TOKEN: ${{ secrets.GIST_TOKEN }}
```

### Checking Secret Existence

```yaml
- name: Update badge (if token available)
  if: secrets.GIST_TOKEN != ''
  env:
    GIST_TOKEN: ${{ secrets.GIST_TOKEN }}
  run: |
    curl -X PATCH ...
```

## Cross-Repository Operations

### Push to Another Repository

```yaml
- name: Push to Free repo
  env:
    TOKEN: ${{ secrets.FREE_REPO_TOKEN }}
  run: |
    git remote add free https://x-access-token:${TOKEN}@github.com/whizbangdevelopers-org/Weaver-Free.git
    git push free HEAD:main --force
```

## Caching Patterns

### npm Cache

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
```

### Custom Cache

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

## Notification Patterns

### Job Summary

```yaml
- name: Write job summary
  run: |
    echo "## Test Results" >> $GITHUB_STEP_SUMMARY
    echo "- Unit tests: Passed" >> $GITHUB_STEP_SUMMARY
    echo "- Lint: Passed" >> $GITHUB_STEP_SUMMARY
    echo "- Build: Passed" >> $GITHUB_STEP_SUMMARY
```

### PR Comment

```yaml
- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: 'All checks passed.'
      })
```

## Workflow Organization

### File Naming Convention

| Pattern | Examples |
| ------- | -------- |
| `test.yml` | Primary test workflow |
| `release.yml` | Release automation |
| `sync-to-*.yml` | Cross-repo sync workflows |
| `security-*.yml` | Security-related workflows |
| `stale.yml` | Issue/PR lifecycle management |

### Job Naming Convention

Use descriptive, lowercase job names:

```yaml
jobs:
  lint-and-typecheck:
    ...
  unit-tests:
    ...
  build:
    needs: [lint-and-typecheck, unit-tests]
    ...
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Alternative |
| ------------ | --- | ----------- |
| `npm install` in CI | Non-deterministic | Use `npm ci` |
| Hardcoded Node.js version | Hard to update | Use a variable or `.nvmrc` |
| Secrets in step commands | Visible in logs | Use `env` block |
| No timeout | Runaway jobs waste minutes | Set `timeout-minutes` |
| `continue-on-error` everywhere | Hides real failures | Only for optional steps |
| Force push without condition | Dangerous on main | Guard with `if` conditions |
