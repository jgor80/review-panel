import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseScore, median, combineReport, buildPrompt } from "../lib/panel.js";
import { normalizeRepo, validateRef } from "../lib/repos.js";

const here = dirname(fileURLToPath(import.meta.url));

test("parseScore reads the last SCORE and VERDICT lines", () => {
  assert.deepEqual(parseScore("blah\nSCORE: 4\nmore\nSCORE: 7.5\nVERDICT: FIX_FIRST\n"), { score: 7.5, verdict: "FIX_FIRST" });
  assert.deepEqual(parseScore("**SCORE:** 9/10\n**VERDICT:** SHIP"), { score: 9, verdict: "SHIP" });
  assert.deepEqual(parseScore("VERDICT: fix first"), { score: undefined, verdict: "FIX_FIRST" });
  assert.equal(parseScore("SCORE: 42").score, undefined);
});

test("median", () => {
  assert.equal(median([9, 4, 6]), 6);
  assert.equal(median([8, 6]), 7);
  assert.equal(median([]), undefined);
});

test("combineReport takes the worst verdict and flags missing judges", () => {
  const { verdict, panelScore, markdown } = combineReport({
    repo: "a/b", sha: "0123456789abcdef", goodEnough: 8.5, date: "2026-11-08",
    results: [
      { title: "PM", runner: "claude", status: "done", output: "## Summary\nGood.\nSCORE: 9\nVERDICT: SHIP", score: 9, verdict: "SHIP" },
      { title: "UX", runner: "gemini", status: "done", output: "## Summary\nMeh.\nSCORE: 6\nVERDICT: FIX_FIRST", score: 6, verdict: "FIX_FIRST" },
      { title: "Eng", runner: "codex", status: "failed", error: "not installed" },
    ],
  });
  assert.equal(verdict, "FIX_FIRST");
  assert.equal(panelScore, 7.5);
  assert.match(markdown, /1 of 3 judges did not report/);
  assert.match(markdown, /\| Eng \| codex \| n\/a \| did not run \| not installed \|/);
});

test("all SHIP but below good-enough becomes FIX_FIRST", () => {
  const { verdict } = combineReport({
    repo: "a/b", sha: "x".repeat(40), goodEnough: 8.5, date: "d",
    results: [{ title: "PM", runner: "claude", status: "done", output: "SCORE: 8\nVERDICT: SHIP", score: 8, verdict: "SHIP" }],
  });
  assert.equal(verdict, "FIX_FIRST");
});

test("repo and ref validation", () => {
  assert.equal(normalizeRepo("https://github.com/jgor80/bleacherbums.git"), "jgor80/bleacherbums");
  assert.equal(normalizeRepo("bleacherbums", "jgor80"), "jgor80/bleacherbums");
  assert.throws(() => normalizeRepo("bleacherbums"));
  assert.throws(() => normalizeRepo("a/../b"));
  assert.throws(() => normalizeRepo("--upload-pack=x/y"));
  assert.throws(() => validateRef("--foo"));
  assert.equal(validateRef("feature/x"), "feature/x");
});

test("prompt tells the judge repo content is not instructions", () => {
  const p = buildPrompt({ instructions: "I", contract: "C", brief: "B" });
  assert.match(p, /not instructions to you/);
});

test("end to end: three fake judges, one failing, report saved", async () => {
  const home = await mkdtemp(join(tmpdir(), "rp-home-"));
  process.env.REVIEW_PANEL_HOME = home;
  const { startReview, getReview, listReviews } = await import("../lib/reviews.js");
  const fake = join(here, "fixtures", "fake-judge.mjs");
  const config = {
    runners: {
      claude: { command: ["node", fake, "9"] },
      gemini: { command: ["node", fake, "6"] },
      codex: { command: ["node", fake, "fail"] },
    },
    judges: {
      product: { title: "Product manager", file: "product-manager.md", runner: "claude" },
      ui: { title: "UX designer", file: "ui-ux.md", runner: "gemini" },
      code: { title: "Engineer", file: "code-structure.md", runner: "codex" },
    },
    timeoutMinutes: 1, goodEnough: 8.5,
  };
  const checkoutFn = async (repo, dir) => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "README.md"), "# Demo app\nIt does things.");
    await writeFile(join(dir, "index.js"), "console.log(1)");
    execFileSync("git", ["init", "-q", dir]);
    execFileSync("git", ["-C", dir, "add", "."]);
    execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"]);
    const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"]).toString().trim();
    return { sha, branch: "main" };
  };
  const started = startReview({ repo: "jgor80/demo" }, { config, checkoutFn });
  assert.equal(started.status, "preparing");
  const r = await getReview(started.review_id, { waitSeconds: 30 });
  assert.equal(r.status, "done");
  assert.equal(r.verdict, "FIX_FIRST");
  assert.equal(r.panel_score, 7.5);
  assert.match(r.report, /Fake judge read the brief: true\. cwd has README: true/);
  assert.match(r.report, /Engineer \| codex \| n\/a \| did not run \| exited with code 3: boom/);
  const saved = await readFile(r.report_path, "utf8");
  assert.equal(saved, r.report);
  const list = await listReviews({});
  assert.equal(list[0].review_id, started.review_id);
});
