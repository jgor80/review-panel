# REVIEW_PANEL.md — Diamond Tracker (PennantBot)

<!-- Draft written from the project description. Verify every TODO against the repo. -->

```yaml
application: diamond-tracker
purpose: Discord-integrated league manager for MLB The Show leagues — game results, standings, drafts, auctions, playoffs.
users:
  - league member: submits game results via Discord, joins drafts/auctions
  - commissioner: approves results, manages rosters, seasons, drafts, auctions
stage: public

critical_paths:
  - Discord ↔ web account linking and auth
  - Game result ingestion (screenshot parsing, link import, approval batches)
  - Standings and stats computation (rebuilds, tiebreakers, forfeits/voids)
  - Live draft room (pick order, clock, autopick, concurrent picks)
  - Live auctions (bids, budgets, timers, cancellation)
  - Commissioner admin writes (trades, roster moves, season phase changes)
  - MCP server tools (dry-run → confirm two-step on every write)

sensitive_data:
  - Discord user IDs and guild membership
  - Account-link tokens and sessions

paid_apis:
  - TODO: AI/vision provider used for screenshot ingestion — where called
  - TODO: any game-data sync provider

constraints:
  - Every admin write keeps the dry-run then confirm two-step
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
    - Account linking, auth, commissioner permissions, RLS changes
    - Discord interaction handlers and webhooks
    - MCP server tools
    - Screenshot/link ingestion
    - Database migrations
  out_of_scope:
    - Generated Supabase types
```

## Notes for judges

- Concurrency matters most in the draft room and auctions: double-clicks, two commissioners,
  timers firing while a bid lands.
- Standings must be reproducible from approved games alone; any cached total is a second
  source of truth to check.
