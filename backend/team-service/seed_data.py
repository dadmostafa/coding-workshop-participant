#!/usr/bin/env python3
"""Seed script for ACME Team Management sample data.

Usage:
    python3 seed_data.py https://d3njdoiji9c3r2.cloudfront.net
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

DEFAULT_BASE = "http://localhost:3001/api/team-service"


BASE = (
    sys.argv[1].rstrip("/") + "/api/team-service"
    if len(sys.argv) > 1
    else DEFAULT_BASE
)


def req(
    method: str,
    path: str,
    data: dict[str, Any] | None = None,
    token: str | None = None,
) -> dict[str, Any] | list[dict[str, Any]] | None:
    """Send an HTTP request to the team-service API and decode JSON response."""
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode()
        print(f"  ERROR {exc.code}: {err_body[:200]}")
        return None


def main() -> int:
    """Populate teams, members, and achievements through the public API."""
    print("Seeding ACME Team Management...\n")

    print("-> Logging in as admin...")
    auth = req("POST", "/auth/login", {"username": "admin", "password": "admin123"})
    if not isinstance(auth, dict) or "token" not in auth:
        print("Login failed. Make sure the app is running.")
        return 1

    token = str(auth["token"])
    print("  OK logged in\n")

    teams_data = [
        {
            "name": "Platform Engineering",
            "department": "Technology",
            "location": "New York",
            "team_leader": "Sarah Chen",
            "leader_location": "New York",
            "org_leader": "CTO Office",
            "description": "Core platform infrastructure and developer tooling",
        },
        {
            "name": "Data Science",
            "department": "Analytics",
            "location": "San Francisco",
            "team_leader": "Marcus Webb",
            "leader_location": "San Francisco",
            "org_leader": "CDO Office",
            "description": "Machine learning models and data analytics",
        },
        {
            "name": "Product Design",
            "department": "Product",
            "location": "London",
            "team_leader": "Priya Sharma",
            "leader_location": "New York",
            "org_leader": "CPO Office",
            "description": "UX research, design systems, and user experience",
        },
        {
            "name": "Security Operations",
            "department": "Technology",
            "location": "Austin",
            "team_leader": "James Liu",
            "leader_location": "Austin",
            "org_leader": "CISO Office",
            "description": "Cybersecurity, threat detection, and compliance",
        },
        {
            "name": "Customer Success",
            "department": "Operations",
            "location": "Chicago",
            "team_leader": "Aisha Patel",
            "leader_location": "Chicago",
            "org_leader": "COO Office",
            "description": "Enterprise customer onboarding and support",
        },
    ]

    print("-> Creating teams...")
    team_ids: dict[str, str] = {}
    for team in teams_data:
        result = req("POST", "/teams", team, token)
        if isinstance(result, dict) and result.get("id"):
            team_ids[team["name"]] = str(result["id"])
            print(f"  OK {team['name']}")
        else:
            teams = req("GET", "/teams", token=token)
            if isinstance(teams, list):
                for existing in teams:
                    if existing.get("name") == team["name"] and existing.get("id"):
                        team_ids[team["name"]] = str(existing["id"])
                        print(f"  SKIP existing {team['name']}")
                        break

    print()

    members_data: dict[str, list[dict[str, Any]]] = {
        "Platform Engineering": [
            {
                "name": "Sarah Chen",
                "email": "schen@acme.com",
                "role": "Engineering Manager",
                "location": "New York",
                "employment_type": "direct",
                "is_team_leader": True,
            },
            {
                "name": "Alex Rodriguez",
                "email": "arodriguez@acme.com",
                "role": "Senior Engineer",
                "location": "New York",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Kim Park",
                "email": "kpark@acme.com",
                "role": "DevOps Engineer",
                "location": "Remote",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Tom Hayes",
                "email": "thayes@acme.com",
                "role": "Cloud Architect",
                "location": "New York",
                "employment_type": "non-direct",
                "is_team_leader": False,
            },
            {
                "name": "Nina Scott",
                "email": "nscott@acme.com",
                "role": "Backend Engineer",
                "location": "Boston",
                "employment_type": "direct",
                "is_team_leader": False,
            },
        ],
        "Data Science": [
            {
                "name": "Marcus Webb",
                "email": "mwebb@acme.com",
                "role": "Head of Data Science",
                "location": "San Francisco",
                "employment_type": "direct",
                "is_team_leader": True,
            },
            {
                "name": "Yuki Tanaka",
                "email": "ytanaka@acme.com",
                "role": "ML Engineer",
                "location": "San Francisco",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Carlos Mendez",
                "email": "cmendez@acme.com",
                "role": "Data Analyst",
                "location": "Remote",
                "employment_type": "non-direct",
                "is_team_leader": False,
            },
            {
                "name": "Fatima Al-Zahra",
                "email": "falzahra@acme.com",
                "role": "Research Scientist",
                "location": "San Francisco",
                "employment_type": "direct",
                "is_team_leader": False,
            },
        ],
        "Product Design": [
            {
                "name": "Priya Sharma",
                "email": "psharma@acme.com",
                "role": "Design Director",
                "location": "London",
                "employment_type": "direct",
                "is_team_leader": True,
            },
            {
                "name": "Luca Bianchi",
                "email": "lbianchi@acme.com",
                "role": "Senior UX Designer",
                "location": "London",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Emma Wilson",
                "email": "ewilson@acme.com",
                "role": "UX Researcher",
                "location": "Remote",
                "employment_type": "non-direct",
                "is_team_leader": False,
            },
            {
                "name": "David Kim",
                "email": "dkim@acme.com",
                "role": "Visual Designer",
                "location": "London",
                "employment_type": "direct",
                "is_team_leader": False,
            },
        ],
        "Security Operations": [
            {
                "name": "James Liu",
                "email": "jliu@acme.com",
                "role": "CISO",
                "location": "Austin",
                "employment_type": "direct",
                "is_team_leader": True,
            },
            {
                "name": "Maya Thompson",
                "email": "mthompson@acme.com",
                "role": "Security Analyst",
                "location": "Austin",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Ben Foster",
                "email": "bfoster@acme.com",
                "role": "Pen Tester",
                "location": "Remote",
                "employment_type": "non-direct",
                "is_team_leader": False,
            },
        ],
        "Customer Success": [
            {
                "name": "Aisha Patel",
                "email": "apatel@acme.com",
                "role": "VP Customer Success",
                "location": "Chicago",
                "employment_type": "direct",
                "is_team_leader": True,
            },
            {
                "name": "Ryan O'Brien",
                "email": "robrien@acme.com",
                "role": "Account Manager",
                "location": "Chicago",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Sophie Laurent",
                "email": "slaurent@acme.com",
                "role": "Support Engineer",
                "location": "Remote",
                "employment_type": "direct",
                "is_team_leader": False,
            },
            {
                "name": "Omar Hassan",
                "email": "ohassan@acme.com",
                "role": "Onboarding Specialist",
                "location": "Chicago",
                "employment_type": "non-direct",
                "is_team_leader": False,
            },
        ],
    }

    print("-> Creating members...")
    for team_name, members in members_data.items():
        team_id = team_ids.get(team_name)
        if not team_id:
            print(f"  SKIP {team_name}: team not found")
            continue

        for member in members:
            member_payload = {**member, "team_id": team_id}
            result = req("POST", "/members", member_payload, token)
            if isinstance(result, dict) and result.get("id"):
                print(f"  OK {member['name']} -> {team_name}")

    print()

    achievements_data = [
        {
            "team": "Platform Engineering",
            "title": "Kubernetes migration complete",
            "month": 1,
            "year": 2026,
            "impact": "Reduced infrastructure costs by 35%",
            "description": "Migrated all services to k8s",
        },
        {
            "team": "Platform Engineering",
            "title": "CI/CD pipeline overhaul",
            "month": 3,
            "year": 2026,
            "impact": "Deploy time reduced from 45min to 8min",
            "description": "New GitOps workflow",
        },
        {
            "team": "Platform Engineering",
            "title": "99.99% uptime achieved",
            "month": 5,
            "year": 2026,
            "impact": "$2M SLA penalties avoided",
            "description": "Q1 reliability milestone",
        },
        {
            "team": "Data Science",
            "title": "Fraud detection model v2 launch",
            "month": 2,
            "year": 2026,
            "impact": "Prevented $4.2M in fraud losses",
            "description": "New ML model with 94% accuracy",
        },
        {
            "team": "Data Science",
            "title": "Real-time analytics dashboard",
            "month": 4,
            "year": 2026,
            "impact": "Exec decision time reduced by 60%",
            "description": "Self-serve analytics platform",
        },
        {
            "team": "Product Design",
            "title": "Design system v3.0 release",
            "month": 1,
            "year": 2026,
            "impact": "Dev velocity up 40% across 6 teams",
            "description": "200+ reusable components",
        },
        {
            "team": "Product Design",
            "title": "Mobile app redesign",
            "month": 3,
            "year": 2026,
            "impact": "App Store rating 3.2 -> 4.7",
            "description": "Full UX overhaul",
        },
        {
            "team": "Security Operations",
            "title": "Zero critical vulnerabilities Q1",
            "month": 3,
            "year": 2026,
            "impact": "SOC2 Type II certification renewed",
            "description": "Quarterly security audit passed",
        },
        {
            "team": "Security Operations",
            "title": "Security training rollout",
            "month": 2,
            "year": 2026,
            "impact": "Phishing susceptibility down 78%",
            "description": "Company-wide security awareness",
        },
        {
            "team": "Customer Success",
            "title": "NPS score reached 72",
            "month": 4,
            "year": 2026,
            "impact": "Enterprise churn reduced to 2.1%",
            "description": "Record customer satisfaction",
        },
        {
            "team": "Customer Success",
            "title": "100 enterprise onboardings",
            "month": 5,
            "year": 2026,
            "impact": "$8M ARR milestone hit",
            "description": "Q1 onboarding target exceeded",
        },
        {
            "team": "Platform Engineering",
            "title": "Database performance boost",
            "month": 11,
            "year": 2025,
            "impact": "Query times improved by 70%",
            "description": "Index optimization project",
        },
        {
            "team": "Data Science",
            "title": "Churn prediction model",
            "month": 12,
            "year": 2025,
            "impact": "1200 at-risk customers identified",
            "description": "Predictive retention model",
        },
    ]

    print("-> Creating achievements...")
    for achievement in achievements_data:
        team_id = team_ids.get(str(achievement["team"]))
        if not team_id:
            continue

        payload = {
            "title": str(achievement["title"]),
            "team_id": team_id,
            "month": int(achievement["month"]),
            "year": int(achievement["year"]),
            "description": str(achievement.get("description", "")),
            "impact": str(achievement.get("impact", "")),
        }

        result = req("POST", "/achievements", payload, token)
        if isinstance(result, dict) and result.get("id"):
            print(f"  OK {payload['title'][:50]}")

    print()
    print("Seeding complete.")
    print("\nSummary:")
    print(f"  Teams:        {len(team_ids)}")
    total_members = sum(len(values) for values in members_data.values())
    print(f"  Members:      {total_members}")
    print(f"  Achievements: {len(achievements_data)}")
    print(f"\nOpen: {BASE.replace('/api/team-service', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
