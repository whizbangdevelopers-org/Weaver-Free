<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Contributing to Weaver

Thank you for your interest in Weaver. Whether you're filing a bug, improving docs, or building a new feature, this guide will help you get started.

## About this project

Weaver has a committed release roadmap through v2.0 and v3.0 with feature scope and tier structure already staked in the ground. Contributions land in a project with long-term direction and maintenance commitment, not a drifting experiment. Release cadence and published tags validate progress against the plan.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). Please read it before participating.

## Ways to Contribute

Not all contributions require writing code. Here are the ways you can help:

| Contribution | Impact | Getting Started |
|---|---|---|
| **Bug reports** | Directly improves stability | [File a bug report](.github/ISSUE_TEMPLATE/bug_report.yml) with reproduction steps |
| **Feature requests** | Shapes the roadmap | [Request a feature](.github/ISSUE_TEMPLATE/feature_request.yml) with your use case |
| **Documentation** | Helps new users succeed | Fix typos, clarify instructions, add examples |
| **Testing** | Catches regressions | Add unit tests, improve E2E coverage |
| **Distro catalog** | Expands VM ecosystem | Submit cloud image URLs for new distributions |

### Try Before You Contribute

The fastest way to understand Weaver is the **[live demo](https://weaver-demo.github.io)**. It runs the full dashboard in mock mode with eight sample VMs. Use the tier-switcher toolbar to see how Free, Premium, and Enterprise features differ.

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/Weaver.git
cd Weaver
```

### 2. Install Dependencies

```bash
npm install
cd backend && npm install && cd ..
```

### 3. Set Up Git Hooks

```bash
git config core.hooksPath .githooks
```

This enables pre-commit linting and pre-push testing.

### 4. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/<name>` -- New features
- `fix/<name>` -- Bug fixes
- `docs/<name>` -- Documentation updates
- `refactor/<name>` -- Code refactoring
- `test/<name>` -- Test additions or updates

## Development Setup

### Running the Development Server

```bash
# Start backend + frontend together
npm run dev:full

# Or start them separately:
npm run dev:backend   # Backend API (port 3110)
npm run dev            # Frontend dev server (port 9010)
```

### Access Points

| Service | URL | Description |
| ------- | ---- | ----------- |
| Frontend | http://localhost:9010 | Quasar dev server with HMR |
| Backend API | http://localhost:3110 | Fastify API server |
| Health check | http://localhost:3110/api/health | Backend status |

### Environment Variables

The backend reads configuration from environment variables. Key variables for development:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3110` | Backend API port |
| `HOST` | `127.0.0.1` | Backend bind address |
| `JWT_SECRET` | *(auto-generated in dev)* | JWT signing secret (required in production) |
| `ANTHROPIC_API_KEY` | *(none)* | Claude API key for AI agent (absent = mock mode) |
| `AGENT_MODEL` | `claude-sonnet-4-5-20250929` | Claude model for agent operations |
| `PROVISIONING_ENABLED` | `false` | Enable VM creation (requires NixOS + bridge) |

See [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) for the complete environment reference.

## Code Style

### ESLint

```bash
npm run lint
```

Key rules: TypeScript strict mode, Vue 3 recommended rules, no unused variables, no untyped `any`.

### Prettier

```bash
npm run format
```

Single quotes, 2-space indentation, 100 character line width.

### TypeScript

All source code must be fully typed:

```bash
npm run typecheck
```

- Avoid `any` -- use `unknown` and narrow types instead
- Define interfaces in `src/types/`
- Use strict null checks

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

### Types

| Type | Description |
| ---- | ----------- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependencies |
| `ci` | CI/CD configuration |
| `chore` | Maintenance tasks |

### Examples

```
feat(dashboard): add VM memory usage chart
fix(websocket): handle reconnection on network drop
docs(readme): update Quick Start instructions
test(composables): add useVmStatus unit tests
```

### Scopes

Common scopes: `dashboard`, `vm-detail`, `backend`, `websocket`, `nixos`, `docker`, `demo`, `ci`, `agent`, `auth`, `provisioning`, `console`, `notifications`.

## Pull Request Process

### Before Submitting

Run the full pre-commit check:

```bash
npm run test:precommit   # lint + typecheck + unit tests
```

For changes that affect UI or API behavior, also run E2E tests (Docker required):

```bash
cd testing/e2e-docker && ./scripts/run-tests.sh
```

### Checklist

- [ ] All CI checks pass locally (`npm run test:precommit`)
- [ ] New features include unit tests
- [ ] UI changes include or update E2E specs in `testing/e2e/`
- [ ] Documentation updated for user-facing changes
- [ ] No secrets, tokens, or credentials committed

### Review Process

1. Submit your PR against the `main` branch.
2. All CI checks must pass (lint, typecheck, unit tests, build).
3. At least one maintainer review is required.
4. Address review feedback with additional commits (do not force-push).
5. A maintainer will merge the PR once approved.

### After Merge

- Your branch will be deleted automatically.
- Changes will be included in the next release.
- You will be credited in the changelog.

## Feedback and Questions

- **Bug reports** -- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml)
- **Feature requests** -- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)
- **Questions** -- Open a GitHub issue with the `question` label
- **Live demo** -- [weaver-demo.github.io](https://weaver-demo.github.io)

## Architecture Overview

Before contributing, familiarize yourself with the project structure:

- **Frontend** (`src/`) -- Quasar 2 + Vue 3 + TypeScript SPA with Pinia stores
- **Backend** (`backend/`) -- Fastify API server with WebSocket, JWT auth, and RBAC
- **NixOS** (`nixos/`) -- NixOS module for declarative deployment
- **Testing** (`testing/`) -- Vitest unit tests + Dockerized Playwright E2E

See [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) for full architecture documentation, API reference, and state management details.

## License

By contributing, you agree that your contributions will be licensed under the project's [AGPL-3.0 + Commons Clause + AI Training Restriction](LICENSE) license.
