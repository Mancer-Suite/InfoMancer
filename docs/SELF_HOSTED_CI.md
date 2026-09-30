# Self-hosted CI, Night Watch, and native package previews

InfoMancer reuses the same local CI pattern as the MCR repositories while keeping product-specific review policy and release safety boundaries.

## Runner layout

The same physical Atlas and Windows machines may host additional GitHub runner services for InfoMancer. A GitHub runner registration belongs to one repository or organization scope, so the MCR runner services are not assumed to be visible to this personal repository.

InfoMancer workflows expect:

- Windows: `[self-hosted, Windows, X64, infomancer-ci]`
- Linux: `[self-hosted, Linux, X64, infomancer-ci]`

Use separate runner work directories and service names when registering InfoMancer on machines that already host MCR runners.

## InfoMancer | Night Watch

The `night-watch` control branch carries:

- `.github/workflows/night-watch.yml`
- `.nightwatch/night-watch.ps1`
- `.nightwatch/request.json`

Changing `.nightwatch/request.json` on that branch dispatches the local Windows/Ollama review. The harness resolves the requested base and target to exact commits, records the merge base, performs a file-by-file defensive pass, runs a cross-file critic pass, and uploads:

- `NIGHT_WATCH_REVIEW.md`
- `night-watch-findings.json`
- `night-watch-metadata.json`

The model is a critic only. It does not commit, merge, rename media, alter the database, or publish release status.

## Self-hosted native package previews

`.github/workflows/self-hosted-native-packaging.yml` creates unsigned preview artifacts using the same InfoMancer Tauri/PyInstaller package path as the canonical release workflow.

The Windows self-hosted job intentionally does not install or uninstall the generated NSIS package. Running InfoMancer's destructive uninstall smoke test on a personal workstation could remove a real local installation or application data. The canonical release workflow keeps that clean-machine smoke test.

Atlas currently has a newer Linux userspace than the canonical Ubuntu 22.04/glibc 2.35 build floor. Linux self-hosted artifacts are therefore marked preview-only and carry `package-provenance.json` with their observed glibc baseline. They must not replace the canonical Ubuntu 22.04 release artifacts.

## Release boundary

The existing release workflow remains authoritative for publishable artifacts, compatibility-floor qualification, updater signing, release assembly, and clean-machine destructive installer tests. Self-hosted package outputs are development previews even when their build succeeds.
