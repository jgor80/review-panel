#!/usr/bin/env python3
"""Run a read-only Codex engineering review without installing the skill."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys


def build_prompt(mode, base=None):
    skill = Path(__file__).resolve().parent / "skills" / "engineering-review"
    sections = ["Use the following engineering review procedure and references. "
                "Review only; do not edit application files, commit, push or post remote comments."]
    references = sorted(p for p in skill.glob("*.md") if p.name != "SKILL.md")
    for path in [skill / "SKILL.md", *references, *sorted((skill / "judges").glob("*.md"))]:
        sections.append(f"\n--- {path.relative_to(skill)} ---\n{path.read_text()}")
    sections.append(f"\nRequested mode: {mode}")
    if base is not None:
        sections.append(f"Review base commit (resolved by launcher): {base}")
    return "\n".join(sections)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--mode", choices=("review", "audit", "gate"), default="review")
    parser.add_argument("--base", help="Git revision for diff mode; resolved locally to a commit")
    parser.add_argument("--output", type=Path, help="save report to a new file (never overwrite)")
    parser.add_argument("--dry-run", action="store_true", help="show invocation without making model calls")
    args = parser.parse_args()
    repo = args.repo.expanduser().resolve()
    try:
        result = subprocess.run(["git", "-C", str(repo), "rev-parse", "--show-toplevel"],
                                check=True, capture_output=True, text=True)
        if Path(result.stdout.strip()).resolve() != repo:
            parser.error("--repo must be the Git checkout root")
        base = None
        if args.base:
            if args.mode != "review":
                parser.error("--base is only valid in review mode")
            base = subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify",
                                   "--end-of-options", args.base + "^{commit}"],
                                  check=True, capture_output=True, text=True).stdout.strip()
        output = args.output.expanduser().absolute() if args.output else None
        if output and (output.exists() or output.is_symlink()):
            parser.error("--output must name a new file")
        command = ["codex", "exec", "--sandbox", "read-only", "-C", str(repo), "-"]
        prompt = build_prompt(args.mode, base)
        if args.dry_run:
            print(json.dumps({"command": command, "base": base, "mode": args.mode,
                              "output": str(output) if output else None, "prompt": prompt}, indent=2))
            return 0
        if not shutil.which("codex"):
            parser.error("Codex CLI is not installed or is not on PATH")
        # Reserve the requested output exclusively before starting a paid run.
        # stdout contains the final response in text mode; progress goes to stderr.
        stream = output.open("x") if output else None
        try:
            result = subprocess.run(command, input=prompt, text=True, stdout=stream)
        finally:
            if stream:
                stream.close()
        return result.returncode
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Review failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
