import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "promote.py"
spec = importlib.util.spec_from_file_location("promotion", MODULE)
promotion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(promotion)

class PromotionTest(unittest.TestCase):
    def command(self, cwd, *args):
        return subprocess.check_output(["git", "-C", str(cwd), *args], text=True, stderr=subprocess.DEVNULL).strip()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.remote, self.author, self.runner = (root / p for p in ("remote.git", "author", "runner"))
        subprocess.run(["git", "init", "--bare", str(self.remote)], check=True, capture_output=True)
        subprocess.run(["git", "clone", str(self.remote), str(self.author)], check=True, capture_output=True)
        self.command(self.author, "config", "user.email", "test@example.com")
        self.command(self.author, "config", "user.name", "Test")
        self.command(self.author, "checkout", "-b", "main")
        overlay = self.author / "gitops/behavior/kustomization.yaml"
        overlay.parent.mkdir(parents=True)
        overlay.write_text("images:\n" + "".join(
            f'  - name: ghcr.io/monoji77/behavior-{s}\n    newTag: "initial"\n'
            for s in ("ingestion-api", "stream-processor", "analytics-api", "dashboard")))
        self.command(self.author, "add", ".")
        self.command(self.author, "commit", "-m", "Initial")
        self.initial = self.command(self.author, "rev-parse", "HEAD")
        self.command(self.author, "push", "origin", "main", "HEAD:refs/heads/deploy/homelab")
        self.source = self.advance_main()
        subprocess.run(["git", "clone", "--branch", "main", str(self.remote), str(self.runner)], check=True, capture_output=True)
        self.previous_cwd = Path.cwd()
        os.chdir(self.runner)

    def tearDown(self):
        os.chdir(self.previous_cwd)
        self.temp.cleanup()

    def advance_main(self):
        path = self.author / "source.txt"
        path.write_text(path.read_text() + "change\n" if path.exists() else "change\n")
        self.command(self.author, "add", ".")
        self.command(self.author, "commit", "-m", "Source change")
        self.command(self.author, "push", "origin", "main")
        return self.command(self.author, "rev-parse", "HEAD")

    def deployment(self):
        return self.command(self.remote, "rev-parse", "deploy/homelab")

    def test_promotes_exact_source_and_is_idempotent(self):
        promotion.promote(self.source)
        deployed = self.deployment()
        self.assertNotEqual(deployed, self.initial)
        self.assertEqual(self.command(self.remote, "rev-parse", deployed + "^"), self.initial)
        overlay = self.command(self.remote, "show", "deploy/homelab:gitops/behavior/kustomization.yaml")
        self.assertEqual(overlay.count(self.source), 4)
        self.assertEqual(self.command(self.remote, "show", "deploy/homelab:source.txt"), "change")
        self.assertEqual(self.command(self.remote, "rev-parse", "main"), self.source)
        promotion.promote(self.source)
        self.assertEqual(self.deployment(), deployed)

    def test_skips_already_superseded_build(self):
        self.advance_main()
        promotion.promote(self.source)
        self.assertEqual(self.deployment(), self.initial)

    def test_skips_new_source_arriving_during_preparation(self):
        original = promotion.refresh
        calls = 0
        def refresh():
            nonlocal calls
            calls += 1
            if calls == 2:
                self.advance_main()
            original()
        with patch.object(promotion, "refresh", refresh):
            promotion.promote(self.source)
        self.assertEqual(self.deployment(), self.initial)

    def conflict(self, newer_source=False):
        original = promotion.git
        collided = False
        competing = None
        def git(*args, **kwargs):
            nonlocal collided, competing
            if args[0] == "push" and not collided:
                collided = True
                tree = self.command(self.remote, "rev-parse", "deploy/homelab^{tree}")
                competing = self.command(self.author, "commit-tree", tree, "-p", self.initial, "-m", "Concurrent promotion")
                self.command(self.author, "push", "origin", competing + ":refs/heads/deploy/homelab")
                if newer_source:
                    self.advance_main()
            return original(*args, **kwargs)
        with patch.object(promotion, "git", git):
            promotion.promote(self.source)
        return competing

    def test_retries_non_fast_forward_on_latest_deployment_parent(self):
        competing = self.conflict()
        self.assertEqual(self.command(self.remote, "rev-parse", "deploy/homelab^"), competing)

    def test_conflict_retry_rechecks_source_freshness(self):
        competing = self.conflict(newer_source=True)
        self.assertEqual(self.deployment(), competing)

    def test_accepts_reordered_keys_and_different_yaml_indentation(self):
        overlay = self.author / "gitops/behavior/kustomization.yaml"
        overlay.write_text("images:\n" + "".join(
            f'    - newTag: initial\n      name: ghcr.io/monoji77/behavior-{s}\n'
            for s in ("ingestion-api", "stream-processor", "analytics-api", "dashboard")))
        source = self.advance_main()
        promotion.promote(source)
        result = self.command(self.remote, "show", "deploy/homelab:gitops/behavior/kustomization.yaml")
        self.assertEqual(result.count(source), 4)

    def test_rejects_invalid_sha(self):
        with self.assertRaises(ValueError):
            promotion.promote("main")

if __name__ == "__main__":
    unittest.main()
