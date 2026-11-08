# Engineering evidence and decisions

Every accepted finding needs:

1. Exact source location (verified current path and line), scope and owner/pass.
2. Concrete trigger, preconditions and expected versus actual behavior.
3. An end-to-end trace or reproduction, including relevant callers and safeguards
   checked. Cite constraints, authorization, retry wrappers or tests that could
   disprove it, and why they do not. Do not dump secrets or sensitive records.
4. Practical impact and affected users, workloads or operations.
5. Class, priority and confidence; distinguish what was observed from assumptions.
6. Smallest coherent fix and a meaningful way to validate it.

Classify as **Defect** (demonstrated by execution or complete static trace),
**Risk** (concrete failure scenario with a named unverified precondition and how
to confirm it), or **Improvement** (measurable or concrete engineering benefit,
without a demonstrated defect). Preferences are optional, nonblocking notes.
Unknown intent belongs in open questions rather than an invented requirement.

| Priority | Meaning |
|---|---|
| P0 | Immediate severe incident: active breach, widespread irreversible data loss, or equivalent. Urgent mitigation. |
| P1 | Serious supported failure in a relevant critical path: authorization bypass, corrupt totals, lost jobs, outage, or unbounded material spend. Fix before release. |
| P2 | Material but bounded defect or supported engineering risk. Fix in a planned change. |
| P3 | Minor behavior problem or optional improvement with clear benefit. |

Priority reflects impact and realistic exposure, not how alarming a hypothetical
sounds. State confidence separately: **high** (reproduced or complete traced path),
**medium** (one named unverified condition), **low** (several material unknowns).
An assertion does not become high confidence through repetition or agent agreement.

Architecture and performance findings require a concrete consequence: demonstrated
drift between duplicated rules, a broken dependency boundary that causes unsafe
changes, N+1 calls on a real request path, unbounded materialization, or an actual
resource/cost bound. Give workload assumptions; do not invent benchmark results.
Missing tests alone are not proof of a behavior bug. Explain the important failure
mode the missing test leaves undetected. Do not require tests that mirror code.

## Verdict

- **BLOCK**: accepted P0/P1 Defect. Cite finding IDs.
- **FIX FIRST**: accepted P0/P1 Risk, or P2 Defect on a documented or observed
  critical path. Identify what evidence or change resolves it.
- **NO BLOCKERS FOUND**: neither condition applies within the assessed scope.
  This is a scoped code-review result, not a certification of production readiness.
- **INCOMPLETE**: material scope or source could not be inspected sufficiently to
  decide. Report confirmed blockers first if present; otherwise use this verdict.

Launch readiness is a separate gate. An incomplete gate can coexist with a diff
having no blockers found. Never average away a serious defect with good scores.
