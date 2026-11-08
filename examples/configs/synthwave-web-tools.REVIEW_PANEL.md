# REVIEW_PANEL.md — Synthwave Web Tools

<!-- Draft written from the project description. Verify every TODO against the repo. -->

```yaml
application: synthwave-web-tools
purpose: AI-assisted SEO scoring of auto-dealer websites into a scoring matrix.
users:
  - consultant: enters dealer URLs, reviews scores
stage: client-facing

critical_paths:
  - URL intake and site fetching
  - AI scoring calls and matrix population
  - Export / sharing of results

sensitive_data:
  - Client prospect lists and scores

paid_apis:
  - TODO: LLM provider for scoring
  - TODO: any crawl/fetch service

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
    - URL fetching (SSRF)
    - Paid AI call paths (caps, auth)
    - Database migrations
```

## Notes for judges

- Fetching user-supplied URLs is the main attack surface: block internal addresses, cap size
  and time.
- Scores should be reproducible enough to defend to a client: same input, similar output.
- "Synthwave Tools" is a near-duplicate project; confirm which one is live before auditing.
