#!/usr/bin/env python3
"""Restricted host-side release updater for InfoMancer.

The web application can only write a small request file. This separately-run
helper validates that request, verifies a trusted cryptographically signed
release tag, checks out its commit, rebuilds the configured Compose project,
verifies health, and rolls back on failure.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


TAG_PATTERN = re.compile(r"v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?")
FINGERPRINT_PATTERN = re.compile(r"^[0-9A-F]{40}$")


class UpdateError(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def run(command: list[str], cwd: Path) -> str:
    completed = subprocess.run(
        command, cwd=cwd, text=True, capture_output=True, check=False,
    )
    if completed.returncode:
        detail = (completed.stderr or completed.stdout).strip()
        raise UpdateError(detail or f"{command[0]} exited unsuccessfully.")
    return completed.stdout.strip()


def normalize_fingerprint(value: str) -> str:
    normalized = re.sub(r"[\s:]", "", value.strip()).upper()
    if normalized.startswith("0X"):
        normalized = normalized[2:]
    if not FINGERPRINT_PATTERN.fullmatch(normalized):
        raise UpdateError(
            "Trusted tag signer fingerprints must be complete 40-character "
            "GPG fingerprints."
        )
    return normalized


def trusted_signers_from_config(
    environment_value: str | None, cli_values: Iterable[str] | None,
) -> set[str]:
    values: list[str] = []
    if environment_value:
        values.extend(
            item for item in re.split(r"[,;\s]+", environment_value) if item
        )
    for value in cli_values or ():
        values.extend(item for item in re.split(r"[,;\s]+", value) if item)
    return {normalize_fingerprint(value) for value in values}


def annotated_tag_name(tag_object: str) -> str:
    """Return the single embedded tag name from an annotated tag header."""
    names: list[str] = []
    for line in tag_object.splitlines():
        if not line:
            break
        if line.startswith("tag "):
            names.append(line[4:])
    if len(names) != 1 or not names[0]:
        raise UpdateError(
            "The requested release tag object does not contain exactly one "
            "embedded tag name."
        )
    return names[0]


def _verify_tag_signature(
    repository: Path, tag_ref: str, trusted_signers: set[str],
) -> tuple[str, str]:
    if not trusted_signers:
        raise UpdateError(
            "No trusted release tag signer is configured. Set "
            "INFOMANCER_UPDATE_SIGNERS or use --trusted-tag-signer."
        )
    completed = subprocess.run(
        ["git", "verify-tag", "--raw", tag_ref],
        cwd=repository,
        text=True,
        capture_output=True,
        check=False,
    )
    verification_output = "\n".join(
        part for part in (completed.stdout, completed.stderr) if part
    )
    if completed.returncode:
        detail = verification_output.strip()
        raise UpdateError(
            "The requested release tag does not have a valid GPG signature"
            + (f": {detail}" if detail else ".")
        )

    valid_signatures: list[tuple[str, str | None]] = []
    for line in verification_output.splitlines():
        marker = "[GNUPG:] VALIDSIG "
        if not line.startswith(marker):
            continue
        fields = line[len(marker):].split()
        if not fields:
            continue
        signing_fingerprint = fields[0].upper()
        if not FINGERPRINT_PATTERN.fullmatch(signing_fingerprint):
            continue
        primary_fingerprint = None
        if len(fields) > 1 and FINGERPRINT_PATTERN.fullmatch(fields[-1].upper()):
            primary_fingerprint = fields[-1].upper()
        valid_signatures.append((signing_fingerprint, primary_fingerprint))

    if not valid_signatures:
        raise UpdateError(
            "Git accepted the release tag signature but did not report a "
            "VALIDSIG fingerprint."
        )

    for signing_fingerprint, primary_fingerprint in valid_signatures:
        candidates = [signing_fingerprint]
        if primary_fingerprint and primary_fingerprint != signing_fingerprint:
            candidates.append(primary_fingerprint)
        for candidate in candidates:
            if candidate in trusted_signers:
                return candidate, signing_fingerprint

    observed = sorted(
        {
            fingerprint
            for signing_fingerprint, primary_fingerprint in valid_signatures
            for fingerprint in (signing_fingerprint, primary_fingerprint)
            if fingerprint
        }
    )
    raise UpdateError(
        "The release tag has a valid GPG signature, but its signer is not "
        f"trusted. Observed fingerprint(s): {', '.join(observed)}"
    )


def verify_release_tag(
    repository: Path, tag: str, trusted_signers: set[str],
) -> tuple[str, str, str]:
    """Fetch and verify one exact annotated tag before resolving its commit."""
    if not trusted_signers:
        raise UpdateError(
            "No trusted release tag signer is configured. Set "
            "INFOMANCER_UPDATE_SIGNERS or use --trusted-tag-signer."
        )
    tag_ref = f"refs/tags/{tag}"
    run(
        [
            "git", "fetch", "--force", "--no-tags", "origin",
            f"+{tag_ref}:{tag_ref}",
        ],
        repository,
    )
    if run(["git", "cat-file", "-t", tag_ref], repository) != "tag":
        raise UpdateError(
            "The requested release uses a lightweight tag. Automatic updates "
            "require an annotated, GPG-signed tag."
        )
    tag_object = run(["git", "cat-file", "-p", tag_ref], repository)
    trusted_fingerprint, signing_fingerprint = _verify_tag_signature(
        repository, tag_ref, trusted_signers,
    )
    embedded_tag = annotated_tag_name(tag_object)
    if embedded_tag != tag:
        raise UpdateError(
            "The requested release tag ref does not match the signed tag "
            f"object name: requested {tag!r}, signed object names {embedded_tag!r}."
        )
    target_commit = run(
        ["git", "rev-parse", "--verify", f"{tag_ref}^{{commit}}"], repository,
    )
    return target_commit, trusted_fingerprint, signing_fingerprint


def compose_command(files: list[str]) -> list[str]:
    command = ["docker", "compose", "-p", "infomancer"]
    for value in files:
        command.extend(["-f", value])
    return command


def wait_for_health(url: str, seconds: int) -> None:
    deadline = time.monotonic() + seconds
    last_error = ""
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=4) as response:
                if response.status == 200:
                    return
                last_error = f"HTTP {response.status}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = str(exc)
        time.sleep(3)
    raise UpdateError(
        "The rebuilt application did not become healthy in time"
        + (f": {last_error}" if last_error else ".")
    )


def process_request(
    repository: Path, data_directory: Path, files: list[str],
    health_url: str, health_timeout: int, trusted_signers: set[str],
) -> bool:
    request_path = data_directory / "update-request.json"
    status_path = data_directory / "update-status.json"
    if not request_path.exists():
        return False
    try:
        request = json.loads(request_path.read_text(encoding="utf-8"))
        tag = str(request.get("tag", "")).strip()
        if not TAG_PATTERN.fullmatch(tag):
            raise UpdateError("The queued release tag is not valid.")
        if not (repository / ".git").exists() or not (repository / "compose.yaml").exists():
            raise UpdateError(
                "The updater is not pointed at an InfoMancer Git checkout."
            )
        for compose_file in files:
            if not (repository / compose_file).is_file():
                raise UpdateError(
                    f"The configured Compose file does not exist: {compose_file}"
                )

        write_json(status_path, {
            "status": "running", "latest_version": tag,
            "message": f"Verifying and updating InfoMancer to {tag}.",
            "started_at": utc_now(),
        })
        if run(["git", "status", "--porcelain", "--untracked-files=no"], repository):
            raise UpdateError(
                "The InfoMancer source has local edits. The updater stopped "
                "so those changes would not be overwritten."
            )
        previous_commit = run(["git", "rev-parse", "HEAD"], repository)
        target_commit, verified_signer, signing_key = verify_release_tag(
            repository, tag, trusted_signers,
        )
        write_json(status_path, {
            "status": "running", "latest_version": tag,
            "verified_commit": target_commit,
            "verified_signer": verified_signer,
            "verified_signing_key": signing_key,
            "message": f"Verified trusted release {tag}; rebuilding InfoMancer.",
            "started_at": utc_now(),
        })
        run(["git", "checkout", "--detach", target_commit], repository)
        compose = compose_command(files)
        try:
            run(compose + ["up", "-d", "--build", "--remove-orphans"], repository)
            wait_for_health(health_url, health_timeout)
        except Exception as update_exc:
            run(["git", "checkout", "--detach", previous_commit], repository)
            try:
                run(compose + ["up", "-d", "--build", "--remove-orphans"], repository)
                wait_for_health(health_url, health_timeout)
            except Exception as rollback_exc:
                raise UpdateError(
                    "The update failed and the previous release could not be "
                    f"started automatically. Update error: {update_exc}. "
                    f"Rollback error: {rollback_exc}"
                ) from rollback_exc
            write_json(status_path, {
                "status": "rolled_back", "latest_version": tag,
                "verified_commit": target_commit,
                "verified_signer": verified_signer,
                "verified_signing_key": signing_key,
                "message": (
                    "The update did not start correctly, so InfoMancer "
                    "returned to the previous release."
                ),
                "finished_at": utc_now(),
            })
            request_path.unlink(missing_ok=True)
            return True

        write_json(status_path, {
            "status": "success", "current_version": tag,
            "latest_version": tag,
            "verified_commit": target_commit,
            "verified_signer": verified_signer,
            "verified_signing_key": signing_key,
            "message": f"InfoMancer was updated successfully to {tag}.",
            "finished_at": utc_now(),
        })
        request_path.unlink(missing_ok=True)
        return True
    except (OSError, json.JSONDecodeError, UpdateError) as exc:
        write_json(status_path, {
            "status": "error",
            "message": (
                "The update could not be completed. The installed version "
                f"was left in place. Reason: {exc}"
            ),
            "finished_at": utc_now(),
        })
        request_path.unlink(missing_ok=True)
        return True


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="InfoMancer host updater")
    value.add_argument(
        "--repository", type=Path,
        default=Path(__file__).resolve().parent.parent,
    )
    value.add_argument("--data-directory", type=Path, default=Path("data"))
    value.add_argument("--compose-file", action="append", dest="compose_files")
    value.add_argument("--health-url", default="http://127.0.0.1:8787/health")
    value.add_argument("--health-timeout", type=int, default=120)
    value.add_argument(
        "--trusted-tag-signer", action="append", dest="trusted_tag_signers",
        help=(
            "Full 40-character GPG fingerprint allowed to sign automatic "
            "update tags. Repeat to trust more than one release key."
        ),
    )
    value.add_argument("--watch", action="store_true")
    value.add_argument("--poll-seconds", type=int, default=5)
    return value


def main() -> int:
    arguments = parser().parse_args()
    repository = arguments.repository.resolve()
    data_directory = arguments.data_directory
    if not data_directory.is_absolute():
        data_directory = repository / data_directory
    files = arguments.compose_files or ["compose.yaml"]
    try:
        trusted_signers = trusted_signers_from_config(
            os.environ.get("INFOMANCER_UPDATE_SIGNERS"),
            arguments.trusted_tag_signers,
        )
    except UpdateError as exc:
        print(f"InfoMancer updater configuration error: {exc}", file=sys.stderr)
        return 2
    while True:
        handled = process_request(
            repository, data_directory, files,
            arguments.health_url, max(15, arguments.health_timeout),
            trusted_signers,
        )
        if not arguments.watch:
            return 0
        time.sleep(max(2, arguments.poll_seconds))


if __name__ == "__main__":
    sys.exit(main())
