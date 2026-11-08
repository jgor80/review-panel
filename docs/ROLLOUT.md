# Rollout — reviewing every project

A step-by-step plan for taking the panel from "a folder of Markdown" to "every app has been
audited once and every change gets reviewed."

## Order

| # | Project | Repo | Stage | First run |
|---|---|---|---|---|
| 1 | **GafferBot** | jgor80/spotbot-3.0-22 | public | Audit, Deep + production gate |
| 2 | **Diamond Tracker (PennantBot)** | jgor80/baseball-league-tracker | public | Audit, Deep + production gate |
| — | SearchDawg | — | client-facing | **Parked.** Config drafted; revisit later |
| — | Synthwave Web Tools, Ballhawk Forecaster | — | public | Later, after the two bots |
| — | Stream Grid, Local Spark, SEO Score Analyzer, Access Control Pro, Editorial Hub, Synthwave Tools, Spotbot 2.0, Nana's Christmas Chat | — | prototypes / stale | Gate only, if relaunched |

Why the two bots first: they're public, share a production family, and share most of
their risk profile (Discord auth, per-server isolation, concurrent writes, paid generation).
Calibrating on one makes the other faster.

## Phase 1 — GafferBot

1. Add `REVIEW_PANEL.md` to the repo root from `config/examples/gafferbot.REVIEW_PANEL.md`.
   Fill the TODOs (AI providers, test command).
2. **Seed test:** run the panel on 3–5 past GafferBot commits where you know there was a
   bug. Record catches and false alarms in `.review-panel/ledger.md`. Tune judges once.
3. **Audit, Deep mode**, one slice per critical path. Start with: account linking,
   club isolation, Discord handlers, paid generation.
4. **Production gate.** Pay attention to bot token handling and per-club generation caps.
5. Triage: fix Criticals now, schedule Highs, then `round 2` on the fixes. Stop at
   good-enough.

## Phase 2 — Diamond Tracker

1. Add `REVIEW_PANEL.md` from `config/examples/diamond-tracker.REVIEW_PANEL.md`.
2. Carry over judge tuning from GafferBot. Skip the full seed test unless GafferBot's
   calibration was shaky; run one or two known-bug commits as a sanity check.
3. **Audit, Deep mode.** Start with: draft room and auction concurrency, standings
   correctness, commissioner permissions, MCP write tools.
4. **Production gate.**
5. Triage and round 2.
6. **Family check:** list problems found in one bot and check the other for the same
   pattern. Shared-origin code tends to share bugs.

## Steady state (both bots)

- Every PR or meaningful change: Standard (Deep when the config says so).
- Fix → `round 2` → stop at good-enough. Don't chase 10s.
- Monthly: tune judges from the ledger.

## What "done" looks like

- Both bots have a `REVIEW_PANEL.md`, one audit report, a production-gate result, and a
  ledger.
- Every Critical from the audits is fixed or explicitly accepted with a reason.
- A scoreboard history per app.
