from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SelfHostedInfrastructureContracts(unittest.TestCase):
    def test_night_watch_is_evidence_bound_and_infomancer_specific(self):
        harness = (ROOT / ".nightwatch" / "night-watch.ps1").read_text(encoding="utf-8")
        workflow = (ROOT / ".github" / "workflows" / "night-watch.yml").read_text(encoding="utf-8")

        self.assertIn("InfoMancer | Night Watch", harness)
        self.assertIn("InfoMancer invariants:", harness)
        self.assertIn("merge-base", harness)
        self.assertIn("base_sha = $baseSha", harness)
        self.assertIn("head_sha = $headSha", harness)
        self.assertIn("[self-hosted, Windows, X64, infomancer-ci]", workflow)
        self.assertNotIn("MCR invariants:", harness)

    def test_self_hosted_packaging_is_preview_only_and_non_destructive(self):
        workflow = (
            ROOT / ".github" / "workflows" / "self-hosted-native-packaging.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("[self-hosted, Windows, X64, infomancer-ci]", workflow)
        self.assertIn("[self-hosted, Linux, X64, infomancer-ci]", workflow)
        self.assertGreaterEqual(workflow.count("release_eligible"), 2)
        self.assertIn("preview_only", workflow)
        self.assertIn("canonical_release_glibc_floor", workflow)
        self.assertNotIn("Start-Process -FilePath $installer", workflow)
        self.assertNotIn("uninstall.exe", workflow)


if __name__ == "__main__":
    unittest.main()
