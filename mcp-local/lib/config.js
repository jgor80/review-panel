// Judge lineup and runner commands. Every value can be overridden in
// $REVIEW_PANEL_HOME/config.json (default ~/.review-panel/config.json).
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const PROMPT_PLACEHOLDER = "{prompt}";

// Each runner is a command line. The prompt goes to stdin, unless an argument is
// exactly "{prompt}", in which case it is passed there instead. Every runner is
// started in a fresh read-only checkout of the repo, with no shell.
export const DEFAULT_RUNNERS = {
  claude: {
    command: [
      "claude", "-p",
      "--output-format", "text",
      "--allowedTools", "Read,Grep,Glob",
      "--disallowedTools", "Edit,Write,NotebookEdit,Bash,WebFetch,WebSearch",
    ],
  },
  gemini: {
    // Headless Gemini CLI reads the piped prompt from stdin and adds the -p text.
    // In the default approval mode it cannot run tools that need approval
    // (shell, file writes), so it reads files only.
    command: ["gemini", "--approval-mode", "default", "-p", "Follow the review instructions above and write your review."],
  },
  codex: {
    command: ["codex", "exec", "--sandbox", "read-only", "--skip-git-repo-check", "-"],
  },
};

export const DEFAULT_JUDGES = {
  product: {
    title: "Product manager (workflows and functionality)",
    file: "product-manager.md",
    runner: "claude",
  },
  ui: {
    title: "UX designer (UI and user experience)",
    file: "ui-ux.md",
    // Gemini was dropped from the default panel on 2026-11-09; set runner to "gemini"
    // in config.json to bring it back.
    runner: "claude",
  },
  code: {
    title: "Engineer (code structure)",
    file: "code-structure.md",
    runner: "codex",
  },
  legal: {
    title: "Counsel (legal, privacy and platform rules)",
    file: "legal-compliance.md",
    runner: "claude",
  },
};

export function panelHome() {
  return process.env.REVIEW_PANEL_HOME || join(homedir(), ".review-panel");
}

export function loadConfig() {
  const path = join(panelHome(), "config.json");
  let user = {};
  if (existsSync(path)) {
    try {
      user = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`Could not read ${path}: ${err.message}`);
    }
  }
  const runners = { ...DEFAULT_RUNNERS };
  for (const [name, r] of Object.entries(user.runners || {})) {
    if (!Array.isArray(r.command) || r.command.length === 0 || !r.command.every((a) => typeof a === "string")) {
      throw new Error(`config.json: runners.${name}.command must be a non-empty array of strings`);
    }
    runners[name] = { ...runners[name], ...r };
  }
  const judges = { ...DEFAULT_JUDGES };
  for (const [name, j] of Object.entries(user.judges || {})) {
    judges[name] = { ...judges[name], ...j };
  }
  for (const [name, j] of Object.entries(judges)) {
    if (!j.file || !j.runner) throw new Error(`config.json: judges.${name} needs "file" and "runner"`);
    if (!runners[j.runner]) throw new Error(`config.json: judges.${name} uses unknown runner "${j.runner}"`);
  }
  return {
    runners,
    judges,
    timeoutMinutes: Number(user.timeoutMinutes) > 0 ? Number(user.timeoutMinutes) : 20,
    goodEnough: Number(user.goodEnough) > 0 ? Number(user.goodEnough) : 8.5,
    defaultOwner: typeof user.defaultOwner === "string" ? user.defaultOwner : undefined,
    // A judge whose score is at least this far below the rest of the panel is called out
    // as the Russian judge.
    russianGap: Number(user.russianGap) > 0 ? Number(user.russianGap) : 1.5,
  };
}
