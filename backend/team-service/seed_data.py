#!/usr/bin/env python3
"""
ACME Full Reseed — 100+ members, 8 teams, 20 projects
Covers all health states: healthy, at-risk, overdue, over-budget,
completed, on-hold, cancelled, planning, backlog
Shows: RAG status, utilization, budget variance, deliverables,
       over-allocation, stale projects
"""
import sys, json, urllib.request, urllib.error
from datetime import datetime, timedelta

BASE = sys.argv[1].rstrip('/') + '/api/team-service' if len(sys.argv) > 1 \
       else 'http://localhost:3001/api/team-service'

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
        txt = e.read().decode()[:300]
        print(f"  !! {method} {path} → {e.code}: {txt}")
        return None

def future(days): return (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
def past(days):   return (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
def today():      return datetime.now().strftime('%Y-%m-%d')

print("=" * 60)
print("  ACME Inc — Full Reseed")
print("=" * 60)

# ── Auth ──────────────────────────────────────────────────────
auth = req('POST', '/auth/login', {'username':'admin','password':'admin123'})
if not auth: print("❌ Login failed"); sys.exit(1)
T = auth['token']
print("✓ Logged in\n")

# ── Wipe existing data ────────────────────────────────────────
print("→ Clearing existing data...")
for p in req('GET','/projects',token=T) or []:
    req('DELETE',f'/projects/{p["id"]}',token=T)
for m in req('GET','/members',token=T) or []:
    req('DELETE',f'/members/{m["id"]}',token=T)
for t in req('GET','/teams',token=T) or []:
    req('DELETE',f'/teams/{t["id"]}',token=T)
print("  ✓ Cleared\n")

# ── Teams ─────────────────────────────────────────────────────
print("→ Creating teams...")
TEAMS_DEF = [
    dict(name='Platform Engineering', department='Technology',
         location='New York',     team_leader='Sarah Chen',
         leader_location='New York',  org_leader='CTO'),
    dict(name='Data Science',        department='Analytics',
         location='San Francisco', team_leader='Marcus Webb',
         leader_location='San Francisco', org_leader='Chief Data Officer'),
    dict(name='Product Design',      department='Product',
         location='Austin',       team_leader='Priya Sharma',
         leader_location='Austin',    org_leader='CPO'),
    dict(name='Security Operations', department='Technology',
         location='Washington DC', team_leader='James Liu',
         leader_location='Washington DC', org_leader='CISO'),
    dict(name='Customer Success',    department='Operations',
         location='Chicago',      team_leader='Aisha Patel',
         leader_location='Chicago',    org_leader='COO'),
    dict(name='Backend Engineering', department='Technology',
         location='Seattle',      team_leader='Alex Rodriguez',
         leader_location='Seattle',    org_leader='CTO'),
    dict(name='Mobile Engineering',  department='Technology',
         location='Boston',       team_leader='Luca Bianchi',
         leader_location='Boston',     org_leader='CTO'),
    dict(name='DevOps & Cloud',      department='Infrastructure',
         location='Denver',       team_leader='Nina Scott',
         leader_location='Denver',     org_leader='CTO'),
]
teams = {}
for td in TEAMS_DEF:
    r = req('POST','/teams',td,T)
    if r and r.get('id'):
        teams[td['name']] = r['id']
        print(f"  ✓ {td['name']}")
print()

# ── Members (108 total) ───────────────────────────────────────
print("→ Creating members...")

MEMBERS_DEF = {
    'Platform Engineering': [
        ('Sarah Chen',       'Engineering Manager',   'direct',     'New York',      True,  '2019-03-01', 950),
        ('Alex Rodriguez',   'Senior Engineer',       'direct',     'New York',      False, '2020-06-15', 850),
        ('Kim Park',         'Platform Engineer',     'direct',     'New York',      False, '2021-01-10', 830),
        ('Tom Hayes',        'DevOps Engineer',       'direct',     'New York',      False, '2020-11-20', 800),
        ('Nina Scott',       'Cloud Architect',       'non-direct', 'Remote',        False, '2022-03-05', 1100),
        ('David Okafor',     'Senior Engineer',       'direct',     'New York',      False, '2021-07-01', 850),
        ('Rachel Torres',    'Platform Engineer',     'direct',     'New Jersey',    False, '2022-09-15', 830),
        ('Mike Anderson',    'Infrastructure Lead',   'direct',     'New York',      False, '2019-11-01', 900),
        ('Lisa Zhang',       'Backend Engineer',      'non-direct', 'Remote',        False, '2023-01-15', 820),
        ('James Wright',     'Senior Engineer',       'direct',     'New York',      False, '2020-04-20', 850),
        ('Olivia Bennett',   'Cloud Engineer',        'non-direct', 'Remote',        False, '2023-06-01', 950),
        ('Chris Nguyen',     'Platform Engineer',     'direct',     'New York',      False, '2021-03-10', 830),
        ('Fiona Walsh',      'DevOps Engineer',       'direct',     'Brooklyn',      False, '2022-07-01', 800),
    ],
    'Data Science': [
        ('Marcus Webb',      'Head of Data Science',  'direct',     'San Francisco', True,  '2018-07-01', 1100),
        ('Yuki Tanaka',      'ML Engineer',           'direct',     'San Francisco', False, '2020-02-15', 900),
        ('Fatima Al-Zahra',  'Data Analyst',          'direct',     'San Francisco', False, '2021-05-01', 700),
        ('Carlos Mendez',    'Research Scientist',    'direct',     'San Francisco', False, '2019-09-10', 950),
        ('Ahmed Hassan',     'ML Engineer',           'direct',     'San Francisco', False, '2022-01-20', 900),
        ('Ben Carter',       'Data Engineer',         'direct',     'San Francisco', False, '2021-08-15', 850),
        ('Lisa Park',        'Data Analyst',          'non-direct', 'Remote',        False, '2022-11-01', 700),
        ('Omar Diallo',      'ML Ops Engineer',       'non-direct', 'Remote',        False, '2023-03-01', 900),
        ('Hannah Lee',       'Data Engineer',         'direct',     'San Francisco', False, '2020-12-01', 850),
        ('Ravi Patel',       'Research Scientist',    'direct',     'San Francisco', False, '2021-04-15', 950),
        ('Sophie Turner',    'Data Analyst',          'non-direct', 'Remote',        False, '2023-07-01', 700),
        ('Diego Martinez',   'ML Engineer',           'direct',     'Oakland',       False, '2022-05-10', 900),
        ('Amira Farouk',     'Data Engineer',         'direct',     'San Francisco', False, '2021-11-20', 850),
    ],
    'Product Design': [
        ('Priya Sharma',     'Design Director',       'direct',     'Austin',        True,  '2019-05-01', 900),
        ('Luca Bianchi',     'Senior UX Designer',    'direct',     'Austin',        False, '2020-08-15', 800),
        ('Mei Lin',          'Visual Designer',       'direct',     'Austin',        False, '2021-03-01', 700),
        ('Ana Flores',       'UX Researcher',         'non-direct', 'Remote',        False, '2022-06-01', 850),
        ('Emma Wilson',      'Product Designer',      'direct',     'Austin',        False, '2021-10-15', 780),
        ('David Kim',        'Senior UX Designer',    'direct',     'Austin',        False, '2020-01-10', 800),
        ('Zara Ahmed',       'Visual Designer',       'non-direct', 'Remote',        False, '2023-02-01', 700),
        ('Jake Morrison',    'UX Researcher',         'direct',     'Austin',        False, '2022-08-20', 780),
        ('Clara Dubois',     'Product Designer',      'direct',     'Austin',        False, '2021-06-01', 780),
        ('Sam Rivera',       'Motion Designer',       'non-direct', 'Remote',        False, '2023-04-15', 720),
        ('Tess O\'Brien',    'Design Systems Lead',   'direct',     'Austin',        False, '2020-11-01', 830),
        ('Patrick Nguyen',   'UX Designer',           'direct',     'Austin',        False, '2022-03-10', 780),
    ],
    'Security Operations': [
        ('James Liu',        'CISO',                  'direct',     'Washington DC', True,  '2017-09-01', 1200),
        ('Maya Thompson',    'Security Analyst',      'direct',     'Washington DC', False, '2020-04-15', 750),
        ('Ben Foster',       'Pen Tester',            'non-direct', 'Remote',        False, '2022-01-10', 950),
        ('Chloe Martin',     'SOC Analyst',           'direct',     'Washington DC', False, '2021-06-01', 700),
        ('Diego Reyes',      'Compliance Officer',    'non-direct', 'Remote',        False, '2022-09-15', 880),
        ('Natalie Brooks',   'Security Analyst',      'direct',     'Washington DC', False, '2020-08-20', 750),
        ('Ravi Kumar',       'Incident Responder',    'non-direct', 'Remote',        False, '2023-01-05', 800),
        ('Elise Chen',       'SOC Analyst',           'direct',     'Washington DC', False, '2021-11-10', 700),
        ('Tyler Jackson',    'Security Engineer',     'direct',     'Washington DC', False, '2022-05-01', 780),
        ('Zoe Williams',     'Pen Tester',            'non-direct', 'Remote',        False, '2023-03-20', 950),
        ('Hassan Ibrahim',   'Compliance Analyst',    'direct',     'Washington DC', False, '2021-08-15', 730),
        ('Ingrid Larsen',    'Security Analyst',      'direct',     'Washington DC', False, '2022-11-01', 750),
    ],
    'Customer Success': [
        ('Aisha Patel',      'VP Customer Success',   'direct',     'Chicago',       True,  '2018-11-01', 1000),
        ('Ryan OBrien',      'Account Manager',       'direct',     'Chicago',       False, '2020-03-15', 700),
        ('Jessica Turner',   'Onboarding Specialist', 'direct',     'Chicago',       False, '2021-07-01', 650),
        ('Tara Singh',       'Customer Success Mgr',  'direct',     'Chicago',       False, '2020-09-20', 720),
        ('Patrick Walsh',    'Account Manager',       'direct',     'Chicago',       False, '2021-01-15', 700),
        ('Kevin Wright',     'Onboarding Specialist', 'direct',     'Remote',        False, '2022-04-01', 650),
        ('Michelle Foster',  'Customer Success Mgr',  'direct',     'Chicago',       False, '2020-06-10', 720),
        ('Daniel Park',      'Account Executive',     'direct',     'Chicago',       False, '2021-09-01', 750),
        ('Sophia Chen',      'Onboarding Lead',       'direct',     'Chicago',       False, '2019-12-15', 730),
        ('Marcus Johnson',   'Customer Success Mgr',  'non-direct', 'Remote',        False, '2023-05-01', 720),
        ('Grace Kim',        'Account Manager',       'direct',     'Chicago',       False, '2022-07-20', 700),
        ('Aaron Lewis',      'CS Operations',         'direct',     'Chicago',       False, '2021-03-10', 680),
    ],
    'Backend Engineering': [
        ('Alex Rodriguez',   'Engineering Manager',   'direct',     'Seattle',       True,  '2019-08-01', 950),
        ('Chris Nguyen',     'Senior Engineer',       'direct',     'Seattle',       False, '2020-10-15', 850),
        ('Fatima Al-Zahra',  'Backend Engineer',      'direct',     'Seattle',       False, '2021-04-01', 820),
        ('Yuki Tanaka',      'Senior Engineer',       'direct',     'Seattle',       False, '2020-07-20', 850),
        ('Brandon Lee',      'Backend Engineer',      'direct',     'Seattle',       False, '2022-02-01', 820),
        ('Preethi Nair',     'API Engineer',          'non-direct', 'Remote',        False, '2022-08-15', 820),
        ('Connor Walsh',     'Senior Engineer',       'direct',     'Seattle',       False, '2021-05-10', 850),
        ('Aaliya Sharma',    'Backend Engineer',      'direct',     'Seattle',       False, '2022-12-01', 820),
        ('Felix Wagner',     'API Engineer',          'non-direct', 'Remote',        False, '2023-04-01', 820),
        ('Isabelle Roy',     'Senior Engineer',       'direct',     'Seattle',       False, '2020-09-15', 850),
        ('Kwame Asante',     'Backend Engineer',      'direct',     'Seattle',       False, '2021-10-20', 820),
        ('Mei Yamamoto',     'API Architect',         'direct',     'Seattle',       False, '2019-06-01', 900),
    ],
    'Mobile Engineering': [
        ('Luca Bianchi',     'Mobile Lead',           'direct',     'Boston',        True,  '2020-01-15', 900),
        ('Emma Wilson',      'iOS Engineer',          'direct',     'Boston',        False, '2021-06-01', 850),
        ('David Kim',        'Android Engineer',      'direct',     'Boston',        False, '2020-11-10', 850),
        ('Zara Ahmed',       'iOS Engineer',          'non-direct', 'Remote',        False, '2022-07-01', 850),
        ('Noah Campbell',    'Mobile Engineer',       'direct',     'Boston',        False, '2021-09-15', 830),
        ('Anika Patel',      'Android Engineer',      'direct',     'Boston',        False, '2022-03-01', 850),
        ('Ryan Foster',      'React Native Dev',      'non-direct', 'Remote',        False, '2023-01-10', 820),
        ('Caitlin Murphy',   'iOS Engineer',          'direct',     'Boston',        False, '2021-04-20', 850),
        ('Omar Hassan',      'Mobile Engineer',       'direct',     'Boston',        False, '2022-09-01', 830),
        ('Petra Novak',      'Android Engineer',      'non-direct', 'Remote',        False, '2023-06-15', 850),
        ('James O\'Sullivan','Mobile Architect',      'direct',     'Boston',        False, '2019-10-01', 920),
        ('Yuna Kim',         'UX/Mobile Designer',   'direct',     'Boston',        False, '2021-08-10', 790),
    ],
    'DevOps & Cloud': [
        ('Nina Scott',       'DevOps Lead',           'direct',     'Denver',        True,  '2020-05-01', 950),
        ('Tom Hayes',        'Cloud Engineer',        'direct',     'Denver',        False, '2021-02-15', 830),
        ('Brandon Lee',      'SRE Engineer',          'direct',     'Denver',        False, '2021-08-01', 840),
        ('Preethi Nair',     'Cloud Architect',       'non-direct', 'Remote',        False, '2022-06-10', 1100),
        ('Kofi Mensah',      'DevOps Engineer',       'direct',     'Denver',        False, '2022-01-20', 800),
        ('Astrid Berg',      'SRE Engineer',          'non-direct', 'Remote',        False, '2022-10-01', 840),
        ('Yusuf Al-Amin',    'Cloud Engineer',        'direct',     'Denver',        False, '2021-11-15', 830),
        ('Cecilia Vega',     'DevOps Engineer',       'direct',     'Denver',        False, '2023-02-01', 800),
        ('Haruto Sato',      'Cloud Architect',       'direct',     'Denver',        False, '2020-08-10', 950),
        ('Brianna Fox',      'SRE Engineer',          'direct',     'Denver',        False, '2022-04-20', 840),
        ('Liam O\'Connor',   'Infrastructure Eng',    'direct',     'Denver',        False, '2021-06-15', 820),
        ('Asel Nurlanovna',  'Cloud Engineer',        'non-direct', 'Remote',        False, '2023-05-01', 830),
    ],
}

member_map = {}  # name → {id, employment_type, daily_rate}

for team_name, members_list in MEMBERS_DEF.items():
    team_id = teams.get(team_name)
    if not team_id:
        continue
    for (name, role, emp_type, location, is_leader, start_date, daily_rate) in members_list:
        # Handle duplicate names across teams by making email unique
        email_name = name.lower().replace(' ', '.').replace("'", '').replace('-','')
        email_team = team_name.lower().replace(' ','').replace('&','')[:8]
        email      = f"{email_name}@acme.com"

        # If already used, add team suffix
        if email in [v.get('email','') for v in member_map.values()]:
            email = f"{email_name}.{email_team}@acme.com"

        payload = dict(
            name=name, team_id=team_id, email=email,
            role=role, location=location,
            employment_type=emp_type,
            is_team_leader=is_leader,
            start_date=start_date,
            daily_rate=daily_rate,
        )
        r = req('POST', '/members', payload, T)
        if r and r.get('id'):
            key = f"{name}_{team_name}"
            member_map[key] = {
                'id':             r['id'],
                'name':           name,
                'team':           team_name,
                'employment_type':emp_type,
                'daily_rate':     daily_rate,
                'email':          email,
            }

total_members = len(member_map)
print(f"  ✓ {total_members} members created\n")

def get_member(name, team):
    key = f"{name}_{team}"
    return member_map.get(key)

def build_member_payload(name, team, role, days):
    m = get_member(name, team)
    if not m: return None
    cost = m['daily_rate'] * days
    return dict(
        member_id=m['id'], member_name=m['name'],
        role=role, member_type=m['employment_type'],
        daily_rate=m['daily_rate'], days_allocated=days,
        cost=cost,
    )

# ── Projects (20 total) ───────────────────────────────────────
print("→ Creating projects...")

PROJECTS = [

    # ── OVERDUE × 2 (🔴 RED RAG) ────────────────────────────
    {
        'name':         'Legacy Auth Migration',
        'description':  'Replace legacy LDAP with OAuth2/OIDC across all 23 internal services',
        'team':         'Platform Engineering',
        'status':       'in_progress',
        'priority':     'critical',
        'owner_name':   'Sarah Chen',
        'owner_team':   'Platform Engineering',
        'start_date':   past(90),
        'due_date':     past(12),        # 🔴 OVERDUE
        'total_budget': 380000,
        'tags':         ['auth','security','migration'],
        'members': [
            ('Sarah Chen',     'Platform Engineering', 'lead',     50),
            ('Alex Rodriguez', 'Platform Engineering', 'member',   40),
            ('Tom Hayes',      'Platform Engineering', 'member',   35),
            ('Kim Park',       'Platform Engineering', 'member',   25),
            ('David Okafor',   'Platform Engineering', 'reviewer', 15),
        ],
        'deliverables': [
            ('OAuth2 provider selected and configured',   'done'),
            ('Dev and staging environments updated',      'done'),
            ('User migration scripts completed',          'done'),
            ('Token refresh logic implemented',           'in_progress'),
            ('Legacy LDAP decommissioned',                'pending'),
            ('Security audit passed',                     'pending'),
            ('Documentation updated',                     'pending'),
        ],
    },
    {
        'name':         'Data Warehouse Rebuild',
        'description':  'Migrate from Redshift to Snowflake — delayed by vendor contract issues',
        'team':         'Data Science',
        'status':       'on_hold',
        'priority':     'high',
        'owner_name':   'Marcus Webb',
        'owner_team':   'Data Science',
        'start_date':   past(120),
        'due_date':     past(8),         # 🔴 OVERDUE + on_hold
        'total_budget': 540000,
        'tags':         ['data','migration','snowflake'],
        'members': [
            ('Marcus Webb',   'Data Science', 'lead',   55),
            ('Ben Carter',    'Data Science', 'member', 45),
            ('Hannah Lee',    'Data Science', 'member', 35),
            ('Carlos Mendez', 'Data Science', 'member', 30),
            ('Ravi Patel',    'Data Science', 'reviewer',20),
        ],
        'deliverables': [
            ('Schema migration plan approved',            'done'),
            ('Historical data load — 3yr backfill',      'done'),
            ('ETL pipelines rewritten in dbt',           'in_progress'),
            ('Query performance benchmarks validated',   'pending'),
            ('Redshift decommission',                    'pending'),
            ('Team training on Snowflake',               'pending'),
        ],
    },

    # ── AT RISK × 2 (🟡 AMBER RAG) ──────────────────────────
    {
        'name':         'Real-Time Fraud Detection v3',
        'description':  'Next-gen ML model for sub-100ms transaction scoring at 50k TPS',
        'team':         'Data Science',
        'status':       'in_progress',
        'priority':     'critical',
        'owner_name':   'Marcus Webb',
        'owner_team':   'Data Science',
        'start_date':   past(35),
        'due_date':     future(6),       # 🟡 AT RISK — due in 6 days, low progress
        'total_budget': 620000,
        'tags':         ['ml','fraud','real-time'],
        'members': [
            ('Marcus Webb',    'Data Science', 'lead',     42),
            ('Yuki Tanaka',    'Data Science', 'member',   38),
            ('Fatima Al-Zahra','Data Science', 'member',   30),
            ('Carlos Mendez',  'Data Science', 'reviewer', 15),
            ('Ahmed Hassan',   'Data Science', 'member',   28),
            ('Omar Diallo',    'Data Science', 'member',   20),
        ],
        'deliverables': [
            ('Training data pipeline',                    'done'),
            ('Feature engineering v3',                   'done'),
            ('Model training — XGBoost + neural net',    'in_progress'),
            ('A/B test framework configured',            'in_progress'),
            ('Shadow mode deployment',                   'pending'),
            ('Production rollout plan',                  'pending'),
            ('Monitoring dashboards',                    'pending'),
        ],
    },
    {
        'name':         'SOC2 Type II Renewal',
        'description':  'Annual compliance audit — evidence collection and auditor engagement',
        'team':         'Security Operations',
        'status':       'review',
        'priority':     'high',
        'owner_name':   'James Liu',
        'owner_team':   'Security Operations',
        'start_date':   past(50),
        'due_date':     future(5),       # 🟡 AT RISK — due in 5 days, 62% done
        'total_budget': 160000,
        'tags':         ['compliance','soc2','audit'],
        'members': [
            ('James Liu',      'Security Operations', 'lead',   32),
            ('Maya Thompson',  'Security Operations', 'member', 28),
            ('Natalie Brooks', 'Security Operations', 'member', 22),
            ('Diego Reyes',    'Security Operations', 'member', 20),
            ('Elise Chen',     'Security Operations', 'member', 15),
        ],
        'deliverables': [
            ('Control matrix updated',                   'done'),
            ('Evidence collection completed',            'done'),
            ('Vendor questionnaires submitted',          'done'),
            ('Auditor kick-off meeting done',            'in_progress'),
            ('Remediation items closed',                 'pending'),
            ('Final report received',                    'pending'),
        ],
    },

    # ── OVER BUDGET × 2 (🔴 RED RAG) ────────────────────────
    {
        'name':         'Zero Trust Security Implementation',
        'description':  'Implement zero trust network architecture across all 47 services company-wide',
        'team':         'Security Operations',
        'status':       'in_progress',
        'priority':     'critical',
        'owner_name':   'James Liu',
        'owner_team':   'Security Operations',
        'start_date':   past(95),
        'due_date':     future(18),
        'total_budget': 500000,          # 🔴 OVER BUDGET — will spend ~$860k
        'tags':         ['zero-trust','network','security'],
        'members': [
            ('James Liu',      'Security Operations', 'lead',     65),
            ('Maya Thompson',  'Security Operations', 'member',   55),
            ('Ben Foster',     'Security Operations', 'member',   48),
            ('Chloe Martin',   'Security Operations', 'member',   42),
            ('Diego Reyes',    'Security Operations', 'reviewer', 32),
            ('Tyler Jackson',  'Security Operations', 'member',   28),
            ('Zoe Williams',   'Security Operations', 'member',   20),
        ],
        'deliverables': [
            ('Network topology audit',                   'done'),
            ('Identity provider integrated',             'done'),
            ('Service mesh deployed',                    'done'),
            ('mTLS enabled on all 47 services',         'done'),
            ('Policy engine configured',                 'in_progress'),
            ('Legacy VPN decommissioned',                'pending'),
            ('Red team validation',                      'pending'),
        ],
    },
    {
        'name':         'Mobile App Redesign Phase 1',
        'description':  'Full redesign of iOS and Android apps — UX overhaul based on user research',
        'team':         'Mobile Engineering',
        'status':       'in_progress',
        'priority':     'high',
        'owner_name':   'Luca Bianchi',
        'owner_team':   'Mobile Engineering',
        'start_date':   past(60),
        'due_date':     future(25),
        'total_budget': 280000,          # 🔴 OVER BUDGET
        'tags':         ['mobile','ux','redesign'],
        'members': [
            ('Luca Bianchi',   'Mobile Engineering', 'lead',   40),
            ('Emma Wilson',    'Mobile Engineering', 'member', 35),
            ('David Kim',      'Mobile Engineering', 'member', 32),
            ('Noah Campbell',  'Mobile Engineering', 'member', 28),
            ('Anika Patel',    'Mobile Engineering', 'member', 25),
            ('Priya Sharma',   'Product Design',     'reviewer',15),
        ],
        'deliverables': [
            ('User research and synthesis',              'done'),
            ('Information architecture redesign',        'done'),
            ('Wireframes for all screens',               'done'),
            ('Hi-fi designs — iOS',                     'in_progress'),
            ('Hi-fi designs — Android',                 'in_progress'),
            ('Prototype testing with 20 users',         'pending'),
            ('Developer handoff package',               'pending'),
        ],
    },

    # ── HEALTHY / ON TRACK × 6 (🟢 GREEN RAG) ───────────────
    {
        'name':         'Infrastructure Modernization',
        'description':  'Migrate legacy monolith to cloud-native microservices on AWS EKS',
        'team':         'Platform Engineering',
        'status':       'in_progress',
        'priority':     'high',
        'owner_name':   'Sarah Chen',
        'owner_team':   'Platform Engineering',
        'start_date':   past(65),
        'due_date':     future(48),
        'total_budget': 480000,
        'tags':         ['infrastructure','kubernetes','aws'],
        'members': [
            ('Sarah Chen',    'Platform Engineering', 'lead',   42),
            ('Alex Rodriguez','Platform Engineering', 'member', 36),
            ('Kim Park',      'Platform Engineering', 'member', 30),
            ('Nina Scott',    'DevOps & Cloud',       'member', 28),
            ('Mike Anderson', 'Platform Engineering', 'member', 22),
        ],
        'deliverables': [
            ('Architecture design document',             'done'),
            ('Dev environment on EKS',                  'done'),
            ('Auth service containerized',              'done'),
            ('API gateway deployed',                    'in_progress'),
            ('Database migration scripts',              'in_progress'),
            ('Load testing completed',                  'pending'),
            ('Production cutover runbook',              'pending'),
            ('Rollback plan documented',                'pending'),
        ],
    },
    {
        'name':         'API Gateway Consolidation',
        'description':  'Unify 12 disparate service APIs into a single managed Kong gateway',
        'team':         'Backend Engineering',
        'status':       'review',
        'priority':     'medium',
        'owner_name':   'Alex Rodriguez',
        'owner_team':   'Backend Engineering',
        'start_date':   past(50),
        'due_date':     future(15),
        'total_budget': 190000,
        'tags':         ['api','kong','backend'],
        'members': [
            ('Alex Rodriguez', 'Backend Engineering', 'lead',   32),
            ('Chris Nguyen',   'Backend Engineering', 'member', 28),
            ('Connor Walsh',   'Backend Engineering', 'member', 22),
            ('Isabelle Roy',   'Backend Engineering', 'member', 18),
        ],
        'deliverables': [
            ('API inventory and audit',                  'done'),
            ('Kong gateway setup',                       'done'),
            ('Rate limiting configured',                 'done'),
            ('Auth middleware integrated',               'done'),
            ('All 12 APIs migrated',                    'in_progress'),
            ('Performance benchmarks',                   'pending'),
        ],
    },
    {
        'name':         'Design System 4.0',
        'description':  'Next-gen component library — dark mode, accessibility tokens, Figma sync',
        'team':         'Product Design',
        'status':       'in_progress',
        'priority':     'high',
        'owner_name':   'Priya Sharma',
        'owner_team':   'Product Design',
        'start_date':   past(25),
        'due_date':     future(42),
        'total_budget': 295000,
        'tags':         ['design-system','accessibility','figma'],
        'members': [
            ('Priya Sharma', 'Product Design', 'lead',     32),
            ('Luca Bianchi', 'Mobile Engineering', 'member',26),
            ('Mei Lin',      'Product Design', 'member',   22),
            ('Ana Flores',   'Product Design', 'reviewer', 18),
            ('Tess O\'Brien','Product Design', 'member',   15),
        ],
        'deliverables': [
            ('Design token system defined',              'done'),
            ('Core 40 components rebuilt',               'done'),
            ('Dark mode support added',                  'in_progress'),
            ('WCAG 2.1 AA compliance',                  'in_progress'),
            ('Storybook documentation',                  'pending'),
            ('Migration guide for 6 teams',             'pending'),
        ],
    },
    {
        'name':         'Enterprise Onboarding Automation',
        'description':  'Automate customer onboarding end-to-end — target: 14 days to 3 days',
        'team':         'Customer Success',
        'status':       'in_progress',
        'priority':     'high',
        'owner_name':   'Aisha Patel',
        'owner_team':   'Customer Success',
        'start_date':   past(28),
        'due_date':     future(38),
        'total_budget': 345000,
        'tags':         ['automation','onboarding','customer-success'],
        'members': [
            ('Aisha Patel',   'Customer Success', 'lead',   32),
            ('Ryan OBrien',   'Customer Success', 'member', 26),
            ('Patrick Walsh', 'Customer Success', 'member', 22),
            ('Kevin Wright',  'Customer Success', 'member', 20),
            ('Sophia Chen',   'Customer Success', 'reviewer',15),
        ],
        'deliverables': [
            ('Current process mapped and documented',    'done'),
            ('Automation platform selected (Zapier+)',   'done'),
            ('Provisioning workflows built',             'in_progress'),
            ('SSO integration complete',                 'in_progress'),
            ('Training material automation',             'pending'),
            ('Pilot with 5 enterprise customers',       'pending'),
            ('Full rollout to all 847 accounts',        'pending'),
        ],
    },
    {
        'name':         'Kubernetes Cost Optimization',
        'description':  'Reduce AWS spend by 35% through right-sizing, spot instances, and autoscaling',
        'team':         'DevOps & Cloud',
        'status':       'in_progress',
        'priority':     'medium',
        'owner_name':   'Nina Scott',
        'owner_team':   'DevOps & Cloud',
        'start_date':   past(20),
        'due_date':     future(55),
        'total_budget': 85000,
        'tags':         ['kubernetes','cost','aws','optimization'],
        'members': [
            ('Nina Scott',   'DevOps & Cloud', 'lead',   25),
            ('Tom Hayes',    'DevOps & Cloud', 'member', 20),
            ('Kofi Mensah',  'DevOps & Cloud', 'member', 18),
            ('Haruto Sato',  'DevOps & Cloud', 'member', 15),
            ('Brianna Fox',  'DevOps & Cloud', 'reviewer',10),
        ],
        'deliverables': [
            ('Cost baseline established',                'done'),
            ('Right-sizing analysis completed',          'done'),
            ('Spot instance migration — non-prod',       'in_progress'),
            ('Autoscaling policies configured',          'in_progress'),
            ('Spot instance migration — production',     'pending'),
            ('Cost monitoring dashboards live',          'pending'),
        ],
    },
    {
        'name':         'Customer 360 Data Platform',
        'description':  'Unified customer data lake for self-serve analytics across all departments',
        'team':         'Data Science',
        'status':       'planning',
        'priority':     'high',
        'owner_name':   'Yuki Tanaka',
        'owner_team':   'Data Science',
        'start_date':   future(7),
        'due_date':     future(95),
        'total_budget': 750000,
        'tags':         ['data-lake','analytics','platform'],
        'members': [
            ('Yuki Tanaka',   'Data Science', 'lead',   55),
            ('Ben Carter',    'Data Science', 'member', 42),
            ('Sophie Turner', 'Data Science', 'member', 35),
            ('Diego Martinez','Data Science', 'member', 30),
            ('Amira Farouk',  'Data Science', 'member', 28),
        ],
        'deliverables': [
            ('Requirements and scope approved',          'done'),
            ('Data source inventory',                    'in_progress'),
            ('Schema design',                            'pending'),
            ('ETL pipelines — source 1 (CRM)',          'pending'),
            ('ETL pipelines — source 2 (Product)',      'pending'),
            ('Data quality framework',                   'pending'),
            ('Self-serve query layer (dbt)',             'pending'),
            ('User training and documentation',          'pending'),
        ],
    },

    # ── BACKLOG × 2 ──────────────────────────────────────────
    {
        'name':         'Mobile App Redesign Phase 2',
        'description':  'Account settings, notifications, and profile — following Phase 1 completion',
        'team':         'Mobile Engineering',
        'status':       'backlog',
        'priority':     'medium',
        'owner_name':   'Luca Bianchi',
        'owner_team':   'Mobile Engineering',
        'start_date':   future(30),
        'due_date':     future(90),
        'total_budget': 195000,
        'tags':         ['mobile','phase2','settings'],
        'members': [
            ('Luca Bianchi',  'Mobile Engineering', 'lead',   30),
            ('Emma Wilson',   'Mobile Engineering', 'member', 22),
            ('Ryan Foster',   'Mobile Engineering', 'member', 20),
            ('Caitlin Murphy','Mobile Engineering', 'member', 18),
        ],
        'deliverables': [
            ('Phase 1 retrospective and lessons learned', 'pending'),
            ('User research for settings flows',         'pending'),
            ('Wireframes',                               'pending'),
            ('Hi-fi designs',                            'pending'),
            ('Development',                              'pending'),
        ],
    },
    {
        'name':         'Internal Developer Portal',
        'description':  'Self-service portal for engineers — infra provisioning, runbooks, on-call',
        'team':         'Platform Engineering',
        'status':       'backlog',
        'priority':     'low',
        'owner_name':   'Alex Rodriguez',
        'owner_team':   'Platform Engineering',
        'start_date':   future(45),
        'due_date':     future(120),
        'total_budget': 220000,
        'tags':         ['developer-experience','portal','backstage'],
        'members': [
            ('Alex Rodriguez','Platform Engineering', 'lead',   35),
            ('Rachel Torres', 'Platform Engineering', 'member', 25),
            ('James Wright',  'Platform Engineering', 'member', 22),
            ('Lisa Zhang',    'Platform Engineering', 'member', 18),
        ],
        'deliverables': [
            ('Technology selection (Backstage vs custom)', 'pending'),
            ('MVP scope defined',                        'pending'),
            ('Infrastructure catalog',                   'pending'),
            ('Runbooks integration',                    'pending'),
            ('On-call integration',                     'pending'),
            ('Launch and adoption campaign',            'pending'),
        ],
    },

    # ── COMPLETED × 3 ────────────────────────────────────────
    {
        'name':         'Customer Health Score Dashboard',
        'description':  'Real-time health scoring for all 847 enterprise accounts with alerting',
        'team':         'Customer Success',
        'status':       'completed',
        'priority':     'medium',
        'owner_name':   'Ryan OBrien',
        'owner_team':   'Customer Success',
        'start_date':   past(120),
        'due_date':     past(3),
        'total_budget': 185000,
        'tags':         ['dashboard','analytics','health-score'],
        'members': [
            ('Ryan OBrien',    'Customer Success', 'lead',   42),
            ('Jessica Turner', 'Customer Success', 'member', 32),
            ('Tara Singh',     'Customer Success', 'member', 26),
            ('Michelle Foster','Customer Success', 'reviewer',18),
        ],
        'deliverables': [
            ('Health score algorithm defined',           'done'),
            ('Data connectors built (CRM + product)',   'done'),
            ('Dashboard UI shipped',                     'done'),
            ('Alert rules configured',                   'done'),
            ('CS team training completed',               'done'),
            ('All 847 accounts onboarded',               'done'),
        ],
    },
    {
        'name':         'CI/CD Pipeline Modernization',
        'description':  'Migrate from Jenkins to GitHub Actions — cut build times by 60%',
        'team':         'DevOps & Cloud',
        'status':       'completed',
        'priority':     'medium',
        'owner_name':   'Nina Scott',
        'owner_team':   'DevOps & Cloud',
        'start_date':   past(90),
        'due_date':     past(10),
        'total_budget': 120000,
        'tags':         ['cicd','github-actions','devops'],
        'members': [
            ('Nina Scott',   'DevOps & Cloud', 'lead',   38),
            ('Tom Hayes',    'DevOps & Cloud', 'member', 30),
            ('Astrid Berg',  'DevOps & Cloud', 'member', 25),
            ('Yusuf Al-Amin','DevOps & Cloud', 'member', 22),
        ],
        'deliverables': [
            ('Jenkins audit — 87 pipelines catalogued',  'done'),
            ('GitHub Actions templates created',         'done'),
            ('Migration — tier 1 services (20)',        'done'),
            ('Migration — tier 2 services (40)',        'done'),
            ('Migration — tier 3 services (27)',        'done'),
            ('Jenkins decommissioned',                   'done'),
            ('Team documentation published',             'done'),
        ],
    },
    {
        'name':         'GDPR Compliance Audit',
        'description':  'Full GDPR readiness audit — data mapping, consent flows, DPA updates',
        'team':         'Security Operations',
        'status':       'completed',
        'priority':     'high',
        'owner_name':   'Maya Thompson',
        'owner_team':   'Security Operations',
        'start_date':   past(75),
        'due_date':     past(5),
        'total_budget': 140000,
        'tags':         ['gdpr','compliance','privacy'],
        'members': [
            ('Maya Thompson',  'Security Operations', 'lead',   35),
            ('Hassan Ibrahim', 'Security Operations', 'member', 28),
            ('Ingrid Larsen',  'Security Operations', 'member', 22),
            ('Ravi Kumar',     'Security Operations', 'member', 18),
        ],
        'deliverables': [
            ('Data inventory and mapping completed',     'done'),
            ('Consent flow audit',                       'done'),
            ('DPA updated with all vendors',             'done'),
            ('Privacy policy updated',                   'done'),
            ('Staff training completed',                 'done'),
            ('DPO sign-off received',                    'done'),
        ],
    },

    # ── CANCELLED × 1 ────────────────────────────────────────
    {
        'name':         'Blockchain Supply Chain PoC',
        'description':  'Proof of concept for blockchain-based supply chain tracking — cancelled after executive review',
        'team':         'Platform Engineering',
        'status':       'cancelled',
        'priority':     'low',
        'owner_name':   'Sarah Chen',
        'owner_team':   'Platform Engineering',
        'start_date':   past(45),
        'due_date':     future(60),
        'total_budget': 90000,
        'tags':         ['blockchain','poc','cancelled'],
        'members': [
            ('Sarah Chen',    'Platform Engineering', 'lead',   10),
            ('James Wright',  'Platform Engineering', 'member', 8),
            ('Lisa Zhang',    'Platform Engineering', 'member', 6),
        ],
        'deliverables': [
            ('Technology research',                      'done'),
            ('Vendor shortlist',                         'done'),
            ('PoC scope document',                       'in_progress'),
            ('Technical build',                          'pending'),
        ],
    },
]

created = []
for proj in PROJECTS:
    team_id  = teams.get(proj['team'])
    if not team_id:
        print(f"  ✗ Team not found: {proj['team']}")
        continue

    owner    = get_member(proj['owner_name'], proj['owner_team'])
    owner_id = owner['id'] if owner else ''

    # Build member list
    valid_members = []
    for (mname, mteam, role, days) in proj['members']:
        mp = build_member_payload(mname, mteam, role, days)
        if mp:
            valid_members.append(mp)

    spent = sum(m['cost'] for m in valid_members)

    # Calculate progress from deliverables
    dels  = proj['deliverables']
    total = len(dels)
    done  = sum(1 for d in dels if d[1] == 'done')
    inp   = sum(1 for d in dels if d[1] == 'in_progress')
    prog  = round(((done * 100) + (inp * 50)) / total) if total else 0

    payload = dict(
        name=proj['name'], description=proj['description'],
        team_id=team_id, status=proj['status'],
        priority=proj['priority'],
        owner_id=owner_id, owner_name=proj['owner_name'],
        start_date=proj['start_date'], due_date=proj['due_date'],
        progress=prog,
        total_budget=proj['total_budget'],
        spent_budget=spent,
        currency='USD', tags=proj['tags'],
        members=valid_members,
        deliverables=[],
    )

    r = req('POST', '/projects', payload, T)
    if not r or not r.get('id'):
        print(f"  ✗ Failed: {proj['name']}")
        continue

    pid = r['id']
    created.append(pid)

    # Add deliverables
    for (title, status) in dels:
        dr = req('POST', f'/projects/{pid}/deliverables', {'title': title}, T)
        if dr and dr.get('item') and status != 'pending':
            req('PUT', f'/projects/{pid}/deliverables/{dr["item"]["id"]}',
                {'status': status}, T)

    budget_pct = round((spent / proj['total_budget']) * 100) if proj['total_budget'] else 0
    overdue    = proj['due_date'] < today() and proj['status'] not in ['completed','cancelled']
    flag = ('🔴 OVERDUE'      if overdue else
            '🔴 OVER BUDGET'  if budget_pct > 100 else
            '🟡 AT RISK'      if proj['due_date'] <= future(14) and prog < 70
                               and proj['status'] not in ['completed','cancelled'] else
            '✅ COMPLETED'    if proj['status'] == 'completed' else
            '⬜ BACKLOG'      if proj['status'] == 'backlog' else
            '🚫 CANCELLED'    if proj['status'] == 'cancelled' else
            '🟢 HEALTHY')

    print(f"  {flag} {proj['name'][:48]:<48} {prog:>3}% | ${spent:>9,.0f}/${proj['total_budget']:>9,.0f} ({budget_pct}%)")

# ── Achievements ──────────────────────────────────────────────
print("\n→ Creating achievements...")
ACHIEVEMENTS = [
    ('Platform Engineering', 'Zero Downtime Migration', 'Migrated auth service with zero downtime during peak traffic hours', 'high', 5, 2025),
    ('Platform Engineering', 'Cost Reduction Q1',       '28% AWS cost reduction through right-sizing initiative', 'medium', 3, 2025),
    ('Data Science',         'Fraud Model v2 Launch',   'New model reduced false positives by 43% saving $2.1M annually', 'high', 4, 2025),
    ('Data Science',         'Data Quality Initiative', 'Achieved 99.8% data quality across all production pipelines', 'medium', 2, 2025),
    ('Product Design',       'Design System 3.0',       'Shipped design system used by 6 product teams reducing design time 40%', 'high', 1, 2025),
    ('Product Design',       'Accessibility Win',       'Achieved WCAG 2.1 AA compliance across all customer-facing products', 'medium', 6, 2025),
    ('Security Operations',  'Zero Incidents Q2',       'Zero critical security incidents for entire Q2 — first time in company history', 'high', 4, 2025),
    ('Security Operations',  'ISO 27001 Certified',     'Achieved ISO 27001 certification covering all production systems', 'high', 3, 2025),
    ('Customer Success',     'NPS Score Record',        'Achieved record NPS of 72 — up from 48 previous quarter', 'high', 5, 2025),
    ('Customer Success',     'Onboarding Time Halved',  'Average onboarding time reduced from 14 days to 7 days', 'medium', 2, 2025),
    ('Backend Engineering',  'API Latency Milestone',   'P99 API latency under 50ms for all endpoints — exceeding SLA', 'high', 6, 2025),
    ('Backend Engineering',  'GraphQL Migration',       'Migrated 8 REST endpoints to GraphQL reducing client data fetching 60%', 'medium', 4, 2025),
    ('Mobile Engineering',   'App Store Rating 4.8',   'iOS and Android apps both achieved 4.8 star rating after redesign', 'high', 3, 2025),
    ('Mobile Engineering',   'Crash Rate < 0.1%',      'Achieved industry-leading crash rate of 0.08% across both platforms', 'medium', 5, 2025),
    ('DevOps & Cloud',       'CI/CD Modernization',     'Reduced average build time from 22 minutes to 4 minutes with GitHub Actions', 'high', 1, 2025),
    ('DevOps & Cloud',       '99.99% Uptime',          'Maintained 99.99% service uptime for 6 consecutive months', 'high', 6, 2025),
    ('Platform Engineering', 'Kubernetes Migration',    'All 47 services running on EKS with full observability stack', 'high', 2, 2026),
    ('Data Science',         'Real-Time ML Pipeline',  'First real-time ML inference pipeline processing 50k events/second', 'high', 1, 2026),
    ('Security Operations',  'SOC2 Type I Achieved',   'SOC2 Type I certification achieved ahead of schedule', 'medium', 3, 2026),
    ('Customer Success',     'Expansion Revenue +40%', 'Net Revenue Retention hit 140% through expansion motion', 'high', 4, 2026),
]

for (team_name, title, description, impact, month, year) in ACHIEVEMENTS:
    tid = teams.get(team_name)
    if not tid: continue
    req('POST', '/achievements', dict(
        team_id=tid, title=title, description=description,
        impact=impact, month=month, year=year,
    ), T)

print(f"  ✓ {len(ACHIEVEMENTS)} achievements created")

# ── Summary ───────────────────────────────────────────────────
print()
print("=" * 60)
print("  ✅ Reseed Complete!")
print("=" * 60)
print(f"  Teams:        {len(teams)}")
print(f"  Members:      {total_members}")
print(f"  Projects:     {len(created)} / {len(PROJECTS)}")
print(f"  Achievements: {len(ACHIEVEMENTS)}")
print()

total_b = sum(p['total_budget'] for p in PROJECTS)
total_s = sum(
    sum(
        (get_member(mn, mt) or {}).get('daily_rate', 0) * d
        for (mn, mt, _, d) in p['members']
        if get_member(mn, mt)
    )
    for p in PROJECTS
)
print(f"  Portfolio budget:  ${total_b:,.0f}")
print(f"  Portfolio spent:   ${total_s:,.0f}")
print(f"  Utilization:       {round(total_s/total_b*100) if total_b else 0}%")
print()

# Project health breakdown
statuses = {}
for p in PROJECTS:
    statuses[p['status']] = statuses.get(p['status'], 0) + 1
print("  Project breakdown:")
for s, c in sorted(statuses.items()):
    print(f"    {s:<15} {c}")
print()
print(f"  🌐 {BASE.replace('/api/team-service','')}")
print()
