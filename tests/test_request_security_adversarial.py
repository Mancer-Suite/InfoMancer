from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from starlette.requests import Request
from starlette.responses import Response

import app.main as app_main
from app.auth import request_ip, secure_cookie_for
from app.request_security import (
    MISSING_CSRF_TOKEN,
    RequestBodyTooLarge,
    browser_request_is_same_origin,
    csrf_submission,
    host_is_allowed,
    LOCAL_CSRF_COOKIE,
)


def make_request(
    *,
    method: str = "GET",
    scheme: str = "http",
    host: str = "localhost",
    origin: str = "",
    headers: dict[str, str] | None = None,
    body_chunks: list[bytes] | None = None,
    client_host: str = "127.0.0.1",
) -> tuple[Request, dict[str, int]]:
    supplied = {"host": host, **(headers or {})}
    if origin:
        supplied["origin"] = origin
    encoded_headers = [
        (key.casefold().encode("latin-1"), value.encode("latin-1"))
        for key, value in supplied.items()
    ]
    chunks = list(body_chunks or [])
    calls = {"receive": 0}

    async def receive():
        calls["receive"] += 1
        if chunks:
            chunk = chunks.pop(0)
            return {
                "type": "http.request",
                "body": chunk,
                "more_body": bool(chunks),
            }
        return {"type": "http.request", "body": b"", "more_body": False}

    request = Request({
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": scheme,
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": encoded_headers,
        "client": (client_host, 43210),
        "server": ("127.0.0.1", 8787),
        "state": {},
    }, receive)
    return request, calls


def settings(**overrides):
    values = {
        "auth_mode": "disabled",
        "trusted_hosts": (),
        "public_url": "",
        "cookie_secure": "auto",
        "trust_cloudflare_proxy": False,
        "trusted_proxy_cidrs": (),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class HostAndOriginAdversarialTests(unittest.TestCase):
    def test_host_allowlist_rejects_userinfo_and_path_shaped_authorities(self):
        for hostile in (
            "attacker.example@localhost",
            "localhost/attacker",
            "localhost?attacker",
            "localhost#attacker",
            "local host",
        ):
            with self.subTest(host=hostile):
                request, _ = make_request(host=hostile)
                self.assertFalse(host_is_allowed(request, settings()))
        request, _ = make_request(host="localhost:8787")
        self.assertTrue(host_is_allowed(request, settings()))

    def test_origin_rejects_generic_url_syntax_not_valid_for_origin_header(self):
        configured = settings(public_url="http://localhost")
        for hostile in (
            "http://attacker.example@localhost",
            "http://localhost/path",
            "http://localhost?query=1",
            "http://localhost#fragment",
        ):
            with self.subTest(origin=hostile):
                request, _ = make_request(host="localhost", origin=hostile)
                self.assertFalse(browser_request_is_same_origin(request, configured))

    def test_untrusted_cloudflare_headers_do_not_spoof_ip_or_https(self):
        request, _ = make_request(
            host="media.example.test",
            headers={
                "cf-connecting-ip": "203.0.113.44",
                "x-forwarded-proto": "https",
            },
            client_host="10.0.0.25",
        )
        configured = settings(auth_mode="local")
        self.assertEqual(request_ip(request, configured), "10.0.0.25")
        self.assertFalse(secure_cookie_for(request, configured))

    def test_proxy_trust_flag_without_peer_allowlist_still_ignores_headers(self):
        request, _ = make_request(
            host="media.example.test",
            headers={
                "cf-connecting-ip": "203.0.113.44",
                "x-forwarded-proto": "https",
            },
            client_host="10.0.0.25",
        )
        configured = settings(auth_mode="local", trust_cloudflare_proxy=True)
        self.assertEqual(request_ip(request, configured), "10.0.0.25")
        self.assertFalse(secure_cookie_for(request, configured))

    def test_explicit_private_cloudflare_proxy_trust_uses_forwarded_metadata(self):
        request, _ = make_request(
            host="media.example.test",
            headers={
                "cf-connecting-ip": "203.0.113.44",
                "x-forwarded-proto": "https",
            },
            client_host="10.0.0.25",
        )
        configured = settings(
            auth_mode="local",
            trust_cloudflare_proxy=True,
            trusted_proxy_cidrs=("10.0.0.25/32",),
        )
        self.assertEqual(request_ip(request, configured), "203.0.113.44")
        self.assertTrue(secure_cookie_for(request, configured))

    def test_proxy_allowlist_does_not_trust_out_of_range_peer(self):
        request, _ = make_request(
            headers={"cf-connecting-ip": "203.0.113.44"},
            client_host="10.0.0.26",
        )
        configured = settings(
            auth_mode="local",
            trust_cloudflare_proxy=True,
            trusted_proxy_cidrs=("10.0.0.25/32",),
        )
        self.assertEqual(request_ip(request, configured), "10.0.0.26")


class RequestParserAdversarialTests(unittest.IsolatedAsyncioTestCase):
    async def test_streamed_urlencoded_body_is_bounded_without_content_length(self):
        request, _ = make_request(
            method="POST",
            headers={"content-type": "application/x-www-form-urlencoded"},
            body_chunks=[b"csrf_", b"token=1234"],
        )
        with self.assertRaises(RequestBodyTooLarge):
            await csrf_submission(request, max_urlencoded_body=8)

    async def test_field_flood_fails_closed_instead_of_crashing(self):
        body = "&".join(f"f{index}=x" for index in range(1001)).encode("ascii")
        request, _ = make_request(
            method="POST",
            headers={
                "content-type": "application/x-www-form-urlencoded",
                "content-length": str(len(body)),
            },
            body_chunks=[body],
        )
        token, replay = await csrf_submission(request)
        self.assertEqual(token, MISSING_CSRF_TOKEN)
        self.assertEqual(replay, body)

    async def test_missing_multipart_csrf_does_not_consume_upload_body(self):
        request, calls = make_request(
            method="POST",
            headers={
                "content-type": "multipart/form-data; boundary=test",
                "content-length": str(512 * 1024 * 1024),
            },
            body_chunks=[b"large-upload-placeholder"],
        )
        token, replay = await csrf_submission(request)
        self.assertEqual(token, MISSING_CSRF_TOKEN)
        self.assertIsNone(replay)
        self.assertEqual(calls["receive"], 0)

    async def test_valid_multipart_header_allows_streaming_without_prefetch(self):
        request, calls = make_request(
            method="POST",
            headers={
                "content-type": "multipart/form-data; boundary=test",
                "content-length": str(512 * 1024 * 1024),
                "x-csrf-token": "valid-session-token",
            },
            body_chunks=[b"chunk-one", b"chunk-two"],
        )
        token, replay = await csrf_submission(request)
        self.assertEqual(token, "valid-session-token")
        self.assertIsNone(replay)
        self.assertEqual(calls["receive"], 0)
        first = await request.receive()
        self.assertEqual(first["body"], b"chunk-one")
        self.assertEqual(calls["receive"], 1)

class MultipartMiddlewareIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def _assert_tokenless_multipart_is_blocked_before_body_read(
        self, *, auth_mode: str,
    ):
        headers = {
            "content-type": "multipart/form-data; boundary=test",
            "content-length": str(512 * 1024 * 1024),
        }
        fake_auth = Mock()
        configured = settings(auth_mode=auth_mode)
        if auth_mode == "disabled":
            headers["cookie"] = f"{LOCAL_CSRF_COOKIE}=known-local-csrf"
        else:
            headers["cookie"] = "infomancer_session=existing-session"
            user = SimpleNamespace(id=42, force_password_change=False)
            fake_auth.user_count.return_value = 1
            fake_auth.session_from_token.return_value = SimpleNamespace(
                id=7, user=user, csrf_token="expected-session-csrf"
            )

        request, calls = make_request(
            method="POST",
            headers=headers,
            body_chunks=[b"first-upload-chunk", b"second-upload-chunk"],
        )
        request.scope["path"] = "/multipart-integration-test"
        request.scope["raw_path"] = b"/multipart-integration-test"
        downstream = {"calls": 0}

        async def call_next(_request):
            downstream["calls"] += 1
            await _request.body()
            return Response("downstream reached", status_code=200)

        def simple_auth_error(_request, status, _title, _detail):
            return Response("blocked", status_code=status, media_type="text/plain")

        with (
            patch.object(app_main, "settings", configured),
            patch.object(app_main, "auth_service", fake_auth),
            patch.object(app_main, "auth_error_response", simple_auth_error),
        ):
            response = await app_main.authentication_middleware(request, call_next)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(calls["receive"], 0)
        self.assertEqual(downstream["calls"], 0)

    async def test_disabled_auth_blocks_tokenless_multipart_before_streaming(self):
        await self._assert_tokenless_multipart_is_blocked_before_body_read(
            auth_mode="disabled"
        )

    async def test_local_auth_blocks_tokenless_multipart_before_streaming(self):
        await self._assert_tokenless_multipart_is_blocked_before_body_read(
            auth_mode="local"
        )


if __name__ == "__main__":
    unittest.main()
