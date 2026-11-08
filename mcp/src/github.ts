// The few GitHub REST calls the MCP server needs: start the on-demand workflow, find its run,
// read the report artifact, list repos.
import { strFromU8, unzipSync } from "fflate";

export interface PanelConfig {
  token: string;
  panelRepo: string; // owner/name of the repo that holds review-on-demand.yml
  workflowFile: string;
  workflowRef: string;
  fetch?: typeof fetch;
}

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ReviewRun {
  run_id: number;
  review_id: string;
  title: string;
  status: string; // queued | in_progress | completed | …
  conclusion: string | null;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewReport {
  verdict: string;
  summary: string;
  report: string;
  ledger_rows: string;
  result: Record<string, unknown> | null;
}

// Runs are titled "review <review_id> · …" by the workflow's run-name.
export const reviewIdFromTitle = (title: string): string | null => {
  const m = /^review (\S+) /.exec(title || "");
  return m ? m[1] : null;
};

export class GitHub {
  private cfg: PanelConfig;
  constructor(cfg: PanelConfig) {
    this.cfg = cfg;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const f = this.cfg.fetch ?? fetch;
    const res = await f(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "review-panel-mcp",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { message?: string }).message || "";
      } catch {
        /* not JSON */
      }
      throw new GitHubError(`GitHub ${init.method || "GET"} ${path.split("?")[0]} failed (${res.status})${detail ? `: ${detail}` : ""}`, res.status);
    }
    return res;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    return (await (await this.call(path, init)).json()) as T;
  }

  async repo(fullName: string): Promise<{ full_name: string; default_branch: string; private: boolean }> {
    return this.json(`/repos/${fullName}`);
  }

  async dispatch(inputs: Record<string, string>): Promise<void> {
    const { panelRepo, workflowFile, workflowRef } = this.cfg;
    await this.call(`/repos/${panelRepo}/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: workflowRef, inputs }),
    });
  }

  async runs(perPage = 30): Promise<ReviewRun[]> {
    const { panelRepo, workflowFile } = this.cfg;
    const data = await this.json<{ workflow_runs: Array<Record<string, any>> }>(
      `/repos/${panelRepo}/actions/workflows/${workflowFile}/runs?per_page=${perPage}&event=workflow_dispatch`,
    );
    return (data.workflow_runs || []).map(toRun);
  }

  async run(runId: number): Promise<ReviewRun> {
    return toRun(await this.json(`/repos/${this.cfg.panelRepo}/actions/runs/${runId}`));
  }

  async findRun(reviewId: string): Promise<ReviewRun | null> {
    if (/^\d+$/.test(reviewId)) return this.run(Number(reviewId));
    return (await this.runs(100)).find((r) => r.review_id === reviewId) ?? null;
  }

  async cancel(runId: number): Promise<void> {
    await this.call(`/repos/${this.cfg.panelRepo}/actions/runs/${runId}/cancel`, { method: "POST" });
  }

  async report(runId: number): Promise<ReviewReport | null> {
    const list = await this.json<{ artifacts: Array<{ id: number; name: string; expired: boolean }> }>(
      `/repos/${this.cfg.panelRepo}/actions/runs/${runId}/artifacts`,
    );
    const art = list.artifacts.find((a) => a.name === "review-panel-report" && !a.expired);
    if (!art) return null;
    // GitHub answers with a redirect to a short-lived signed URL. Follow it by hand so the
    // GitHub token is never sent to the storage host.
    const f = this.cfg.fetch ?? fetch;
    const first = await f(`https://api.github.com/repos/${this.cfg.panelRepo}/actions/artifacts/${art.id}/zip`, {
      redirect: "manual",
      headers: { Authorization: `Bearer ${this.cfg.token}`, Accept: "application/vnd.github+json", "User-Agent": "review-panel-mcp" },
    });
    const location = first.headers.get("location");
    const res = first.status >= 300 && first.status < 400 && location ? await f(location) : first;
    if (!res.ok) throw new GitHubError(`Couldn't download the report (${res.status})`, res.status);
    return parseReportZip(new Uint8Array(await res.arrayBuffer()));
  }

  async listRepos(): Promise<Array<{ full_name: string; private: boolean; pushed_at: string; description: string | null }>> {
    const out: Array<Record<string, any>> = [];
    for (let page = 1; page <= 3; page++) {
      const batch = await this.json<Array<Record<string, any>>>(`/user/repos?per_page=100&sort=pushed&page=${page}`);
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out.map((r) => ({ full_name: r.full_name, private: r.private, pushed_at: r.pushed_at, description: r.description }));
  }
}

function toRun(r: Record<string, any>): ReviewRun {
  const title = String(r.display_title || r.name || "");
  return {
    run_id: r.id,
    review_id: reviewIdFromTitle(title) || String(r.id),
    title,
    status: r.status,
    conclusion: r.conclusion ?? null,
    url: r.html_url,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function parseReportZip(zip: Uint8Array): ReviewReport {
  const files = unzipSync(zip);
  const text = (name: string) => {
    // upload-artifact keeps paths relative to the uploaded folder; match by file name to be safe.
    const key = Object.keys(files).find((k) => k === name || k.endsWith(`/${name}`));
    return key ? strFromU8(files[key]) : "";
  };
  let result: Record<string, unknown> | null = null;
  try {
    result = JSON.parse(text("result.json") || "null");
  } catch {
    result = null;
  }
  return {
    verdict: (text("verdict.txt").trim() || String(result?.verdict || "") || "ERROR").toUpperCase(),
    summary: text("summary.md"),
    report: text("report.md"),
    ledger_rows: text("ledger-rows.md"),
    result,
  };
}
