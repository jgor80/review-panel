# Production readiness gate

For each applicable control record **PASS**, **FAIL**, **UNKNOWN** or **N/A**,
with source/command evidence and a reason. A source declaration does not prove
deployed enforcement. N/A needs evidence that the control does not apply.

| Area | Controls to verify |
|---|---|
| Access and privacy | Server-side authentication and resource/tenant authorization; private sensitive storage; bounded signed URLs; no privileged client secrets; safe logs and minimum data sharing. Use RLS, service authorization or equivalent appropriate to the stack. |
| Attack boundaries | Input validation, rendering and query safety; webhook/job authenticity; SSRF defenses where URLs are fetched; AI tool permission boundaries; relevant dependency exposure. |
| Data integrity | Constraints and transactions; idempotent writes and jobs; correct totals; compatible migrations; backup and restore verification for persistent production data. |
| Efficiency and cost | Bounded pagination, input, fanout, concurrency, retries and paid calls; relevant query plans or load evidence; quotas/hard limits distinguished from billing alerts. |
| Operations | Failure visibility, timeouts, recovery, health checks, ownership of alerts, rollout/rollback procedure and realistic resource limits. |
| Release | Required validation actually runs and fails correctly; least-privilege CI; safe handling of untrusted changes; deployment/runtime configuration evidence. |

Result: **NOT READY** for any applicable FAIL; **UNVERIFIED** for any applicable
UNKNOWN without a FAIL; **READY WITHIN ASSESSED SCOPE** only when all applicable
controls pass. List every FAIL and UNKNOWN with owner if known, smallest next
action and evidence needed. Never hide an unknown behind a numeric readiness score.
