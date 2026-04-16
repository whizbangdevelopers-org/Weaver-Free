<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# UI Design References

Screenshot the 3-4 patterns you care about once, drop them in `docs/designs/`, and reference them by filename in agent definitions. Then you don't need SuiteCRM running for every session.

## Key Patterns to Capture

For Weaver's enterprise tier:

- **Role-permission matrix** (RBAC admin page) — features as rows, roles as columns, toggles in cells
- **User management table** (list, edit, status) — searchable table with inline status badges and action buttons
- **Audit log viewer** (filterable, searchable, time-range) — log table with date range picker, severity filter, search

## Usage in Agent Definitions

```markdown
## UI Reference
- Permissions table: [rbac-matrix.png](docs/designs/rbac-matrix.png)
  Pattern: role-permission matrix (features as rows, roles as columns, toggles in cells)
  Source: SuiteCRM ACL Roles detail view
- User management: [user-table.png](docs/designs/user-table.png)
  Pattern: searchable table with inline status badges and action buttons
- Audit log: [audit-log.png](docs/designs/audit-log.png)
  Pattern: filterable log viewer with time-range, severity, and search
```

## Naming Convention

Use descriptive kebab-case filenames that indicate the pattern:

```
rbac-matrix.png          # Role-permission grid
user-table.png           # User management list
audit-log.png            # Filterable audit log viewer
settings-cards.png       # Grouped settings with inline edit
vm-list.png              # VM summary table (like Proxmox)
network-topology.png     # Network diagram layout
```

## Supported Formats

- PNG (preferred for screenshots)
- JPEG (acceptable for photos of hand-drawn wireframes)

Claude can read images directly via the Read tool and implement against them.
