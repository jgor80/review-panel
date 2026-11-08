#!/usr/bin/env node
// Review Panel MCP server (stdio). Add it to Claude Code, Claude Desktop, Codex or
// Gemini CLI as a local MCP server; see README.md.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./lib/config.js";
import { listRepos } from "./lib/repos.js";
import { getReview, listReviews, startReview } from "./lib/reviews.js";

const server = new McpServer({ name: "review-panel", version: "0.1.0" });

const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: "text", text: err.message || String(err) }] });
const guard = (fn) => async (args) => {
  try {
    return await fn(args);
  } catch (err) {
    return fail(err);
  }
};

server.registerTool("list_repos", {
  title: "List repos",
  description: "List GitHub repos the signed-in GitHub CLI account can see, newest first. Use it to find the owner/name to review.",
  inputSchema: {
    owner: z.string().optional().describe("GitHub user or org. Leave out for your own account."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true },
}, guard(async ({ owner, limit }) => text(await listRepos({ owner, limit }))));

server.registerTool("list_judges", {
  title: "List judges",
  description: "Show the judges on the panel, what each one judges, and which AI runs it.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, guard(async () => {
  const { judges } = loadConfig();
  return text(Object.entries(judges).map(([key, j]) => ({ key, judge: j.title, runs_on: j.runner })));
}));

server.registerTool("start_review", {
  title: "Start a review",
  description:
    "Send a repo (the whole app, or one pull request) to the review panel. By default three judges run at the same time: " +
    "Claude judges workflows and functionality as a product manager, Gemini judges UI/UX, and Codex judges code structure. " +
    "Each runs read-only on a fresh copy of the repo and returns findings and a score out of 10. Returns a review_id at once; " +
    "reviews take several minutes, so call get_review with wait_seconds to collect the report.",
  inputSchema: {
    repo: z.string().describe("owner/name, for example jgor80/bleacherbums"),
    pr: z.number().int().positive().optional().describe("Review this pull request instead of the whole app"),
    ref: z.string().optional().describe("Branch or tag to review (default: the default branch). Ignored with pr."),
    judges: z.array(z.string()).optional().describe("Judge keys to run, e.g. [\"product\"]. Default: all. See list_judges."),
    focus: z.string().max(2000).optional().describe("What you want the judges to look at hardest, in plain words"),
    app_url: z.string().url().optional().describe("Link to the running app, for judges whose tools can open it"),
  },
}, guard(async ({ repo, pr, ref, judges, focus, app_url }) =>
  text(startReview({ repo, pr, ref, judges, focus, appUrl: app_url }))));

server.registerTool("get_review", {
  title: "Get a review",
  description: "Check on a review, or get its finished report (scoreboard, then each judge's findings). wait_seconds waits up to that long for it to finish.",
  inputSchema: {
    review_id: z.string(),
    wait_seconds: z.number().int().min(0).max(600).optional().describe("Wait up to this many seconds for the review to finish (default 0)"),
  },
  annotations: { readOnlyHint: true },
}, guard(async ({ review_id, wait_seconds }) => {
  const r = await getReview(review_id, { waitSeconds: wait_seconds || 0 });
  if (r.report) {
    const { report, ...meta } = r;
    return { content: [{ type: "text", text: JSON.stringify(meta, null, 2) }, { type: "text", text: report }] };
  }
  return text(r);
}));

server.registerTool("list_reviews", {
  title: "List reviews",
  description: "List past and running reviews, newest first, optionally for one repo.",
  inputSchema: {
    repo: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true },
}, guard(async ({ repo, limit }) => text(await listReviews({ repo, limit }))));

await server.connect(new StdioServerTransport());
