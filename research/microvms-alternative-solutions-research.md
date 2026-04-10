<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# MicroVM Alternative Solutions Research

**Last updated:** 2026-02-12

There are several approaches, ranging from simple to elaborate. Here's the rundown:

## 1. Multiple Tabs/Panes in VS Code (Simplest)

The extension natively supports this. Use the Command Palette and run **"Open in New Tab"** or **"Open in New Window"**. Each conversation gets its own independent context. The colored dot on the spark icon tells you status — blue means waiting for permission, orange means finished while the tab was hidden.

The catch: they all share the same working directory and file system, so if two agents edit the same file simultaneously, you'll get conflicts.

## 2. Git Worktrees (Recommended for Real Isolation)

This is the go-to pattern for truly independent agents:

```bash
# NixOS terminal, user: mark, dir: ~/Projects/myapp
git worktree add ../myapp-feature-auth -b feature/auth
git worktree add ../myapp-feature-api -b feature/api
git worktree add ../myapp-bugfix-123 -b fix/123
```

Then open each worktree in its own VS Code window (`code ../myapp-feature-auth`, etc.). Each window gets its own Claude Code session with fully isolated file state while sharing git history. No file conflicts between agents.

## 3. tmux + CLI (Power User / Headless)

For your NixOS setup, you could run multiple CLI sessions in tmux panes:

```bash
# NixOS terminal, user: mark, dir: ~/Projects
# Create worktrees first, then launch agents
tmux new-session -d -s agents
tmux send-keys -t agents "cd ~/Projects/myapp-feature-auth && claude" Enter
tmux split-window -t agents
tmux send-keys -t agents "cd ~/Projects/myapp-feature-api && claude" Enter
```

Or use headless mode for fire-and-forget tasks:

```bash
claude -p "Implement the OAuth login flow" --output-file result.md
```

## 4. Role Specialization via CLAUDE.md

To make agents truly "independent" in purpose, give each worktree a different `CLAUDE.md` that defines the agent's role:

```markdown
# CLAUDE.md in myapp-feature-auth worktree
## Role: Auth Agent
You are focused exclusively on implementing OAuth2 authentication.
Do NOT modify files outside of src/auth/ and tests/auth/.
Run `npm run test:auth` after every change.
```

This scopes each agent's behavior so they stay in their lane.

## 5. Bypass Permissions for Autonomous Operation

For agents to run truly independently without you babysitting permission prompts, set up pre-approved permissions in each worktree's `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Edit(**)",
      "Bash(npm run test:*)",
      "Bash(git:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(grep:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)"
    ]
  }
}
```

Or enable bypass mode in VS Code settings (`claudeCode.allowDangerouslySkipPermissions: true`), though this has had reliability issues in the extension compared to the CLI's `--dangerously-skip-permissions` flag.

## 6. Emerging Tools

A few community tools worth knowing about for orchestrating this:

- **Claude Squad** — tmux-based multi-agent manager
- **GitButler** — uses Claude Code lifecycle hooks to auto-sort parallel sessions into separate branches without worktrees
- **Gitpod/Ona** — cloud dev environments where each agent gets its own isolated CPU, memory, and filesystem

Given your Proxmox homelab setup, you could also spin up lightweight VMs or containers per agent for true compute isolation, which would be overkill for most people but fits your infrastructure nicely.

The practical sweet spot for most work is **worktrees + multiple VS Code windows + scoped CLAUDE.md files + pre-approved permissions**.
