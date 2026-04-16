// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Dependency License Audit
 *
 * Scans all npm dependencies via `npm ls --json --all --long` and checks
 * each package's license against blocked/allowed lists.
 *
 * Exit 1 if any blocked (copyleft) license is found, exit 0 otherwise.
 * Unknown licenses produce warnings but do not fail the audit.
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';

// --- License classification ---

const BLOCKED_LICENSES = new Set([
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'SSPL-1.0',
  'SSPL',
  'EUPL-1.1',
  'EUPL-1.2',
  'EUPL',
]);

const ALLOWED_LICENSES = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'CC-BY-4.0',
  'CC-BY-3.0',
  'BlueOak-1.0.0',
  'Python-2.0',
  'MIT-0',
]);

// --- Types ---

interface NpmLsDep {
  version?: string;
  license?: string;
  dependencies?: Record<string, NpmLsDep>;
}

interface PackageEntry {
  name: string;
  version: string;
  license: string;
}

// --- Helpers ---

function normalizeLicense(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object' && 'type' in raw) {
    return String((raw as { type: string }).type).trim();
  }
  return 'UNKNOWN';
}

function classifyLicense(license: string): 'blocked' | 'allowed' | 'unknown' {
  if (BLOCKED_LICENSES.has(license)) return 'blocked';
  if (ALLOWED_LICENSES.has(license)) return 'allowed';
  // Handle SPDX OR expressions — consumer picks the best option
  // Blocked only if ALL choices are blocked; allowed if ANY choice is allowed
  if (license.includes(' OR ')) {
    const parts = license.split(/\s+OR\s+/).map((s) => s.replace(/[()]/g, '').trim());
    if (parts.some((p) => ALLOWED_LICENSES.has(p))) return 'allowed';
    if (parts.every((p) => BLOCKED_LICENSES.has(p))) return 'blocked';
    return 'unknown';
  }
  // Handle SPDX AND expressions — all must be acceptable
  if (license.includes(' AND ')) {
    const parts = license.split(/\s+AND\s+/).map((s) => s.replace(/[()]/g, '').trim());
    if (parts.some((p) => BLOCKED_LICENSES.has(p))) return 'blocked';
    if (parts.every((p) => ALLOWED_LICENSES.has(p))) return 'allowed';
    return 'unknown';
  }
  return 'unknown';
}

function extractDeps(
  deps: Record<string, NpmLsDep> | undefined,
  prefix: string,
  out: PackageEntry[],
  seen: Set<string>,
): void {
  if (!deps) return;
  for (const [name, info] of Object.entries(deps)) {
    const version = info.version ?? '0.0.0';
    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      version,
      license: normalizeLicense(info.license),
    });
    extractDeps(info.dependencies, `${prefix}${name}/`, out, seen);
  }
}

// --- Main ---

function main(): void {
  const projectDir = path.resolve(import.meta.dirname ?? __dirname, '..');

  console.log('Running npm ls --json --all --long ...\n');

  let rawJson: string;
  try {
    rawJson = execSync('npm ls --json --all --long 2>/dev/null', {
      cwd: projectDir,
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf-8',
    });
  } catch (err: unknown) {
    // npm ls exits non-zero on peer dep issues but still produces valid JSON
    const execErr = err as { stdout?: string };
    if (execErr.stdout) {
      rawJson = execErr.stdout;
    } else {
      console.error('Failed to run npm ls:', err);
      process.exit(1);
    }
  }

  let tree: NpmLsDep;
  try {
    tree = JSON.parse(rawJson) as NpmLsDep;
  } catch {
    console.error('Failed to parse npm ls JSON output');
    process.exit(1);
  }

  const packages: PackageEntry[] = [];
  const seen = new Set<string>();
  extractDeps(tree.dependencies, '', packages, seen);

  if (packages.length === 0) {
    console.error('No dependencies found — check npm ls output');
    process.exit(1);
  }

  // Classify
  const blocked: PackageEntry[] = [];
  const unknown: PackageEntry[] = [];
  const licenseCounts = new Map<string, number>();

  for (const pkg of packages) {
    const count = licenseCounts.get(pkg.license) ?? 0;
    licenseCounts.set(pkg.license, count + 1);

    const classification = classifyLicense(pkg.license);
    if (classification === 'blocked') blocked.push(pkg);
    else if (classification === 'unknown') unknown.push(pkg);
  }

  // --- Summary ---
  console.log(`Scanned ${packages.length} unique packages\n`);

  // License counts (sorted by count descending)
  const sorted = [...licenseCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('License distribution:');
  for (const [license, count] of sorted) {
    const tag =
      classifyLicense(license) === 'blocked'
        ? ' [BLOCKED]'
        : classifyLicense(license) === 'unknown'
          ? ' [UNKNOWN]'
          : '';
    console.log(`  ${license}: ${count}${tag}`);
  }
  console.log();

  // Unknown warnings
  if (unknown.length > 0) {
    console.log(`WARNING: ${unknown.length} package(s) with unrecognized licenses:`);
    for (const pkg of unknown) {
      console.log(`  - ${pkg.name}@${pkg.version}: ${pkg.license}`);
    }
    console.log();
  }

  // Blocked failures
  if (blocked.length > 0) {
    console.log(`FAIL: ${blocked.length} package(s) with BLOCKED copyleft licenses:`);
    for (const pkg of blocked) {
      console.log(`  - ${pkg.name}@${pkg.version}: ${pkg.license}`);
    }
    console.log();
    process.exit(1);
  }

  console.log('PASS: No blocked licenses found.');
}

main();
