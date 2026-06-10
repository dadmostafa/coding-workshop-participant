#!/usr/bin/env python3
"""
Seed script - populates ACME Team Management with realistic sample data.
Usage: python3 seed_data.py https://d3njdoiji9c3r2.cloudfront.net
"""

import sys
import json
import random
import urllib.request
import urllib.error
from datetime import datetime, timedelta

BASE = sys.argv[1].rstrip('/') + '/api/team-service' if len(sys.argv) > 1 else 'http://localhost:3001/api/team-service'

# ── HTTP helper ───────────────────────────────────────────────────────────────

def req(method, path, data=None, token=None):
    url  = BASE + path
    body = json.dumps(data).encode() if data else None
    hdrs = {'Content-Type': 'application/json'}
    if token:
        hdrs['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR {e.code} on {path}: {body[:200]}")
        return None

# ── Login ─────────────────────────────────────────────────────────────────────

print("🌱 ACME Team Management — Seed Script")
print("=" * 50)
print(f"Target: {BASE}\n")

print("→ Logging in...")
auth = req('POST', '/auth/login', {'username': 'admin', 'password': 'admin123'})
if not auth:
    print("❌ Login failed. Make sure the app is running.")
    sys.exit(1)
TOKEN = auth['token']
print(f"  ✓ Logged in as admin\n")

# ── Teams ─────────────────────────────────────────────────────────────────────

TEAMS_DATA = [
    {
        'name':            'Platform Engineering',
        'department':      'Technology',
        'location':        'New York',
        'team_leader':     'Sarah Chen',
        'leader_location': 'New York',
        'org_leader':      'CTO Office',
        'description':     'Core platform infrastructure and developer tooling',
    },
    {
        'name':            'Data Science',
        'department':      'Analytics',
        'location':        'San Francisco',
        'team_leader':     'Marcus Webb',
        'leader_location': 'San Francisco',
        'org_leader':      'CDO Office',
        'description':     'Machine learning models and data analytics',
    },
    {
        'name':            'Product Design',
        'department':      'Product',
        'location':        'London',
        'team_leader':     'Priya Sharma',
        'leader_location': 'New York',
        'org_leader':      'CPO Office',
        'description':     'UX research, design systems, and user experience',
    },
    {
        'name':            'Security Operations',
        'department':      'Technology',
        'location':        'Austin',
        'team_leader':     'James Liu',
        'leader_location': 'Austin',
        'org_leader':      'CISO Office',
        'description':     'Cybersecurity, threat detection, and compliance',
    },
    {
        'name':            'Customer Success',
        'department':      'Operations',
        'location':        'Chicago',
        'team_leader':     'Aisha Patel',
        'leader_location': 'Chicago',
        'org_leader':      'COO Office',
        'description':     'Enterprise customer onboarding and support',
    },
]

print("→ Creating teams...")
team_ids = {}
existing = req('GET', '/teams', token=TOKEN) or []
existing_map = {t['name']: t['id'] for t in existing}

for t in TEAMS_DATA:
    if t['name'] in existing_map:
        team_ids[t['name']] = existing_map[t['name']]
        print(f"  ~ {t['name']} (already exists)")
    else:
        result = req('POST', '/teams', t, TOKEN)
        if result and result.get('id'):
            team_ids[t['name']] = result['id']
            print(f"  ✓ {t['name']}")
        else:
            print(f"  ✗ Failed to create {t['name']}")

print()

# ── Members ───────────────────────────────────────────────────────────────────

MEMBERS_DATA = {
    'Platform Engineering': [
        {'name': 'Sarah Chen',      'email': 'schen@acme.com',       'role': 'Engineering Manager',   'location': 'New York',      'employment_type': 'direct',     'is_team_leader': True,  'start_date': '2021-03-15'},
        {'name': 'Alex Rodriguez',  'email': 'arodriguez@acme.com',  'role': 'Senior Engineer',        'location': 'New York',      'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-01-10'},
        {'name': 'Kim Park',        'email': 'kpark@acme.com',       'role': 'DevOps Engineer',        'location': 'Remote',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-06-20'},
        {'name': 'Tom Hayes',       'email': 'thayes@acme.com',      'role': 'Cloud Architect',        'location': 'New York',      'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2021-09-01'},
        {'name': 'Nina Scott',      'email': 'nscott@acme.com',      'role': 'Backend Engineer',       'location': 'Boston',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-02-14'},
        {'name': 'David Okafor',    'email': 'dokafor@acme.com',     'role': 'Frontend Engineer',      'location': 'New York',      'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-05-01'},
        {'name': 'Rachel Green',    'email': 'rgreen@acme.com',      'role': 'Site Reliability',       'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-11-07'},
        {'name': 'Chris Nguyen',    'email': 'cnguyen@acme.com',     'role': 'Platform Engineer',      'location': 'New York',      'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-07-19'},
        {'name': 'Maria Santos',    'email': 'msantos@acme.com',     'role': 'Infrastructure Lead',    'location': 'Miami',         'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-04-03'},
        {'name': 'Jake Thompson',   'email': 'jthompson@acme.com',   'role': 'Security Engineer',      'location': 'New York',      'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-08-21'},
    ],
    'Data Science': [
        {'name': 'Marcus Webb',     'email': 'mwebb@acme.com',       'role': 'Head of Data Science',  'location': 'San Francisco', 'employment_type': 'direct',     'is_team_leader': True,  'start_date': '2020-11-01'},
        {'name': 'Yuki Tanaka',     'email': 'ytanaka@acme.com',     'role': 'ML Engineer',            'location': 'San Francisco', 'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-08-15'},
        {'name': 'Carlos Mendez',   'email': 'cmendez@acme.com',     'role': 'Data Analyst',           'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-03-07'},
        {'name': 'Fatima Al-Zahra', 'email': 'falzahra@acme.com',   'role': 'Research Scientist',     'location': 'San Francisco', 'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-05-20'},
        {'name': 'Ben Carter',      'email': 'bcarter@acme.com',     'role': 'Data Engineer',          'location': 'Seattle',       'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-09-12'},
        {'name': 'Zoe Williams',    'email': 'zwilliams@acme.com',   'role': 'BI Analyst',             'location': 'San Francisco', 'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-01-30'},
        {'name': 'Ahmed Hassan',    'email': 'ahassan@acme.com',     'role': 'ML Ops Engineer',        'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-07-18'},
        {'name': 'Lisa Park',       'email': 'lpark@acme.com',       'role': 'Data Scientist',         'location': 'San Francisco', 'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-12-01'},
        {'name': 'Omar Diallo',     'email': 'odiallo@acme.com',     'role': 'Analytics Engineer',     'location': 'New York',      'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2023-03-14'},
        {'name': 'Hannah Lee',      'email': 'hlee@acme.com',        'role': 'Statistical Modeler',    'location': 'San Francisco', 'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-10-25'},
    ],
    'Product Design': [
        {'name': 'Priya Sharma',    'email': 'psharma@acme.com',     'role': 'Design Director',        'location': 'London',        'employment_type': 'direct',     'is_team_leader': True,  'start_date': '2020-06-01'},
        {'name': 'Luca Bianchi',    'email': 'lbianchi@acme.com',   'role': 'Senior UX Designer',     'location': 'London',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-02-22'},
        {'name': 'Emma Wilson',     'email': 'ewilson@acme.com',     'role': 'UX Researcher',          'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-05-09'},
        {'name': 'David Kim',       'email': 'dkim@acme.com',        'role': 'Visual Designer',        'location': 'London',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-10-14'},
        {'name': 'Sophie Laurent',  'email': 'slaurent@acme.com',   'role': 'Product Designer',       'location': 'Paris',         'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-08-03'},
        {'name': 'Raj Patel',       'email': 'rpatel@acme.com',      'role': 'Interaction Designer',   'location': 'London',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-04-17'},
        {'name': 'Mei Lin',         'email': 'mlin@acme.com',        'role': 'Design Systems Lead',    'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2021-11-29'},
        {'name': 'Tom Bradley',     'email': 'tbradley@acme.com',    'role': 'Motion Designer',        'location': 'London',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-12-05'},
        {'name': 'Ana Flores',      'email': 'aflores@acme.com',     'role': 'Accessibility Lead',     'location': 'Madrid',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2023-06-20'},
        {'name': 'Jack Morrison',   'email': 'jmorrison@acme.com',   'role': 'Content Designer',       'location': 'London',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-09-11'},
    ],
    'Security Operations': [
        {'name': 'James Liu',       'email': 'jliu@acme.com',        'role': 'CISO',                   'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': True,  'start_date': '2019-08-01'},
        {'name': 'Maya Thompson',   'email': 'mthompson@acme.com',   'role': 'Security Analyst',       'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-04-15'},
        {'name': 'Ben Foster',      'email': 'bfoster@acme.com',     'role': 'Pen Tester',             'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-02-28'},
        {'name': 'Chloe Martin',    'email': 'cmartin@acme.com',     'role': 'Threat Intelligence',    'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-06-07'},
        {'name': 'Ravi Kumar',      'email': 'rkumar@acme.com',      'role': 'SOC Analyst',            'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-10-18'},
        {'name': 'Natalie Brooks',  'email': 'nbrooks@acme.com',     'role': 'Compliance Officer',     'location': 'New York',      'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2021-09-30'},
        {'name': 'Diego Reyes',     'email': 'dreyes@acme.com',      'role': 'Incident Responder',     'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-01-09'},
        {'name': 'Elise Chen',      'email': 'echen@acme.com',       'role': 'Security Engineer',      'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-07-24'},
        {'name': 'Tyler Jackson',   'email': 'tjackson@acme.com',    'role': 'Vulnerability Analyst',  'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-03-01'},
        {'name': 'Isabella Rossi',  'email': 'irossi@acme.com',      'role': 'Identity & Access',      'location': 'Austin',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-07-14'},
    ],
    'Customer Success': [
        {'name': 'Aisha Patel',     'email': 'apatel@acme.com',      'role': 'VP Customer Success',    'location': 'Chicago',       'employment_type': 'direct',     'is_team_leader': True,  'start_date': '2020-02-10'},
        {'name': 'Ryan OBrien',     'email': 'robrien@acme.com',     'role': 'Account Manager',        'location': 'Chicago',       'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-07-05'},
        {'name': 'Omar Hassan',     'email': 'ohassan@acme.com',     'role': 'Onboarding Specialist',  'location': 'Chicago',       'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-04-11'},
        {'name': 'Jessica Turner',  'email': 'jturner@acme.com',     'role': 'Customer Success Mgr',   'location': 'Dallas',        'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-11-20'},
        {'name': 'Patrick Walsh',   'email': 'pwalsh@acme.com',      'role': 'Technical Support Lead', 'location': 'Chicago',       'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2022-03-14'},
        {'name': 'Amara Osei',      'email': 'aosei@acme.com',       'role': 'Customer Advocate',      'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-09-01'},
        {'name': 'Kevin Wright',    'email': 'kwright@acme.com',     'role': 'Solutions Engineer',     'location': 'Chicago',       'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2021-05-17'},
        {'name': 'Tara Singh',      'email': 'tsingh@acme.com',      'role': 'Renewals Manager',       'location': 'Chicago',       'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-02-06'},
        {'name': 'Luis Garcia',     'email': 'lgarcia@acme.com',     'role': 'Support Specialist',     'location': 'Remote',        'employment_type': 'non-direct', 'is_team_leader': False, 'start_date': '2022-12-19'},
        {'name': 'Fiona Clarke',    'email': 'fclarke@acme.com',     'role': 'Customer Training',      'location': 'Chicago',       'employment_type': 'direct',     'is_team_leader': False, 'start_date': '2023-10-02'},
    ],
}

print("→ Creating members...")
member_ids = {}  # name → id

for team_name, members in MEMBERS_DATA.items():
    team_id = team_ids.get(team_name)
    if not team_id:
        print(f"  ✗ Skipping members for {team_name} — team not found")
        continue

    # Check existing members
    existing_members = req('GET', f'/members?team_id={team_id}', token=TOKEN) or []
    existing_names   = {m['name'] for m in existing_members}
    for m in existing_members:
        member_ids[m['name']] = m['id']

    for m in members:
        if m['name'] in existing_names:
            print(f"  ~ {m['name']} (exists)")
            continue
        payload = {**m, 'team_id': team_id}
        result  = req('POST', '/members', payload, TOKEN)
        if result and result.get('id'):
            member_ids[m['name']] = result['id']
            print(f"  ✓ {m['name']} → {team_name}")
        else:
            print(f"  ✗ Failed: {m['name']}")

print()

# ── Achievements ──────────────────────────────────────────────────────────────

ACHIEVEMENTS_DATA = [
    {'team': 'Platform Engineering', 'title': 'Kubernetes migration complete',    'month': 1,  'year': 2026, 'impact': 'Reduced infra costs by 35%',          'description': 'Migrated all services to k8s on EKS'},
    {'team': 'Platform Engineering', 'title': 'CI/CD pipeline overhaul',          'month': 3,  'year': 2026, 'impact': 'Deploy time reduced 45min → 8min',    'description': 'New GitOps workflow with ArgoCD'},
    {'team': 'Platform Engineering', 'title': '99.99% uptime milestone',           'month': 5,  'year': 2026, 'impact': '$2M SLA penalties avoided',            'description': 'Q1 reliability target exceeded'},
    {'team': 'Platform Engineering', 'title': 'Database query optimization',       'month': 11, 'year': 2025, 'impact': 'Query times improved 70%',             'description': 'Index optimization and query refactoring'},
    {'team': 'Data Science',         'title': 'Fraud detection model v2',          'month': 2,  'year': 2026, 'impact': 'Prevented $4.2M in fraud losses',      'description': 'New ML model with 94% accuracy'},
    {'team': 'Data Science',         'title': 'Real-time analytics dashboard',     'month': 4,  'year': 2026, 'impact': 'Exec decision time reduced 60%',       'description': 'Self-serve analytics platform launch'},
    {'team': 'Data Science',         'title': 'Churn prediction model',            'month': 12, 'year': 2025, 'impact': '1,200 at-risk customers identified',   'description': 'Predictive retention model deployed'},
    {'team': 'Product Design',       'title': 'Design system v3.0 release',        'month': 1,  'year': 2026, 'impact': 'Dev velocity up 40% across 6 teams',  'description': '200+ reusable components shipped'},
    {'team': 'Product Design',       'title': 'Mobile app redesign',               'month': 3,  'year': 2026, 'impact': 'App Store rating 3.2 → 4.7',          'description': 'Full UX overhaul based on user research'},
    {'team': 'Product Design',       'title': 'Accessibility audit complete',       'month': 5,  'year': 2026, 'impact': 'WCAG 2.1 AA compliance achieved',     'description': '47 accessibility issues resolved'},
    {'team': 'Security Operations',  'title': 'Zero critical vulnerabilities Q1',  'month': 3,  'year': 2026, 'impact': 'SOC2 Type II certification renewed',    'description': 'Quarterly security audit passed clean'},
    {'team': 'Security Operations',  'title': 'Security training rollout',         'month': 2,  'year': 2026, 'impact': 'Phishing susceptibility down 78%',     'description': 'Company-wide security awareness program'},
    {'team': 'Customer Success',     'title': 'NPS score reached 72',              'month': 4,  'year': 2026, 'impact': 'Enterprise churn reduced to 2.1%',     'description': 'Record customer satisfaction score'},
    {'team': 'Customer Success',     'title': '100 enterprise onboardings',        'month': 5,  'year': 2026, 'impact': '$8M ARR milestone hit',                'description': 'Q1 onboarding target exceeded by 12%'},
]

print("→ Creating achievements...")
for a in ACHIEVEMENTS_DATA:
    team_id = team_ids.get(a['team'])
    if not team_id:
        continue
    payload = {
        'title':       a['title'],
        'team_id':     team_id,
        'month':       a['month'],
        'year':        a['year'],
        'description': a.get('description', ''),
        'impact':      a.get('impact', ''),
    }
    result = req('POST', '/achievements', payload, TOKEN)
    if result and result.get('id'):
        print(f"  ✓ {a['title'][:55]}")
    else:
        print(f"  ~ Already exists or failed: {a['title'][:40]}")

print()

# ── Projects ──────────────────────────────────────────────────────────────────

def future_date(days):
    return (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')

def past_date(days):
    return (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

def pick_members(team_name, count=3):
    names  = [m['name'] for m in MEMBERS_DATA.get(team_name, [])]
    chosen = random.sample(names, min(count, len(names)))
    return [
        {
            'member_id':   member_ids[n],
            'member_name': n,
            'role':        random.choice(['member', 'lead', 'reviewer']),
        }
        for n in chosen if n in member_ids
    ]

PROJECTS_DATA = [
    {
        'name':        'Infrastructure Modernization',
        'description': 'Migrate legacy systems to cloud-native architecture',
        'team':        'Platform Engineering',
        'status':      'in_progress',
        'priority':    'high',
        'owner':       'Sarah Chen',
        'start_date':  past_date(60),
        'due_date':    future_date(45),
        'progress':    65,
        'tags':        ['infrastructure', 'cloud', 'migration'],
        'member_count': 4,
    },
    {
        'name':        'API Gateway Consolidation',
        'description': 'Unify 12 disparate APIs into a single gateway',
        'team':        'Platform Engineering',
        'status':      'review',
        'priority':    'medium',
        'owner':       'Alex Rodriguez',
        'start_date':  past_date(45),
        'due_date':    future_date(10),
        'progress':    88,
        'tags':        ['api', 'backend', 'architecture'],
        'member_count': 3,
    },
    {
        'name':        'Real-Time Fraud Detection v3',
        'description': 'Next-gen ML model for real-time transaction scoring',
        'team':        'Data Science',
        'status':      'in_progress',
        'priority':    'critical',
        'owner':       'Marcus Webb',
        'start_date':  past_date(30),
        'due_date':    future_date(30),
        'progress':    42,
        'tags':        ['ml', 'fraud', 'real-time'],
        'member_count': 5,
    },
    {
        'name':        'Customer 360 Data Platform',
        'description': 'Unified customer data lake for analytics and ML',
        'team':        'Data Science',
        'status':      'planning',
        'priority':    'high',
        'owner':       'Yuki Tanaka',
        'start_date':  future_date(5),
        'due_date':    future_date(90),
        'progress':    10,
        'tags':        ['data-lake', 'analytics', 'platform'],
        'member_count': 4,
    },
    {
        'name':        'Design System 4.0',
        'description': 'Next generation component library with dark mode support',
        'team':        'Product Design',
        'status':      'in_progress',
        'priority':    'high',
        'owner':       'Priya Sharma',
        'start_date':  past_date(20),
        'due_date':    future_date(40),
        'progress':    55,
        'tags':        ['design-system', 'components', 'dark-mode'],
        'member_count': 4,
    },
    {
        'name':        'Mobile App Redesign Phase 2',
        'description': 'Onboarding flow and settings revamp based on user feedback',
        'team':        'Product Design',
        'status':      'backlog',
        'priority':    'medium',
        'owner':       'Luca Bianchi',
        'start_date':  future_date(14),
        'due_date':    future_date(75),
        'progress':    0,
        'tags':        ['mobile', 'ux', 'onboarding'],
        'member_count': 3,
    },
    {
        'name':        'Zero Trust Security Implementation',
        'description': 'Implement zero trust network architecture across all services',
        'team':        'Security Operations',
        'status':      'in_progress',
        'priority':    'critical',
        'owner':       'James Liu',
        'start_date':  past_date(90),
        'due_date':    future_date(20),
        'progress':    78,
        'tags':        ['zero-trust', 'network', 'security'],
        'member_count': 5,
    },
    {
        'name':        'SOC2 Type II Renewal',
        'description': 'Annual compliance audit preparation and execution',
        'team':        'Security Operations',
        'status':      'review',
        'priority':    'high',
        'owner':       'Maya Thompson',
        'start_date':  past_date(45),
        'due_date':    future_date(7),
        'progress':    92,
        'tags':        ['compliance', 'audit', 'soc2'],
        'member_count': 4,
    },
    {
        'name':        'Enterprise Onboarding Automation',
        'description': 'Automate customer onboarding from 14 days to 3 days',
        'team':        'Customer Success',
        'status':      'in_progress',
        'priority':    'high',
        'owner':       'Aisha Patel',
        'start_date':  past_date(25),
        'due_date':    future_date(35),
        'progress':    48,
        'tags':        ['automation', 'onboarding', 'efficiency'],
        'member_count': 4,
    },
    {
        'name':        'Customer Health Score Dashboard',
        'description': 'Real-time health scoring for all enterprise accounts',
        'team':        'Customer Success',
        'status':      'completed',
        'priority':    'medium',
        'owner':       'Ryan OBrien',
        'start_date':  past_date(120),
        'due_date':    past_date(5),
        'progress':    100,
        'tags':        ['dashboard', 'analytics', 'health-score'],
        'member_count': 3,
    },
]

print("→ Creating projects...")
for p in PROJECTS_DATA:
    team_id    = team_ids.get(p['team'])
    owner_name = p['owner']
    owner_id   = member_ids.get(owner_name, '')
    members    = pick_members(p['team'], p['member_count'])

    # Make sure owner is in members list
    if owner_id and not any(m['member_id'] == owner_id for m in members):
        members.insert(0, {
            'member_id':   owner_id,
            'member_name': owner_name,
            'role':        'lead',
        })

    payload = {
        'name':        p['name'],
        'description': p['description'],
        'team_id':     team_id,
        'status':      p['status'],
        'priority':    p['priority'],
        'owner_id':    owner_id,
        'owner_name':  owner_name,
        'start_date':  p['start_date'],
        'due_date':    p['due_date'],
        'progress':    p['progress'],
        'tags':        p['tags'],
        'members':     members,
    }

    result = req('POST', '/projects', payload, TOKEN)
    if result and result.get('id'):
        print(f"  ✓ [{p['status']:12}] {p['name']}")
    else:
        print(f"  ~ Already exists or failed: {p['name']}")

print()

# ── Summary ───────────────────────────────────────────────────────────────────

print("✅ Seed complete!")
print()
print("📊 Summary")
print(f"   Teams:        {len(team_ids)}")
total_members = sum(len(v) for v in MEMBERS_DATA.values())
print(f"   Members:      {total_members}")
print(f"   Achievements: {len(ACHIEVEMENTS_DATA)}")
print(f"   Projects:     {len(PROJECTS_DATA)}")
print()
print(f"🌐 App URL: {BASE.replace('/api/team-service', '')}")
print()
print("Default login: admin / admin123")
