from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MultipartCsrfClientContractTests(unittest.TestCase):
    def test_upload_helper_uses_header_csrf_without_parsing_upload_body(self):
        script = (ROOT / "app" / "static" / "multipart-submit.js").read_text(
            encoding="utf-8"
        )
        self.assertIn('headers: {"X-CSRF-Token": csrfToken}', script)
        self.assertIn("document.body?.dataset.csrfToken", script)
        self.assertNotIn("csrf_token", script.split("new FormData(form)", 1)[1])

    def test_missing_client_token_blocks_native_multipart_submission(self):
        script = (ROOT / "app" / "static" / "multipart-submit.js").read_text(
            encoding="utf-8"
        )
        missing = script.index("if (!csrfToken)")
        prevent = script.index("event.preventDefault();", missing)
        form_data = script.index("new FormData(form)")
        self.assertLess(missing, prevent)
        self.assertLess(prevent, form_data)

    def test_base_template_exposes_page_csrf_token_for_all_upload_forms(self):
        base = (ROOT / "app" / "templates" / "base.html").read_text(
            encoding="utf-8"
        )
        self.assertIn('data-csrf-token="{{ csrf_token }}"', base)
        settings = (ROOT / "app" / "templates" / "settings.html").read_text(
            encoding="utf-8"
        )
        self.assertIn('enctype="multipart/form-data"', settings)


if __name__ == "__main__":
    unittest.main()
