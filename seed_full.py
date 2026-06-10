#!/usr/bin/env python3
"""
Full reseed - clears existing projects and repopulates with
complete data including budgets, member rates, and deliverables.
"""
import sys, json, urllib.request, urllib.error, random
from datetime import datetime, timedelta

BASE = sys.argv[1].rstrip('/') + '/api/team-service' if len(sys.argv) > 1 else 'http://localhost:3001/api/team-service'

def req(method, path, data=None, token=None):
    url  = BASE + path
    body = json.dumps(data).encode() if data else None
    hdrs = {'Content-Type': 'application/json'}
    if token: hdrs['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            if not raw:
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:200]}")
        return None

def future(days): return (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
def past(days):   return (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

print("Full Reseed - ACME Project Management")
print("=" * 50)

# Login
auth = req('POST', '/auth/login', {'username': 'admin', 'password': 'admin123'})
if not auth:
    print("Login failed"); sys.exit(1)
TOKEN = auth['token']
print("Logged in\n")

# Get existing data
teams   = req('GET', '/teams',   token=TOKEN) or []
members = req('GET', '/members', token=TOKEN) or []

team_map   = {t['name']: t['id'] for t in teams}
member_map = {m['name']: {'id': m['id'], 'type': m.get('employment_type', 'direct')} for m in members}

print(f"Found {len(teams)} teams, {len(members)} members\n")

# Daily rates by employment type and role
RATES = {
    'direct': {
        'Engineering Manager':   950,
        'Head of Data Science':  1100,
        'Design Director':       900,
        'CISO':                  1200,
        'VP Customer Success':   1000,
        'Senior Engineer':       850,
        'ML Engineer':           900,
        'Senior UX Designer':    800,
        'Security Analyst':      750,
        'Account Manager':       700,
        'DevOps Engineer':       800,
        'Data Analyst':          700,
        'Visual Designer':       700,
        'SOC Analyst':           700,
        'Onboarding Specialist': 650,
        'default':               750,
    },
    'non-direct': {
        'Cloud Architect':       1100,
        'Pen Tester':            950,
        'UX Researcher':         850,
        'ML Ops Engineer':       900,
        'Compliance Officer':    880,
        'Incident Responder':    800,
        'default':               800,
    }
}

def get_rate(name):
    m = member_map.get(name, {})
    mtype = m.get('type', 'direct')
    # Find member role
    member_obj = next((x for x in members if x['name'] == name), {})
    role = member_obj.get('role', 'default')
    rate_map = RATES.get(mtype, RATES['direct'])
    return rate_map.get(role, rate_map.get('default', 750))

# Projects with full data
PROJECTS = [
    {
        'name':         'Infrastructure Modernization',
        'description':  'Migrate legacy monolith to cloud-native microservices on AWS EKS',
        'team':         'Platform Engineering',
        'status':       'in_progress',
        'priority':     'high',
        'owner':        'Sarah Chen',
        'start_date':   past(60),
        'due_date':     future(45),
        'progress':     65,
        'total_budget': 480000,
        'currency':     'USD',
        'tags':         ['infrastructure', 'cloud', 'kubernetes'],
        'members': [
            {'name': 'Sarah Chen',    'role': 'lead',     'days': 40},
            {'name': 'Alex Rodriguez','role': 'member',   'days': 35},
            {'name': 'Kim Park',      'role': 'member',   'days': 30},
            {'name': 'Tom Hayes',     'role': 'reviewer', 'days': 20},
            {'name': 'Nina Scott',    'role': 'member',   'days': 25},
        ],
        'deliverables': [
            {'title': 'Architecture design document',       'status': 'done'},
            {'title': 'Dev environment on EKS',            'status': 'done'},
            {'title': 'Auth service containerized',        'status': 'done'},
            {'title': 'API gateway deployed',              'status': 'in_progress'},
            {'title': 'Database migration scripts',        'status': 'in_progress'},
            {'title': 'Load testing completed',            'status': 'pending'},
            {'title': 'Production cutover',                'status': 'pending'},
        ],
    },
    {
        'name':         'API Gateway Consolidation',
        'description':  'Unify 12 disparate service APIs into a single managed gateway',
        'team':         'Platform Engineering',
        'status':       'review',
        'priority':     'medium',
        'owner':        'Alex Rodriguez',
        'start_date':   past(45),
        'due_date':     future(10),
        'progress':     88,
        'total_budget': 180000,
        'currency':     'USD',
        'tags':         ['api', 'backend', 'architecture'],
        'members': [
            {'name': 'Alex Rodriguez','role': 'lead',   'days': 30},
            {'name': 'Chris Nguyen',  'role': 'member', 'days': 25},
            {'name': 'Nina Scott',    'role': 'member', 'days': 20},
        ],
        'deliverables': [
            {'title': 'API inventory and audit',           'status': 'done'},
            {'title': 'Gateway vendor selection',          'status': 'done'},
            {'title': 'Rate limiting configured',          'status': 'done'},
            {'title': 'Auth middleware integrated',        'status': 'done'},
            {'title': 'All 12 APIs migrated',             'status': 'in_progress'},
            {'title': 'Performance benchmarks passed',    'status': 'pending'},
        ],
    },
    {
        'name':         'Real-Time Fraud Detection v3',
        'description':  'Next-gen ML model for sub-100ms real-time transaction scoring',
        'team':         'Data Science',
        'status':       'in_progress',
        'priority':     'critical',
        'owner':        'Marcus Webb',
        'start_date':   past(30),
        'due_date':     future(30),
        'progress':     42,
        'total_budget': 620000,
        'currency':     'USD',
        'tags':         ['ml', 'fraud', 'real-time', 'python'],
        'members': [
            {'name': 'Marcus Webb',    'role': 'lead',     'days': 40},
            {'name': 'Yuki Tanaka',    'role': 'member',   'days': 35},
            {'name': 'Fatima Al-Zahra','role': 'member',   'days': 30},
            {'name': 'Carlos Mendez',  'role': 'reviewer', 'days': 15},
            {'name': 'Ahmed Hassan',   'role': 'member',   'days': 25},
        ],
        'deliverables': [
            {'title': 'Training data pipeline built',      'status': 'done'},
            {'title': 'Feature engineering complete',      'status': 'done'},
            {'title': 'Model v3 trained and validated',    'status': 'in_progress'},
            {'title': 'A/B test framework set up',        'status': 'in_progress'},
            {'title': 'Shadow mode deployment',           'status': 'pending'},
            {'title': 'Production rollout',               'status': 'pending'},
            {'title': 'Monitoring dashboards live',       'status': 'pending'},
        ],
    },
    {
        'name':         'Customer 360 Data Platform',
        'description':  'Unified customer data lake enabling self-serve analytics across all teams',
        'team':         'Data Science',
        'status':       'planning',
        'priority':     'high',
        'owner':        'Yuki Tanaka',
        'start_date':   future(5),
        'due_date':     future(90),
        'progress':     10,
        'total_budget': 750000,
        'currency':     'USD',
        'tags':         ['data-lake', 'analytics', 'platform'],
        'members': [
            {'name': 'Yuki Tanaka',   'role': 'lead',   'days': 50},
            {'name': 'Ben Carter',    'role': 'member', 'days': 40},
            {'name': 'Lisa Park',     'role': 'member', 'days': 35},
            {'name': 'Omar Diallo',   'role': 'member', 'days': 30},
        ],
        'deliverables': [
            {'title': 'Requirements and scope doc',       'status': 'done'},
            {'title': 'Data source inventory',            'status': 'in_progress'},
            {'title': 'Schema design approved',           'status': 'pending'},
            {'title': 'ETL pipelines built',              'status': 'pending'},
            {'title': 'Data quality checks',              'status': 'pending'},
            {'title': 'Self-serve query layer',           'status': 'pending'},
            {'title': 'User training and docs',           'status': 'pending'},
        ],
    },
    {
        'name':         'Design System 4.0',
        'description':  'Next-gen component library with dark mode, accessibility, and token system',
        'team':         'Product Design',
        'status':       'in_progress',
        'priority':     'high',
        'owner':        'Priya Sharma',
        'start_date':   past(20),
        'due_date':     future(40),
        'progress':     55,
        'total_budget': 290000,
        'currency':     'USD',
        'tags':         ['design-system', 'components', 'accessibility'],
        'members': [
            {'name': 'Priya Sharma',  'role': 'lead',     'days': 30},
            {'name': 'Luca Bianchi',  'role': 'member',   'days': 25},
            {'name': 'Mei Lin',       'role': 'member',   'days': 20},
            {'name': 'Ana Flores',    'role': 'reviewer', 'days': 15},
        ],
        'deliverables': [
            {'title': 'Design token system defined',      'status': 'done'},
            {'title': 'Core components rebuilt',          'status': 'done'},
            {'title': 'Dark mode support added',          'status': 'in_progress'},
            {'title': 'WCAG 2.1 AA compliance',          'status': 'in_progress'},
            {'title': 'Storybook documentation',          'status': 'pending'},
            {'title': 'Migration guide for teams',        'status': 'pending'},
        ],
    },
    {
        'name':         'Mobile App Redesign Phase 2',
        'description':  'Revamp onboarding flow and account settings based on user research',
        'team':         'Product Design',
        'status':       'backlog',
        'priority':     'medium',
        'owner':        'Luca Bianchi',
        'start_date':   future(14),
        'due_date':     future(75),
        'progress':     0,
        'total_budget': 220000,
        'currency':     'USD',
        'tags':         ['mobile', 'ux', 'onboarding'],
        'members': [
            {'name': 'Luca Bianchi',  'role': 'lead',   'days': 30},
            {'name': 'Emma Wilson',   'role': 'member', 'days': 20},
            {'name': 'David Kim',     'role': 'member', 'days': 25},
        ],
        'deliverables': [
            {'title': 'User research synthesis',          'status': 'pending'},
            {'title': 'Wireframes approved',              'status': 'pending'},
            {'title': 'Hi-fi designs complete',           'status': 'pending'},
            {'title': 'Prototype tested',                 'status': 'pending'},
            {'title': 'Dev handoff package',              'status': 'pending'},
        ],
    },
    {
        'name':         'Zero Trust Security Implementation',
        'description':  'Implement zero trust network architecture across all 47 services',
        'team':         'Security Operations',
        'status':       'in_progress',
        'priority':     'critical',
        'owner':        'James Liu',
        'start_date':   past(90),
        'due_date':     future(20),
        'progress':     78,
        'total_budget': 890000,
        'currency':     'USD',
        'tags':         ['zero-trust', 'network', 'security', 'compliance'],
        'members': [
            {'name': 'James Liu',      'role': 'lead',     'days': 60},
            {'name': 'Maya Thompson',  'role': 'member',   'days': 50},
            {'name': 'Ben Foster',     'role': 'member',   'days': 40},
            {'name': 'Chloe Martin',   'role': 'member',   'days': 35},
            {'name': 'Diego Reyes',    'role': 'reviewer', 'days': 25},
        ],
        'deliverables': [
            {'title': 'Network topology audit',           'status': 'done'},
            {'title': 'Identity provider integrated',     'status': 'done'},
            {'title': 'Service mesh deployed',            'status': 'done'},
            {'title': 'mTLS enabled on all services',    'status': 'done'},
            {'title': 'Policy engine configured',         'status': 'in_progress'},
            {'title': 'Legacy VPN decommissioned',        'status': 'pending'},
            {'title': 'Red team validation passed',       'status': 'pending'},
        ],
    },
    {
        'name':         'SOC2 Type II Renewal',
        'description':  'Annual compliance audit preparation, evidence collection, and auditor engagement',
        'team':         'Security Operations',
        'status':       'review',
        'priority':     'high',
        'owner':        'Maya Thompson',
        'start_date':   past(45),
        'due_date':     future(7),
        'progress':     92,
        'total_budget': 150000,
        'currency':     'USD',
        'tags':         ['compliance', 'audit', 'soc2'],
        'members': [
            {'name': 'Maya Thompson',  'role': 'lead',   'days': 30},
            {'name': 'Natalie Brooks', 'role': 'member', 'days': 25},
            {'name': 'Ravi Kumar',     'role': 'member', 'days': 20},
            {'name': 'Elise Chen',     'role': 'member', 'days': 15},
        ],
        'deliverables': [
            {'title': 'Control matrix updated',           'status': 'done'},
            {'title': 'Evidence collection complete',     'status': 'done'},
            {'title': 'Vendor questionnaires submitted',  'status': 'done'},
            {'title': 'Auditor interviews complete',      'status': 'done'},
            {'title': 'Remediation items closed',        'status': 'in_progress'},
            {'title': 'Final audit report received',     'status': 'pending'},
        ],
    },
    {
        'name':         'Enterprise Onboarding Automation',
        'description':  'Automate customer onboarding end-to-end reducing time from 14 days to 3 days',
        'team':         'Customer Success',
        'status':       'in_progress',
        'priority':     'high',
        'owner':        'Aisha Patel',
        'start_date':   past(25),
        'due_date':     future(35),
        'progress':     48,
        'total_budget': 340000,
        'currency':     'USD',
        'tags':         ['automation', 'onboarding', 'customer-success'],
        'members': [
            {'name': 'Aisha Patel',    'role': 'lead',   'days': 30},
            {'name': 'Ryan OBrien',    'role': 'member', 'days': 25},
            {'name': 'Patrick Walsh',  'role': 'member', 'days': 20},
            {'name': 'Kevin Wright',   'role': 'member', 'days': 20},
        ],
        'deliverables': [
            {'title': 'Current process mapped',           'status': 'done'},
            {'title': 'Automation tool selected',         'status': 'done'},
            {'title': 'Provisioning workflows built',     'status': 'in_progress'},
            {'title': 'SSO integration complete',         'status': 'in_progress'},
            {'title': 'Training material automated',      'status': 'pending'},
            {'title': 'Pilot with 5 customers',          'status': 'pending'},
            {'title': 'Full rollout complete',            'status': 'pending'},
        ],
    },
    {
        'name':         'Customer Health Score Dashboard',
        'description':  'Real-time health scoring for all 847 enterprise accounts with alert system',
        'team':         'Customer Success',
        'status':       'completed',
        'priority':     'medium',
        'owner':        'Ryan OBrien',
        'start_date':   past(120),
        'due_date':     past(5),
        'progress':     100,
        'total_budget': 180000,
        'currency':     'USD',
        'tags':         ['dashboard', 'analytics', 'health-score'],
        'members': [
            {'name': 'Ryan OBrien',    'role': 'lead',   'days': 40},
            {'name': 'Jessica Turner', 'role': 'member', 'days': 30},
            {'name': 'Tara Singh',     'role': 'member', 'days': 25},
        ],
        'deliverables': [
            {'title': 'Health score algorithm defined',   'status': 'done'},
            {'title': 'Data connectors built',            'status': 'done'},
            {'title': 'Dashboard UI complete',            'status': 'done'},
            {'title': 'Alert rules configured',           'status': 'done'},
            {'title': 'CS team training done',            'status': 'done'},
            {'title': 'All accounts onboarded',           'status': 'done'},
        ],
    },
]

# Delete existing projects
print("-> Clearing existing projects...")
existing_projects = req('GET', '/projects', token=TOKEN) or []
deleted = 0
for p in existing_projects:
    req('DELETE', f'/projects/{p["id"]}', token=TOKEN)
    deleted += 1
print(f"  Deleted {deleted} existing projects\n")

# Create new projects
print("-> Creating projects with budgets, members, and deliverables...")
created_projects = []

for p in PROJECTS:
    team_id  = team_map.get(p['team'])
    owner_id = member_map.get(p['owner'], {}).get('id', '')

    if not team_id:
        print(f"  Team not found: {p['team']}")
        continue

    # Pre-calculate members with rates
    members_payload = []
    for m in p['members']:
        mid  = member_map.get(m['name'], {}).get('id', '')
        if not mid:
            continue
        rate = get_rate(m['name'])
        days = m['days']
        members_payload.append({
            'member_id':      mid,
            'member_name':    m['name'],
            'role':           m['role'],
            'member_type':    member_map.get(m['name'], {}).get('type', 'direct'),
            'daily_rate':     rate,
            'days_allocated': days,
            'cost':           rate * days,
        })

    spent = sum(m['cost'] for m in members_payload)

    payload = {
        'name':         p['name'],
        'description':  p['description'],
        'team_id':      team_id,
        'status':       p['status'],
        'priority':     p['priority'],
        'owner_id':     owner_id,
        'owner_name':   p['owner'],
        'start_date':   p['start_date'],
        'due_date':     p['due_date'],
        'progress':     p['progress'],
        'total_budget': p['total_budget'],
        'spent_budget': spent,
        'currency':     p['currency'],
        'tags':         p['tags'],
        'members':      members_payload,
        'deliverables': [],
    }

    result = req('POST', '/projects', payload, TOKEN)
    if not result or not result.get('id'):
        print(f"  Failed: {p['name']}")
        continue

    proj_id = result['id']
    created_projects.append(proj_id)

    # Add deliverables
    deliverable_ids = {}
    for d in p['deliverables']:
        dr = req('POST', f'/projects/{proj_id}/deliverables',
                 {'title': d['title']}, TOKEN)
        if dr and dr.get('item'):
            item_id = dr['item']['id']
            deliverable_ids[d['title']] = item_id

            # Update status if not pending
            if d['status'] != 'pending':
                req('PUT', f'/projects/{proj_id}/deliverables/{item_id}',
                    {'status': d['status']}, TOKEN)

    budget_pct = round((spent / p['total_budget']) * 100) if p['total_budget'] else 0
    print(f"  [{p['status']:12}] {p['name']}")
    print(f"          Budget: ${spent:,.0f} / ${p['total_budget']:,.0f} ({budget_pct}%) - "
          f"{len(members_payload)} members - {len(p['deliverables'])} deliverables")

print()
print("Reseed complete!")
print()
print("Summary")
print(f"   Projects created:  {len(created_projects)}")
total_budget = sum(p['total_budget'] for p in PROJECTS)
total_spent  = sum(
    sum(get_rate(m['name']) * m['days'] for m in p['members']
        if member_map.get(m['name']))
    for p in PROJECTS
)
print(f"   Total budget:      ${total_budget:,.0f}")
print(f"   Total spent:       ${total_spent:,.0f}")
print(f"   Budget utilization:{round(total_spent/total_budget*100)}%")
print()
print(f"URL: {BASE.replace('/api/team-service', '')}")
