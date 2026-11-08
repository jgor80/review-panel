import { spawn } from "node:child_process";

// Run a command without a shell. Resolves with { code, stdout, stderr, timedOut }.
// Never rejects for a non-zero exit; rejects only if the command cannot start.
// shell is only for Windows, where npm-installed CLIs are .cmd files that can't be
// started without one; it is never used for arguments that come from a repo.
export function run(command, args, { cwd, input, timeoutMs = 120_000, env, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const quoted = shell ? args.map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)) : args;
    const child = spawn(command, quoted, {
      cwd,
      env: env || process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin.on("error", () => {}); // the child may exit before reading stdin
    child.stdin.end(input ?? "");
  });
}

export async function runOk(command, args, opts) {
  const r = await run(command, args, opts);
  if (r.code !== 0) {
    const msg = (r.stderr || r.stdout).trim().split("\n").slice(-5).join("\n");
    throw new Error(`${command} ${args[0] ?? ""} failed${r.timedOut ? " (timed out)" : ""}: ${msg}`);
  }
  return r.stdout;
}
