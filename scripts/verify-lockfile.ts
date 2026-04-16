// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-lockfile.ts — Lockfile integrity verification
 *
 * Checks:
 * 1. package-lock.json exists
 * 2. lockfileVersion is 3
 * 3. Every dependency in package.json has a corresponding entry in the lockfile
 * 4. Warns about orphaned packages (in lock but not in package.json dependency tree)
 *
 * Exit 1 on missing lockfile or missing dependencies.
 * Uses only Node built-ins (fs, path).
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

let exitCode = 0;
const errors: string[] = [];
const warnings: string[] = [];

// 1. Check lockfile exists
const lockfilePath = resolve(ROOT, 'package-lock.json');
if (!existsSync(lockfilePath)) {
  console.error('FAIL: package-lock.json not found');
  process.exit(1);
}

// Read files
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));

// 2. Check lockfileVersion
if (lockfile.lockfileVersion !== 3) {
  errors.push(
    `lockfileVersion is ${lockfile.lockfileVersion}, expected 3`
  );
  exitCode = 1;
}

// 3. Verify every dependency in package.json exists in lockfile
const declaredDeps: Record<string, string> = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
};

const lockPackages: Record<string, unknown> = lockfile.packages || {};

// In lockfileVersion 3, dependencies are keyed as "node_modules/<name>"
const missingDeps: string[] = [];
for (const depName of Object.keys(declaredDeps)) {
  const lockKey = `node_modules/${depName}`;
  if (!(lockKey in lockPackages)) {
    missingDeps.push(depName);
  }
}

if (missingDeps.length > 0) {
  errors.push(
    `Missing from lockfile (${missingDeps.length}):\n` +
    missingDeps.map((d) => `  - ${d}`).join('\n')
  );
  exitCode = 1;
}

// 4. Check for orphaned packages (top-level only, warn-only)
// Orphans = packages in lockfile's node_modules/ that aren't depended on by anything in package.json
// We only check direct top-level entries, not transitive deps
const topLevelLockDeps = Object.keys(lockPackages)
  .filter((key) => {
    // Match "node_modules/<name>" but not nested "node_modules/x/node_modules/y"
    if (key === '') return false; // root entry
    const parts = key.split('node_modules/');
    // Top-level: exactly one "node_modules/" segment, no slashes in the package name
    // (scoped packages like @scope/name are fine)
    return parts.length === 2 && parts[0] === '';
  })
  .map((key) => key.replace('node_modules/', ''));

// Collect all declared deps (direct only — transitive are expected in lockfile)
const declaredSet = new Set(Object.keys(declaredDeps));

// Find orphans: in lockfile top-level but not a direct dependency
// Note: most of these are transitive deps, so we only flag packages that
// aren't referenced as a dependency by ANY package in the lockfile
function isReferencedByAny(pkgName: string): boolean {
  for (const [, entry] of Object.entries(lockPackages)) {
    const e = entry as Record<string, unknown>;
    const allDeps = {
      ...(e.dependencies as Record<string, string> || {}),
      ...(e.devDependencies as Record<string, string> || {}),
      ...(e.peerDependencies as Record<string, string> || {}),
      ...(e.optionalDependencies as Record<string, string> || {}),
    };
    if (pkgName in allDeps) return true;
  }
  return false;
}

const orphans: string[] = [];
for (const pkg of topLevelLockDeps) {
  if (!declaredSet.has(pkg) && !isReferencedByAny(pkg)) {
    orphans.push(pkg);
  }
}

if (orphans.length > 0) {
  warnings.push(
    `Potentially orphaned packages (${orphans.length}):\n` +
    orphans.map((d) => `  - ${d}`).join('\n')
  );
}

// Report
console.log('--- Lockfile Integrity Check ---\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('OK: lockfileVersion 3, all dependencies present, no orphans detected.');
} else {
  for (const err of errors) {
    console.error(`FAIL: ${err}\n`);
  }
  for (const warn of warnings) {
    console.warn(`WARN: ${warn}\n`);
  }
  if (errors.length === 0) {
    console.log('OK: lockfile structure valid (warnings above are non-blocking).');
  }
}

process.exit(exitCode);
