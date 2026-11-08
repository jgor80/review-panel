// Stands in for claude/gemini/codex: reads the prompt on stdin and prints a review.
let input = "";
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", () => {
  const score = process.argv[2] || "7";
  if (score === "fail") { console.error("boom"); process.exit(3); }
  const sawBrief = input.includes("# Review brief") && input.includes("README");
  console.log(`## Summary\nFake judge read the brief: ${sawBrief}. cwd has README: ${require_exists()}\n\n## Findings\nNone\n\nSCORE: ${score}\nVERDICT: ${Number(score) >= 9 ? "SHIP" : "FIX_FIRST"}`);
});
import { existsSync } from "node:fs";
function require_exists() { return existsSync("README.md"); }
