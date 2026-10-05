from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts import host_updater


TRUSTED = "A" * 40
OTHER = "B" * 40
SUBKEY = "C" * 40


class HostUpdaterTrustTests(unittest.TestCase):
    def test_normalize_fingerprint_accepts_full_colon_separated_value(self):
        value = ":".join(["aa"] * 20)
        self.assertEqual(host_updater.normalize_fingerprint(value), "AA" * 20)

    def test_normalize_fingerprint_rejects_short_key_id(self):
        with self.assertRaises(host_updater.UpdateError):
            host_updater.normalize_fingerprint("DEADBEEF")

    def test_trusted_signers_merge_environment_and_cli(self):
        signers = host_updater.trusted_signers_from_config(
            f"{TRUSTED.lower()},{OTHER}", [SUBKEY.lower()]
        )
        self.assertEqual(signers, {TRUSTED, OTHER, SUBKEY})

    @mock.patch("scripts.host_updater.run")
    def test_no_trusted_signer_fails_before_fetch(self, run):
        with self.assertRaisesRegex(host_updater.UpdateError, "No trusted"):
            host_updater.verify_release_tag(Path("/repo"), "v1.2.3", set())
        run.assert_not_called()

    @mock.patch("scripts.host_updater.subprocess.run")
    @mock.patch("scripts.host_updater.run")
    def test_lightweight_tag_is_rejected_before_signature_verification(
        self, run, subprocess_run
    ):
        run.side_effect = ["", "commit"]
        with self.assertRaisesRegex(host_updater.UpdateError, "lightweight"):
            host_updater.verify_release_tag(
                Path("/repo"), "v1.2.3", {TRUSTED}
            )
        subprocess_run.assert_not_called()
        self.assertNotIn(
            ["git", "rev-parse", "--verify", "refs/tags/v1.2.3^{commit}"],
            [call.args[0] for call in run.call_args_list],
        )

    @mock.patch("scripts.host_updater.subprocess.run")
    @mock.patch("scripts.host_updater.run")
    def test_valid_signature_from_wrong_key_is_rejected(self, run, subprocess_run):
        run.side_effect = ["", "tag"]
        subprocess_run.return_value = subprocess.CompletedProcess(
            ["git"], 0, "", f"[GNUPG:] VALIDSIG {OTHER} 2026-10-05 0 4 0 1 10 00 {OTHER}\n"
        )
        with self.assertRaisesRegex(host_updater.UpdateError, "not trusted"):
            host_updater.verify_release_tag(
                Path("/repo"), "v1.2.3", {TRUSTED}
            )
        self.assertNotIn(
            ["git", "rev-parse", "--verify", "refs/tags/v1.2.3^{commit}"],
            [call.args[0] for call in run.call_args_list],
        )

    @mock.patch("scripts.host_updater.subprocess.run")
    @mock.patch("scripts.host_updater.run")
    def test_trusted_signature_is_accepted(self, run, subprocess_run):
        run.side_effect = ["", "tag", "0123456789abcdef0123456789abcdef01234567"]
        subprocess_run.return_value = subprocess.CompletedProcess(
            ["git"], 0, "", f"[GNUPG:] VALIDSIG {TRUSTED} 2026-10-05 0 4 0 1 10 00 {TRUSTED}\n"
        )
        commit, signer, signing_key = host_updater.verify_release_tag(
            Path("/repo"), "v1.2.3", {TRUSTED}
        )
        self.assertEqual(commit, "0123456789abcdef0123456789abcdef01234567")
        self.assertEqual(signer, TRUSTED)
        self.assertEqual(signing_key, TRUSTED)

    @mock.patch("scripts.host_updater.subprocess.run")
    @mock.patch("scripts.host_updater.run")
    def test_primary_key_allowlist_accepts_signature_from_signing_subkey(
        self, run, subprocess_run
    ):
        run.side_effect = ["", "tag", "0123456789abcdef0123456789abcdef01234567"]
        subprocess_run.return_value = subprocess.CompletedProcess(
            ["git"], 0, "", f"[GNUPG:] VALIDSIG {SUBKEY} 2026-10-05 0 4 0 1 10 00 {TRUSTED}\n"
        )
        _, signer, signing_key = host_updater.verify_release_tag(
            Path("/repo"), "v1.2.3", {TRUSTED}
        )
        self.assertEqual(signer, TRUSTED)
        self.assertEqual(signing_key, SUBKEY)

    @mock.patch("scripts.host_updater.subprocess.run")
    @mock.patch("scripts.host_updater.run")
    def test_signature_verification_precedes_commit_resolution(
        self, run, subprocess_run
    ):
        events = []

        def run_side_effect(command, cwd):
            if command[:2] == ["git", "fetch"]:
                events.append("fetch")
                return ""
            if command[:3] == ["git", "cat-file", "-t"]:
                events.append("type")
                return "tag"
            if command[:3] == ["git", "rev-parse", "--verify"]:
                events.append("resolve")
                return "0123456789abcdef0123456789abcdef01234567"
            raise AssertionError(command)

        def subprocess_side_effect(*args, **kwargs):
            events.append("verify")
            return subprocess.CompletedProcess(
                ["git"], 0, "", f"[GNUPG:] VALIDSIG {TRUSTED} 2026-10-05 0 4 0 1 10 00 {TRUSTED}\n"
            )

        run.side_effect = run_side_effect
        subprocess_run.side_effect = subprocess_side_effect
        host_updater.verify_release_tag(Path("/repo"), "v1.2.3", {TRUSTED})
        self.assertLess(events.index("verify"), events.index("resolve"))

    @mock.patch("scripts.host_updater.verify_release_tag")
    @mock.patch("scripts.host_updater.run")
    def test_failed_trust_check_never_checks_out_target(self, run, verify):
        with tempfile.TemporaryDirectory() as temp:
            repository = Path(temp) / "repo"
            data_directory = Path(temp) / "data"
            (repository / ".git").mkdir(parents=True)
            (repository / "compose.yaml").write_text("services: {}\n", encoding="utf-8")
            data_directory.mkdir()
            (data_directory / "update-request.json").write_text(
                json.dumps({"tag": "v1.2.3"}), encoding="utf-8"
            )
            run.side_effect = ["", "0" * 40]
            verify.side_effect = host_updater.UpdateError("untrusted signer")

            handled = host_updater.process_request(
                repository, data_directory, ["compose.yaml"],
                "http://127.0.0.1:8787/health", 15, {TRUSTED},
            )

            self.assertTrue(handled)
            status = json.loads(
                (data_directory / "update-status.json").read_text(encoding="utf-8")
            )
            self.assertEqual(status["status"], "error")
            self.assertIn("untrusted signer", status["message"])
            self.assertFalse((data_directory / "update-request.json").exists())
            for call in run.call_args_list:
                self.assertNotEqual(call.args[0][:2], ["git", "checkout"])

    @mock.patch("scripts.host_updater.wait_for_health")
    @mock.patch("scripts.host_updater.verify_release_tag")
    @mock.patch("scripts.host_updater.run")
    def test_success_status_records_verified_commit_and_signer(
        self, run, verify, wait_for_health
    ):
        target = "1" * 40
        with tempfile.TemporaryDirectory() as temp:
            repository = Path(temp) / "repo"
            data_directory = Path(temp) / "data"
            (repository / ".git").mkdir(parents=True)
            (repository / "compose.yaml").write_text("services: {}\n", encoding="utf-8")
            data_directory.mkdir()
            (data_directory / "update-request.json").write_text(
                json.dumps({"tag": "v1.2.3"}), encoding="utf-8"
            )
            run.side_effect = ["", "0" * 40, "", ""]
            verify.return_value = (target, TRUSTED, SUBKEY)

            host_updater.process_request(
                repository, data_directory, ["compose.yaml"],
                "http://127.0.0.1:8787/health", 15, {TRUSTED},
            )

            status = json.loads(
                (data_directory / "update-status.json").read_text(encoding="utf-8")
            )
            self.assertEqual(status["status"], "success")
            self.assertEqual(status["verified_commit"], target)
            self.assertEqual(status["verified_signer"], TRUSTED)
            self.assertEqual(status["verified_signing_key"], SUBKEY)
            wait_for_health.assert_called_once()


if __name__ == "__main__":
    unittest.main()
