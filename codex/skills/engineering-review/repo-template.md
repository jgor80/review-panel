# ENGINEERING_REVIEW.md

Populate from actual code and CI. Replace placeholders with evidence or TODO.
Record secret names/locations only, never secret values. Keep this file concise.

- Stage: TODO (prototype/internal/client-facing/public)
- Runtime and deployment: TODO
- Data stores and isolation model: TODO
- External services and paid APIs: TODO
- Expected workload and resource/spend limits: TODO
- Sensitive data and trust boundaries: TODO
- Requirements and accepted constraints: TODO

## Critical paths

| Behavior/invariant | Real entry point and relevant files | Failure impact |
|---|---|---|
| TODO | TODO | TODO |

## Validation

Exact existing commands, working directory and CI workflow references. Distinguish
required CI commands from suggested checks and checks that need external services.

## Operations evidence

Locations of deployment, rollback, backup/restore and alert configuration. Mark
unknown deployed settings TODO; never infer them from example environment files.

## Review boundaries

Out-of-scope paths, accepted tradeoffs, known issues and their rationale. These
are context; do not silently suppress a newly demonstrated security or data defect.
