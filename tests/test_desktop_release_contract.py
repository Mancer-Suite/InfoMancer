import json
import re
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
VERSION = re.search(
    r'^APP_VERSION\s*=\s*"([^"]+)"',
    (ROOT / "app" / "version.py").read_text(encoding="utf-8"),
    re.MULTILINE,
).group(1)


class DesktopReleaseContractTests(unittest.TestCase):
    def test_windows_launcher_uses_gui_subsystem(self):
        source = (ROOT / "desktop" / "src-tauri" / "src" / "main.rs").read_text(
            encoding="utf-8"
        )
        self.assertIn(
            '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]',
            source,
        )

    def test_windows_launcher_surfaces_and_logs_startup_failures(self):
        source = (ROOT / "desktop" / "src-tauri" / "src" / "main.rs").read_text(
            encoding="utf-8"
        )
        for expected in (
            "desktop-launcher.log",
            "install_panic_logger",
            "InfoMancer startup error",
            "Tauri startup failed",
            "Tauri application built successfully; entering the desktop event loop.",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, source)

    def test_preview_updater_plugin_configuration_deserializes(self):
        config = json.loads(
            (ROOT / "desktop" / "src-tauri" / "tauri.conf.json").read_text(
                encoding="utf-8"
            )
        )
        updater = config.get("plugins", {}).get("updater")
        self.assertIsInstance(updater, dict)
        self.assertIn("pubkey", updater)
        self.assertIsInstance(updater["pubkey"], str)
        self.assertEqual(updater["pubkey"], "")
        self.assertEqual(updater.get("endpoints"), [])

    def test_draft_windows_sidecar_is_built_without_console(self):
        workflow = (ROOT / ".github" / "workflows" / "draft-08-release.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("PyInstaller --noconfirm --onefile --noconsole", workflow)
        self.assertNotIn("PyInstaller --noconfirm --clean --onefile --noconsole", workflow)
        self.assertIn("Verify Windows launcher uses GUI subsystem", workflow)

    def test_draft_release_launches_installed_windows_app(self):
        workflow = (ROOT / ".github" / "workflows" / "draft-08-release.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("Smoke-test installed Windows desktop launch", workflow)
        self.assertIn("Start-Process -FilePath $launcher.FullName -PassThru", workflow)
        self.assertIn("desktop-launcher.log", workflow)
        self.assertIn(
            "Tauri application built successfully; entering the desktop event loop.",
            workflow,
        )

    def test_draft_release_uses_least_privilege_and_only_moves_draft_namespace_tags(self):
        workflow = (ROOT / ".github" / "workflows" / "draft-08-release.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("permissions:\n  actions: read\n  contents: read", workflow)
        self.assertIn("permissions:\n      actions: read\n      contents: write", workflow)
        self.assertIn("permissions:\n      issues: write", workflow)
        self.assertNotIn("permissions:\n  actions: read\n  contents: write", workflow)
        self.assertIn('TAG="draft-v$VERSION"', workflow)
        self.assertNotIn('TAG="v$VERSION"', workflow)
        self.assertIn('git/refs/tags/$TAG', workflow)
        self.assertIn('-f sha="$RELEASE_SHA"', workflow)
        self.assertIn("-F force=true", workflow)

    def test_standard_windows_release_ignores_prerelease_v_tags(self):
        workflow = (
            ROOT / ".github" / "workflows" / "windows-desktop-release.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("- 'v[0-9]+.[0-9]+.[0-9]+'", workflow)
        self.assertNotIn("- 'v*'", workflow)
        self.assertIn(
            "Windows Desktop Release publishes the Standard channel only",
            workflow,
        )

    def test_installation_guide_documents_current_native_packages(self):
        guide = (ROOT / "docs" / "INSTALLATION.md").read_text(encoding="utf-8")
        for expected in (
            f"InfoMancer-{VERSION}-Windows-x64-Setup.exe",
            f"InfoMancer-{VERSION}-macOS-Apple-Silicon.dmg",
            f"InfoMancer-{VERSION}-macOS-Intel.dmg",
            f"InfoMancer-{VERSION}-Linux-x86_64.deb",
            f"InfoMancer-{VERSION}-Linux-x86_64.AppImage",
            f"InfoMancer-Server-{VERSION}.zip",
            "Run on this computer",
            "Connect to a server",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, guide)
        self.assertNotIn("0.8.1-beta.1", guide)


if __name__ == "__main__":
    unittest.main()