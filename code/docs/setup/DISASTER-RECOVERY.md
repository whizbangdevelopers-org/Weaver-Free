<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Disaster Recovery

Backup and recovery procedures for the Weaver project.

## What to Back Up

| Item | Location | Method | Frequency |
| ---- | -------- | ------ | --------- |
| Source code | GitHub (Dev + Free repos) | Git (automatic) | Every push |
| GitHub Secrets | Repository Settings | Document separately | On change |
| Environment configs | `.env` files | Secure storage | On change |
| hCaptcha credentials | hCaptcha dashboard | Password manager | On change |
| CI badges gist | GitHub Gist | Note gist ID | On creation |
| NixOS configuration | `/etc/nixos/` | NixOS generation | On rebuild |
| Demo site content | GitHub Pages | Git (automatic) | On deploy |

## Repository Recovery

### Clone from GitHub

```bash
# Development repository
git clone git@github.com:whizbangdevelopers-org/Weaver-Dev.git
cd Weaver-Dev
npm install
cd backend && npm install && cd ..

# Free mirror
git clone git@github.com:whizbangdevelopers-org/Weaver-Free.git

# Demo site
git clone git@github.com:whizbangdevelopers-org/weaver-demo.github.io.git
```

### Restore from Local Backup

If GitHub is unavailable and you have a local clone:

```bash
# Create a new remote and push
git remote set-url origin NEW_REMOTE_URL
git push --all
git push --tags
```

### Restore from Archive

```bash
tar -xzf weaver-backup.tar.gz
cd Weaver-Dev
git remote set-url origin NEW_REMOTE_URL
npm install
cd backend && npm install && cd ..
```

## Secrets Recovery

### Required Secrets Inventory

Document these securely outside the repository (e.g., password manager):

| Secret | Purpose | How to Regenerate |
| ------ | ------- | ----------------- |
| `GIST_TOKEN` | CI badge updates | GitHub PAT with `gist` scope |
| `TEST_BADGE_GIST_ID` | Badge storage location | Create new gist, update workflows |
| `HCAPTCHA_SECRET` | Demo captcha verification | hCaptcha dashboard > Settings |
| `HCAPTCHA_SITEKEY` | Demo captcha widget | hCaptcha dashboard > Sites |
| `FREE_REPO_TOKEN` | Sync to free repo | GitHub PAT with `repo` scope |
| `DEPLOY_KEY` | Demo site deployment | Generate SSH keypair, add to repo |

### Regenerating GitHub Tokens

1. Go to GitHub **Settings > Developer Settings > Personal Access Tokens**.
2. Click **Generate new token (classic)**.
3. Select required scopes:
   - `gist` -- For CI badge gist updates
   - `repo` -- For cross-repo sync operations
4. Copy the token immediately (it will not be shown again).
5. Add to repository secrets: **Settings > Secrets and variables > Actions**.

### Regenerating hCaptcha Keys

1. Log in to [hCaptcha Dashboard](https://dashboard.hcaptcha.com).
2. Navigate to **Settings** for the secret key.
3. Navigate to **Sites** for the site key.
4. Update both in GitHub Secrets and any deployment configurations.

## NixOS Rebuild from Scratch

### Prerequisites

- A NixOS machine (bare metal or VM)
- Network access to GitHub and Nix cache

### Step 1: Install NixOS

Follow the [NixOS installation guide](https://nixos.org/manual/nixos/stable/#sec-installation) for your hardware.

### Step 2: Add Weaver to Configuration

```nix
# /etc/nixos/flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    weaver.url = "github:whizbangdevelopers-org/Weaver-Free";
  };

  outputs = { nixpkgs, weaver, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        weaver.nixosModules.default
      ];
    };
  };
}
```

### Step 3: Configure the Service

```nix
# /etc/nixos/configuration.nix
{
  services.weaver = {
    enable = true;
    port = 3110;
    host = "0.0.0.0";
    openFirewall = true;
  };
}
```

### Step 4: Rebuild and Activate

```bash
sudo nixos-rebuild switch --flake /etc/nixos#myhost
```

### Step 5: Verify

```bash
# Check service status
systemctl status weaver

# Test the API
curl http://localhost:3110/api/health

# Test VM listing
curl http://localhost:3110/api/workload
```

## Database Recovery

Weaver does not use a traditional database. State is derived from:

- **VM definitions:** Hardcoded in `backend/src/services/microvm.ts`
- **VM status:** Queried live from systemd via `systemctl`
- **Frontend state:** Pinia stores (in-memory, refreshed from API)

There is no persistent data store to back up or restore. If the service restarts, it simply re-queries systemd for current VM status.

## Demo Site Reset

If the demo site needs to be reset:

### Full Redeploy

```bash
# Trigger the demo deployment workflow manually
gh workflow run deploy-demo.yml --repo whizbangdevelopers-org/weaver-demo.github.io
```

### Manual Reset

```bash
git clone git@github.com:whizbangdevelopers-org/weaver-demo.github.io.git
cd weaver-demo.github.io

# Build the demo version
cd /path/to/Weaver-Dev
VITE_DEMO_MODE=true npm run build

# Copy build output to demo repo
cp -r dist/spa/* /path/to/weaver-demo.github.io/
cd /path/to/weaver-demo.github.io
git add -A && git commit -m "Reset demo site" && git push
```

## CI/CD Recovery

### Restoring GitHub Actions

1. Verify workflows exist in `.github/workflows/`:
   - `test.yml` -- CI tests
   - `release.yml` -- Release automation
   - `sync-to-free.yml` -- Free repo sync
   - `codeql.yml` -- Security scanning
   - `security-scan.yml` -- npm audit
   - `stale.yml` -- Stale issue management

2. Re-add all required secrets (see Secrets Inventory above).

3. Trigger a test workflow to verify:

```bash
gh workflow run test.yml
```

## Recovery Verification Checklist

After any recovery, verify each of the following:

- [ ] `npm install` succeeds (root and backend)
- [ ] `npm run dev` starts the frontend
- [ ] `npm run dev:backend` starts the backend
- [ ] `npm run test:unit:run` passes all unit tests
- [ ] `npm run build:all` succeeds
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] CI workflows trigger and pass
- [ ] GitHub Secrets are properly configured
- [ ] Demo site is accessible and functional
- [ ] Free repo mirror is up to date
- [ ] NixOS module builds (if applicable)
