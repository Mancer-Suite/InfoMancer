# Moving InfoMancer to GitHub

## Recommended first step: a private repository

A private GitHub repository is the best fit while filesystem operations and
remote access are still being hardened. It provides history, off-machine code
backup, issues, and automated tests without publishing the project. Private
does not make committed secrets safe: environment files, tunnel tokens, API
keys, and the SQLite database must remain untracked.

Before the first push:

1. Install Git for Windows and optionally the GitHub CLI (`gh`).
2. Run the test suite.
3. Review `git status` and the staged diff carefully.
4. Verify that `.env`, `.env.cloudflare`, `tvdb.env`, and `data/` are absent.
5. Verify that `compose.atlas.yaml`, `dist/`, and generated archives are absent.

If this folder is not already a Git repository:

```powershell
git init
git add .
git status
git diff --cached
git commit -m "Initial InfoMancer release"
```

With GitHub CLI:

```powershell
gh auth login
gh repo create infomancer --private --source=. --remote=origin --push
```

## Create a signed Server release

The release builder uses an explicit allowlist. It does not include local
environment files, databases, media, `compose.atlas.yaml`, Cloudflare
credentials, or generated deployment archives.

```powershell
.\.venv\Scripts\python.exe scripts\build_release.py
```

On macOS or Linux:

```bash
python3 scripts/build_release.py
```

Server releases must use an existing annotated GPG-signed Git tag. Do not let
`gh release create` create the tag implicitly.

For the 0.9 integration line, create the signed tag from a qualified commit on
`testing/0.9-alpha`:

```powershell
git switch testing/0.9-alpha
git pull --ff-only
git tag -s v0.9.0-beta.1 -m "InfoMancer v0.9.0-beta.1"
git verify-tag --raw v0.9.0-beta.1
git push origin refs/tags/v0.9.0-beta.1
```

Then run the **Publish Signed Server Release** workflow with that exact tag.
The workflow requires:

- repository variable `INFOMANCER_UPDATE_SIGNERS` containing one or more full
  trusted OpenPGP fingerprints; and
- Actions secret `INFOMANCER_RELEASE_GPG_PUBLIC_KEYS` containing the matching
  ASCII-armored public key or keys.

The workflow rejects lightweight tags, invalid signatures, untrusted signers,
signed-tag aliases, commits not reachable from `testing/0.9-alpha`, tags that
do not match `APP_VERSION`, and an already-existing GitHub release. It builds
`InfoMancer-Server-VERSION.zip` plus `SHA256SUMS.txt` only after verification.

See `docs/UPDATES_ADVANCED.md` for updater-side trust configuration. Desktop
Tauri updater signing is separate from Server Git-tag signing.
## Later options

- **Keep it private:** simplest for a personal administration tool.
- **Publish it:** perform a privacy/security review, choose a license, replace
  home-specific examples, and create contribution/security policies first.
- **Deploy from GitHub:** add a self-hosted runner or a server pull/deploy
  script only after repository access and secret handling are settled. Do not
  expose Docker control or media credentials to pull requests.

No license is added yet. If the repository becomes public, common choices are
MIT (permissive and short), Apache-2.0 (permissive with an explicit patent
grant), or GPL-3.0 (derivatives distributed under the same license).

The included GitHub Actions workflow installs dependencies, runs the unit
tests, and compiles the application on pushes and pull requests. It does not
need or receive TVDB, IMDb, Cloudflare, or filesystem secrets.
