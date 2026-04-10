// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * generate-cashflow.ts — Generates business/finance/CASHFLOW-PROJECTION.md from
 * business/finance/cashflow-inputs.json. Run via: npm run generate:cashflow
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(ROOT, '..')
const INPUTS_PATH = process.env.CASHFLOW_INPUTS || resolve(PROJECT_ROOT, 'business', 'finance', 'cashflow-inputs.json')
const OUTPUT_PATH = process.env.CASHFLOW_OUTPUT || resolve(PROJECT_ROOT, 'business', 'finance', 'CASHFLOW-PROJECTION.md')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpensePhase {
  aiTools: number
  infrastructure: number
  insurance: number
  legal: number
  bookkeeping: number
  registeredAgents: number
  markReimbursement: number
  marketing: number
  contingencyPct: number
}

interface PartnerEvent {
  month: number
  count: number
  label: string
}

interface SuccessEvent {
  month: number
  program: 'adopt' | 'accelerate' | 'partner'
  note?: string
}

interface ProfServiceEvent {
  month: number
  amount: number
}

interface Scenario {
  label: string
  description: string
  keyAssumptions: string[]
  cumulativeWeaver: number[]
  cumulativeWeaverTeam: number[]
  cumulativeFabrick: number[]
  partnerTimeline: PartnerEvent[]
  successEvents: SuccessEvent[]
  professionalServiceEvents: ProfServiceEvent[]
  firstHireMonth: number | null
  secondHireMonth: number | null
  versionSchedule: Record<string, string>
}

interface Inputs {
  meta: { startDate: string; months: number; sourceDocs: string[] }
  pricing: {
    weaverSolo: { annual: number }
    weaverTeam: { annual: number; avgAnnual: number }
    fabrick: { firstNode: number; nodes2to9: number; nodes10plus: number }
    plugins: { avgAnnual: number }
  }
  blendedFabrickAnnual: number
  expenses: {
    phases: { preRevenue: ExpensePhase; earlyRevenue: ExpensePhase; atScale: ExpensePhase }
    phaseTransitions: { earlyRevenueAtMRR: number; atScaleAtMRR: number }
  }
  oneTimeCosts: { name: string; amount: number; month: number }[]
  hiring: { mrrTrigger: number; monthlyCost: number; label: string }[]
  partnerChannel: {
    annualFee: number
    foundingMemberCommission: number
    clientsPerPartnerPerYear: Record<string, number>
  }
  successPrograms: Record<string, number>
  scenarios: Record<string, Scenario>
  forgeImpact: {
    annualLaborSavings: number
    hiringDelayMonths: number
    hiringMonthlyCost: number
    velocityMultiplier: string
    releaseCadenceImprovement: string
  }
  sensitivityVariables: { variable: string; impact: string; sensitivity: string }[]
}

// ---------------------------------------------------------------------------
// Month-by-month calculation
// ---------------------------------------------------------------------------

interface MonthRow {
  month: number
  version: string
  cumWeaver: number
  cumWeaverTeam: number
  cumFabrick: number
  weaverMRR: number
  weaverTeamMRR: number
  fabrickMRR: number
  directRevenue: number
  partnerFees: number
  partnerSourcedRevenue: number
  successRevenue: number
  profServicesRevenue: number
  totalRevenue: number
  baseExpenses: number
  oneTimeCosts: number
  hiringCost: number
  totalExpenses: number
  commissionOut: number
  netCash: number
  cumulativeCash: number
  footnotes: string[]
  activePartners: number
  cumPartnerSourcedClients: number
  totalMRR: number
  headcount: number
}

function computePhaseExpenses(phase: ExpensePhase): number {
  const items =
    phase.aiTools +
    phase.infrastructure +
    phase.insurance +
    phase.legal +
    phase.bookkeeping +
    phase.registeredAgents +
    phase.markReimbursement +
    phase.marketing
  const contingency = Math.round(items * phase.contingencyPct)
  return items + contingency
}

function getExpensePhase(
  mrr: number,
  transitions: { earlyRevenueAtMRR: number; atScaleAtMRR: number },
): 'preRevenue' | 'earlyRevenue' | 'atScale' {
  if (mrr >= transitions.atScaleAtMRR) return 'atScale'
  if (mrr >= transitions.earlyRevenueAtMRR) return 'earlyRevenue'
  return 'preRevenue'
}

function computeScenario(
  key: string,
  scenario: Scenario,
  inputs: Inputs,
): MonthRow[] {
  const rows: MonthRow[] = []
  let cumulativeCash = 0
  let activePartners = 0
  let cumPartnerSourcedClients = 0
  const clientsPerPartnerPerMonth =
    (inputs.partnerChannel.clientsPerPartnerPerYear[key] ?? 3) / 12
  let _activeHireCost = 0

  for (let m = 1; m <= inputs.meta.months; m++) {
    const footnotes: string[] = []

    // --- Customers ---
    const cumWeaver = scenario.cumulativeWeaver[m - 1] ?? 0
    const cumWeaverTeam = scenario.cumulativeWeaverTeam[m - 1] ?? 0
    const cumFabrick = scenario.cumulativeFabrick[m - 1] ?? 0

    // --- Direct revenue ---
    const weaverMRR = Math.round(
      (cumWeaver * inputs.pricing.weaverSolo.annual) / 12,
    )
    const weaverTeamMRR = Math.round(
      (cumWeaverTeam * inputs.pricing.weaverTeam.avgAnnual) / 12,
    )
    const fabrickMRR = Math.round(
      (cumFabrick * inputs.blendedFabrickAnnual) / 12,
    )
    const directRevenue = weaverMRR + weaverTeamMRR + fabrickMRR

    // --- Partners ---
    let partnerFees = 0
    for (const pe of scenario.partnerTimeline) {
      if (pe.month === m) {
        partnerFees += pe.count * inputs.partnerChannel.annualFee
        activePartners += pe.count
        footnotes.push(pe.label)
      }
    }

    // Partner-sourced clients accumulate
    if (activePartners > 0) {
      cumPartnerSourcedClients += activePartners * clientsPerPartnerPerMonth
    }
    const partnerSourcedRevenue = Math.round(
      (cumPartnerSourcedClients * inputs.blendedFabrickAnnual) / 12,
    )

    // Commission
    const commissionOut = Math.round(
      partnerSourcedRevenue * inputs.partnerChannel.foundingMemberCommission,
    )

    // --- Success programs ---
    let successRevenue = 0
    for (const se of scenario.successEvents) {
      if (se.month === m) {
        successRevenue += inputs.successPrograms[se.program] ?? 0
        if (se.note) footnotes.push(se.note)
      }
    }

    // --- Professional services ---
    let profServicesRevenue = 0
    for (const ps of scenario.professionalServiceEvents) {
      if (ps.month === m) {
        profServicesRevenue += ps.amount
      }
    }

    // --- Total revenue ---
    const totalRevenue =
      directRevenue +
      partnerFees +
      partnerSourcedRevenue +
      successRevenue +
      profServicesRevenue

    // --- Expenses ---
    const totalMRR = directRevenue + partnerSourcedRevenue
    const phaseName = getExpensePhase(totalMRR, inputs.expenses.phaseTransitions)
    const phase = inputs.expenses.phases[phaseName]
    const baseExpenses = computePhaseExpenses(phase)

    let oneTimeCosts = 0
    for (const otc of inputs.oneTimeCosts) {
      if (otc.month === m) oneTimeCosts += otc.amount
    }

    // Hiring
    if (scenario.firstHireMonth && m === scenario.firstHireMonth) {
      _activeHireCost = inputs.hiring[0]?.monthlyCost ?? 0
      footnotes.push(`First hire: ${inputs.hiring[0]?.label ?? 'contractor'}`)
    }
    if (scenario.secondHireMonth && m === scenario.secondHireMonth) {
      _activeHireCost = inputs.hiring[1]?.monthlyCost ?? 0
      footnotes.push(
        `Second hire: ${inputs.hiring[1]?.label ?? 'FT conversion'}`,
      )
    }
    const hiringCost = m >= (scenario.firstHireMonth ?? Infinity) ? (
      m >= (scenario.secondHireMonth ?? Infinity) ? (inputs.hiring[1]?.monthlyCost ?? 0) : (inputs.hiring[0]?.monthlyCost ?? 0)
    ) : 0

    const totalExpenses = baseExpenses + oneTimeCosts + hiringCost

    // --- Net ---
    const netCash = totalRevenue - totalExpenses - commissionOut
    cumulativeCash += netCash

    // Version
    const version = scenario.versionSchedule[String(m)] ?? '—'

    // Headcount
    let headcount = 2 // founders
    if (scenario.firstHireMonth && m >= scenario.firstHireMonth) headcount++
    if (scenario.secondHireMonth && m >= scenario.secondHireMonth) headcount++

    rows.push({
      month: m,
      version,
      cumWeaver,
      cumWeaverTeam,
      cumFabrick,
      weaverMRR,
      weaverTeamMRR,
      fabrickMRR,
      directRevenue,
      partnerFees,
      partnerSourcedRevenue,
      successRevenue,
      profServicesRevenue,
      totalRevenue,
      baseExpenses,
      oneTimeCosts,
      hiringCost,
      totalExpenses,
      commissionOut,
      netCash,
      cumulativeCash,
      footnotes,
      activePartners,
      cumPartnerSourcedClients,
      totalMRR,
      headcount,
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function $(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  return `${sign}$${abs.toLocaleString('en-US')}`
}

function $bold(n: number): string {
  return `**${$(n)}**`
}

function findMilestoneMonth(
  rows: MonthRow[],
  test: (r: MonthRow) => boolean,
): number | null {
  for (const r of rows) {
    if (test(r)) return r.month
  }
  return null
}

function monthLabel(startDate: string, monthNum: number): string {
  const [startYear, startMonth] = startDate.split('-').map(Number)
  const date = new Date(startYear, startMonth - 1 + monthNum - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function generateMarkdown(inputs: Inputs): string {
  const today = new Date().toISOString().split('T')[0]
  const scenarios: Record<string, MonthRow[]> = {}

  for (const key of ['best', 'base', 'worst']) {
    scenarios[key] = computeScenario(key, inputs.scenarios[key], inputs)
  }

  const lines: string[] = []
  const w = (s: string) => lines.push(s)

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------
  w('# Weaver — Cashflow Projection (24-Month Model)')
  w('')
  w(`**Last updated:** ${today}`)
  w(`**Generated:** ${today}`)
  w('**Status:** Planning — requires CPA review before use in investor materials')
  w(`**Projection period:** ${monthLabel(inputs.meta.startDate, 1)} through ${monthLabel(inputs.meta.startDate, inputs.meta.months)}`)
  w('**Source data:** [cashflow-inputs.json](cashflow-inputs.json) — edit inputs in `business/finance/cashflow-inputs.json`, then `cd code && npm run generate:cashflow`')
  w('')
  w('> **Disclaimer:** These projections are planning estimates, not guarantees. All revenue assumptions depend on successful execution of marketing, partner recruitment, and product delivery. Review with CPA/advisor before presenting to investors.')
  w('')
  w('> **This file is generated.** Do not edit directly. Modify `business/finance/cashflow-inputs.json` and re-run the generator.')
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // TOC
  // -------------------------------------------------------------------------
  w('## Table of Contents')
  w('')
  w('1. [Revenue Streams & Unit Economics](#1-revenue-streams)')
  w('2. [Expense Model](#2-expense-model)')
  w('3. [Scenario Definitions](#3-scenario-definitions)')
  w('4. [Best Case: Monthly Cashflow](#4-best-case)')
  w('5. [Base Case: Monthly Cashflow](#5-base-case)')
  w('6. [Worst Case: Monthly Cashflow](#6-worst-case)')
  w('7. [Cumulative Summary (All Scenarios)](#7-cumulative-summary)')
  w('8. [Key Milestones & Inflection Points](#8-milestones)')
  w('9. [Sensitivity Analysis](#9-sensitivity)')
  w('10. [Forge Productivity Impact](#10-forge-impact)')
  w('11. [Capital Requirements](#11-capital-requirements)')
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 1: Revenue Streams
  // -------------------------------------------------------------------------
  w('## 1. Revenue Streams & Unit Economics {#1-revenue-streams}')
  w('')
  w('### Software Licenses (Recurring)')
  w('')
  w('| Stream | Price | Billing | Available |')
  w('|--------|:-----:|---------|:---------:|')
  w(`| Weaver Solo (per node) | $${inputs.pricing.weaverSolo.annual}/yr | Annual | v1.0 |`)
  w(`| Weaver Team (per user, avg ${Math.round(inputs.pricing.weaverTeam.avgAnnual / inputs.pricing.weaverTeam.annual)} users) | $${inputs.pricing.weaverTeam.annual}/user/yr (~$${inputs.pricing.weaverTeam.avgAnnual}/yr avg) | Annual | v2.2 |`)
  w(`| Fabrick (first node) | $${inputs.pricing.fabrick.firstNode}/yr | Annual | v1.0 |`)
  w(`| Fabrick (nodes 2–9) | $${inputs.pricing.fabrick.nodes2to9}/yr each | Annual | v1.0 |`)
  w(`| Fabrick (add'l nodes, 10+ fleet) | $${inputs.pricing.fabrick.nodes10plus}/yr each | Annual | v1.0 |`)
  w(`| Plugins (à la carte) | ~$${inputs.pricing.plugins.avgAnnual}/yr avg | Annual | v1.1+ |`)
  w('')
  w(`**Blended Fabrick deal size:** ~${$(inputs.blendedFabrickAnnual)}/yr (weighted toward small deals in early months)`)
  w('')
  w('### Success Programs (Recurring)')
  w('')
  w('> FM prices used in this model (24-month window predates full delivery capacity). Standard prices activate by internal decision.')
  w('')
  w('| Program | FM Price (modeled) | Standard Price |')
  w('|---------|:-----------------:|:--------------:|')
  w(`| Adopt | ${$(inputs.successPrograms.adopt)}/yr | ${$(inputs.successPrograms.adoptStandard ?? 15000)}/yr |`)
  w(`| Accelerate | ${$(inputs.successPrograms.accelerate)}/yr | ${$(inputs.successPrograms.accelerateStandard ?? 45000)}/yr |`)
  w(`| Partner | ${$(inputs.successPrograms.partner)}/yr | ${$(inputs.successPrograms.partnerStandard ?? 90000)}/yr |`)
  w('')
  w('### Partner Channel')
  w('')
  w(`| Component | Value |`)
  w('|-----------|:-----:|')
  w(`| Annual partner fee | ${$(inputs.partnerChannel.annualFee)}/yr per partner |`)
  w(`| Founding Member commission | ${(inputs.partnerChannel.foundingMemberCommission * 100).toFixed(0)}% (locked forever) |`)
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 2: Expense Model
  // -------------------------------------------------------------------------
  w('## 2. Expense Model {#2-expense-model}')
  w('')
  w('### Monthly Operating Expenses')
  w('')
  w('| Category | Pre-Revenue | Early Revenue | At Scale |')
  w('|----------|:----------:|:------------:|:--------:|')
  for (const cat of [
    'aiTools', 'infrastructure', 'insurance', 'legal', 'bookkeeping',
    'registeredAgents', 'markReimbursement', 'marketing',
  ] as const) {
    const labels: Record<string, string> = {
      aiTools: 'AI dev tools',
      infrastructure: 'Infrastructure',
      insurance: 'Insurance',
      legal: 'Legal (amortized)',
      bookkeeping: 'Bookkeeping',
      registeredAgents: 'Registered agents',
      markReimbursement: "Mark's expense reimbursement",
      marketing: 'Marketing',
    }
    const pre = inputs.expenses.phases.preRevenue[cat]
    const early = inputs.expenses.phases.earlyRevenue[cat]
    const scale = inputs.expenses.phases.atScale[cat]
    w(`| ${labels[cat]} | ${$(pre)} | ${$(early)} | ${$(scale)} |`)
  }
  w(`| Contingency | ${(inputs.expenses.phases.preRevenue.contingencyPct * 100).toFixed(0)}% | ${(inputs.expenses.phases.earlyRevenue.contingencyPct * 100).toFixed(0)}% | ${(inputs.expenses.phases.atScale.contingencyPct * 100).toFixed(0)}% |`)
  w(`| **Subtotal (founders only)** | **${$(computePhaseExpenses(inputs.expenses.phases.preRevenue))}** | **${$(computePhaseExpenses(inputs.expenses.phases.earlyRevenue))}** | **${$(computePhaseExpenses(inputs.expenses.phases.atScale))}** |`)
  w('')
  w('### Hiring (triggered by MRR milestones)')
  w('')
  w('| MRR Trigger | Hire | Monthly Cost |')
  w('|:-----------:|------|:-----------:|')
  for (const h of inputs.hiring) {
    w(`| ${$(h.mrrTrigger)} | ${h.label} | ${$(h.monthlyCost)} |`)
  }
  w('')
  w('### One-Time Costs')
  w('')
  w('| Item | Amount | Month |')
  w('|------|:------:|:-----:|')
  let otcTotal = 0
  for (const otc of inputs.oneTimeCosts) {
    w(`| ${otc.name} | ${$(otc.amount)} | ${otc.month} |`)
    otcTotal += otc.amount
  }
  w(`| **Total** | **${$(otcTotal)}** | |`)
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 3: Scenario Definitions
  // -------------------------------------------------------------------------
  w('## 3. Scenario Definitions {#3-scenario-definitions}')
  w('')
  for (const key of ['best', 'base', 'worst']) {
    const s = inputs.scenarios[key]
    w(`### ${s.label}`)
    w('')
    w(s.description)
    w('')
    w('**Key assumptions:**')
    for (const a of s.keyAssumptions) {
      w(`- ${a}`)
    }
    w('')
  }
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Sections 4-6: Monthly Cashflow
  // -------------------------------------------------------------------------
  const sectionNums: Record<string, number> = { best: 4, base: 5, worst: 6 }

  for (const key of ['best', 'base', 'worst']) {
    const s = inputs.scenarios[key]
    const rows = scenarios[key]
    const secNum = sectionNums[key]

    w(`## ${secNum}. ${s.label}: Monthly Cashflow {#${secNum}-${key}-case}`)
    w('')

    // Determine if this scenario has partner/commission columns
    const hasPartners = s.partnerTimeline.length > 0
    const hasSuccess = s.successEvents.length > 0 || s.professionalServiceEvents.length > 0

    // Split into two halves
    for (const half of [0, 1]) {
      const start = half * 12
      const end = start + 12
      const halfRows = rows.slice(start, end)
      const halfLabel = half === 0 ? `Months 1–12 (${monthLabel(inputs.meta.startDate, 1)} – ${monthLabel(inputs.meta.startDate, 12)})` : `Months 13–24 (${monthLabel(inputs.meta.startDate, 13)} – ${monthLabel(inputs.meta.startDate, 24)})`

      w(`### ${halfLabel}`)
      w('')

      // Build table header dynamically based on scenario complexity
      if (hasPartners && hasSuccess) {
        w('| Mo | Ver | Solo | Team | Ent | Direct Rev | Partner Fees | Prtnr-Src Rev | Success+Svc | **Total Rev** | Expenses | Commission | **Net Cash** | **Cumulative** |')
        w('|:--:|-----|:----:|:----:|:---:|:----------:|:----------:|:------------:|:----------:|:------------:|:--------:|:----------:|:------------:|:--------------:|')
      } else if (hasPartners) {
        w('| Mo | Ver | Solo | Team | Ent | Direct Rev | Partner Fees | **Total Rev** | Expenses | **Net Cash** | **Cumulative** |')
        w('|:--:|-----|:----:|:----:|:---:|:----------:|:----------:|:------------:|:--------:|:------------:|:--------------:|')
      } else {
        w('| Mo | Ver | Solo | Team | Ent | Direct Rev | **Total Rev** | Expenses | **Net Cash** | **Cumulative** |')
        w('|:--:|-----|:----:|:----:|:---:|:----------:|:------------:|:--------:|:------------:|:--------------:|')
      }

      // Collect footnotes for this half
      const halfFootnotes: { month: number; notes: string[] }[] = []

      for (const r of halfRows) {
        if (r.footnotes.length > 0) {
          halfFootnotes.push({ month: r.month, notes: r.footnotes })
        }

        if (hasPartners && hasSuccess) {
          const successSvc = r.successRevenue + r.profServicesRevenue
          w(`| ${r.month} | ${r.version} | ${r.cumWeaver} | ${r.cumWeaverTeam} | ${r.cumFabrick} | ${$(r.directRevenue)} | ${$(r.partnerFees)} | ${$(r.partnerSourcedRevenue)} | ${$(successSvc)} | ${$bold(r.totalRevenue)} | ${$(r.totalExpenses)} | ${$(r.commissionOut)} | ${$(r.netCash)} | ${$(r.cumulativeCash)} |`)
        } else if (hasPartners) {
          w(`| ${r.month} | ${r.version} | ${r.cumWeaver} | ${r.cumWeaverTeam} | ${r.cumFabrick} | ${$(r.directRevenue)} | ${$(r.partnerFees)} | ${$bold(r.totalRevenue)} | ${$(r.totalExpenses)} | ${$(r.netCash)} | ${$(r.cumulativeCash)} |`)
        } else {
          w(`| ${r.month} | ${r.version} | ${r.cumWeaver} | ${r.cumWeaverTeam} | ${r.cumFabrick} | ${$(r.directRevenue)} | ${$bold(r.totalRevenue)} | ${$(r.totalExpenses)} | ${$(r.netCash)} | ${$(r.cumulativeCash)} |`)
        }
      }

      w('')

      // Footnotes
      if (halfFootnotes.length > 0) {
        for (const fn of halfFootnotes) {
          for (const note of fn.notes) {
            w(`**Month ${fn.month}:** ${note}`)
            w('')
          }
        }
      }
    }

    // Year-End Summary
    const m10 = rows[9] // EOY 2026 (Month 10 is Dec 2026 if started Mar)
    const m12 = rows[11]
    const m24 = rows[23]

    w(`### ${s.label} Summary`)
    w('')
    w('| Metric | EOY 2026 (Mo 10) | Month 12 | Month 24 |')
    w('|--------|:----------------:|:--------:|:--------:|')
    w(`| Cumulative Weaver Solo | ${m10.cumWeaver} | ${m12.cumWeaver} | ${m24.cumWeaver} |`)
    w(`| Cumulative Weaver Team | ${m10.cumWeaverTeam} | ${m12.cumWeaverTeam} | ${m24.cumWeaverTeam} |`)
    w(`| Cumulative Fabrick | ${m10.cumFabrick} | ${m12.cumFabrick} | ${m24.cumFabrick} |`)
    w(`| Direct MRR | ${$(m10.directRevenue)} | ${$(m12.directRevenue)} | ${$(m24.directRevenue)} |`)
    if (hasPartners) {
      w(`| Partner-sourced MRR | ${$(m10.partnerSourcedRevenue)} | ${$(m12.partnerSourcedRevenue)} | ${$(m24.partnerSourcedRevenue)} |`)
    }
    w(`| **Total MRR** | **${$(m10.totalMRR)}** | **${$(m12.totalMRR)}** | **${$(m24.totalMRR)}** |`)
    w(`| **ARR run rate** | **${$(m10.totalMRR * 12)}** | **${$(m12.totalMRR * 12)}** | **${$(m24.totalMRR * 12)}** |`)
    w(`| Headcount | ${m10.headcount} | ${m12.headcount} | ${m24.headcount} |`)
    w(`| **Cumulative net cash** | **${$(m10.cumulativeCash)}** | **${$(m12.cumulativeCash)}** | **${$(m24.cumulativeCash)}** |`)
    w('')
    w('---')
    w('')
  }

  // -------------------------------------------------------------------------
  // Section 7: Cumulative Summary
  // -------------------------------------------------------------------------
  w('## 7. Cumulative Summary (All Scenarios) {#7-cumulative-summary}')
  w('')

  // Revenue milestones
  w('### Revenue Milestones')
  w('')
  w('| Milestone | Best Case | Base Case | Worst Case |')
  w('|-----------|:---------:|:---------:|:----------:|')
  for (const [label, threshold] of [
    ['First $1K MRR', 1000],
    ['First $5K MRR', 5000],
    ['First $10K MRR', 10000],
    ['First $25K MRR', 25000],
    ['$100K ARR', 100000 / 12],
  ] as [string, number][]) {
    const cells: string[] = []
    for (const key of ['best', 'base', 'worst']) {
      const isARR = label.includes('ARR')
      const m = findMilestoneMonth(scenarios[key], (r) =>
        isARR ? r.totalMRR * 12 >= threshold * 12 : r.totalMRR >= threshold,
      )
      cells.push(
        m
          ? `Month ${m} (${monthLabel(inputs.meta.startDate, m)})`
          : 'Month 24+',
      )
    }
    w(`| ${label} | ${cells.join(' | ')} |`)
  }
  w('')

  // Cash position at key dates
  w('### Cash Position at Key Dates')
  w('')
  w('| Date | Best Case | Base Case | Worst Case |')
  w('|------|:---------:|:---------:|:----------:|')
  for (const m of [4, 7, 10, 13, 16, 19, 22, 24]) {
    const label = monthLabel(inputs.meta.startDate, m)
    const cells = ['best', 'base', 'worst'].map((k) =>
      $(scenarios[k][m - 1].cumulativeCash),
    )
    w(`| ${label} (Mo ${m}) | ${cells.join(' | ')} |`)
  }
  w('')

  // Breakeven
  w('### Breakeven Point')
  w('')
  w('| Scenario | Monthly Breakeven | Cumulative Breakeven |')
  w('|----------|:-----------------:|:--------------------:|')
  for (const key of ['best', 'base', 'worst']) {
    const monthlyBE = findMilestoneMonth(scenarios[key], (r) => r.netCash > 0)
    const cumBE = findMilestoneMonth(
      scenarios[key],
      (r) => r.cumulativeCash > 0,
    )
    const label =
      key === 'best' ? '**Best**' : key === 'base' ? '**Base**' : '**Worst**'
    const mLabel = monthlyBE
      ? `Month ${monthlyBE} (${monthLabel(inputs.meta.startDate, monthlyBE)})`
      : 'Month 24+'
    const cLabel = cumBE
      ? `Month ${cumBE} (${monthLabel(inputs.meta.startDate, cumBE)})`
      : 'Month 24+'
    w(`| ${label} | ${mLabel} | ${cLabel} |`)
  }
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 8: Milestones
  // -------------------------------------------------------------------------
  w('## 8. Key Milestones & Inflection Points {#8-milestones}')
  w('')
  w('### Revenue Inflection Points')
  w('')
  w('| Event | Best | Base | Impact |')
  w('|-------|:----:|:----:|--------|')

  const milestones = [
    {
      event: 'First Weaver Solo sale',
      test: (r: MonthRow) => r.cumWeaver > 0,
      impact: 'Validates pricing; product-market fit signal',
    },
    {
      event: 'First Weaver Team sale',
      test: (r: MonthRow) => r.cumWeaverTeam > 0,
      impact: 'Validates Team tier; peer federation adoption signal (ships v2.2)',
    },
    {
      event: 'First partner signed',
      test: (r: MonthRow) => r.activePartners > 0,
      impact: '$30K upfront + pipeline',
    },
    {
      event: 'First Fabrick close',
      test: (r: MonthRow) => r.cumFabrick > 0,
      impact: 'Validates Fabrick pricing; success program upsell',
    },
    {
      event: '$5K MRR',
      test: (r: MonthRow) => r.totalMRR >= 5000,
      impact: 'Hiring trigger — first contractor',
    },
    {
      event: '$10K MRR',
      test: (r: MonthRow) => r.totalMRR >= 10000,
      impact: 'Second hire trigger — sustainable growth',
    },
  ]

  for (const ms of milestones) {
    const best = findMilestoneMonth(scenarios.best, ms.test)
    const base = findMilestoneMonth(scenarios.base, ms.test)
    const fmtBest = best ? `Mo ${best}` : '—'
    const fmtBase = base ? `Mo ${base}` : '—'
    w(`| ${ms.event} | ${fmtBest} | ${fmtBase} | ${ms.impact} |`)
  }
  w('')

  // Expense inflection points
  w('### Expense Inflection Points')
  w('')
  w('| Event | When (Best) | Monthly Change |')
  w('|-------|:-----------:|:--------------:|')
  w(`| One-time costs (formation, legal) | Month 1 | +${$(otcTotal)} one-time |`)
  if (inputs.scenarios.best.firstHireMonth) {
    w(`| First hire | Month ${inputs.scenarios.best.firstHireMonth} | +${$(inputs.hiring[0].monthlyCost)}/mo |`)
  }
  if (inputs.scenarios.best.secondHireMonth) {
    w(`| Second hire | Month ${inputs.scenarios.best.secondHireMonth} | +${$(inputs.hiring[1].monthlyCost - inputs.hiring[0].monthlyCost)}/mo additional |`)
  }
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 9: Sensitivity
  // -------------------------------------------------------------------------
  w('## 9. Sensitivity Analysis {#9-sensitivity}')
  w('')
  w('### What Moves the Needle Most')
  w('')
  w('| Variable | Impact on Month 24 Cash (Best Case) | Sensitivity |')
  w('|----------|:-----------------------------------:|:-----------:|')
  for (const sv of inputs.sensitivityVariables) {
    w(`| **${sv.variable}** | ${sv.impact} | **${sv.sensitivity}** |`)
  }
  w('')

  w('### Critical Dependencies')
  w('')
  w('| Dependency | Risk | Mitigation |')
  w('|-----------|:----:|-----------|')
  w('| Partner recruitment | High | Begin partner conversations pre-v1.0; Design Partner program creates urgency |')
  w('| v1.2 "The Closer" on time | Medium | Forge agents pre-defined; agent definitions reviewed and ready |')
  w('| NixOS community reception | Medium | Demo site, README, and blog content ready before launch |')
  w('| Fabrick buyer cycle | High | 3–6 month sales cycles mean deals closed in Month 8+ were initiated at launch |')
  w('| Founder availability | Medium–High | Forge automation reduces manual dev work; contractor hire provides buffer |')
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 10: Forge Impact
  // -------------------------------------------------------------------------
  const fi = inputs.forgeImpact
  w('## 10. Forge Productivity Impact {#10-forge-impact}')
  w('')
  w(`Forge (autonomous agent pipeline) is a productivity multiplier. Estimated **${$(fi.annualLaborSavings)}/yr** in avoided labor costs and a **${fi.hiringDelayMonths}-month hiring delay** saving ${$(fi.hiringDelayMonths * fi.hiringMonthlyCost)}.`)
  w('')
  w('### Development Velocity')
  w('')
  w(`- **Routine task multiplier:** ${fi.velocityMultiplier}`)
  w(`- **Release cadence improvement:** ${fi.releaseCadenceImprovement}`)
  w(`- **Annual labor savings:** ${$(fi.annualLaborSavings)} (E2E test maintenance, compliance auditors, docs, screenshots)`)
  w('')
  w('### How Forge Changes the Hiring Equation')
  w('')
  w(`Without Forge, the first hire is needed earlier. With Forge handling routine tasks, the first hire can be **delayed by ~${fi.hiringDelayMonths} months**, saving ${$(fi.hiringDelayMonths * fi.hiringMonthlyCost)}. The hire can also be **more specialized** (feature development only, not maintenance).`)
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Section 11: Capital Requirements
  // -------------------------------------------------------------------------
  w('## 11. Capital Requirements {#11-capital-requirements}')
  w('')
  w('### Self-Funded Runway')
  w('')
  w('| Scenario | Max Cash Deficit | When | Self-Fund Feasible? |')
  w('|----------|:---------------:|:----:|:-------------------:|')
  for (const key of ['best', 'base', 'worst']) {
    const rows = scenarios[key]
    let minCash = 0
    let minMonth = 1
    for (const r of rows) {
      if (r.cumulativeCash < minCash) {
        minCash = r.cumulativeCash
        minMonth = r.month
      }
    }
    const label =
      key === 'best' ? '**Best**' : key === 'base' ? '**Base**' : '**Worst**'
    const feasible =
      Math.abs(minCash) < 20000
        ? 'Yes'
        : Math.abs(minCash) < 40000
          ? 'Yes — need ~$' + Math.ceil(Math.abs(minCash) / 5000) * 5 + 'K accessible'
          : 'Tight — need ~$' + Math.ceil(Math.abs(minCash) / 5000) * 5 + 'K accessible'
    w(`| ${label} | ${$(minCash)} | Month ${minMonth} | ${feasible} |`)
  }
  w('')

  // Revenue mix at month 24
  w('### Revenue Mix at Month 24')
  w('')
  w('| Stream | Best Case | Base Case | Worst Case |')
  w('|--------|:---------:|:---------:|:----------:|')
  const mixRows = [
    {
      label: 'Direct Weaver',
      fn: (r: MonthRow) => r.weaverMRR,
    },
    {
      label: 'Direct Fabrick',
      fn: (r: MonthRow) => r.fabrickMRR,
    },
    {
      label: 'Partner fees (amortized)',
      fn: (r: MonthRow) => r.partnerFees,
    },
    {
      label: 'Partner-sourced Fabrick',
      fn: (r: MonthRow) => r.partnerSourcedRevenue,
    },
    {
      label: 'Success + Services',
      fn: (r: MonthRow) => r.successRevenue + r.profServicesRevenue,
    },
  ]
  for (const mr of mixRows) {
    const cells = ['best', 'base', 'worst'].map((k) => {
      const r = scenarios[k][23]
      const total = r.totalRevenue
      if (total === 0) return '—'
      const pct = Math.round((mr.fn(r) / total) * 100)
      return `${pct}%`
    })
    w(`| ${mr.label} | ${cells.join(' | ')} |`)
  }
  w('')

  // Key insight
  const bestM24 = scenarios.best[23]
  const partnerPct = Math.round(
    ((bestM24.partnerFees + bestM24.partnerSourcedRevenue) /
      bestM24.totalRevenue) *
      100,
  )
  w(`**Key insight:** In the Best Case, the **partner channel** (fees + sourced clients) represents **${partnerPct}%** of Month 24 total revenue. Partner recruitment is the single highest-leverage activity after shipping v1.0.`)
  w('')
  w('---')
  w('')

  // -------------------------------------------------------------------------
  // Appendix
  // -------------------------------------------------------------------------
  w('## Appendix: Assumptions & Formulas')
  w('')
  w('### Revenue Calculations')
  w('')
  w(`- **Weaver Solo MRR** = cumulative Solo customers × $${inputs.pricing.weaverSolo.annual}/12`)
  w(`- **Weaver Team MRR** = cumulative Team customers × $${inputs.pricing.weaverTeam.avgAnnual}/12 (avg ${inputs.pricing.weaverTeam.avgUsers} users at $${inputs.pricing.weaverTeamEA.annual}/user/yr)`)
  w(`- **Fabrick MRR** = cumulative Fabrick customers × ${$(inputs.blendedFabrickAnnual)}/12 (blended average)`)
  w(`- **Partner-sourced MRR** = cumulative partner-sourced clients × ${$(inputs.blendedFabrickAnnual)}/12`)
  w(`- **Commission outflow** = partner-sourced Enterprise revenue × ${(inputs.partnerChannel.foundingMemberCommission * 100).toFixed(0)}%`)
  w('- **Churn** not modeled (annual billing, <5% assumed for 24-month projection)')
  w('')
  w('### Growth Trajectories (Cumulative Customers)')
  w('')
  w('| Month | Best Prem | Best Ent | Base Prem | Base Ent | Worst Prem | Worst Ent |')
  w('|:-----:|:---------:|:--------:|:---------:|:--------:|:----------:|:---------:|')
  for (let m = 0; m < inputs.meta.months; m++) {
    w(`| ${m + 1} | ${inputs.scenarios.best.cumulativeWeaver[m]} | ${inputs.scenarios.best.cumulativeFabrick[m]} | ${inputs.scenarios.base.cumulativeWeaver[m]} | ${inputs.scenarios.base.cumulativeFabrick[m]} | ${inputs.scenarios.worst.cumulativeWeaver[m]} | ${inputs.scenarios.worst.cumulativeFabrick[m]} |`)
  }
  w('')
  w('### Expense Phase Transitions')
  w('')
  w(`- **Pre-revenue** → **Early revenue**: when total MRR ≥ ${$(inputs.expenses.phaseTransitions.earlyRevenueAtMRR)}`)
  w(`- **Early revenue** → **At scale**: when total MRR ≥ ${$(inputs.expenses.phaseTransitions.atScaleAtMRR)}`)
  w('')
  w('---')
  w('')
  w('*Cross-reference: [BUDGET-AND-ENTITY-PLAN.md](BUDGET-AND-ENTITY-PLAN.md) | [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | [RELEASE-ROADMAP.md](RELEASE-ROADMAP.md) | [PARTNER-TIER-REVENUE-PROPOSAL.md](PARTNER-TIER-REVENUE-PROPOSAL.md) | [TALENT-STRATEGY.md](TALENT-STRATEGY.md) | [PITCH-DECK.md](PITCH-DECK.md)*')
  w('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

const inputsRaw = readFileSync(INPUTS_PATH, 'utf-8')
const inputs: Inputs = JSON.parse(inputsRaw)

console.log(`${BOLD}Generating cashflow projection...${RESET}`)
console.log(`  Input:  ${INPUTS_PATH}`)
console.log(`  Output: ${OUTPUT_PATH}`)

const markdown = generateMarkdown(inputs)
writeFileSync(OUTPUT_PATH, markdown, 'utf-8')

const lineCount = markdown.split('\n').length
console.log(`${GREEN}${BOLD}Done${RESET} — ${lineCount} lines written to business/CASHFLOW-PROJECTION.md`)
