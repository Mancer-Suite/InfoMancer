import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import app.main as main


class PasswordSessionRotationRouteTests(unittest.TestCase):
    def test_password_change_issues_fresh_session_cookie(self):
        user = SimpleNamespace(id=42)
        old_session = SimpleNamespace(id=7, csrf_token="old-csrf")
        fresh_session = SimpleNamespace(id=8, csrf_token="fresh-csrf")
        request = SimpleNamespace(
            state=SimpleNamespace(user=user, auth_session=old_session),
            headers={"host": "localhost", "user-agent": "rotation-test"},
            client=SimpleNamespace(host="127.0.0.1"),
            url=SimpleNamespace(scheme="http"),
        )
        fresh_session.user = user
        fake_auth = Mock()
        fake_auth.change_password.return_value = (
            "fresh-session-token", fresh_session
        )

        with (
            patch.object(main, "auth_service", fake_auth),
            patch.object(main, "record_security_event"),
        ):
            response = main.change_account_password(
                request,
                current_password="original long password",
                new_password="replacement long password",
                password_confirm="replacement long password",
            )

        fake_auth.change_password.assert_called_once_with(
            user.id,
            "original long password",
            "replacement long password",
            request=request,
        )
        fake_auth.create_session.assert_not_called()
        fake_auth.get_user.assert_not_called()
        fake_auth.revoke_user_sessions.assert_not_called()
        self.assertIs(request.state.auth_session, fresh_session)
        self.assertEqual(response.status_code, 303)
        cookie = response.headers.get("set-cookie", "")
        self.assertIn("infomancer_session=fresh-session-token", cookie)
        self.assertIn("HttpOnly", cookie)

    def test_audit_failure_does_not_block_rotated_cookie_delivery(self):
        user = SimpleNamespace(id=42)
        fresh_session = SimpleNamespace(
            id=8, csrf_token="fresh-csrf", user=user
        )
        request = SimpleNamespace(
            state=SimpleNamespace(
                user=user,
                auth_session=SimpleNamespace(id=7, csrf_token="old-csrf"),
            ),
            headers={"host": "localhost", "user-agent": "rotation-test"},
            client=SimpleNamespace(host="127.0.0.1"),
            url=SimpleNamespace(scheme="http"),
        )
        fake_auth = Mock()
        fake_auth.change_password.return_value = (
            "fresh-session-token", fresh_session
        )

        with (
            patch.object(main, "auth_service", fake_auth),
            patch.object(
                main,
                "record_security_event",
                side_effect=RuntimeError("audit backend unavailable"),
            ),
        ):
            response = main.change_account_password(
                request,
                current_password="original long password",
                new_password="replacement long password",
                password_confirm="replacement long password",
            )

        self.assertEqual(response.status_code, 303)
        self.assertIs(request.state.auth_session, fresh_session)
        self.assertIn(
            "infomancer_session=fresh-session-token",
            response.headers.get("set-cookie", ""),
        )


if __name__ == "__main__":
    unittest.main()
