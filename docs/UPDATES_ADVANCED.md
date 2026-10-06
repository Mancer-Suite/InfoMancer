# Advanced Update Administration

This page is for operators and maintainers who intentionally run InfoMancer from a repository checkout or enable the restricted host updater.

Normal Desktop and packaged Server users should use **[Updating InfoMancer](UPDATES.md)** instead.

# Security model

The InfoMancer web application does not receive general Docker or Git control. Automated host updates use a separate, restricted helper running under an operating-system account with only the access it needs.

The host updater accepts only release tags whose signatures can be verified against an explicitly trusted full signing-key fingerprint. Desktop Tauri updater signatures and Server Git-tag signatures are separate trust systems.

# Release signing trust

The updater requires one or more complete OpenPGP fingerprints. Short key IDs are rejected.

Trusted signers can be supplied with either:

- the `INFOMANCER_UPDATE_SIGNERS` environment variable, using comma, semicolon, or whitespace-separated fingerprints; or
- repeated `--trusted-signing-key <fingerprint>` / `--trusted-tag-signer <fingerprint>` arguments.

A valid signature from another key in the service account's GPG keyring is not enough. The `VALIDSIG` fingerprint must match the explicit allowlist.

The release-signing public key must be imported into the GPG keyring used by the operating-system account that runs the updater. The private signing key should remain on a separate maintainer machine.

# What the host updater verifies

For every queued Server update, the helper:

1. validates the requested release-tag format;
2. refuses to update a checkout with local tracked source edits;
3. requires at least one trusted full fingerprint;
4. fetches exactly the requested remote tag into an isolated candidate ref;
5. requires that ref to point to an annotated tag object;
6. verifies the tag with `git verify-tag --raw`;
7. requires a `VALIDSIG` fingerprint from an allowlisted signing or primary key;
8. requires the signed tag object's embedded `tag` name to match the requested remote ref;
9. only then resolves the tag object to a commit;
10. if qualified release metadata names a commit, requires the signed tag to resolve to that same commit;
11. records the verified commit and signer in updater status/history;
12. checks out that exact commit, rebuilds the existing Compose project, and checks `/health`; and
13. returns to the previous commit if the rebuilt release does not become healthy.

A missing allowlist, lightweight tag, invalid signature, unknown signing key, signed-tag alias, or commit mismatch stops before checkout.

# Signed Server release tags

For the 0.9 integration line, release tags must be created from a qualified commit reachable from `testing/0.9-alpha`.

Do not rely on `gh release create` to create a tag implicitly. Create and verify an annotated signed tag first:

```bash
git switch testing/0.9-alpha
git pull --ff-only
git tag -s vX.Y.Z -m "InfoMancer X.Y.Z"
git verify-tag --raw vX.Y.Z
git push origin refs/tags/vX.Y.Z
```

Then use the **Publish Signed Server Release** GitHub Actions workflow with that exact tag. The workflow independently verifies:

- the tag is annotated;
- the signed object's embedded tag name matches the requested ref;
- the signature is valid;
- the signer is in repository variable `INFOMANCER_UPDATE_SIGNERS`;
- the tag commit is reachable from `testing/0.9-alpha`;
- the tag version matches `APP_VERSION` in the verified commit; and
- the GitHub release does not already exist.

The workflow also requires an active repository tag ruleset named **Protect release tags** with no bypass actors. It must include the exact pattern `refs/tags/v*`, have no exclusions, and restrict both updates and deletions while still allowing new tags to be created. Import the repository template at `deploy/protect-release-tags.ruleset.json` through **Settings > Rulesets > New ruleset > Import a ruleset** before publishing the first Server release.

Because GitHub's normal workflow token cannot see ruleset bypass actors, add Actions secret `INFOMANCER_RULESET_AUDIT_TOKEN` containing a fine-grained GitHub token scoped only to the InfoMancer repository with **Administration: Read-only** permission. The workflow rejects ruleset responses where the bypass list is hidden, rejects any nonempty bypass list, records the verified annotated-tag object ID, and reconfirms the remote ref still points to that same immutable object immediately before publication.

The workflow imports trusted public release keys from the Actions secret `INFOMANCER_RELEASE_GPG_PUBLIC_KEYS`. It never needs the private release-signing key.

# Manual repository update

For an installation intentionally deployed from a Git checkout, use the same trust boundary rather than checking out an unverified tag.

A maintainer can inspect a candidate manually with an isolated ref so an
older local tag can never be mistaken for the just-fetched remote object:

```bash
set -euo pipefail
release_tag=vX.Y.Z
candidate_ref="refs/infomancer/manual-candidates/$release_tag"
verification_file="$(mktemp)"
tag_object_file="$(mktemp)"
trap 'rm -f "$verification_file" "$tag_object_file"; git update-ref -d "$candidate_ref" >/dev/null 2>&1 || true' EXIT

: "${INFOMANCER_UPDATE_SIGNERS:?Set INFOMANCER_UPDATE_SIGNERS to the trusted full OpenPGP fingerprint(s)}"

git fetch --force --no-tags origin "+refs/tags/$release_tag:$candidate_ref"
[[ "$(git cat-file -t "$candidate_ref")" == "tag" ]]
git cat-file -p "$candidate_ref" >"$tag_object_file"
git verify-tag --raw "$candidate_ref" >"$verification_file" 2>&1

python3 - "$release_tag" "$tag_object_file" "$verification_file" "$INFOMANCER_UPDATE_SIGNERS" <<'PY'
import re
import sys

release_tag, tag_path, verification_path, configured = sys.argv[1:]
fingerprint = re.compile(r"^(?:[0-9A-F]{40}|[0-9A-F]{64})$")

def normalize(value: str) -> str:
    value = re.sub(r"[\s:]", "", value.strip()).upper()
    if value.startswith("0X"):
        value = value[2:]
    if not fingerprint.fullmatch(value):
        raise SystemExit(
            "INFOMANCER_UPDATE_SIGNERS must contain only complete "
            "40- or 64-character OpenPGP fingerprints."
        )
    return value

trusted = {
    normalize(value)
    for value in re.split(r"[,;\s]+", configured)
    if value.strip()
}
if not trusted:
    raise SystemExit("No trusted release-signing fingerprint is configured.")

names = []
with open(tag_path, encoding="utf-8") as stream:
    for raw_line in stream:
        line = raw_line.rstrip("\n")
        if not line:
            break
        if line.startswith("tag "):
            names.append(line[4:])
if names != [release_tag]:
    raise SystemExit(
        f"Signed tag object name mismatch: expected {release_tag!r}, observed {names!r}."
    )

observed = set()
with open(verification_path, encoding="utf-8") as stream:
    for line in stream:
        marker = "[GNUPG:] VALIDSIG "
        if marker not in line:
            continue
        fields = line.split(marker, 1)[1].split()
        if fields and fingerprint.fullmatch(fields[0].upper()):
            observed.add(fields[0].upper())
        if fields and fingerprint.fullmatch(fields[-1].upper()):
            observed.add(fields[-1].upper())

if observed.isdisjoint(trusted):
    raise SystemExit(
        "Valid signature was not made by an allowlisted InfoMancer release key. "
        f"Observed: {', '.join(sorted(observed)) or 'no VALIDSIG fingerprint'}"
    )
PY

candidate_commit="$(git rev-parse --verify "$candidate_ref^{commit}")"
git checkout --detach "$candidate_commit"
git update-ref -d "$candidate_ref"
rm -f "$verification_file" "$tag_object_file"
trap - EXIT

# Rebuild with the same Compose files/overrides used by this installation.
docker compose -p infomancer -f compose.yaml -f compose.atlas.yaml -f compose.cloudflare.yaml up -d --build --remove-orphans
curl -fsS http://127.0.0.1:8787/health
```

The block itself enforces the requested signed tag name and configured full
fingerprint allowlist before commit resolution or checkout. If your installation
uses different local Compose overrides, substitute those exact files in the
rebuild command.

Create a backup first and preserve the deployment's `.env`, local Compose override, and `data/` directory.

# Linux host updater service

An example systemd unit is provided at:

`deploy/infomancer-updater.service.example`

To use it:

1. Copy it to `/etc/systemd/system/infomancer-updater.service`.
2. Create `/etc/infomancer/updater.env`.
3. Put one or more trusted fingerprints in that file, for example:

```text
INFOMANCER_UPDATE_SIGNERS=0123456789ABCDEF0123456789ABCDEF01234567
```

4. Edit `User`, `WorkingDirectory`, `ExecStart`, and the repeated `--compose-file` values for the installation.
5. Import the matching release-signing public key into the GPG keyring of the service account and verify its fingerprint independently.
6. Make sure the service account can run Docker and read/write the InfoMancer checkout.
7. Start the helper:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now infomancer-updater
```

# Windows and macOS host helper

The same restricted Python helper can be run manually or by an operating-system scheduler:

```text
set INFOMANCER_UPDATE_SIGNERS=0123456789ABCDEF0123456789ABCDEF01234567
python scripts/host_updater.py --watch --compose-file compose.yaml --compose-file compose.media.yaml
```

Run it under a dedicated account with access only to the InfoMancer checkout, Docker, and the release-signing public key needed for verification.

# Native Desktop updater

Packaged Desktop builds use Tauri's signed updater rather than the Server host-update mechanism.

Updater signatures are mandatory when the update channel is configured:

- the public verification key is compiled into release builds through `TAURI_UPDATER_PUBLIC_KEY`
- the private signing key is supplied only to the release workflow through `TAURI_SIGNING_PRIVATE_KEY` and its optional password
- builds without a configured public verification key report the updater as unavailable instead of accepting unsigned updates

Before a replacement installer runs, the Desktop shell stops its bundled local core. The normal update path is designed to replace application binaries while preserving the user's InfoMancer application data.

# Operational cautions

- Back up a catalog before testing a beta update.
- Do not disable signature verification to make an update work.
- Do not give the web application direct Docker or Git credentials.
- Do not store the Server release-signing private key on the production Server host.
- Do not run the host updater with broader operating-system permissions than it needs.
- Do not treat an older binary as a safe rollback target for a database that was already migrated by a newer build. Use a pre-update database or Server-folder backup instead.
