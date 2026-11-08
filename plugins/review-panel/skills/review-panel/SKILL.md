---
name: review-panel
description: Run a multi-judge code review (skeptic, advocate, correctness, security, maintainer, refereed) on a change or a whole codebase, using the shared rubric and the repo's REVIEW_PANEL.md. Also sets up a new repo (init), fixes accepted findings and re-reviews (fix), runs unattended in CI (ci), and reconciles the findings ledger (ledger). Use for "review this PR", "audit this project", "run the panel", "judge this", or "set up the review panel".
argument-hint: "[review|deep|audit|gate|init|fix|round N|ci pr <n>|ci nightly|ledger|calibrate]"
---

# Review Panel

A panel of judges with different philosophies reviews the same code against one shared
standard. Judges disagree on **priorities**, never on **evidence rules**.

The workflow follows David Bell's loop from *"I Can't Code. Here's How I Built Our Entire
Client Intelligence System Anyway"* (Tech SEO Connect, Nov 2026):

> **Specify → Role → Prompt → Critique → Ship**
>
> The human owns the vision. AI drafts. A harsh, framework-driven judge scores each round.
> Iterate until it's good enough (a 9, not a 10). Engineers make it safe before production.

Mapped onto code review:

| Talk step | In this package |
|---|---|
| **Specify** — the vision; don't turn the car into a boat halfway | §1 Spec brief. Every judge reviews against the stated intent, and flags drift from it. |
| **Role** — who's on the team | `judges/*.md`, one role each |
| **Prompt** — role, job, frameworks, process (d.school structure) | Each judge file has exactly those four sections. Frameworks teach the judge *how* to think. |
| **Critique** — the Cold War Olympic judge, scored rounds | §2–§4 independent review, cross-examination, referee; §6 the round loop |
| **Ship** — engineers make it safe | §7 Production gate: data exposure, attack surface, runaway API spend |

## Files

All panel files sit next to this SKILL.md, in this skill's directory. Read them from there.

| File | Purpose |
|---|---|
| `rubric.md` | Evidence rules, severity, confidence, scoring. Every judge obeys it. |
| `judges/*.md` | skeptic, advocate, correctness, security, maintainer, referee |
| `report-template.md` | Exact output format, including the scoreboard |
| `production-gate.md` | The ship checklist for anything going in front of clients or the public |
| `calibration.md` | Ledger format and tuning loop |

Each app repo holds only its own `REVIEW_PANEL.md` (root) and a `.review-panel/` folder
(`reports/`, `ledger.md`). The panel itself is never copied into app repos.

## Commands

The argument picks what to do. No argument means `review`.

| Command | What it does | Section |
|---|---|---|
| `review` | Standard review of the current branch vs the default branch (Deep if the config requires it) | §0–§8 |
| `deep` | Same, forced Deep mode | §0–§8 |
| `audit` | Whole-codebase audit sliced by critical paths, Deep mode | §0–§8 |
| `gate` | Production gate only | §7 |
| `round N` | Re-review after fixes, showing round history | §6 |
| `fix` | Fix accepted findings from the latest report, then re-review | §9 |
| `init` | Draft this repo's `REVIEW_PANEL.md` and `.review-panel/` from the code | §10 |
| `ci pr <n>` | Unattended pull request review for GitHub Actions | §11 |
| `ci nightly` | Unattended review of commits pushed to the default branch in the last 24 h | §11 |
| `ci review` · `ci deep` · `ci audit` · `ci gate` | Unattended branch review, forced Deep, whole-codebase audit or production gate (on-demand runs from the MCP server) | §11 |
| `ledger` | Reconcile ledger statuses against merged code | §12 |
| `calibrate` | Read ledgers and propose judge tuning | §13 |

## 0. Pick scope and mode

**Scope**

- **Diff** (default): a branch, PR, commit range, or uncommitted changes. Review the change
  plus whatever surrounding code you need to judge it. Pre-existing problems are out of
  scope unless the change depends on or worsens them.
- **Audit**: the whole codebase, for a project that's never been reviewed. Don't try to read
  everything. Slice by the config's `critical_paths`, review each slice as if it were a
  change, and report coverage honestly.

**Mode**

| Mode | Use when | Judges |
|---|---|---|
| Quick | Small routine diffs (copy, styling, isolated UI) | correctness, maintainer |
| Standard | Most diffs | skeptic, advocate, correctness, maintainer |
| Deep | Anything matching `require_security_for`, every audit, anything touching data model / auth / money / external inputs / AI API calls | all five + cross-examination + production gate |

If the config requires security review for what changed, Deep is the floor. Say so.

## 1. Specify — build the spec brief

Every judge gets the same brief. This is the "vision" from the talk: judges review against
it, not against their own idea of the app.

1. Read `REVIEW_PANEL.md` at the repo root. If missing, say so, infer from `README`,
   `AGENTS.md`, `CLAUDE.md`, `package.json`, and use Standard mode.
2. Read repo instructions (`AGENTS.md`, `CLAUDE.md`, contributing docs).
3. Get the change: `git diff <base>...HEAD`, or the files in the audit slice.
4. For each changed area, read callers, callees, types/schemas, and any database
   migrations, RLS policies, or edge functions it touches.
5. Write the **intent** in 2–5 sentences: what this change is supposed to do and for whom.
   Sources: PR description, commits, issue, or the user.
   **If you can't tell, ask the user before reviewing.** Don't read their mind. If the user
   isn't available, write "Intent unclear", list your assumptions, and carry them into the
   report.
6. Run the config's `validation` commands if possible. Record exact pass/fail. If not run,
   say why.

The brief = app summary, critical paths, constraints, intent, file list, validation
results, relevant code excerpts with paths and line numbers.

## 2. Critique — independent review

Each judge in the mode reviews **independently**: same brief, its own judge file, plus
`rubric.md`. No judge sees another's output in this phase — the first confident reviewer
otherwise steers the whole panel.

- **With subagents** (e.g. Claude Code's Agent tool): one subagent per judge, in parallel.
  The prompt contains the brief, the full judge file, and the full rubric. Ask for output in
  the rubric's finding format plus the judge's score, nothing else.
- **Without subagents:** run judges as separate sequential passes and disclose
  "Judges ran sequentially in one context; independence is reduced."
- **Optional model diversity:** the talk used different models for different roles. If you
  have access to more than one model, running the skeptic or security judge on a different
  model than the author's is a cheap way to break shared blind spots. Record which model ran
  which judge.

Each judge returns: findings (zero is fine), open questions, a 1–10 score with a one-line
reason, and per-dimension scores for what it assessed.

## 3. Cross-examination (Deep mode, or any disputed finding)

A finding is **disputed** if it's High/Critical, or Medium with Low confidence, or another
judge directly contradicts it. Give each disputed finding to a *different* judge (advocate
for skeptic/security findings; skeptic for advocate dismissals):

> Look for counterevidence: a guard, test, type, RLS policy, DB constraint, or caller
> guarantee that prevents this. Can you construct the failure concretely?
> Answer UPHELD / WEAKENED / REFUTED with evidence.

Don't cross-examine clear findings. It doubles cost for little gain.

## 4. Referee

Run `judges/referee.md` over all findings and cross-examination results. It merges
duplicates, throws out anything failing the evidence rules, sets final severity and
confidence, and makes the call.

## 5. Report

Use `report-template.md` exactly: verdict → scoreboard → blocking findings → other
findings → open questions → disagreements → accepted tradeoffs → coverage gaps →
dismissed. Coverage gaps are mandatory. Save to `.review-panel/reports/<date>-<scope>.md`.

## 6. Rounds — iterate to "good enough"

This is the talk's 4.5 → 6 → 9 loop. When the user asks to fix and re-review:

1. Fix only the accepted findings (fixing is a separate step the user asks for).
2. Re-run the same mode on the new diff. Judges see the previous report this time — the
   point is to check whether findings were resolved and whether fixes introduced new ones.
3. Show the scoreboard history: `Round 1: 4.5 → Round 2: 6.0 → Round 3: 9.0`.

**Stop rule — "a 9 is good enough":** stop when there are no open Critical/High findings
**and** the panel score is ≥ the config's `good_enough` (default 8.5). Do not chase a 10.
A harsh judge told to keep going will start manufacturing objections — the talk's "judges
wanting to kill each other." If a round produces only new Low/Preference findings, that's
the signal to stop.

Cap at `max_rounds` (default 3). If not at good-enough by then, stop and report what's
blocking; the problem is usually the spec, not the code.

## 7. Ship — production gate

Before anything goes in front of clients or the public, run `production-gate.md`. The talk's
point: vibe-coded tools are the car you wouldn't put on the highway; engineers rebuilt
David's code so nobody had to worry about **losing sensitive data, getting hacked, or
spending thousands on API keys**. The gate checks exactly those, plus reliability basics.
Its output is a hand-off list for whoever plays the engineer role — which may be you, with a
different hat on.

## 8. Log for calibration

Append one row per final finding to the repo's `.review-panel/ledger.md` (create if
missing), status `open`. See `calibration.md`.

---

## Hard rules

- No finding without a file path and line reference, and a concrete failure scenario.
- Zero findings is a valid, good result. Never pad.
- Judges ask instead of guessing: unknowns go under **Open questions**, not into findings
  dressed up as defects.
- The panel score is a progress meter. It never overrides findings: one supported
  Critical blocks at any score; unsupported objections block nothing at any score.
- Don't edit code during a review round.


---

## 9. `fix` — fix accepted findings, then re-review

1. Read the newest report in `.review-panel/reports/`. If the user hasn't said which findings
   are accepted, treat blocking findings plus Medium findings on critical paths as accepted,
   and say so at the top.
2. Fix them one at a time, smallest change first, each as its own commit with the ledger ID
   in the message (e.g. `Fix RP-0006: only approve pending claims`). Add or update a test
   where the repo has tests for that area.
3. Run the config's `validation` commands. Don't continue past a failure you caused.
4. Run `round N+1` (§6) on the combined diff, then update the ledger rows to `accepted` with
   the commit hash.
5. Stop at the good-enough rule. Report what's fixed, what's left, and the score history.

## 10. `init` — set up a new repo

Goal: a usable `REVIEW_PANEL.md` in five minutes, drafted from the code, not from guesses.

1. Read `README*`, `AGENTS.md`, `CLAUDE.md`, `package.json` (and the bot or server package
   files), `.github/workflows/*`, the top-level layout, `supabase/` or other backend folders,
   and any `docs/`.
2. Fill this skill's `templates/REVIEW_PANEL.template.md` (the structure is: purpose,
   users, stage, architecture, critical_paths, sensitive_data, paid_apis, constraints,
   validation, review, notes). Rules:
   - `validation` = exactly the commands CI runs. If there's no CI, the build/lint/test
     scripts in package files.
   - `critical_paths` = auth/identity, permission checks, anything taking money, paid API
     calls, data writes users depend on, external inputs, concurrency hot spots. Name real
     files and functions.
   - `paid_apis` = every SDK or env var for a paid provider you can find.
   - `out_of_scope` = generated or vendored files.
   - Mark anything you couldn't determine with `TODO:`.
3. Create `.review-panel/ledger.md` (header from `calibration.md`) and `.review-panel/reports/`,
   and add `.review-panel/out/` to `.gitignore`.
4. Add the two workflow files from this skill's `templates/workflows/` to
   `.github/workflows/`, unchanged unless the default branch isn't `main`.
5. Show the user the drafted config and the TODO list. Commit on a branch named
   `review-panel-setup`; don't push to the default branch.

## 11. `ci` — unattended mode for GitHub Actions

No human is present. Never ask questions; take the most reasonable reading and say which you
took in the report. Never edit source files, commit, or push in this mode.

**`ci pr <n>`**
1. Scope = `git diff origin/<base>...HEAD` for the pull request. `<base>` is in the
   `PANEL_BASE` environment variable when set, otherwise the default branch.
2. Intent = the PR title and body (in `PANEL_PR_TITLE` / `PANEL_PR_BODY` when set) plus
   commit messages. Add `PANEL_FOCUS` when set.
3. If `PANEL_COMMAND` is `deep`, `audit` or `gate`, use Deep (and for `gate` also run §7).
   Otherwise pick the mode from the changed files:
   - only docs, images, generated or out-of-scope files → write verdict `SKIP` and stop;
   - any file matching `require_security_for` → Deep;
   - ≤ 50 changed lines outside critical paths → Quick;
   - otherwise Standard.
4. Run §1–§5. Use subagents for judges when available. Skip validation commands that need
   secrets or services; note them as coverage gaps.

**`ci nightly`**
1. Scope = commits on the default branch from the last 24 hours that did **not** arrive
   through a merged pull request (those were already reviewed). Use
   `git log --since="24 hours ago" --first-parent` and check each merge's message for a PR
   number. If none remain, write verdict `SKIP` and stop.
2. Review them together as one diff in Standard mode (Deep if the config requires it).
3. Collect findings from pull requests merged in the last 24 hours: with `gh`, list merged
   PRs, read each one's comment that starts with `<!-- review-panel -->`, and take the rows
   from its "Ledger rows" section.
4. Run §12 `ledger` with those rows plus this run's rows.

**`ci review` · `ci deep` · `ci audit` · `ci gate`** (on demand, any repo)
1. The checked-out commit is what to review. `PANEL_BASE` is the default branch.
2. `ci review` / `ci deep`: scope = `git diff origin/<base>...HEAD`. If that diff is empty
   (the default branch itself was asked for), review the last 20 commits on it instead and
   say so. `ci deep` forces Deep.
3. `ci audit`: §0 Audit scope, Deep mode, sliced by `critical_paths`.
4. `ci gate`: §7 only, on the whole codebase.
5. Intent = `PANEL_FOCUS` when set, otherwise the repo's README and recent commit messages.
   If the repo has no `REVIEW_PANEL.md`, infer one as §1 says and note it in the report;
   don't write the file.
6. Don't write the ledger in these modes; put new rows only in `ledger-rows.md`.

**Output contract (all `ci` commands).** Write exactly these files; the workflow reads them:
- `.review-panel/out/report.md` — the full report from `report-template.md`.
- `.review-panel/out/verdict.txt` — one word: `SHIP`, `FIX_FIRST`, `BLOCK` or `SKIP`.
- `.review-panel/out/summary.md` — at most 15 lines: verdict, panel score, and one line per
  blocking finding. Used as the PR comment headline and issue title source.
- `.review-panel/out/ledger-rows.md` — new ledger rows for this run's surviving findings
  (status `open`, ID column `RP-NEW`; §12 assigns real IDs), or empty. In `ci pr` the
  workflow appends these to the PR comment under a "Ledger rows" heading.

## 12. `ledger` — reconcile statuses

For each `open` row in `.review-panel/ledger.md`: look at the current code at the finding's
location. If the problem no longer exists, set `accepted` and note the commit that removed
it (`git log -L` or `git log -S`). If the code was deleted, set `accepted` with "code
removed". Leave everything else alone. Append any rows from `.review-panel/out/ledger-rows.md`
with the next free IDs. Write only the ledger file.

## 13. `calibrate` — tune the judges

Read every ledger you're given (one per app). Per judge, count accepted, false-alarm,
dismissed, escaped and seed-missed. Propose at most three small edits to judge files or the
rubric, each tied to specific ledger rows, following `calibration.md`. Present them as a
diff for approval; don't apply them unasked.
