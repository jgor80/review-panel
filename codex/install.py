#!/usr/bin/env python3
"""Install the standalone Codex skill; Python standard library only."""

import argparse
from pathlib import Path
import shutil
import sys
import tempfile


SOURCE = Path(__file__).resolve().parent / "skills" / "engineering-review"


def install(destination, replace=False):
    """Refuse existing differing installs unless replacement is explicitly requested."""
    destination = Path(destination).expanduser().absolute()
    # Do not follow a user-controlled symlink when replacing a skill tree.
    if any(path.is_symlink() for path in (destination, *destination.parents)):
        raise ValueError("destination and its parents must not be symlinks")
    if destination == SOURCE or SOURCE in destination.parents or destination in SOURCE.parents:
        raise ValueError("destination must not overlap the source package")
    if destination.exists():
        if not destination.is_dir():
            raise ValueError("destination exists and is not a directory")
        source_files = {p.relative_to(SOURCE): p.read_bytes()
                        for p in SOURCE.rglob("*") if p.is_file()}
        target_files = {p.relative_to(destination): p.read_bytes()
                        for p in destination.rglob("*") if p.is_file() and not p.is_symlink()}
        if any(p.is_symlink() for p in destination.rglob("*")):
            raise ValueError("existing installation contains symlinks")
        if source_files == target_files:
            return f"Already installed: {destination}"
        if not replace:
            raise ValueError("destination differs; inspect it, then use --replace to replace only this skill")
        # A sibling staging directory is complete before the existing skill moves.
    destination.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".engineering-review-", dir=destination.parent))
    backup = stage / "previous"
    completed = False
    try:
        shutil.copytree(SOURCE, stage / "new")
        if destination.exists():
            destination.rename(backup)
        try:
            (stage / "new").rename(destination)
            completed = True
        except OSError:
            if backup.exists():
                backup.rename(destination)
            raise
    finally:
        # If restoration itself failed, preserve the old skill for recovery.
        if completed or not backup.exists():
            shutil.rmtree(stage)
    return f"Installed: {destination}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    targets = parser.add_mutually_exclusive_group(required=True)
    targets.add_argument("--user", action="store_true", help="install in ~/.agents/skills for all local repos")
    targets.add_argument("--repo", type=Path, help="install in REPO/.agents/skills")
    targets.add_argument("--destination", type=Path, help="exact skill directory for a custom installation")
    parser.add_argument("--replace", action="store_true", help="replace an existing differing skill, including local edits")
    args = parser.parse_args()
    if args.user:
        destination = Path.home() / ".agents" / "skills" / "engineering-review"
    elif args.repo:
        repo = args.repo.expanduser().resolve()
        if not repo.is_dir() or not (repo / ".git").exists():
            parser.error("--repo must name an existing Git checkout")
        destination = repo / ".agents" / "skills" / "engineering-review"
    else:
        destination = args.destination
    try:
        print(install(destination, args.replace))
    except (OSError, ValueError) as error:
        print(f"Installation failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
