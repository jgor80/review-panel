# Review Panel MCP server

Lets any AI app that speaks MCP (Claude, ChatGPT, Cursor, Claude Code…) run the Review Panel on
any GitHub repo, whenever you ask: a pull request, a branch, the whole codebase, or the production
gate. Nothing runs on its own.

```
AI app ──MCP──▶ this Worker ──workflow_dispatch──▶ review-on-demand.yml (GitHub Actions, in this repo)
                    ▲                                     │ checks out the target repo, runs the panel
                    └────── report artifact ◀─────────────┘
```

The panel needs a real checkout and 5 to 45 minutes, so it runs in GitHub Actions; the Worker only
starts runs and reads their reports. Tools:

| Tool | Does |
|---|---|
| `list_repos` | Repos the panel's token can read |
| `start_review` | `repo` plus `pr`, or `ref`, or `command: "audit"` / `"gate"` / `"deep"`; optional `focus`, `post_comment`. Returns a `review_id` |
| `get_review` | Status while running; verdict, summary and full report when done |
| `list_reviews` | Recent runs |
| `cancel_review` | Stop a running review |

## Set up (once)

1. **GitHub token.** github.com → Settings → Developer settings → Fine-grained tokens → Generate.
   Resource owner `jgor80`, repository access *All repositories* (or pick the ones to review).
   Permissions: **Actions** read and write, **Contents** read, **Pull requests** read and write
   (write only matters for `post_comment`), Metadata read.
2. **Secrets in this repo** (Settings → Secrets and variables → Actions):
   - `ANTHROPIC_API_KEY`: pays for the reviews
   - `REVIEW_PANEL_GITHUB_TOKEN`: the token from step 1
   - `REVIEW_MCP_KEY`: a long random string (e.g. `openssl rand -hex 32`); it's the connector password
   - `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`
3. **Deploy:** Actions → *Review Panel MCP server* → Run workflow (it also deploys on every merge
   that touches `mcp/`). It deploys the Worker and copies the key and token into it.
4. **Connect your AI app** with the URL
   `https://review-panel-mcp.<your-workers-subdomain>.workers.dev/mcp/<REVIEW_MCP_KEY>`
   (no sign-in; the key is in the URL). Apps that take a header can use
   `https://…/mcp` with `Authorization: Bearer <REVIEW_MCP_KEY>`.

Then ask, for example: "Run the review panel on jgor80/spotbot-3.0-22 PR 140" or "Audit
jgor80/baseball-league-tracker, focus on the draft room", and later "Is that review done?".

## Notes

- **Cost:** every review spends Anthropic credit (audits the most). The tools say so, and the
  AI is told to start one only when you ask. `cancel_review` stops one.
- **Which repos:** `ALLOWED_OWNERS` in `wrangler.jsonc` (default `jgor80`) plus whatever the
  GitHub token can read. A repo without a `REVIEW_PANEL.md` still gets reviewed; the panel infers
  the context and says so.
- **Key leaks:** anyone with the URL can start reviews on your bill. Change `REVIEW_MCP_KEY` and
  re-run the deploy workflow to rotate it.
- **Reports** stay as the run's artifact for 90 days (GitHub's default).
- **Local:** `npm install && npm test`. `npx wrangler dev` with a `.dev.vars` holding `MCP_KEY`
  and `GITHUB_TOKEN` runs it at `http://localhost:8787/mcp/<key>`.
