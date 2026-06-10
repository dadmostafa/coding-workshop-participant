#!/usr/bin/env python3
"""
Add members with daily rates to existing projects.
"""
import sys, json, urllib.request, urllib.error

BASE = sys.argv[1].rstrip('/') + '/api/team-service' if len(sys.argv) > 1 else 'http://localhost:3001/api/team-service'

def req(method, path, data=None, token=None):
    url  = BASE + path
    body = json.dumps(data).encode() if data else None
    hdrs = {'Content-Type': 'application/json'}
    if token: hdrs['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:200]}")
        return None

print("Adding members to projects...")

auth = req('POST', '/auth/login', {'username': 'admin', 'password': 'admin123'})
if not auth:
    print("❌ Login failed"); sys.exit(1)
TOKEN = auth['token']
print("✓ Logged in\n")

# Load all data
projects = req('GET', '/projects', token=TOKEN) or []
members  = req('GET', '/members',  token=TOKEN) or []

member_map = {m['name']: {
    'id':   m['id'],
    'type': m.get('employment_type', 'direct'),
    'role': m.get('role', ''),
} for m in members}

# Daily rates
RATES = {
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
    'Cloud Architect':       1100,
    'Pen Tester':            950,
    'UX Researcher':         850,
    'ML Ops Engineer':       900,
    'Compliance Officer':    880,
    'Incident Responder':    800,
    'Backend Engineer':      820,
    'Platform Engineer':     830,
    'Data Engineer':         850,
    'Research Scientist':    950,
    'Infrastructure Lead':   900,
    'default':               750,
}

def get_rate(name):
    role = member_map.get(name, {}).get('role', '')
    return RATES.get(role, RATES['default'])

# Members per project
PROJECT_MEMBERS = {
    'Infrastructure Modernization': [
        {'name': 'Sarah Chen',     'role': 'lead',     'days': 40},
        {'name': 'Alex Rodriguez', 'role': 'member',   'days': 35},
        {'name': 'Kim Park',       'role': 'member',   'days': 30},
        {'name': 'Tom Hayes',      'role': 'member',   'days': 20},
        {'name': 'Nina Scott',     'role': 'member',   'days': 25},
    ],
    'Legacy Auth Migration': [
        {'name': 'Sarah Chen',     'role': 'lead',     'days': 45},
        {'name': 'Alex Rodriguez', 'role': 'member',   'days': 38},
        {'name': 'Tom Hayes',      'role': 'member',   'days': 30},
        {'name': 'Kim Park',       'role': 'member',   'days': 25},
    ],
    'API Gateway Consolidation': [
        {'name': 'Alex Rodriguez', 'role': 'lead',   'days': 30},
        {'name': 'Chris Nguyen',   'role': 'member', 'days': 25},
        {'name': 'Nina Scott',     'role': 'member', 'days': 20},
    ],
    'Real-Time Fraud Detection v3': [
        {'name': 'Marcus Webb',     'role': 'lead',     'days': 40},
        {'name': 'Yuki Tanaka',     'role': 'member',   'days': 35},
        {'name': 'Fatima Al-Zahra','role': 'member',   'days': 30},
        {'name': 'Carlos Mendez',  'role': 'reviewer', 'days': 15},
        {'name': 'Ahmed Hassan',   'role': 'member',   'days': 25},
    ],
    'Data Warehouse Rebuild': [
        {'name': 'Marcus Webb',   'role': 'lead',   'days': 50},
        {'name': 'Ben Carter',    'role': 'member', 'days': 40},
        {'name': 'Carlos Mendez', 'role': 'member', 'days': 30},
        {'name': 'Hannah Lee',    'role': 'member', 'days': 25},
    ],
    'Customer 360 Data Platform': [
        {'name': 'Yuki Tanaka', 'role': 'lead',   'days': 50},
        {'name': 'Ben Carter',  'role': 'member', 'days': 40},
        {'name': 'Lisa Park',   'role': 'member', 'days': 35},
        {'name': 'Omar Diallo', 'role': 'member', 'days': 30},
    ],
    'Design System 4.0': [
        {'name': 'Priya Sharma', 'role': 'lead',     'days': 30},
        {'name': 'Luca Bianchi', 'role': 'member',   'days': 25},
        {'name': 'Mei Lin',      'role': 'member',   'days': 20},
        {'name': 'Ana Flores',   'role': 'reviewer', 'days': 15},
    ],
    'Mobile App Redesign Phase 2': [
        {'name': 'Luca Bianchi', 'role': 'lead',   'days': 30},
        {'name': 'Emma Wilson',  'role': 'member', 'days': 20},
        {'name': 'David Kim',    'role': 'member', 'days': 25},
    ],
    'Zero Trust Security Implementation': [
        {'name': 'James Liu',     'role': 'lead',     'days': 60},
        {'name': 'Maya Thompson', 'role': 'member',   'days': 50},
        {'name': 'Ben Foster',    'role': 'member',   'days': 45},
        {'name': 'Chloe Martin',  'role': 'member',   'days': 40},
        {'name': 'Diego Reyes',   'role': 'reviewer', 'days': 30},
    ],
    'SOC2 Type II Renewal': [
        {'name': 'Maya Thompson',  'role': 'lead',   'days': 30},
        {'name': 'Natalie Brooks', 'role': 'member', 'days': 25},
        {'name': 'Ravi Kumar',     'role': 'member', 'days': 20},
        {'name': 'Elise Chen',     'role': 'member', 'days': 15},
    ],
    'Enterprise Onboarding Automation': [
        {'name': 'Aisha Patel',   'role': 'lead',   'days': 30},
        {'name': 'Ryan OBrien',   'role': 'member', 'days': 25},
        {'name': 'Patrick Walsh', 'role': 'member', 'days': 20},
        {'name': 'Kevin Wright',  'role': 'member', 'days': 20},
    ],
    'Customer Health Score Dashboard': [
        {'name': 'Ryan OBrien',    'role': 'lead',   'days': 40},
        {'name': 'Jessica Turner', 'role': 'member', 'days': 30},
        {'name': 'Tara Singh',     'role': 'member', 'days': 25},
    ],
}

for project in projects:
    pname    = project['name']
    pid      = project['id']
    assigned = PROJECT_MEMBERS.get(pname)

    if not assigned:
        print(f"  ~ {pname[:45]} — no member config, skipping")
        continue

    # Get current members to avoid duplicates
    current = {m['member_id'] for m in project.get('members', [])}

    print(f"\n→ {pname}")
    total_cost = 0

    for m in assigned:
        mid = member_map.get(m['name'], {}).get('id', '')
        if not mid:
            print(f"    ✗ {m['name']} — not found in members list")
            continue
        if mid in current:
            print(f"    ~ {m['name']} — already on project")
            continue

        rate = get_rate(m['name'])
        days = m['days']
        cost = rate * days

        result = req('POST', f'/projects/{pid}/members', {
            'member_id':      mid,
            'role':           m['role'],
            'daily_rate':     rate,
            'days_allocated': days,
        }, TOKEN)

        if result:
            total_cost += cost
            print(f"    ✓ {m['name']:<22} {m['role']:<12} {days}d @ ${rate}/d = ${cost:,.0f}")
        else:
            print(f"    ✗ {m['name']} — failed to add")

    print(f"    💰 Total added: ${total_cost:,.0f}")

print("\n✅ Done! All members added with rates.")
print(f"\n🌐 {BASE.replace('/api/team-service', '')}")
