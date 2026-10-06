from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import host_updater
from scripts.host_updater import UpdateError, verify_release_tag


TRUSTED = "A" * 40
OTHER = "B" * 40
SUBKEY = "C" * 40


def tag_object(name: str) -> str:
    return (
        "object " + "1" * 40 + "\n"
        "type commit\n"
        f"tag {name}\n"
        "tagger InfoMancer Release <release@example.invalid> 0 +0000\n"
        "\n"
        "release\n"
        "-----BEGIN PGP SIGNATURE-----\n"
        "test\n"
        "-----END PGP SIGNATURE-----\n"
    )


class HostUpdaterTests(unittest.TestCase):
    def test_unsigned_tag_is_rejected(self):
        completed = subprocess.CompletedProcess(["git"], 1, "", "bad signature")
        with tempfile.TemporaryDirectory() as temporary, patch(
            "scripts.host_updater.subprocess.run", return_value=completed
        ):
            with self.assertRaises(UpdateError):
                verify_release_tag("refs/test/tag", Path(temporary), {TRUSTED})

    def test_valid_signature_without_trusted_fingerprint_is_rejected(self):
        completed = subprocess.CompletedProcess(
            ["git"], 0, "",
            f"[GNUPG:] VALIDSIG {TRUSTED} 2026-01-01 0 4 0 1 10 00 {TRUSTED}",
        )
        with tempfile.TemporaryDirectory() as temporary, patch(
            "scripts.host_updater.subprocess.run", return_value=completed
        ):
            with self.assertRaises(UpdateError):
                verify_release_tag("refs/test/tag", Path(temporary))

    def test_trusted_signature_fingerprint_is_enforced(self):
        completed = subprocess.CompletedProcess(
            ["git"], 0, "",
            f"[GNUPG:] VALIDSIG {TRUSTED} 2026-01-01 0 4 0 1 10 00 {TRUSTED}",
        )
        with tempfile.TemporaryDirectory() as temporary, patch(
            "scripts.host_updater.subprocess.run", return_value=completed
        ):
            signer, signing_key = verify_release_tag(
                "refs/test/tag", Path(temporary), {TRUSTED}
            )
            self.assertEqual(signer, TRUSTED)
            self.assertEqual(signing_key, TRUSTED)
            with self.assertRaises(UpdateError):
                verify_release_tag(
                    "refs/test/tag", Path(temporary), {OTHER}
                )

    def test_primary_fingerprint_is_accepted_when_signing_subkey_was_used(self):
        completed = subprocess.CompletedProcess(
            ["git"], 0, "",
            f"[GNUPG:] VALIDSIG {SUBKEY} 2026-01-01 0 4 0 1 10 00 {TRUSTED}",
        )
        with tempfile.TemporaryDirectory() as temporary, patch(
            "scripts.host_updater.subprocess.run", return_value=completed
        ):
            signer, signing_key = verify_release_tag(
                "refs/test/tag", Path(temporary), {TRUSTED}
            )
            self.assertEqual(signer, TRUSTED)
            self.assertEqual(signing_key, SUBKEY)

    def test_success_without_parseable_validsig_fails_closed(self):
        completed = subprocess.CompletedProcess(
            ["git"], 0, "", "signature accepted"
        )
        with tempfile.TemporaryDirectory() as temporary, patch(
            "scripts.host_updater.subprocess.run", return_value=completed
        ):
            with self.assertRaises(UpdateError):
                verify_release_tag(
                    "refs/test/tag", Path(temporary), {TRUSTED}
                )

    def test_short_key_id_is_rejected(self):
        with self.assertRaises(UpdateError):
            host_updater.normalize_fingerprint("DEADBEEF")

    def test_environment_and_cli_signers_are_combined(self):
        signers = host_updater.trusted_signers_from_config(
            f"{TRUSTED.lower()},{OTHER}", [SUBKEY.lower()]
        )
        self.assertEqual(signers, {TRUSTED, OTHER, SUBKEY})

    def test_annotated_tag_name_reads_only_header(self):
        value = tag_object("v1.2.3") + "\ntag misleading-message-text\n"
        self.assertEqual(host_updater.annotated_tag_name(value), "v1.2.3")

    @patch("scripts.host_updater.subprocess.run")
    @patch("scripts.host_updater.run")
    def test_lightweight_tag_is_rejected_before_signature_verification(
        self, run, subprocess_run
    ):
        run.side_effect = ["", "commit"]
        with self.assertRaisesRegex(UpdateError, "lightweight"):
            host_updater.fetch_and_verify_release_tag(
                "v1.2.3", Path("/repo"), {TRUSTED}
            )
        verify_calls = [
            call for call in subprocess_run.call_args_list
            if call.args and call.args[0][:2] == ["git", "verify-tag"]
        ]
        self.assertEqual(verify_calls, [])

    @patch("scripts.host_updater.subprocess.run")
    @patch("scripts.host_updater.run")
    def test_exact_requested_tag_is_fetched_into_isolated_ref(
        self, run, subprocess_run
    ):
        target = "1" * 40
        run.side_effect = ["", "tag", tag_object("v1.2.3"), target]
        subprocess_run.return_value = subprocess.CompletedProcess(
            ["git"], 0, "",
            f"[GNUPG:] VALIDSIG {TRUSTED} 2026-01-01 0 4 0 1 10 00 {TRUSTED}",
        )

        commit, signer, signing_key = host_updater.fetch_and_verify_release_tag(
            "v1.2.3", Path("/repo"), {TRUSTED}
        )

        self.assertEqual(commit, target)
        self.assertEqual(signer, TRUSTED)
        self.assertEqual(signing_key, TRUSTED)
        fetch = run.call_args_list[0].args[0]
        self.assertEqual(fetch[:5], ["git", "fetch", "--force", "--no-tags", "origin"])
        self.assertEqual(
            fetch[5],
            "+refs/tags/v1.2.3:refs/infomancer/update-candidates/v1.2.3",
        )

    @patch("scripts.host_updater.subprocess.run")
    @patch("scripts.host_updater.run")
    def test_signed_tag_alias_is_rejected_before_commit_resolution(
        self, run, subprocess_run
    ):
        run.side_effect = ["", "tag", tag_object("v1.2.2")]
        subprocess_run.return_value = subprocess.CompletedProcess(
            ["git"], 0, "",
            f"[GNUPG:] VALIDSIG {TRUSTED} 2026-01-01 0 4 0 1 10 00 {TRUSTED}",
        )

        with self.assertRaisesRegex(UpdateError, "does not match"):
            host_updater.fetch_and_verify_release_tag(
                "v1.2.3", Path("/repo"), {TRUSTED}
            )

        self.assertFalse(
            any(
                call.args[0][:3] == ["git", "rev-parse", "--verify"]
                for call in run.call_args_list
            )
        )

    @patch("scripts.host_updater.subprocess.run")
    @patch("scripts.host_updater.run")
    def test_signature_verification_precedes_commit_resolution(
        self, run, subprocess_run
    ):
        events: list[str] = []

        def run_side_effect(command, cwd):
            if command[:2] == ["git", "fetch"]:
                events.append("fetch")
                return ""
            if command[:3] == ["git", "cat-file", "-t"]:
                events.append("type")
                return "tag"
            if command[:3] == ["git", "cat-file", "-p"]:
                events.append("tag-object")
                return tag_object("v1.2.3")
            if command[:3] == ["git", "rev-parse", "--verify"]:
                events.append("resolve")
                return "1" * 40
            raise AssertionError(command)

        def subprocess_side_effect(command, **kwargs):
            if command[:2] == ["git", "verify-tag"]:
                events.append("verify")
                return subprocess.CompletedProcess(
                    command, 0, "",
                    f"[GNUPG:] VALIDSIG {TRUSTED} 2026-01-01 0 4 0 1 10 00 {TRUSTED}",
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        run.side_effect = run_side_effect
        subprocess_run.side_effect = subprocess_side_effect

        host_updater.fetch_and_verify_release_tag(
            "v1.2.3", Path("/repo"), {TRUSTED}
        )
        self.assertLess(events.index("verify"), events.index("resolve"))


if __name__ == "__main__":
    unittest.main()
