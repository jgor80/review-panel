# Review Panel local MCP server (four judges)

One MCP tool that reviews any of your GitHub repos with four AI judges at once, and
gives you back one scored report that shows each judge's working and calls out the
harshest one as **the Russian judge**.

| Judge | Runs on | Judges |
|---|---|---|
| Product manager | Claude | Workflows and functionality: walks each user journey end to end, from a real person's point of view |
| UX designer | Claude (Gemini until 2026-11-09) | UI and user experience: screens, states, copy, accessibility |
| Engineer | Codex | Code structure: boundaries, data integrity, failure handling, tests |
| Counsel | Claude | Legal, privacy and platform rules: data-protection law (GDPR, CCPA/CPRA), children (COPPA), app-store, Discord and API terms, copyright and licensing, payments, contests, marketing law. It maps what the app collects and shows, then checks each against the rules that apply to that app. Not legal advice. |

The roles come from David Bell's Tech SEO Connect 2026 talk: Claude as product manager,
Gemini on UX and design, Codex building the code. The judging style is from that talk too.
Each judge is a harsh judge working from named frameworks, scores out of 10, and lists its
problems. A 9 is good enough; nobody chases a 10.

Each judge runs **read-only** on a fresh copy of the repo, in parallel. The judges use the
command-line tools you're already signed in to, so the cost goes on your existing Claude,
Gemini and ChatGPT/Codex plans. No API keys are needed.

## What you need

- Node.js 20 or newer, and git
- The GitHub CLI (`gh`), signed in (`gh auth login`), for `list_repos` and pull request reviews
- The judge CLIs, each installed and signed in once:
  - Claude Code: `npm install -g @anthropic-ai/claude-code`, then run `claude` once
  - Gemini CLI: `npm install -g @google/gemini-cli`, then run `gemini` once
  - Codex CLI: `npm install -g @openai/codex`, then run `codex` once

If one isn't installed, the other judges still run and the report says which one was
missing.

## Install

```bash
git clone https://github.com/jgor80/review-panel.git
cd review-panel/mcp-local
npm install
```

Then add it to whichever app you'll call it from. Use the full path to `server.js`.

**Claude Code**

```bash
claude mcp add --scope user review-panel-local -- node /full/path/to/review-panel/mcp-local/server.js
```

**Claude Desktop**: Settings → Developer → Edit Config, and add:

```json
{
  "mcpServers": {
    "review-panel-local": {
      "command": "node",
      "args": ["C:\\full\\path\\to\\review-panel\\mcp-local\\server.js"]
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.review-panel-local]
command = "node"
args = ["/full/path/to/review-panel/mcp-local/server.js"]
tool_timeout_sec = 900
```

**Gemini CLI** (`~/.gemini/settings.json`): the same `mcpServers` block as Claude Desktop.

## Use it

Just ask in plain words:

> Review jgor80/bleacherbums with the panel.
>
> Run only the product judge on PennantBot PR 42, focus on the draft-day workflow.
>
> Show me my last reviews.

The tools:

| Tool | Does |
|---|---|
| `list_repos` | Lists your GitHub repos |
| `list_judges` | Shows the judges and which AI runs each |
| `start_review` | Starts a review of a repo (whole app) or one PR; returns a `review_id` at once |
| `get_review` | Progress, or the finished report; `wait_seconds` waits for it |
| `list_reviews` | Past and running reviews |

A review takes a few minutes, so `start_review` returns straight away and `get_review`
collects the result. Reports are saved to `~/.review-panel/reports/<owner>__<repo>/`.

**The report** opens with **the Russian judge**: the judge scoring furthest below the
median of the others, shown in a banner with its score, the gap, what sank it and its
harshest criteria. It's only called out when the gap is at least 1.5 points (`russianGap`
in config.json); otherwise the report says there isn't one this round.

Then the scoreboard. It shows each judge's score, how far it sits from the rest ("vs rest"),
its findings by severity, the cap or finding that set its score, and its verdict, then the
panel score, which is the median. The overall verdict is the most serious one any judge
gave: `SHIP`, `FIX_FIRST` or `BLOCK`. If the panel score is below the good-enough mark
(8.5), a `SHIP` becomes `FIX_FIRST`. Next, "How each judge got its score": every judge's per-criterion table (score, the
files and lines it read as evidence, and why), and its steps from criteria to the final
number, including any cap. After that comes each judge's full review.

If the repo has a `REVIEW_PANEL.md` (see `../templates/`), every judge gets it as the
spec, along with the README, AGENTS.md, CLAUDE.md and the file list.

## Change the judges

Create `~/.review-panel/config.json`. Anything you leave out keeps its default.

```json
{
  "defaultOwner": "jgor80",
  "timeoutMinutes": 20,
  "goodEnough": 8.5,
  "russianGap": 1.5,
  "runners": {
    "gemini": { "command": ["gemini", "-m", "gemini-2.5-pro", "--approval-mode", "default", "-p", "Follow the review instructions above and write your review."] }
  },
  "judges": {
    "security": { "title": "Security reviewer", "file": "/full/path/to/my-security-judge.md", "runner": "claude" }
  }
}
```

- A runner is a command line, run with no shell, in the repo copy. The prompt goes to stdin.
  If you'd rather pass it as an argument, put `"{prompt}"` where it goes.
- A judge is a title, an instructions file (in `judges/` or a full path) and a runner. The
  output format every judge must follow is `judges/_output-contract.md`.
- Edit `judges/product-manager.md`, `ui-ux.md`, `code-structure.md` or `legal-compliance.md` to tune a judge.
- To put Gemini back on UI/UX: `"judges": { "ui": { "runner": "gemini" } }`.

## Safety

- The judges can only read. Claude runs with only `Read,Grep,Glob` allowed and edits, shell
  and web turned off. Codex runs in its `read-only` sandbox. Gemini runs headless in
  default approval mode, so any tool that needs approval (shell, writes) is refused.
- Nothing is pushed or posted to GitHub. The server only reads.
- Each judge is told that repo content is material to review, not instructions. That
  matters because the judges read code and docs written by whoever can push to the repo.
- The repo copy is deleted after each review; only the report is kept.

## How this relates to `mcp/`

`mcp/` is the hosted connector (a Cloudflare Worker). It runs the Claude-only five-judge panel
in GitHub Actions and is paid for with an Anthropic API key. This server is the local one. It runs
several AIs on your own machine through their CLIs, so it needs no keys and no deploy.
Name them differently in your AI app (`review-panel` and `review-panel-local`) so both can be
installed.

## Tests

```bash
npm test
```

The tests use a fake judge, so they make no model calls.
