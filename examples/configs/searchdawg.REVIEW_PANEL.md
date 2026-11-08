# REVIEW_PANEL.md — SearchDawg

<!-- Draft written from the project description. Verify every TODO against the repo. -->

```yaml
application: searchdawg
purpose: Agency platform for local SEO performance — unified GBP, GA4 and GSC data, client health, task automation, AI insights.
users:
  - agency analyst: monitors clients, runs reports, acts on insights
  - client viewer: sees client-facing reports
stage: client-facing

critical_paths:
  - Client/tenant isolation (an analyst or client sees only their accounts)
  - Google OAuth connections and token storage (GBP, GA4, GSC)
  - Daily sync jobs and historical backfills
  - AI Assistant channel classification, incl. "Estimated (pre-native classification)" labeling
  - AI insight generation and meeting-notes → task automation
  - Client file storage

sensitive_data:
  - Client analytics, search and business-profile data
  - Google OAuth refresh tokens
  - Meeting notes and client files

paid_apis:
  - TODO: LLM provider(s) for insights and task generation — where called
  - Google APIs (quota, not money — still cap retries)

constraints:
  - Estimated historical AI-assistant traffic stays visible, visually distinct
  - Follow existing repo conventions

validation:
  - npm ci
  - npx tsc --noEmit
  - npm run lint
  - npm run build

review:
  default: standard
  good_enough: 8.5
  max_rounds: 3
  require_security_for:
    - Auth, tenant scoping, RLS changes
    - OAuth token handling
    - Edge functions and sync jobs
    - AI calls that receive client data
    - Storage bucket policies
    - Database migrations
  out_of_scope:
    - Generated Supabase types
```

## Notes for judges

- Large codebase (1,270+ files): in audit mode, slice strictly by critical path.
- Sync jobs must be idempotent; a re-run or overlapping backfill must not double-count.
- Numbers in client reports are the product. Any change to aggregation is a correctness
  critical path.
