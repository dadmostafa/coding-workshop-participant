"""Integration tests for deployed team-service API endpoints.

Run with:
    RUN_INTEGRATION=1 API_BASE_URL=https://d3njdoiji9c3r2.cloudfront.net pytest test_integration_api.py -v
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

import pytest

DEFAULT_BASE_URL = "https://d3njdoiji9c3r2.cloudfront.net"
API_PREFIX = "/api/team-service"


def _integration_enabled() -> bool:
    return os.getenv("RUN_INTEGRATION", "0") == "1"


def _service_url(path: str) -> str:
    base = os.getenv("API_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{base}{API_PREFIX}{normalized_path}"


def _request_json(
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> tuple[int, Any]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url=_service_url(path),
        data=body,
        method=method,
        headers=headers,
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            content = response.read().decode("utf-8")
            return response.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8")
        parsed = json.loads(error_body) if error_body else {}
        return exc.code, parsed


@pytest.mark.integration
@pytest.mark.skipif(not _integration_enabled(), reason="Set RUN_INTEGRATION=1 to execute API integration tests")
def test_health_endpoint() -> None:
    status, body = _request_json("GET", "/")

    assert status == 200
    assert isinstance(body, dict)
    assert body.get("status") == "ok"


@pytest.mark.integration
@pytest.mark.skipif(not _integration_enabled(), reason="Set RUN_INTEGRATION=1 to execute API integration tests")
def test_login_then_fetch_projects() -> None:
    username = os.getenv("INTEGRATION_USERNAME", "admin")
    password = os.getenv("INTEGRATION_PASSWORD", "admin123")

    login_status, login_body = _request_json(
        "POST",
        "/auth/login",
        payload={"username": username, "password": password},
    )

    assert login_status == 200
    assert isinstance(login_body, dict)

    token = login_body.get("access_token") or login_body.get("token")
    assert token, "Expected access token in login response"

    projects_status, projects_body = _request_json("GET", "/projects", token=token)

    assert projects_status == 200
    assert isinstance(projects_body, list)


@pytest.mark.integration
@pytest.mark.skipif(not _integration_enabled(), reason="Set RUN_INTEGRATION=1 to execute API integration tests")
def test_invalid_team_id_returns_400() -> None:
    username = os.getenv("INTEGRATION_USERNAME", "admin")
    password = os.getenv("INTEGRATION_PASSWORD", "admin123")

    login_status, login_body = _request_json(
        "POST",
        "/auth/login",
        payload={"username": username, "password": password},
    )

    assert login_status == 200

    token = login_body.get("access_token") or login_body.get("token")
    assert token

    status, body = _request_json("GET", "/teams/not-an-id", token=token)

    assert status == 400
    assert isinstance(body, dict)
    assert "error" in body
