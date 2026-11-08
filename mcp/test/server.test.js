import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = join(dirname(fileURLToPath(import.meta.url)), "..", "server.js");

test("server lists its tools and judges over stdio", async () => {
  const home = await mkdtemp(join(tmpdir(), "rp-srv-"));
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath], env: { ...process.env, REVIEW_PANEL_HOME: home } }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["get_review", "list_judges", "list_repos", "list_reviews", "start_review"]);
    const judges = JSON.parse((await client.callTool({ name: "list_judges", arguments: {} })).content[0].text);
    assert.deepEqual(judges.map((j) => j.runs_on), ["claude", "gemini", "codex"]);
    const bad = await client.callTool({ name: "start_review", arguments: { repo: "not a repo" } });
    assert.equal(bad.isError, true);
  } finally {
    await client.close();
  }
});
