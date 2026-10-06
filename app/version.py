from __future__ import annotations

import re
from pathlib import Path


VERSION_FILE = Path(__file__).resolve().parent.parent / "VERSION"
VERSION_PATTERN = re.compile(
    r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)


def application_version() -> str:
    version = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not VERSION_PATTERN.fullmatch(version):
        raise RuntimeError("VERSION does not contain a valid semantic version.")
    return version


APP_VERSION = application_version()
