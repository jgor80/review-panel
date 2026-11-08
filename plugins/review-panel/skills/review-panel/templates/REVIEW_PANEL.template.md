# REVIEW_PANEL.md

<!-- Copy to the repo root. The shared package defines HOW to review; this file defines
     WHAT MATTERS in this app. Keep it short — judges read it on every review. -->

```yaml
application: <slug>
purpose: <one sentence: who uses it and what for>
users:
  - <role>: <what they do>
stage: prototype | internal | client-facing | public   # drives production-gate strictness

critical_paths:            # review priority; audit mode slices by these
  - <path>: <files/dirs, if known>

sensitive_data:            # what must never leak
  - <e.g. client GA4/GSC data, Discord IDs, emails>

paid_apis:                 # every external call that costs money
  - <provider>: <where it's called>

constraints:               # judges must not re-litigate these
  - Follow existing repo conventions
  - <e.g. React + Vite + Supabase stack stays>

validation:                # commands the panel runs, in order
  - npm ci
  - npx tsc --noEmit
  - npm run lint
  - npm run build
  # - npm test   (add when tests exist)

review:
  default: standard
  good_enough: 8.5         # panel score that ends the round loop
  max_rounds: 3
  require_security_for:
    - Auth, permissions, or RLS policy changes
    - New or changed edge functions / API routes / webhooks
    - Any paid API call path
    - New external inputs (uploads, URLs, screenshots, Discord commands)
    - Database migrations
  out_of_scope:
    - <e.g. generated files under src/integrations/supabase/types.ts>
```

## Notes for judges

<Anything app-specific a reviewer should know: known quirks, deliberate tradeoffs,
"this table is public on purpose", etc.>
