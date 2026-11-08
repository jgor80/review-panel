# Codex Engineering Review

A standalone Codex skill for production engineering reviews across repositories.
It uses engineering specialist roles rather than advocate/skeptic personalities.
It does not depend on Claude Code, Anthropic credentials, or the Claude plugin.
The existing Claude implementation remains separately installable.

## Install once for every repository on a machine

From the root of this source checkout:

```bash
python3 codex/install.py --user
```

This installs `engineering-review` under `~/.agents/skills/`. Start a new Codex
chat so the skill is discovered, open any repository you have access to, and ask:

```text
$engineering-review review my branch against origin/main
$engineering-review audit the billing and webhook paths
$engineering-review gate
$engineering-review init
$engineering-review fix the accepted P1 findings
```

For a repository-scoped install instead:

```bash
python3 codex/install.py --repo /absolute/path/to/repository
```

This adds only `.agents/skills/engineering-review/`. Commit it if you want to share
it with collaborators; otherwise keep it local. Each environment or machine needs
its own install. The installer does not change Codex settings, grant repository
access, enable CI, add billing credentials, or modify other skills. Identical
installs are a no-op; changed installs require explicit `--replace`, which replaces
this skill directory including local edits. Updates are manual: update this source
checkout, inspect the changes, then rerun the installer with `--replace`.

## Run without installation

Requires Python 3.9+, Git, and an authenticated Codex CLI supporting `codex exec`.
Uses your existing Codex model/provider configuration and normal usage limits.

```bash
python3 codex/run.py --repo /absolute/path/to/repo --base origin/main
python3 codex/run.py --repo /absolute/path/to/repo --mode audit --output /tmp/engineering-review.md
python3 codex/run.py --repo /absolute/path/to/repo --mode gate --dry-run
```

The launcher supplies all review references in the prompt, resolves supplied Git
refs to commits without a shell, and runs Codex with the read-only sandbox.
It will not overwrite a report. A failed run can leave an empty or partial output;
the process exit code indicates failure. Read-only execution may prevent tests
that write caches/artifacts; the report must identify checks it could not execute.
Dry-run makes no model calls. This launcher does not implement a CI merge gate or
post PR comments; verdicts are report content, not special process exit codes.

## Engineering specialists

| Role | Focus |
|---|---|
| Correctness and data | Invariants, concurrency, transactions, aggregation and migration compatibility |
| Architecture and maintainability | Domain boundaries, explicit contracts, coupling, duplicated rules and proportional design |
| Performance and efficiency | Query/call counts, real workload bounds, allocations, concurrency and paid API cost |
| Security and privacy | Authorization, tenant isolation, trust boundaries, tokens, storage and AI tool permissions |
| Reliability and operations | Timeouts, retries, idempotency, recovery, diagnostics, resource limits and rollback |
| Testing and release | Useful regression coverage, real CI enforcement, reproducible builds and safe rollouts |
| Principal engineer / referee | Checks evidence, challenges findings, merges duplicates and issues the verdict |

Separate agents are used only if the host provides and permits them. Otherwise
Codex performs explicitly labeled sequential specialist passes. A skill cannot
enable agent tools or select independent models by itself.

## What makes a finding actionable

Every finding needs a source location, concrete failure scenario, impact,
safeguards checked, confidence, smallest coherent fix and validation. Defects,
risks and optional improvements remain distinct. Serious defects determine the
verdict; numerical averages and reviewer agreement do not. Unknown deployed
controls cannot pass the launch gate. No mandatory findings or stylistic rewrites.

Optional `ENGINEERING_REVIEW.md` records each repo's actual critical paths,
constraints and CI commands. `init` drafts it from evidence; unknowns remain TODO.
Reviewing does not authorize fixes, deployment, remote comments or infrastructure
changes. Request fixes explicitly when wanted.

## Verify this package

```bash
python3 -m unittest discover -s codex/tests -v
```

The tests exercise installation safety and launcher behavior using temporary Git
repositories and a fake Codex executable. They do not evaluate model accuracy.
For a manual review-quality check, introduce a bounded known defect on a temporary
branch (for example, removing resource authorization), review that branch, and
check that the panel traces the missing safeguard without inventing unrelated bugs.
