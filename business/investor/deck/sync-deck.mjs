#!/usr/bin/env node
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Proprietary and confidential. Do not distribute.

// Pitch deck sync: PITCH-DECK.md (source of truth) → deck/index.html (presentation)
// Triggered by pre-commit hook when PITCH-DECK.md is staged.
// Zero dependencies — runs with bare Node.js.

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MD_PATH = join(__dirname, '..', 'PITCH-DECK.md');
const HTML_PATH = join(__dirname, 'index.html');

// ─── Markdown parsing ────────────────────────────────────────────────

function parseSlides(md) {
  const slides = new Map();
  // Split on ## Slide N: headers
  const slideRegex = /^## Slide (\d+):\s*(.+)$/gm;
  const matches = [...md.matchAll(slideRegex)];

  for (let i = 0; i < matches.length; i++) {
    const num = parseInt(matches[i][1], 10);
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
    const body = md.slice(start, end).trim();
    slides.set(num, body);
  }

  // Parse appendices
  const appendixRegex = /^## Appendix:\s*(.+)$/gm;
  const appMatches = [...md.matchAll(appendixRegex)];
  for (let i = 0; i < appMatches.length; i++) {
    const name = appMatches[i][1].trim();
    const start = appMatches[i].index + appMatches[i][0].length;
    const end = i + 1 < appMatches.length ? appMatches[i + 1].index : md.length;
    const body = md.slice(start, end).trim();
    slides.set(`appendix:${name}`, body);
  }

  return slides;
}

function extractTables(slideBody) {
  const tables = [];
  const lines = slideBody.split('\n');
  let current = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      inTable = true;
      current.push(line.trim());
    } else if (inTable) {
      tables.push(parseTable(current));
      current = [];
      inTable = false;
    }
  }
  if (current.length > 0) tables.push(parseTable(current));
  return tables;
}

function parseTable(lines) {
  // Returns { headers: string[], separatorRow: number, rows: string[][] }
  const result = { headers: [], rows: [], alignments: [] };
  for (let i = 0; i < lines.length; i++) {
    const cells = splitTableRow(lines[i]);
    if (i === 0) {
      result.headers = cells;
    } else if (cells.every(c => /^[-:]+$/.test(c.trim()))) {
      // Separator row — extract alignments
      result.alignments = cells.map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
    } else {
      result.rows.push(cells);
    }
  }
  return result;
}

function splitTableRow(line) {
  // Split | col1 | col2 | into [col1, col2]
  return line.split('|').slice(1, -1).map(c => c.trim());
}

function extractSpeakerNote(slideBody) {
  const match = slideBody.match(/^>\s*\*\*Speaker note:\*\*\s*([\s\S]*?)(?:\n\n|\n---|\n$|$)/m);
  if (!match) return null;
  // Collapse continuation lines (> prefix)
  return match[1]
    .split('\n')
    .map(l => l.replace(/^>\s?/, ''))
    .join(' ')
    .trim();
}

function extractBullets(slideBody) {
  const bullets = [];
  for (const line of slideBody.split('\n')) {
    const match = line.match(/^- (.+)$/);
    if (match) bullets.push(match[1]);
  }
  return bullets;
}

function extractCodeBlock(slideBody) {
  const match = slideBody.match(/```[\s\S]*?\n([\s\S]*?)```/);
  return match ? match[1].trimEnd() : null;
}

// ─── Markdown → HTML transforms ──────────────────────────────────────

function mdInlineToHtml(text) {
  // Order matters: bold before italic
  let html = text;
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  // Entities
  html = html.replace(/—/g, '&mdash;');
  html = html.replace(/→/g, '&rarr;');
  html = html.replace(/←/g, '&larr;');
  html = html.replace(/×/g, '&times;');
  html = html.replace(/≥/g, '&ge;');
  html = html.replace(/≤/g, '&le;');
  // FabricK brand
  html = html.replace(/\bFabricK\b/g, '<span class="fab-accent">FabricK</span>');
  return html;
}

function tableRowsToHtml(table, opts = {}) {
  const { skipHeader = true, indent = '    ', pillMap = {} } = opts;
  const lines = [];

  for (const row of table.rows) {
    const cells = row.map((cell, ci) => {
      let html = mdInlineToHtml(cell);
      // Apply pill badges if configured
      for (const [pattern, cls] of Object.entries(pillMap)) {
        if (html.includes(pattern)) {
          html = html.replace(
            new RegExp(`\\b${escapeRegex(pattern)}\\b`),
            `<span class="pill ${cls}">${pattern}</span>`
          );
        }
      }
      // Alignment
      const align = table.alignments[ci];
      if (align === 'center') return `<td style="text-align:center;">${html}</td>`;
      if (align === 'right') return `<td style="text-align:right;">${html}</td>`;
      return `<td>${html}</td>`;
    });
    lines.push(`${indent}<tr>${cells.join('')}</tr>`);
  }

  return lines.join('\n');
}

function bulletsToHtml(bullets, indent = '    ') {
  return bullets
    .map(b => `${indent}<li>${mdInlineToHtml(b)}</li>`)
    .join('\n');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── HTML injection ──────────────────────────────────────────────────

function injectZone(html, zoneId, content) {
  const pattern = new RegExp(
    `(<!-- sync:${escapeRegex(zoneId)} -->)\\n[\\s\\S]*?(\\n\\s*<!-- \\/sync:${escapeRegex(zoneId)} -->)`,
  );
  const match = html.match(pattern);
  if (!match) return { html, found: false };
  // Escape $ in content to prevent backreference interpretation by String.replace()
  const safeContent = content.replace(/\$/g, '$$$$');
  const replaced = html.replace(pattern, `$1\n${safeContent}$2`);
  return { html: replaced, found: true };
}

// ─── Sync map ────────────────────────────────────────────────────────
// Each entry: { zoneId, source, transform }
// source: { slide: N, type: 'table'|'bullets'|'note'|'code', index?: N }

const PILL_MAP_MIGRATION = {
  'Zero': 'pill-green',
  'Minimal': 'pill-green',
  'Controlled': 'pill-amber',
  'Incremental': 'pill-green',
};

const PILL_MAP_STATUS = {
  'Shipping': 'pill-green',
  'Tiered, shipping': 'pill-green',
  'Shipping / v2.0': 'pill-green',
  'Shipping / v2.2': 'pill-green',
  'v2.3': 'pill-amber',
};

const SYNC_MAP = [
  // Slide 2: The Problem
  // Note: slide-2-problem-table and slide-2-problem-bullets are protected zones
  // (custom stat-cards layout in HTML) — only the speaker note is synced.
  {
    zoneId: 'notes-slide-2',
    source: { slide: 2, type: 'note' },
  },

  // Slide 5: Market Opportunity — TAM table
  {
    zoneId: 'slide-7-tam-table',
    source: { slide: 5, type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'notes-slide-7',
    source: { slide: 5, type: 'note' },
  },

  // Slide 10: Microservices — benefit + cost tables
  {
    zoneId: 'slide-14-microservices-table',
    source: { slide: 10, type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'slide-14-cost-table',
    source: { slide: 10, type: 'table', index: 1 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'notes-slide-14',
    source: { slide: 10, type: 'note' },
  },

  // Slide 11: Glasswing
  {
    zoneId: 'slide-15-glasswing-table',
    source: { slide: 11, type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'slide-15-practices-table',
    source: { slide: 11, type: 'table', index: 1 },
    transform: { skipHeader: true, pillMap: PILL_MAP_STATUS },
  },
  {
    zoneId: 'notes-slide-15',
    source: { slide: 11, type: 'note' },
  },

  // Slide 12: Competitive Positioning
  {
    zoneId: 'slide-16-competitive-table',
    source: { slide: 12, type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'notes-slide-16',
    source: { slide: 12, type: 'note' },
  },

  // Slide 13: Traction
  {
    zoneId: 'slide-17-traction-table',
    source: { slide: 13, type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'notes-slide-17',
    source: { slide: 13, type: 'note' },
  },

  // Slide 8: Smart Bridges — K8s + AI tables
  {
    zoneId: 'slide-10-bridges-k8s-table',
    source: { slide: 8, type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'slide-10-bridges-ai-table',
    source: { slide: 8, type: 'table', index: 1 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'slide-11-migration-table',
    source: { slide: 8, type: 'table', index: 2 },
    transform: { skipHeader: true, pillMap: PILL_MAP_MIGRATION },
  },
  {
    zoneId: 'notes-slide-10',
    source: { slide: 8, type: 'note' },
  },

  // Appendix: Verticals
  {
    zoneId: 'appendix-verticals-table',
    source: { slide: 'appendix:Fabrick Sales Verticals', type: 'table', index: 0 },
    transform: { skipHeader: true },
  },

  // Appendix: Success Programs
  {
    zoneId: 'appendix-success-table',
    source: { slide: 'appendix:Success Programs', type: 'table', index: 0 },
    transform: { skipHeader: true },
  },

  // Appendix: Competitive scorecards
  {
    zoneId: 'appendix-orchestration-table',
    source: { slide: 'appendix:Competitive Feature Scorecard', type: 'table', index: 0 },
    transform: { skipHeader: true },
  },
  {
    zoneId: 'appendix-virtualization-table',
    source: { slide: 'appendix:Competitive Feature Scorecard', type: 'table', index: 1 },
    transform: { skipHeader: true },
  },
];

// ─── Main ────────────────────────────────────────────────────────────

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  const md = readFileSync(MD_PATH, 'utf-8');
  let html = readFileSync(HTML_PATH, 'utf-8');

  const slides = parseSlides(md);
  let synced = 0;
  let skipped = 0;
  let missing = 0;

  for (const entry of SYNC_MAP) {
    const slideBody = slides.get(entry.source.slide);
    if (!slideBody) {
      if (verbose) console.warn(`  ⚠ No slide body for ${entry.zoneId} (slide ${entry.source.slide})`);
      missing++;
      continue;
    }

    let content;
    switch (entry.source.type) {
      case 'table': {
        const tables = extractTables(slideBody);
        const idx = entry.source.index ?? 0;
        if (idx >= tables.length) {
          if (verbose) console.warn(`  ⚠ Table index ${idx} not found in slide ${entry.source.slide}`);
          missing++;
          continue;
        }
        content = tableRowsToHtml(tables[idx], entry.transform || {});
        break;
      }
      case 'bullets': {
        const bullets = extractBullets(slideBody);
        if (bullets.length === 0) {
          if (verbose) console.warn(`  ⚠ No bullets found in slide ${entry.source.slide}`);
          missing++;
          continue;
        }
        content = bulletsToHtml(bullets);
        break;
      }
      case 'note': {
        const note = extractSpeakerNote(slideBody);
        if (!note) {
          if (verbose) console.warn(`  ⚠ No speaker note in slide ${entry.source.slide}`);
          missing++;
          continue;
        }
        content = `    ${mdInlineToHtml(note)}`;
        break;
      }
      case 'code': {
        const code = extractCodeBlock(slideBody);
        if (!code) {
          if (verbose) console.warn(`  ⚠ No code block in slide ${entry.source.slide}`);
          missing++;
          continue;
        }
        content = code;
        break;
      }
      default:
        console.warn(`  ⚠ Unknown type: ${entry.source.type}`);
        missing++;
        continue;
    }

    const result = injectZone(html, entry.zoneId, content);
    if (!result.found) {
      if (verbose) console.warn(`  ⚠ Marker not found in HTML: <!-- sync:${entry.zoneId} -->`);
      skipped++;
    } else {
      if (result.html !== html) {
        html = result.html;
        synced++;
        if (verbose) console.log(`  ✓ ${entry.zoneId}`);
      } else {
        if (verbose) console.log(`  · ${entry.zoneId} (unchanged)`);
      }
    }
  }

  if (!dryRun) {
    writeFileSync(HTML_PATH, html);
  }

  const total = SYNC_MAP.length;
  console.log(`pitch-deck sync: ${synced} updated, ${total - synced - skipped - missing} unchanged, ${skipped} markers missing, ${missing} content missing${dryRun ? ' (dry run)' : ''}`);

  if (synced > 0 && !dryRun) {
    process.exit(0); // signal success, content changed
  }
  process.exit(0);
}

main();
