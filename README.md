# Review Panel

For a standalone **Codex version focused on production engineering**, see
[Codex Engineering Review](codex/README.md). Install its user-wide skill once to
invoke it across local repositories, or run its read-only CLI launcher directly.

**New: [Review Panel MCP server](mcp/README.md).** One MCP tool that reviews any of your
GitHub repos with Claude (workflows and functionality, as product manager), Gemini (UI/UX)
and Codex (code structure) in parallel, and returns one scored report.

A multi-judge code review for Claude Code. Five judges with different philosophies
(skeptic, home-team advocate, correctness, security, maintainer) review the same change
against one shared rubric; a referee rules on the evidence and issues the verdict.
Modeled on figure-skating judging and David Bell's Specify → Role → Prompt → Critique → Ship
loop (Tech SEO Connect 2026).

## How it runs

| Where | What happens |
|---|---|
| From any AI app (MCP) | Ask for a review of any repo, PR, branch or whole codebase; it runs in GitHub Actions and the AI reads back the report. See [mcp/](mcp/README.md) |
| On demand in Claude Code | `/review-panel:review-panel` plus a command (below) |
| A pull request, when asked | Actions → Review Panel → Run workflow with the PR number: posts one comment, labels the PR `panel: ship / fix-first / block`, fails the check on BLOCK. It doesn't run on every PR |
| Every night | Reviews commits pushed straight to the default branch, opens an issue only if something needs attention, opens a PR with ledger updates |

## Install in Claude Code (once per machine)

```bash
claude plugin marketplace add jgor80/review-panel
claude plugin install review-panel@jgor80-tools
```

## Add an app (about five minutes)

1. In the app's repo, run `/review-panel:review-panel init`. It drafts `REVIEW_PANEL.md` from
   the code, creates `.review-panel/`, adds the two workflows, and commits on a
   `review-panel-setup` branch. Fill the TODOs, open a PR, merge.
2. Make sure the repo can use the `ANTHROPIC_API_KEY` secret (set it once as an
   organization or account secret, or per repo) and that the
   [Claude GitHub App](https://github.com/apps/claude) is installed on it.
3. Optional: Settings → Actions → General → "Allow GitHub Actions to create and approve pull
   requests" so the nightly ledger PR can open.
4. Optional: Settings → Branches → require the "Review Panel" check, so BLOCK stops a merge.

## Commands

| Command | Does |
|---|---|
| *(none)* / `review` | Review the current branch |
| `deep` · `audit` · `gate` | Forced Deep · whole-codebase audit · production gate only |
| `fix` | Fix accepted findings, re-review, stop at good-enough |
| `round N` | Re-review after fixes with score history |
| `init` | Set up a new repo |
| `ledger` · `calibrate` | Reconcile the findings ledger · propose judge tuning |

## Layout

```
.claude-plugin/marketplace.json          marketplace "jgor80-tools"
mcp/                                     MCP server (Cloudflare Worker) for on-demand reviews from AI apps
plugins/review-panel/
  .claude-plugin/plugin.json
  skills/review-panel/
    SKILL.md                             procedure and commands
    rubric.md  judges/*.md  report-template.md  production-gate.md  calibration.md
    templates/                           REVIEW_PANEL template + the two workflows
templates/                               same templates, for browsing
examples/                                configs for each app, seed-test report
docs/ROLLOUT.md
mcp/                                     MCP server: Claude + Gemini + Codex judges for any repo
```

Each app repo holds only its `REVIEW_PANEL.md` and `.review-panel/` (reports and ledger).
Tune a judge here and every app picks it up on its next run.
