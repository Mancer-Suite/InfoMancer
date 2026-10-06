from __future__ import annotations

import re


APP_VERSION = "0.9.0-alpha.1"
VERSION_PATTERN = re.compile(
    r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)

if not VERSION_PATTERN.fullmatch(APP_VERSION):
    raise RuntimeError("APP_VERSION does not contain a valid semantic version.")


def application_version() -> str:
    return APP_VERSION
