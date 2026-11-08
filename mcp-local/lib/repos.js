// GitHub access uses git and the GitHub CLI (`gh`) with whatever account they are
// signed in to. Nothing here writes to GitHub.
import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { run, runOk } from "./exec.js";

const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const REF_RE = /^[A-Za-z0-9._\/-]{1,200}$/;

export function normalizeRepo(repo, defaultOwner) {
  let r = String(repo || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  if (!r.includes("/") && defaultOwner) r = `${defaultOwner}/${r}`;
  if (!REPO_RE.test(r) || r.includes("..")) {
    throw new Error(`"${repo}" is not a GitHub repo name. Use owner/name, for example jgor80/bleacherbums.`);
  }
  return r;
}

export function validateRef(ref) {
  if (ref === undefined || ref === null || ref === "") return undefined;
  if (!REF_RE.test(ref) || ref.startsWith("-") || ref.includes("..")) {
    throw new Error(`"${ref}" is not a valid branch or tag name.`);
  }
  return ref;
}

export async function listRepos({ owner, limit = 50 } = {}) {
  const args = ["repo", "list"];
  if (owner) args.push(owner);
  args.push("--limit", String(limit), "--json", "nameWithOwner,description,pushedAt,isPrivate,primaryLanguage");
  const out = await runOk("gh", args);
  return JSON.parse(out);
}

export async function prInfo(repo, pr) {
  const out = await runOk("gh", ["pr", "view", String(pr), "-R", repo, "--json", "title,body,baseRefName,headRefName,url,number"]);
  const info = JSON.parse(out);
  const diff = await runOk("gh", ["pr", "diff", String(pr), "-R", repo], { timeoutMs: 120_000 });
  return { ...info, diff };
}

// Shallow-clone the repo into dir at ref (default branch if none), or at a PR's head.
export async function checkout(repo, dir, { ref, pr } = {}) {
  // Plain git first (uses your git credential helper); fall back to the GitHub CLI.
  const gitArgs = ["clone", "--depth", "1", "--quiet"];
  if (ref && !pr) gitArgs.push("--branch", ref);
  gitArgs.push("--", `https://github.com/${repo}.git`, dir);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const viaGit = await run("git", gitArgs, { timeoutMs: 600_000, env }).catch((e) => ({ code: -1, stderr: e.message }));
  if (viaGit.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    const ghArgs = ["repo", "clone", repo, dir, "--", "--depth", "1", "--quiet"];
    if (ref && !pr) ghArgs.push("--branch", ref);
    try {
      await runOk("gh", ghArgs, { timeoutMs: 600_000 });
    } catch (err) {
      throw new Error(`Couldn't download ${repo}. git said: ${viaGit.stderr.trim().split("\n").pop()}. gh said: ${err.message}`);
    }
  }
  if (pr) {
    await runOk("git", ["-C", dir, "fetch", "--depth", "1", "--quiet", "origin", `pull/${Number(pr)}/head`], { timeoutMs: 600_000 });
    await runOk("git", ["-C", dir, "checkout", "--quiet", "--detach", "FETCH_HEAD"]);
  }
  const sha = (await runOk("git", ["-C", dir, "rev-parse", "HEAD"])).trim();
  const branch = (await run("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
  return { sha, branch };
}

async function readIfExists(path, maxChars) {
  try {
    const text = await readFile(path, "utf8");
    return text.length > maxChars ? text.slice(0, maxChars) + "\n\n[... truncated ...]" : text;
  } catch {
    return undefined;
  }
}

// The project documents every judge gets in its brief.
export async function projectDocs(dir) {
  const docs = {};
  const top = await readdir(dir);
  const pick = (re) => top.find((f) => re.test(f));
  const candidates = [
    ["REVIEW_PANEL.md", pick(/^REVIEW_PANEL\.md$/i), 20_000],
    ["README", pick(/^README(\.md|\.markdown|\.txt)?$/i), 15_000],
    ["AGENTS.md", pick(/^AGENTS\.md$/i), 8_000],
    ["CLAUDE.md", pick(/^CLAUDE\.md$/i), 8_000],
    ["package.json", pick(/^package\.json$/), 6_000],
  ];
  for (const [label, file, max] of candidates) {
    if (!file) continue;
    const text = await readIfExists(join(dir, file), max);
    if (text) docs[label] = { file, text };
  }
  const files = (await runOk("git", ["-C", dir, "ls-files"])).split("\n").filter(Boolean);
  return { docs, files };
}
