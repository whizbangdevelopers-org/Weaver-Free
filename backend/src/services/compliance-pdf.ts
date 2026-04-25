// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFileSync } from 'node:fs'
import { readFile, writeFile, rename, unlink, mkdtemp, rm, mkdir } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import MarkdownIt from 'markdown-it'

const execFileAsync = promisify(execFile) as (
  file: string,
  args: string[],
  options: { timeout: number },
) => Promise<{ stdout: string; stderr: string }>

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

/** Slug → file path mapping (relative to docs root) */
const COMPLIANCE_DOCS: Record<string, { path: string; title: string }> = {
  'security-baselines': { path: 'security/SECURITY-BASELINES.md', title: 'Security Baselines' },
  'nist-800-171': { path: 'security/compliance/NIST-800-171-MAPPING.md', title: 'NIST 800-171 Mapping' },
  'hipaa-164-312': { path: 'security/compliance/HIPAA-164-312-MAPPING.md', title: 'HIPAA §164.312 Mapping' },
  'pci-dss': { path: 'security/compliance/PCI-DSS-MAPPING.md', title: 'PCI DSS v4.0 Mapping' },
  'cis-benchmarks': { path: 'security/compliance/CIS-BENCHMARK-ALIGNMENT.md', title: 'CIS Benchmark Alignment' },
  'soc2-readiness': { path: 'security/compliance/SOC2-READINESS.md', title: 'SOC 2 Readiness' },
}

export function getComplianceSlugs(): string[] {
  return Object.keys(COMPLIANCE_DOCS)
}

export function isValidComplianceSlug(slug: string): boolean {
  return slug in COMPLIANCE_DOCS
}

interface PdfOptions {
  slug: string
  version: string
  weasyprintBin: string
  docsRoot: string
  cacheDir: string
}

/**
 * Generate a branded compliance PDF using WeasyPrint.
 * Caches to disk keyed by slug + version — deterministic output for static markdown.
 * Cache naturally invalidates on version bump (new key).
 * Returns the PDF as a Buffer.
 */
export async function generateCompliancePdf(options: PdfOptions): Promise<Buffer> {
  const { slug, version, weasyprintBin, docsRoot, cacheDir } = options
  const docDef = COMPLIANCE_DOCS[slug]
  if (!docDef) throw new Error(`Unknown compliance document: ${slug}`)

  // Check cache first — read-with-ENOENT-fallthrough instead of existsSync+readFile
  // to avoid the TOCTOU window where a file passes existsSync() and is then
  // deleted before readFileSync(). The same race existed on the write side
  // (cachePath passing exists check and then being mutated by a concurrent
  // writer before our overwrite). `readFile` returning a buffer means "it
  // existed AND we got its contents atomically"; ENOENT falls through to
  // regenerate. CodeQL's js/file-system-race rule prescribes exactly this.
  const cacheFileName = `weaver-${slug}-v${version}.pdf`
  const cachePath = join(cacheDir, cacheFileName)
  try {
    return await readFile(cachePath)
  } catch (err) {
    // ENOENT is the expected miss path; any other error should propagate.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  // Read and convert markdown
  const mdPath = join(docsRoot, docDef.path)
  const raw = readFileSync(mdPath, 'utf-8')
  // Strip copyright headers
  const stripped = raw.replace(/^<!--[\s\S]*?-->\s*/g, '')
  const contentHtml = md.render(stripped)

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Build full HTML document with embedded CSS
  const html = buildHtmlDocument(docDef.title, version, date, contentHtml)

  // Write HTML to temp file, run WeasyPrint, read PDF output
  const tmpDir = await mkdtemp(join(tmpdir(), 'weaver-pdf-'))
  const htmlPath = join(tmpDir, 'input.html')
  const pdfPath = join(tmpDir, 'output.pdf')

  try {
    await writeFile(htmlPath, html, 'utf-8')
    const args: string[] = [htmlPath, pdfPath]
    await execFileAsync(weasyprintBin, args, { timeout: 30_000 })
    const pdfBuffer = readFileSync(pdfPath)

    // Write to cache (fire-and-forget — serve even if caching fails)
    await mkdir(cacheDir, { recursive: true }).catch(() => {})
    // Atomic cache write: write to temp first, then rename — prevents partial reads on concurrent requests.
    const tmpCachePath = `${cachePath}.tmp-${randomBytes(4).toString('hex')}`
    await writeFile(tmpCachePath, pdfBuffer)
      .then(() => rename(tmpCachePath, cachePath))
      .catch(() => { unlink(tmpCachePath).catch(() => {}) })

    return pdfBuffer
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

function buildHtmlDocument(
  title: string,
  version: string,
  date: string,
  contentHtml: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} — Weaver</title>
<style>
${PDF_STYLES}
</style>
</head>
<body>

<!-- Cover page -->
<div class="cover">
  <div class="cover-accent-top"></div>
  <div class="cover-body">
    <div class="cover-company">whizBANG Developers</div>
    <div class="cover-product">Weaver</div>
    <div class="cover-divider"></div>
    <div class="cover-title">${escapeHtml(title)}</div>
    <div class="cover-subtitle">Compliance Control Mapping</div>
  </div>
  <div class="cover-meta">
    <div>Version: ${escapeHtml(version)}</div>
    <div>Generated: ${escapeHtml(date)}</div>
  </div>
  <div class="cover-footer">
    <div class="cover-disclaimer">
      This document maps technical controls to industry standards. It is not a certification claim.
    </div>
    <div class="cover-generated">Generated by Weaver — whizbangdevelopers.com</div>
  </div>
  <div class="cover-accent-bottom"></div>
</div>

<!-- Content pages -->
<div class="content">
${contentHtml}
</div>

</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PDF_STYLES = `
/* Page setup */
@page {
  size: A4;
  margin: 20mm 18mm 25mm 18mm;

  @bottom-center {
    content: "Weaver ${/* version injected via title */ ''}— whizbangdevelopers.com";
    font-size: 8pt;
    color: #999;
    font-family: Helvetica, Arial, sans-serif;
  }

  @bottom-right {
    content: counter(page);
    font-size: 8pt;
    color: #999;
    font-family: Helvetica, Arial, sans-serif;
  }
}

@page :first {
  margin: 0;
  @bottom-center { content: none; }
  @bottom-right { content: none; }
}

/* Base */
body {
  font-family: Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.6;
  color: #1a1a2e;
}

/* Cover page */
.cover {
  page-break-after: always;
  width: 210mm;
  height: 297mm;
  position: relative;
  display: flex;
  flex-direction: column;
}

.cover-accent-top, .cover-accent-bottom {
  height: 8mm;
  background: #FF6B35;
}

.cover-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 30mm;
}

.cover-company {
  font-size: 14pt;
  font-weight: bold;
  color: #666;
  margin-bottom: 6mm;
}

.cover-product {
  font-size: 36pt;
  font-weight: bold;
  color: #FF6B35;
  margin-bottom: 6mm;
}

.cover-divider {
  width: 80mm;
  height: 0.5mm;
  background: #FF6B35;
  margin-bottom: 10mm;
}

.cover-title {
  font-size: 22pt;
  font-weight: bold;
  color: #1a1a2e;
  text-align: center;
  margin-bottom: 4mm;
}

.cover-subtitle {
  font-size: 13pt;
  color: #666;
}

.cover-meta {
  text-align: center;
  font-size: 11pt;
  color: #999;
  padding-bottom: 15mm;
  line-height: 1.8;
}

.cover-footer {
  text-align: center;
  padding-bottom: 8mm;
}

.cover-disclaimer {
  font-size: 8pt;
  color: #999;
  margin-bottom: 3mm;
}

.cover-generated {
  font-size: 9pt;
  color: #999;
}

/* Content */
.content {
  padding-top: 0;
}

.content h1 {
  font-size: 18pt;
  font-weight: 600;
  padding-bottom: 3mm;
  border-bottom: 0.3mm solid rgba(0, 0, 0, 0.12);
  margin-bottom: 4mm;
  color: #1a1a2e;
}

.content h2 {
  font-size: 14pt;
  font-weight: 600;
  margin-top: 8mm;
  margin-bottom: 3mm;
  padding-bottom: 2mm;
  border-bottom: 0.2mm solid rgba(0, 0, 0, 0.06);
  page-break-after: avoid;
}

.content h3 {
  font-size: 11.5pt;
  font-weight: 600;
  margin-top: 6mm;
  margin-bottom: 2mm;
  page-break-after: avoid;
}

.content p {
  margin-bottom: 3mm;
}

.content ul, .content ol {
  margin-bottom: 3mm;
  padding-left: 6mm;
}

.content li {
  margin-bottom: 1mm;
}

.content code {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.5mm 1.5mm;
  border-radius: 1mm;
  font-size: 9pt;
  font-family: 'Courier New', monospace;
}

.content pre {
  background: rgba(0, 0, 0, 0.04);
  padding: 3mm;
  border-radius: 1.5mm;
  overflow-x: auto;
  margin-bottom: 3mm;
  font-size: 8.5pt;
}

.content pre code {
  background: none;
  padding: 0;
}

.content table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 4mm;
  font-size: 9pt;
  page-break-inside: avoid;
}

.content th, .content td {
  border: 0.3mm solid rgba(0, 0, 0, 0.15);
  padding: 2mm 3mm;
  text-align: left;
}

.content th {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.content blockquote {
  border-left: 1mm solid #FF6B35;
  margin: 3mm 0;
  padding: 2mm 4mm;
  background: rgba(0, 0, 0, 0.02);
}

.content em:first-child {
  color: #FF6B35;
}

.content a {
  color: #FF6B35;
  text-decoration: none;
}

.content hr {
  border: none;
  border-top: 0.3mm solid rgba(0, 0, 0, 0.12);
  margin: 6mm 0;
}

/* Strong in tables — control IDs */
.content strong {
  font-weight: 600;
}
`
