// Runs reviews in the background so a long review doesn't hit the client's tool timeout.
// start() returns an id at once; get() reports progress and, when done, the report.
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { loadConfig, panelHome, PROMPT_PLACEHOLDER } from "./config.js";
import { run } from "./exec.js";
import { checkout, normalizeRepo, prInfo, projectDocs, validateRef } from "./repos.js";
import { buildBrief, buildPrompt, combineReport, judgeInstructions, outputContract, parseScore } from "./panel.js";

const jobs = new Map();
const ID_RE = /^rp-[0-9a-z-]{6,40}$/;

function newId() {
  const d = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `rp-${d}-${randomBytes(2).toString("hex")}`;
}

function reportsDir(repo) {
  return join(panelHome(), "reports", repo.replace("/", "__"));
}

export function startReview({ repo, ref, pr, judges, focus, appUrl }, deps = {}) {
  const config = deps.config || loadConfig();
  const fullRepo = normalizeRepo(repo, config.defaultOwner);
  const cleanRef = validateRef(ref);
  if (pr !== undefined && !(Number.isInteger(pr) && pr > 0)) throw new Error("pr must be a pull request number.");
  const keys = judges && judges.length ? [...new Set(judges)] : Object.keys(config.judges);
  for (const k of keys) {
    if (!config.judges[k]) throw new Error(`Unknown judge "${k}". Available: ${Object.keys(config.judges).join(", ")}.`);
  }
  const id = newId();
  const job = {
    id,
    repo: fullRepo,
    ref: cleanRef,
    pr,
    focus,
    status: "preparing",
    startedAt: new Date().toISOString(),
    judges: keys.map((k) => ({ key: k, title: config.judges[k].title, runner: config.judges[k].runner, status: "waiting" })),
  };
  jobs.set(id, job);
  job.promise = execute(job, { config, appUrl, ...deps }).catch((err) => {
    job.status = "failed";
    job.error = err.message;
  });
  return publicView(job);
}

async function execute(job, { config, appUrl, checkoutFn = checkout, prInfoFn = prInfo, runFn = run }) {
  await mkdir(join(panelHome(), "work"), { recursive: true });
  const dir = await mkdtemp(join(panelHome(), "work", `${job.id}-`));
  try {
    const pr = job.pr ? await prInfoFn(job.repo, job.pr) : undefined;
    const { sha, branch } = await checkoutFn(job.repo, join(dir, "repo"), { ref: job.ref, pr: job.pr });
    job.sha = sha;
    const { docs, files } = await projectDocs(join(dir, "repo"));
    const contract = await outputContract();
    job.status = "judging";

    await Promise.all(job.judges.map(async (j) => {
      const judgeCfg = config.judges[j.key];
      const runner = config.runners[judgeCfg.runner];
      const others = job.judges.filter((o) => o.key !== j.key);
      const brief = buildBrief({ repo: job.repo, sha, branch, pr, focus: job.focus, appUrl, docs, files, otherJudges: others });
      const prompt = buildPrompt({ instructions: await judgeInstructions(judgeCfg), contract, brief });
      const [cmd, ...rawArgs] = runner.command;
      const usesArg = rawArgs.includes(PROMPT_PLACEHOLDER);
      const args = rawArgs.map((a) => (a === PROMPT_PLACEHOLDER ? prompt : a));
      j.status = "running";
      const t0 = Date.now();
      try {
        const r = await runFn(cmd, args, {
          cwd: join(dir, "repo"),
          input: usesArg ? "" : prompt,
          timeoutMs: config.timeoutMinutes * 60_000,
          shell: process.platform === "win32" && !usesArg,
        });
        j.seconds = Math.round((Date.now() - t0) / 1000);
        if (r.timedOut) throw new Error(`timed out after ${config.timeoutMinutes} minutes`);
        if (r.code !== 0) throw new Error(`exited with code ${r.code}: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" ")}`);
        if (!r.stdout.trim()) throw new Error("returned no output");
        j.output = r.stdout;
        Object.assign(j, parseScore(r.stdout));
        j.status = "done";
      } catch (err) {
        j.seconds = Math.round((Date.now() - t0) / 1000);
        j.status = "failed";
        j.error = err.code === "ENOENT"
          ? `the "${cmd}" command isn't installed or isn't on PATH (install it and sign in, or change runners.${judgeCfg.runner} in config.json)`
          : err.message;
      }
    }));

    const date = new Date().toISOString().slice(0, 10);
    const { markdown, verdict, panelScore } = combineReport({
      repo: job.repo, sha, pr, focus: job.focus, results: job.judges, goodEnough: config.goodEnough, date,
    });
    const outDir = reportsDir(job.repo);
    await mkdir(outDir, { recursive: true });
    job.reportPath = join(outDir, `${job.id}.md`);
    await writeFile(job.reportPath, markdown);
    await writeFile(join(outDir, `${job.id}.json`), JSON.stringify({
      id: job.id, repo: job.repo, sha, pr: job.pr, focus: job.focus, date, verdict, panelScore,
      judges: job.judges.map(({ key, title, runner, status, score, verdict: v, seconds, error }) => ({ key, title, runner, status, score, verdict: v, seconds, error })),
    }, null, 2));
    job.report = markdown;
    job.verdict = verdict;
    job.panelScore = panelScore;
    job.status = "done";
    job.finishedAt = new Date().toISOString();
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function publicView(job, { includeReport = false } = {}) {
  const v = {
    review_id: job.id,
    repo: job.repo,
    status: job.status,
    commit: job.sha,
    pr: job.pr,
    judges: job.judges.map((j) => ({
      judge: j.title, runs_on: j.runner, status: j.status,
      ...(j.score !== undefined ? { score: j.score } : {}),
      ...(j.verdict ? { verdict: j.verdict } : {}),
      ...(j.seconds !== undefined ? { seconds: j.seconds } : {}),
      ...(j.error ? { error: j.error } : {}),
    })),
  };
  if (job.error) v.error = job.error;
  if (job.status === "done") {
    v.verdict = job.verdict;
    v.panel_score = job.panelScore;
    v.report_path = job.reportPath;
    if (includeReport) v.report = job.report;
  }
  return v;
}

export async function getReview(id, { waitSeconds = 0 } = {}) {
  if (!ID_RE.test(id)) throw new Error(`"${id}" is not a review id.`);
  const job = jobs.get(id);
  if (job) {
    if (waitSeconds > 0 && job.status !== "done" && job.status !== "failed") {
      await Promise.race([job.promise, new Promise((r) => setTimeout(r, Math.min(waitSeconds, 600) * 1000))]);
    }
    return publicView(job, { includeReport: true });
  }
  // Not in memory (server restarted): look for the saved report.
  const root = join(panelHome(), "reports");
  for (const repoDir of await readdir(root).catch(() => [])) {
    const md = await readFile(join(root, repoDir, `${id}.md`), "utf8").catch(() => undefined);
    if (md !== undefined) {
      const meta = JSON.parse(await readFile(join(root, repoDir, `${id}.json`), "utf8").catch(() => "{}"));
      return { review_id: id, status: "done", ...meta, report: md };
    }
  }
  throw new Error(`No review with id ${id}.`);
}

export async function listReviews({ repo, limit = 20 } = {}) {
  const root = join(panelHome(), "reports");
  const config = loadConfig();
  const dirs = repo ? [normalizeRepo(repo, config.defaultOwner).replace("/", "__")] : await readdir(root).catch(() => []);
  const rows = [];
  for (const d of dirs) {
    for (const f of await readdir(join(root, d)).catch(() => [])) {
      if (!f.endsWith(".json")) continue;
      const meta = JSON.parse(await readFile(join(root, d, f), "utf8").catch(() => "null"));
      if (meta) rows.push({ review_id: meta.id, repo: meta.repo, date: meta.date, pr: meta.pr, verdict: meta.verdict, panel_score: meta.panelScore });
    }
  }
  for (const job of jobs.values()) {
    if (job.status !== "done" && (!repo || job.repo === normalizeRepo(repo, config.defaultOwner))) {
      rows.push({ review_id: job.id, repo: job.repo, status: job.status });
    }
  }
  return rows.sort((a, b) => String(b.review_id).localeCompare(String(a.review_id))).slice(0, limit);
}
