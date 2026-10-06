import importlib.util
import json
from pathlib import Path
import re
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
SEMVER = re.compile(
    r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)


def load_build_release():
    path = ROOT / "scripts" / "build_release.py"
    spec = importlib.util.spec_from_file_location("build_release_version_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class VersionConsistencyTests(unittest.TestCase):
    def test_canonical_version_is_valid_and_used_by_server_release_builder(self):
        self.assertRegex(VERSION, SEMVER)
        self.assertEqual(load_build_release().application_version(), VERSION)

    def test_runtime_reads_canonical_version_instead_of_embedding_a_literal(self):
        source = (ROOT / "app" / "main.py").read_text(encoding="utf-8")
        self.assertIn("from .version import APP_VERSION", source)
        self.assertNotRegex(source, r'^APP_VERSION\s*=\s*"[^"]+"')

    def test_desktop_packaging_versions_match_canonical_version(self):
        sidecar = (ROOT / "desktop" / "sidecar.py").read_text(encoding="utf-8")
        self.assertIn(f'DESKTOP_VERSION = "{VERSION}"', sidecar)

        tauri = json.loads(
            (ROOT / "desktop" / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8")
        )
        package = json.loads(
            (ROOT / "desktop" / "package.json").read_text(encoding="utf-8")
        )
        package_lock = json.loads(
            (ROOT / "desktop" / "package-lock.json").read_text(encoding="utf-8")
        )
        cargo = tomllib.loads(
            (ROOT / "desktop" / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")
        )
        cargo_lock = tomllib.loads(
            (ROOT / "desktop" / "src-tauri" / "Cargo.lock").read_text(encoding="utf-8")
        )
        root_package = next(
            item for item in cargo_lock["package"] if item.get("name") == "infomancer-desktop"
        )

        self.assertEqual(tauri["version"], VERSION)
        self.assertEqual(package["version"], VERSION)
        self.assertEqual(package_lock["version"], VERSION)
        self.assertEqual(package_lock["packages"][""]["version"], VERSION)
        self.assertEqual(cargo["package"]["version"], VERSION)
        self.assertEqual(root_package["version"], VERSION)

    def test_server_runtime_image_and_package_include_version_file(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        builder = (ROOT / "scripts" / "build_release.py").read_text(encoding="utf-8")
        self.assertIn("COPY --chown=infomancer:infomancer VERSION VERSION", dockerfile)
        self.assertIn('"VERSION",', builder)

    def test_current_user_facing_release_docs_match_canonical_version(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        installation = (ROOT / "docs" / "INSTALLATION.md").read_text(encoding="utf-8")
        self.assertIn(f"InfoMancer-Server-{VERSION}.zip", readme)
        self.assertIn(f"InfoMancer-Server-{VERSION}.zip", installation)
        self.assertIn(f"InfoMancer-{VERSION}-Windows-x64-Setup.exe", readme)
        self.assertIn(f"InfoMancer-{VERSION}-Windows-x64-Setup.exe", installation)

    def test_release_workflows_use_canonical_version_path(self):
        server = (ROOT / ".github" / "workflows" / "server-release.yml").read_text(
            encoding="utf-8"
        )
        draft = (ROOT / ".github" / "workflows" / "draft-08-release.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("from scripts.build_release import application_version", server)
        self.assertIn("python scripts/stamp_build_version.py", draft)
        self.assertNotIn("APP_VERSION", draft)


if __name__ == "__main__":
    unittest.main()
