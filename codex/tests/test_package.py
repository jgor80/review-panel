import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("installer", ROOT / "install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTests(unittest.TestCase):
    def test_failed_replacement_restores_previous_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "engineering-review"
            installer.install(target)
            (target / "local.md").write_text("preserve on failure")
            original_rename = Path.rename

            def fail_activation(path, destination):
                if path.name == "new":
                    raise OSError("simulated activation failure")
                return original_rename(path, destination)

            with mock.patch.object(Path, "rename", fail_activation):
                with self.assertRaises(OSError):
                    installer.install(target, replace=True)
            self.assertEqual((target / "local.md").read_text(), "preserve on failure")
            self.assertTrue((target / "SKILL.md").exists())

    def test_install_idempotency_and_explicit_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "skills" / "engineering-review"
            installer.install(target)
            self.assertTrue((target / "SKILL.md").is_file())
            self.assertIn("Already installed", installer.install(target))
            (target / "local.md").write_text("local changes")
            with self.assertRaises(ValueError):
                installer.install(target)
            self.assertEqual((target / "local.md").read_text(), "local changes")
            installer.install(target, replace=True)
            self.assertFalse((target / "local.md").exists())

    def test_symlink_and_source_protection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "real").mkdir()
            (root / "link").symlink_to(root / "real", target_is_directory=True)
            with self.assertRaises(ValueError):
                installer.install(root / "link" / "skill", replace=True)
            with self.assertRaises(ValueError):
                installer.install(installer.SOURCE, replace=True)
            target = root / "existing"
            target.mkdir()
            (target / "linked").symlink_to(root / "real", target_is_directory=True)
            with self.assertRaises(ValueError):
                installer.install(target, replace=True)


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo with spaces"
        self.repo.mkdir()
        subprocess.run(["git", "init", str(self.repo)], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(self.repo), "-c", "user.name=Test", "-c",
                        "user.email=test@example.com", "commit", "--allow-empty", "-m", "seed"],
                       check=True, capture_output=True)

    def run_launcher(self, *args, env=None):
        return subprocess.run([sys.executable, str(ROOT / "run.py"), "--repo", str(self.repo), *args],
                              capture_output=True, text=True, env=env)

    def test_dry_run_resolves_base_and_includes_specialists(self):
        result = self.run_launcher("--base", "HEAD", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(len(data["base"]), 40)
        self.assertIn("read-only", data["command"])
        self.assertIn("Performance and resource efficiency engineer", data["prompt"])
        self.assertIn("Principal engineer / final reviewer", data["prompt"])
        self.assertEqual(data["prompt"].count("name: engineering-review"), 1)

    def test_invalid_base_and_existing_output_are_rejected(self):
        self.assertNotEqual(self.run_launcher("--base=--help", "--dry-run").returncode, 0)
        output = self.repo / "report.md"
        output.write_text("preserve")
        result = self.run_launcher("--output", str(output), "--dry-run")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_text(), "preserve")

    def test_exec_receives_prompt_and_propagates_failure(self):
        binary = Path(self.temp.name) / "bin"
        binary.mkdir()
        fake = binary / "codex"
        fake.write_text("#!/usr/bin/env python3\nimport sys\nprompt=sys.stdin.read()\n"
                        "assert 'Security and privacy engineer' in prompt\n"
                        "assert sys.argv[1:4] == ['exec', '--sandbox', 'read-only']\n"
                        "print('review result')\nsys.exit(7)\n")
        fake.chmod(0o755)
        env = dict(os.environ, PATH=str(binary) + os.pathsep + os.environ.get("PATH", ""))
        output = self.repo / "new-report.md"
        result = self.run_launcher("--output", str(output), env=env)
        self.assertEqual(result.returncode, 7, result.stderr)
        self.assertEqual(output.read_text(), "review result\n")


if __name__ == "__main__":
    unittest.main()
