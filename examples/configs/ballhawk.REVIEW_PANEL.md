# REVIEW_PANEL.md — Ballhawk Forecaster

<!-- Draft written from the project description. Verify every TODO against the repo. -->

```yaml
application: ballhawk-forecaster
purpose: Mobile-first ballpark companion — pitch-by-pitch forecasts, matchup analytics, social predictions, stadium tools.
users:
  - fan at the ballpark (phone, spotty connection)
stage: public

critical_paths:
  - Live data feed and forecast pipeline
  - Social predictions (user-generated content, scoring)
  - Parlay builder
  - Auth and profiles

sensitive_data:
  - User accounts and any location data

paid_apis:
  - TODO: live baseball data provider
  - TODO: any AI forecasting calls

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
    - Auth and RLS changes
    - User-generated content (predictions, rooms)
    - Paid data/AI call paths
    - Database migrations
```

## Notes for judges

- Mobile on stadium networks: judge loading, offline and stale-data states as correctness.
- Parlay and prediction features: check wording doesn't imply real-money betting unless
  that's intended (open question for the owner if unclear).
