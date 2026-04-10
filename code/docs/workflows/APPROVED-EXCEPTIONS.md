<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Approved Exceptions

Documented exceptions to lint rules, IDE warnings, and code style guidelines that are intentionally accepted in the Weaver project.

## ESLint Exceptions

### `@typescript-eslint/no-explicit-any`

| Location | Reason | Approved |
| -------- | ------ | -------- |
| `src/services/api.ts` (error handler) | Axios error types require `any` for generic catch | Yes |
| `backend/src/routes/ws.ts` (WebSocket) | Fastify WebSocket types incomplete | Yes |

These are isolated to error handling boundaries where TypeScript's type narrowing is applied immediately after the `any` usage.

### `@typescript-eslint/no-unused-vars`

| Pattern | Reason | Approved |
| ------- | ------ | -------- |
| Underscore-prefixed (`_err`, `_unused`) | Intentionally unused parameters in callbacks | Yes |
| Destructured rest (`{ used, ...rest }`) | Extracting specific properties | Yes |

Convention: Prefix unused variables with `_` to signal intent.

### `vue/multi-word-component-names`

| Component | Reason | Approved |
| --------- | ------ | -------- |
| None currently | All components use multi-word names | N/A |

If single-word component names are needed in the future, they should be documented here.

## TypeScript Exceptions

### `// @ts-expect-error`

| Location | Reason | Approved |
| -------- | ------ | -------- |
| None currently | No `@ts-expect-error` directives in codebase | N/A |

Policy: Avoid `@ts-expect-error`. If absolutely necessary, include a comment explaining why and add an entry to this document.

### `// @ts-ignore`

**Policy: `@ts-ignore` is not permitted.** Use `@ts-expect-error` instead, which will error when the underlying type issue is fixed.

### `as` Type Assertions

| Location | Reason | Approved |
| -------- | ------ | -------- |
| `src/services/mock-vm.ts` | `JSON.parse` returns `unknown`, assert to `VmInfo[]` | Yes |
| `src/composables/useVmStatus.ts` | WebSocket `event.data` typed as `string` | Yes |

Convention: Prefer type narrowing over assertions. When assertions are necessary, validate the shape at runtime.

## IDE Warnings

### Volar / Vue Language Server

| Warning | Location | Reason | Approved |
| ------- | -------- | ------ | -------- |
| "Component name should always be multi-word" | Page components | Pages are auto-imported by router | Acceptable |
| "Unused CSS selector" | `src/css/` | Global styles used by dynamic components | Acceptable |

### TypeScript Language Server

| Warning | Location | Reason | Approved |
| ------- | -------- | ------ | -------- |
| Path alias resolution | `src/*` imports | Resolved by Quasar/Vite at build time | Acceptable |
| Module not found (backend) | Backend imports | Separate `tsconfig.json` for backend | Acceptable |

## Prettier Exceptions

### Line Length

| File Pattern | Max Length | Reason |
| ------------ | --------- | ------ |
| `*.md` (Markdown) | No limit | Tables and URLs can be long |
| `*.yml` (YAML) | No limit | GitHub Actions steps can be verbose |

### Formatting Overrides

No `prettier-ignore` directives are currently in use. If one is needed, document it here with the reason.

## Security Scan Exceptions

### npm audit

| Package | Severity | Reason | Approved |
| ------- | -------- | ------ | -------- |
| None currently | -- | No active exceptions | N/A |

Policy: All high and critical vulnerabilities must be resolved. Moderate vulnerabilities in dev-only dependencies may be excepted with documentation.

### CodeQL

| Finding | Reason | Approved |
| ------- | ------ | -------- |
| None currently | No active CodeQL exceptions | N/A |

Policy: All CodeQL findings should be addressed. False positives should be marked as such in the GitHub Security tab with an explanation.

## Build Warnings

### Quasar Build

| Warning | Reason | Approved |
| ------- | ------ | -------- |
| "Unused component import" | Auto-imported by Quasar plugin system | Acceptable |
| Source map warnings | Dev-only, does not affect production | Acceptable |

### Vite Build

| Warning | Reason | Approved |
| ------- | ------ | -------- |
| Chunk size warnings | Large vendor chunks expected for Quasar | Acceptable |

## Adding a New Exception

When you need to add a new exception:

1. Verify the exception is truly necessary (not just convenient).
2. Add an entry to the appropriate section in this document.
3. Include the location, reason, and whether it is approved.
4. If the exception involves a lint disable comment, include a reason in the comment:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Fastify WebSocket types incomplete
```

5. Reference this document in the PR that introduces the exception.

## Reviewing Exceptions

Exceptions should be reviewed periodically (at least every major release):

- [ ] Check if any exceptions can be removed due to upstream fixes.
- [ ] Verify all documented exceptions still exist in the codebase.
- [ ] Remove entries for exceptions that are no longer needed.
- [ ] Add any undocumented exceptions found during review.
