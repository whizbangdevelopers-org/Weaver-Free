<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# MCP Tooling Setup

Configuration guide for Model Context Protocol (MCP) servers and Claude Code integration with the Weaver project.

**Note:** This file is excluded from the Free (public) repo sync. It contains internal development tooling configuration.

## Overview

MCP (Model Context Protocol) servers extend Claude Code's capabilities by providing specialized tools for interacting with external services. This document covers the MCP configuration used for Weaver development.

## CLAUDE.md Integration

The `CLAUDE.md` file at the repository root provides Claude Code with project-specific context. Key sections:

- Repository aliases and canonical identifiers
- Project structure and file organization
- Available npm commands
- API endpoint reference
- WebSocket protocol details
- Path aliases for TypeScript imports
- Release checklist and sync workflow details

### Keeping CLAUDE.md Updated

Update `CLAUDE.md` when:
- API endpoints change
- New npm scripts are added
- Directory structure changes
- Path aliases are modified
- Release process changes

See `docs/workflows/CLAUDEMD-GENERATOR-PROMPT.md` for the regeneration prompt.

## MCP Server Configuration

### Filesystem MCP Server

The filesystem MCP server provides enhanced file operations.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/Weaver-Dev"]
    }
  }
}
```

### Memory MCP Server

For persistent context across sessions:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

## Claude Code Configuration

### Project-Level Settings

Claude Code reads `CLAUDE.md` from the repository root automatically. No additional configuration is needed for basic project awareness.

### Recommended Practices

1. **Always reference CLAUDE.md** when starting a new session. Claude Code reads it automatically, but explicitly asking Claude to review it ensures the latest content is used.

2. **Use specific file paths** when asking Claude to work on particular components:
   - `src/stores/vm-store.ts` for state management
   - `backend/src/routes/vms.ts` for API routes
   - `backend/src/services/microvm.ts` for VM service logic
   - `nixos/default.nix` for NixOS module changes

3. **Provide context for cross-cutting changes** that span frontend, backend, and NixOS:
   - Describe the full flow (UI -> API -> systemctl)
   - Reference the types in `src/types/vm.ts`
   - Mention the WebSocket protocol if real-time updates are involved

4. **Run commands through Claude Code** for verification:
   - `npm run lint` after code changes
   - `npm run typecheck` after TypeScript changes
   - `npm run test:unit:run` after logic changes

## Development Workflow with Claude Code

### Starting a Session

1. Open the project directory in Claude Code.
2. Claude reads `CLAUDE.md` automatically.
3. Describe the task, referencing specific files or components.

### Common Tasks

| Task | Approach |
| ---- | -------- |
| Add new API endpoint | Edit `backend/src/routes/`, update `src/services/api.ts`, add types |
| Add new page | Create in `src/pages/`, add route in `src/router/routes.ts` |
| Modify NixOS module | Edit `nixos/default.nix`, test with `nix-build` |
| Fix a bug | Identify affected files, write a test, apply the fix |
| Update documentation | Edit the relevant `docs/` file |

### Testing Changes

After Claude makes changes, verify with:

```bash
# Quick check
npm run lint && npm run typecheck && npm run test:unit:run

# Full check
npm run test:prepush

# Build check
npm run build:all
```

## Security Notes

- MCP server tokens should be stored in your local environment, not in the repository.
- The `CLAUDE.md` file does not contain any secrets.
- Rotate MCP tokens regularly (every 90 days).

## Troubleshooting

### Claude Code does not see CLAUDE.md

- Verify the file exists at the repository root.
- Ensure you opened the correct directory in Claude Code.
- Try explicitly asking Claude to read the file.

### MCP server fails to start

- Verify Node.js is installed and `npx` is available.
- Check that the MCP server package is accessible.
- Review the MCP server logs for error messages.

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) -- Claude Code project guidance
- [docs/workflows/CLAUDEMD-GENERATOR-PROMPT.md](../workflows/CLAUDEMD-GENERATOR-PROMPT.md) -- Regeneration prompt
- [MCP Documentation](https://modelcontextprotocol.io/) -- Official MCP specification
