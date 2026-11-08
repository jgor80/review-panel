# Review Panel MCP server

One MCP tool that reviews any of your GitHub repos with three AI judges at once, and
gives you back one scored report.

| Judge | Runs on | Judges |
|---|---|---|
| Product manager | Claude | Workflows and functionality: walks each user journey end to end, from a real person's point of view |
| UX designer | Gemini | UI and user experience: screens, states, copy, accessibility |
| Engineer | Codex | Code structure: boundaries, data integrity, failure handling, tests |

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
cd review-panel/mcp
npm install
```

Then add it to whichever app you'll call it from. Use the full path to `server.js`.

**Claude Code**

```bash
claude mcp add --scope user review-panel -- node /full/path/to/review-panel/mcp/server.js
```

**Claude Desktop**: Settings → Developer → Edit Config, and add:

```json
{
  "mcpServers": {
    "review-panel": {
      "command": "node",
      "args": ["C:\\full\\path\\to\\review-panel\\mcp\\server.js"]
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.review-panel]
command = "node"
args = ["/full/path/to/review-panel/mcp/server.js"]
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

**The report** starts with a scoreboard. It shows each judge's score and verdict, then the
panel score, which is the median. The overall verdict is the most serious one any judge
gave: `SHIP`, `FIX_FIRST` or `BLOCK`. If the panel score is below the good-enough mark
(8.5), a `SHIP` becomes `FIX_FIRST`. After the scoreboard comes each judge's full review.

If the repo has a `REVIEW_PANEL.md` (see `../templates/`), every judge gets it as the
spec, along with the README, AGENTS.md, CLAUDE.md and the file list.

## Change the judges

Create `~/.review-panel/config.json`. Anything you leave out keeps its default.

```json
{
  "defaultOwner": "jgor80",
  "timeoutMinutes": 20,
  "goodEnough": 8.5,
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
- Edit `judges/product-manager.md`, `ui-ux.md` or `code-structure.md` to tune a judge.

## Safety

- The judges can only read. Claude runs with only `Read,Grep,Glob` allowed and edits, shell
  and web turned off. Codex runs in its `read-only` sandbox. Gemini runs headless in
  default approval mode, so any tool that needs approval (shell, writes) is refused.
- Nothing is pushed or posted to GitHub. The server only reads.
- Each judge is told that repo content is material to review, not instructions. That
  matters because the judges read code and docs written by whoever can push to the repo.
- The repo copy is deleted after each review; only the report is kept.

## Hosted mode (later)

This version runs on your computer. A hosted version would add a second kind of runner
that calls the Anthropic, Gemini and OpenAI APIs with keys, plus an authenticated HTTP
transport, so the panel could be added as a connector in claude.ai. The judges, the brief
and the report would stay the same.

## Tests

```bash
npm test
```

The tests use a fake judge, so they make no model calls.
