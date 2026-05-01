// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface FailurePattern {
  name: string
  percentOfFailures: string
  symptom: string
  fix: string
  example?: string
}

interface ParallelWorkerRule {
  rule: string
  rationale: string
}

interface SharedStateRule {
  entity: string
  constraint: string
  alternativeHelper: string
}

interface E2eFailurePatternsResult {
  rootCausePatterns: FailurePattern[]
  parallelWorkerRules: ParallelWorkerRule[]
  sharedStateRules: SharedStateRule[]
  diagnosisChecklist: string[]
  bypassPattern: string
  warnings: string[]
}

export async function getE2eFailurePatterns(_projectRoot: string): Promise<E2eFailurePatternsResult> {
  // Root cause categories documented after Wave 1 (Phase 6) — 14 failures traced to 5 patterns.
  // Also incorporates the 147-failure single-session + parallel workers incident (2026-03-04).
  const rootCausePatterns: FailurePattern[] = [
    {
      name: 'Environment Mismatch',
      percentOfFailures: '50%',
      symptom: '400/422 on API calls — commonly IP/subnet validation rejections',
      fix: 'Test data must match env defaults. Bridge gateway defaults to 10.10.0.1, enforcing 10.10.0.x subnet for all VM IPs. Check BRIDGE_GATEWAY in docker-compose.yml.',
      example: 'Creating a VM with IP 192.168.1.5 fails because E2E env enforces the 10.10.0.x bridge subnet',
    },
    {
      name: 'Shared State Contamination',
      percentOfFailures: '14%',
      symptom: 'Auth failures in unrelated tests — 401 errors on tests that were previously passing',
      fix: 'sessionStore.deleteByUser() on role change invalidates ALL sessions for that user. Parallel tests using the same user\'s storageState break. Never mutate shared users (e2e-admin, e2e-operator, e2e-viewer). Use createTempUser() / cleanupTempUser() for tests that modify users.',
      example: 'Test A changes e2e-admin\'s role → invalidates tokens → Test B\'s storageState gets 401',
    },
    {
      name: 'Tier/Feature Gate Change',
      percentOfFailures: '21%',
      symptom: 'Element not found / assertion count mismatch — features that were visible are now hidden',
      fix: 'E2E runs at premium tier. Features moved to enterprise-only need updated assertions. Run audit:tier-parity to catch gate changes. Update spec assertions whenever tier-matrix.json changes.',
      example: 'Bulk selection moved to enterprise → spec expects 5 checkboxes, finds 0',
    },
    {
      name: 'Auth Plumbing',
      percentOfFailures: '7%',
      symptom: '401 on API-level tests even though storageState is set',
      fix: 'Playwright request fixture does NOT use storageState cookies for API calls. Must pass Authorization: Bearer header explicitly when making API calls directly (not via page navigation).',
      example: 'test uses page.request.get(\'/api/vms\') without Authorization header → 401',
    },
    {
      name: 'Race Conditions',
      percentOfFailures: '7%',
      symptom: 'Intermittent "not found" after create — test sees stale state',
      fix: 'fullyParallel: true means ALL tests run concurrently. Use test.describe.configure({ mode: \'serial\' }) for sequences that depend on prior state. Never assume a created resource is visible immediately without waiting for it.',
      example: 'Create VM → immediately assert it appears → fails because UI hasn\'t refreshed yet',
    },
  ]

  const parallelWorkerRules: ParallelWorkerRule[] = [
    {
      rule: 'Disable single-session in test mode',
      rationale: 'singleSession=true means every POST /api/auth/login calls sessionStore.deleteByUser(), revoking all prior sessions for that user. With 4 parallel workers sharing 3 users, workers constantly invalidate each other\'s tokens. Fix: const singleSession = process.env.NODE_ENV !== \'test\' in backend/src/routes/auth.ts',
    },
    {
      rule: 'Never re-login as shared users inside tests',
      rationale: 'Use getPresetAdminToken() to read the admin token from .auth/user.json. Direct login calls revoke all concurrent sessions for that user.',
    },
    {
      rule: 'Use dedicated test users for auth flow tests',
      rationale: 'Tests that perform real login/logout (session revocation) should use e2e-login-test user only, so revocation only affects that isolated user, not shared storageState tokens.',
    },
    {
      rule: 'Any backend security feature mutating shared state needs a test-mode bypass',
      rationale: 'Session revocation, account lockout counters, and rate limits all mutate shared state that parallel workers legitimately share. This is not weakening security — real users never share accounts across parallel requests.',
    },
  ]

  const sharedStateRules: SharedStateRule[] = [
    {
      entity: 'e2e-admin / e2e-operator / e2e-viewer',
      constraint: 'Read-only. Never change their roles, passwords, or delete them.',
      alternativeHelper: 'createTempUser() / cleanupTempUser() from testing/e2e/helpers/auth.ts',
    },
    {
      entity: 'Seed VMs (web-nginx, web-app, dev-node, dev-python, svc-postgres)',
      constraint: 'Read-only. Never delete or modify their config in tests.',
      alternativeHelper: 'createTempVm() / cleanupTempVm() from testing/e2e/helpers/index.ts',
    },
  ]

  const diagnosisChecklist: string[] = [
    'Tests pass with --workers=1 but fail with --workers=4 → shared state contamination or single-session enforcement',
    'Backend logs show mass 401 errors → single-session calling deleteByUser() across workers',
    'Element not found on a premium feature → tier gate changed, check tier-matrix.json diff',
    'API returns 400/422 on valid-looking data → check env defaults (BRIDGE_GATEWAY, subnet)',
    'Intermittent failures on the same test → race condition, add waitForSelector or serial mode',
    'Auth spec fails then passes in re-run → stale storageState from session revocation in another test',
    'All tests in one spec file fail, others pass → check for spec-level beforeAll state pollution',
  ]

  const bypassPattern =
    'process.env.NODE_ENV !== \'test\' guard for server-side security features that mutate shared state. ' +
    'Add to: single-session enforcement, per-IP rate limit counters, account lockout. ' +
    'Env is set to "test" in E2E Docker via NODE_ENV=test in docker-compose.yml.'

  // Check if the auth route has the bypass in place (live verification)
  const warnings: string[] = []
  const authRoutePath = resolve(_projectRoot, 'backend/src/routes/auth.ts')
  const authContent = await safeReadFile(authRoutePath)
  if (authContent && !authContent.includes('NODE_ENV')) {
    warnings.push('backend/src/routes/auth.ts may be missing NODE_ENV test bypass for singleSession — verify manually')
  }

  return { rootCausePatterns, parallelWorkerRules, sharedStateRules, diagnosisChecklist, bypassPattern, warnings }
}
