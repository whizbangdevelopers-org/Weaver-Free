<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Workspace Transfer Guide

Instructions for setting up the Weaver development environment on a new machine or transferring the workspace to a new developer.

## Prerequisites

### Required Software

| Tool | Minimum Version | Installation |
| ---- | --------------- | ------------ |
| Node.js | 18.0.0 | [nodejs.org](https://nodejs.org) or `nix-shell -p nodejs_22` |
| npm | 9.0.0 | Included with Node.js |
| Git | 2.30+ | Package manager or [git-scm.com](https://git-scm.com) |
| Docker | 20.10+ | [docker.com](https://docker.com) (for E2E tests) |
| Docker Compose | 2.0+ | Included with Docker Desktop |

### Optional Software

| Tool | Purpose | Installation |
| ---- | ------- | ------------ |
| GitHub CLI (`gh`) | PR creation, workflow management | `nix-shell -p gh` or [cli.github.com](https://cli.github.com) |
| NixOS | Deployment testing | [nixos.org](https://nixos.org) |
| VS Code | IDE | [code.visualstudio.com](https://code.visualstudio.com) |
| Quasar CLI | Direct Quasar commands | `npm install -g @quasar/cli` |

### NixOS-Specific Setup

If developing on NixOS, you can use a development shell:

```nix
# shell.nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    nodePackages.npm
    git
    docker
    docker-compose
    gh
  ];
}
```

Or with Nix flakes:

```bash
nix develop
```

## Step 1: Clone the Repository

```bash
# SSH (recommended for contributors)
git clone git@github.com:whizbangdevelopers-org/Weaver-Dev.git
cd Weaver-Dev

# HTTPS (read-only or with PAT)
git clone https://github.com/whizbangdevelopers-org/Weaver-Dev.git
cd Weaver-Dev
```

## Step 2: Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..
```

## Step 3: Configure Git Hooks

```bash
git config core.hooksPath .githooks
```

This enables:
- **pre-commit** -- Lints staged files automatically
- **pre-push** -- Runs lint, tests, security audit, and typecheck

## Step 4: Environment Configuration

Create environment files from examples (if they exist) or set up from scratch:

### Backend Environment

```bash
# Create backend/.env
cat > backend/.env << 'EOF'
PORT=3110
HOST=127.0.0.1
NODE_ENV=development
LOG_LEVEL=debug
EOF
```

### Frontend Environment (optional for demo mode)

```bash
# Create .env for demo mode only
cat > .env << 'EOF'
VITE_DEMO_MODE=false
EOF
```

## Step 5: Verify the Setup

Run these commands to verify everything is working:

```bash
# 1. Lint check
npm run lint

# 2. TypeScript compilation
npm run typecheck

# 3. Unit tests
npm run test:unit:run

# 4. Build check
npm run build:all

# 5. Start development servers
npm run dev:backend &
npm run dev
```

If all commands succeed, the workspace is properly configured.

## Step 6: Set Up E2E Testing (Optional)

E2E tests require Docker:

```bash
cd testing/e2e-docker
./scripts/setup.sh
./scripts/run-tests.sh
cd ../..
```

## Secrets and Tokens

The following secrets are needed for specific operations. They should be shared securely (password manager, encrypted message) and never committed to the repository.

### Development Secrets

| Secret | Needed For | Where to Get |
| ------ | ---------- | ------------ |
| GitHub SSH key | Push access | Generate locally, add to GitHub |
| GitHub PAT | CLI operations (`gh`) | GitHub Settings > Developer Settings |

### CI/CD Secrets (Repository Admin Only)

| Secret | Needed For | Where to Get |
| ------ | ---------- | ------------ |
| `GIST_TOKEN` | CI badge updates | GitHub PAT with `gist` scope |
| `TEST_BADGE_GIST_ID` | Badge storage | Note existing gist ID |
| `HCAPTCHA_SECRET` | Demo deployment | hCaptcha dashboard |
| `HCAPTCHA_SITEKEY` | Demo deployment | hCaptcha dashboard |
| `FREE_REPO_TOKEN` | Free repo sync | GitHub PAT with `repo` scope |

### Sharing Secrets with New Developers

1. Use a password manager shared vault (recommended).
2. Alternatively, share via encrypted messaging.
3. Never share secrets via email, Slack, or other unencrypted channels.
4. New developers only need GitHub SSH key and optionally GitHub PAT.
5. CI/CD secrets are managed by repository admins only.

## IDE Configuration

### VS Code

Recommended extensions:

```json
{
  "recommendations": [
    "Vue.volar",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer"
  ]
}
```

Workspace settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["javascript", "typescript", "vue"],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Other IDEs

- **WebStorm / IntelliJ:** TypeScript and Vue support built in. Enable ESLint integration.
- **Neovim:** Use `nvim-lspconfig` with `volar` for Vue 3 and `ts_ls` for TypeScript.
- **Zed:** Vue and TypeScript support available via extensions.

## NixOS Development Environment

For testing NixOS integration locally:

### Option 1: NixOS VM

```bash
# Build a test VM with the dashboard module
nix build .#nixosConfigurations.test-vm.config.system.build.vm
./result/bin/run-test-vm
```

### Option 2: NixOS Container

```bash
# Test the module in a NixOS container
sudo nixos-container create dashboard-test --flake .#test-container
sudo nixos-container start dashboard-test
```

### Option 3: Existing NixOS System

Add to your system configuration and rebuild:

```nix
{
  imports = [ /path/to/Weaver-Dev/nixos/default.nix ];
  services.weaver.enable = true;
}
```

## Transferring to a New Developer

### Checklist for the Departing Developer

- [ ] Push all local branches to remote
- [ ] Document any in-progress work in GitHub Issues
- [ ] Transfer any locally-stored secrets via secure channel
- [ ] Update `CODEOWNERS` if applicable
- [ ] Brief the new developer on current project state

### Checklist for the New Developer

- [ ] Get repository access from an admin
- [ ] Follow Steps 1-5 above
- [ ] Review `CLAUDE.md` for project conventions
- [ ] Review `docs/DEVELOPER-GUIDE.md` for architecture
- [ ] Review open issues and PRs
- [ ] Run the full test suite to verify setup
- [ ] Make a small test commit to verify push access

## Troubleshooting

### `npm install` fails with permission errors

```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors after clone

```bash
# Ensure all dependencies are installed
cd backend && npm install && cd ..
npm run clean
npm install
```

### Git hooks not running

```bash
# Verify hooks path is set
git config core.hooksPath
# Should output: .githooks

# If not set:
git config core.hooksPath .githooks

# Verify hooks are executable
ls -la .githooks/
chmod +x .githooks/*
```

### Docker E2E setup fails

```bash
# Ensure Docker is running
docker info

# Rebuild from scratch
cd testing/e2e-docker
docker compose build --no-cache
./scripts/setup.sh
```
