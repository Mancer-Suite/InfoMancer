# Updating InfoMancer

InfoMancer can check GitHub releases without additional setup. Installing a
server release from the web interface is optional and uses a separate,
restricted host helper. The web application never receives Docker or Git
control.

Automatic server updates fail closed unless the requested release tag is an
annotated Git tag with a valid GPG signature from an explicitly trusted release
key. Desktop Tauri updater signatures and Git tag signatures are separate trust
systems; configuring one does not configure the other.

## Release signing trust

The updater requires one or more complete 40-character GPG fingerprints. Do
not configure short key IDs. Trusted signers can be supplied with either:

- `INFOMANCER_UPDATE_SIGNERS`, using comma, semicolon, or whitespace-separated
  fingerprints; and/or
- repeated `--trusted-tag-signer <fingerprint>` arguments.

The public key for every configured signer must also be imported into the GPG
keyring used by the operating-system account that runs the updater. A
fingerprint is an allowlist entry, not the public key itself.

For example, on Linux:

```sh
sudo install -d -m 0750 -o infomancer -g infomancer /etc/infomancer
sudoedit /etc/infomancer/updater.env
```

Set the environment file to a complete fingerprint:

```text
INFOMANCER_UPDATE_SIGNERS=0123456789ABCDEF0123456789ABCDEF01234567
```

Then import the corresponding public release key into the `infomancer` service
account's GPG keyring and confirm that the full fingerprint matches what you
configured:

```sh
sudo -u infomancer gpg --import /path/to/infomancer-release-public-key.asc
sudo -u infomancer gpg --fingerprint --with-subkey-fingerprint
```

If a dedicated signing subkey is used, the updater accepts a valid signature
when either the actual signing-key fingerprint or its primary-key fingerprint
is on the allowlist.

## What the host updater verifies

For each queued update, the helper:

1. validates the requested release-tag format;
2. refuses to update a checkout with local source edits;
3. requires at least one trusted full GPG fingerprint;
4. fetches exactly the requested tag from `origin` without fetching unrelated
   tags;
5. requires the fetched ref to point to an annotated tag object;
6. runs `git verify-tag --raw` and requires a `VALIDSIG` from an allowlisted
   signing or primary-key fingerprint;
7. only after successful signature verification resolves the tag to its commit;
8. records the verified commit and signer in updater status;
9. checks out that commit, rebuilds the existing Compose project, and checks
   `/health`; and
10. returns to the previous commit if the rebuilt release does not become
    healthy.

A missing allowlist, lightweight tag, bad signature, unknown signing key, or
other trust failure stops before checkout, so the running installation remains
on its current commit.

## Creating server releases

Server releases must start from an annotated GPG-signed tag. Do not rely on
`gh release create` to create the tag implicitly.

Create and verify the tag locally first:

```sh
git switch main
git pull --ff-only
git tag -s v0.9.0-beta.1 -m "InfoMancer v0.9.0-beta.1"
git verify-tag --raw v0.9.0-beta.1
git push origin refs/tags/v0.9.0-beta.1
```

Then use the **Publish Signed Server Release** GitHub Actions workflow with
that exact tag. The workflow refuses lightweight or invalidly signed tags and
requires the signing fingerprint to match the repository variable
`INFOMANCER_UPDATE_SIGNERS`. It imports trusted release public keys from the
Actions secret `INFOMANCER_RELEASE_GPG_PUBLIC_KEYS`, builds the server release
archive from the verified tag commit, and creates the GitHub release only after
those checks pass.

`INFOMANCER_RELEASE_GPG_PUBLIC_KEYS` may contain one or more ASCII-armored
public keys. It contains public key material, but storing it as an Actions
secret prevents accidental log disclosure and keeps the workflow configuration
simple.

## Manual updates

Manual server updates should use the same trust check rather than checking out
an unverified tag directly. From the InfoMancer checkout:

```sh
export INFOMANCER_UPDATE_SIGNERS=0123456789ABCDEF0123456789ABCDEF01234567
python3 scripts/host_updater.py --compose-file compose.yaml --compose-file compose.media.yaml
```

Normally the web application creates `data/update-request.json` before the
helper runs. For a fully manual deployment, verify the signed tag with
`git verify-tag --raw <tag>` and confirm the signer fingerprint against your
allowlist before checking it out.

Create or download a database backup from **Settings > System** first.

## Enable updates from the interface on Linux

1. Copy `deploy/infomancer-updater.service.example` to
   `/etc/systemd/system/infomancer-updater.service`.
2. Create `/etc/infomancer/updater.env` with `INFOMANCER_UPDATE_SIGNERS` set to
   one or more trusted full fingerprints.
3. Import the matching release public key or keys into the updater service
   account's GPG keyring.
4. Edit `User`, `WorkingDirectory`, `ExecStart`, and the repeated
   `--compose-file` values to match the installation.
5. The service user must be able to run Docker and read/write the InfoMancer
   checkout.
6. Start the helper:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now infomancer-updater
```

## Windows and macOS

The same Python helper is cross-platform and can be run by Task Scheduler,
launchd, or manually. Configure the trusted signer environment variable and
make the trusted public key available to GPG for the account running it:

```text
set INFOMANCER_UPDATE_SIGNERS=0123456789ABCDEF0123456789ABCDEF01234567
python scripts/host_updater.py --watch --compose-file compose.yaml --compose-file compose.media.yaml
```

Keep it running under a dedicated operating-system account with access only to
the InfoMancer checkout, Docker, and the GPG keyring containing the trusted
release public key.
