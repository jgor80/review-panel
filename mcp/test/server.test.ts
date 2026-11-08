import { strict as assert } from "node:assert";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { contextFor, handle, type Env } from "../src/index.ts";
import { parseReportZip, reviewIdFromTitle } from "../src/github.ts";

const ENV: Env = { MCP_KEY: "secret-key", GITHUB_TOKEN: "ghp_test", ALLOWED_OWNERS: "jgor80" };

type Call = { url: string; method: string; body: any; headers: Record<string, string> };

function fakeGitHub(opts: { runStatus?: string; repoMissing?: boolean } = {}) {
  const calls: Call[] = [];
  let dispatched: Record<string, string> | null = null;
  const zip = zipSync({
    "verdict.txt": strToU8("FIX_FIRST\n"),
    "summary.md": strToU8("**FIX_FIRST** · 7.9\n- RP-NEW: missing guild check"),
    "report.md": strToU8("# Report\n" + "x".repeat(5000)),
    "ledger-rows.md": strToU8(""),
    "result.json": strToU8('{"verdict":"FIX_FIRST"}'),
  });
  const run = () => ({
    id: 42,
    display_title: `review ${dispatched?.request_id ?? "abc123"} · jgor80/app #7 · review`,
    status: opts.runStatus ?? "completed",
    conclusion: "success",
    html_url: "https://github.com/jgor80/review-panel/actions/runs/42",
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  const f = (async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const headers = Object.fromEntries(Object.entries((init.headers as Record<string, string>) || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method: init.method || "GET", body, headers });
    const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.startsWith("https://storage.example/")) return new Response(zip);
    const path = url.replace("https://api.github.com", "").split("?")[0];
    if (path === "/repos/jgor80/app") return opts.repoMissing ? ok({ message: "Not Found" }, 404) : ok({ full_name: "jgor80/app", default_branch: "main", private: true });
    if (path.endsWith("/dispatches")) {
      dispatched = body.inputs;
      return new Response(null, { status: 204 });
    }
    if (path === "/repos/jgor80/review-panel/actions/workflows/review-on-demand.yml/runs") return ok({ workflow_runs: [run()] });
    if (path === "/repos/jgor80/review-panel/actions/runs/42") return ok(run());
    if (path === "/repos/jgor80/review-panel/actions/runs/42/artifacts") return ok({ artifacts: [{ id: 9, name: "review-panel-report", expired: false }] });
    if (path === "/repos/jgor80/review-panel/actions/artifacts/9/zip") return new Response(null, { status: 302, headers: { location: "https://storage.example/zip" } });
    if (path === "/user/repos") return ok([{ full_name: "jgor80/app", private: true, pushed_at: "", description: null }, { full_name: "someone/else", private: false, pushed_at: "", description: null }]);
    return ok({ message: `unexpected ${path}` }, 500);
  }) as typeof fetch;
  return { f, calls, dispatched: () => dispatched };
}

const rpc = (method: string, params: Record<string, unknown> = {}, id: number | null = 1) =>
  JSON.stringify({ jsonrpc: "2.0", ...(id === null ? {} : { id }), method, params });

async function call(gh: ReturnType<typeof fakeGitHub>, body: string, path = "/mcp/secret-key", headers: Record<string, string> = {}) {
  const ctx = { ...contextFor(ENV, gh.f), sleep: async () => {}, newId: () => "abc123" };
  return handle(new Request(`https://rp.example${path}`, { method: "POST", body, headers }), ENV, ctx);
}

const toolResult = async (res: Response) => {
  const j = (await res.json()) as any;
  return { isError: j.result.isError as boolean, data: j.result.structuredContent, text: j.result.content[0].text as string };
};

test("rejects a wrong or missing key", async () => {
  const gh = fakeGitHub();
  assert.equal((await call(gh, rpc("tools/list"), "/mcp/nope")).status, 401);
  assert.equal((await call(gh, rpc("tools/list"), "/mcp")).status, 401);
  assert.equal(gh.calls.length, 0);
});

test("accepts the key as a bearer token", async () => {
  const res = await call(fakeGitHub(), rpc("tools/list"), "/mcp", { authorization: "Bearer secret-key" });
  assert.equal(res.status, 200);
});

test("503 when not configured", async () => {
  const res = await handle(new Request("https://rp.example/mcp/x", { method: "POST", body: rpc("ping") }), {});
  assert.equal(res.status, 503);
});

test("initialize and tools/list", async () => {
  const init = (await (await call(fakeGitHub(), rpc("initialize", { protocolVersion: "2025-03-26" }))).json()) as any;
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.equal(init.result.serverInfo.name, "review-panel");
  const list = (await (await call(fakeGitHub(), rpc("tools/list"))).json()) as any;
  assert.deepEqual(list.result.tools.map((t: any) => t.name), ["start_review", "get_review", "list_reviews", "list_repos", "cancel_review"]);
});

test("notifications get 202", async () => {
  const res = await call(fakeGitHub(), rpc("notifications/initialized", {}, null));
  assert.equal(res.status, 202);
});

test("start_review dispatches the workflow with string inputs and finds the run", async () => {
  const gh = fakeGitHub({ runStatus: "queued" });
  const r = await toolResult(await call(gh, rpc("tools/call", { name: "start_review", arguments: { repo: "https://github.com/jgor80/app", pr: 7, focus: "auth" } })));
  assert.equal(r.isError, false);
  assert.deepEqual(gh.dispatched(), { repo: "jgor80/app", pr: "7", ref: "", command: "review", focus: "auth", post_comment: "false", request_id: "abc123" });
  const dispatch = gh.calls.find((c) => c.url.endsWith("/dispatches"))!;
  assert.equal(dispatch.body.ref, "main");
  assert.equal(r.data.review_id, "abc123");
  assert.equal(r.data.url, "https://github.com/jgor80/review-panel/actions/runs/42");
});

test("start_review refuses other owners and bad input before calling GitHub", async () => {
  for (const args of [{ repo: "someone/else" }, { repo: "not a repo" }, { repo: "jgor80/app", command: "nuke" }, { repo: "jgor80/app", ref: "a b" }, { repo: "jgor80/app", post_comment: true }]) {
    const gh = fakeGitHub();
    const r = await toolResult(await call(gh, rpc("tools/call", { name: "start_review", arguments: args })));
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.equal(gh.calls.length, 0);
  }
});

test("start_review explains a repo the token can't see", async () => {
  const gh = fakeGitHub({ repoMissing: true });
  const r = await toolResult(await call(gh, rpc("tools/call", { name: "start_review", arguments: { repo: "jgor80/app" } })));
  assert.equal(r.isError, true);
  assert.match(r.text, /Can't see jgor80\/app/);
  assert.equal(gh.dispatched(), null);
});

test("get_review while running returns status only", async () => {
  const gh = fakeGitHub({ runStatus: "in_progress" });
  const r = await toolResult(await call(gh, rpc("tools/call", { name: "get_review", arguments: { review_id: "abc123" } })));
  assert.equal(r.data.status, "in_progress");
  assert.equal(r.data.report, undefined);
  assert.equal(r.data.started_minutes_ago, 12);
});

test("get_review when done returns verdict and report, and never sends the token to storage", async () => {
  const gh = fakeGitHub();
  const r = await toolResult(await call(gh, rpc("tools/call", { name: "get_review", arguments: { review_id: "abc123", max_chars: 2000 } })));
  assert.equal(r.data.verdict, "FIX_FIRST");
  assert.match(r.data.summary, /missing guild check/);
  assert.match(r.data.report, /cut at 2000 characters/);
  const storage = gh.calls.find((c) => c.url.startsWith("https://storage.example/"))!;
  assert.equal(storage.headers.authorization, undefined);
});

test("get_review by run id", async () => {
  const r = await toolResult(await call(fakeGitHub(), rpc("tools/call", { name: "get_review", arguments: { review_id: "42", include_report: false } })));
  assert.equal(r.data.verdict, "FIX_FIRST");
  assert.equal(r.data.report, undefined);
});

test("list_repos filters to allowed owners", async () => {
  const r = await toolResult(await call(fakeGitHub(), rpc("tools/call", { name: "list_repos", arguments: {} })));
  assert.deepEqual(r.data.repos.map((x: any) => x.full_name), ["jgor80/app"]);
});

test("cancel_review leaves finished runs alone", async () => {
  const gh = fakeGitHub();
  const r = await toolResult(await call(gh, rpc("tools/call", { name: "cancel_review", arguments: { review_id: "abc123" } })));
  assert.match(r.data.note, /Already finished/);
  assert.ok(!gh.calls.some((c) => c.url.endsWith("/cancel")));
});

test("helpers", () => {
  assert.equal(reviewIdFromTitle("review abc123 · jgor80/app #7 · review"), "abc123");
  assert.equal(reviewIdFromTitle("Review Panel"), null);
  const zip = zipSync({ "nested/verdict.txt": strToU8(" ship ") });
  assert.equal(parseReportZip(zip).verdict, "SHIP");
});
