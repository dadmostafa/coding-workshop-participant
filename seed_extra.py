#!/usr/bin/env python3
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
        print(f"  !! {e.code}: {e.read().decode()[:200]}")
        return None

auth = req('POST', '/auth/login', {'username':'admin','password':'admin123'})
if not auth: print("Login failed"); sys.exit(1)
T = auth['token']
print("Logged in")

projects = req('GET', '/projects', token=T) or []
members  = req('GET', '/members',  token=T) or []
member_map = {m['name']: m for m in members}

RATES = {
    'Engineering Manager': 950, 'Head of Data Science': 1100,
    'Design Director': 900, 'CISO': 1200, 'VP Customer Success': 1000,
    'Senior Engineer': 850, 'ML Engineer': 900, 'Senior UX Designer': 800,
    'Security Analyst': 750, 'Account Manager': 700, 'DevOps Engineer': 800,
    'Data Analyst': 700, 'Visual Designer': 700, 'SOC Analyst': 700,
    'Onboarding Specialist': 650, 'Cloud Architect': 1100, 'Pen Tester': 950,
    'UX Researcher': 850, 'ML Ops Engineer': 900, 'Compliance Officer': 880,
    'Backend Engineer': 820, 'Platform Engineer': 830, 'Data Engineer': 850,
    'Research Scientist': 950, 'default': 750,
}

BUDGET_CONFIG = {
    'Zero Trust Security Implementation':  {'total': 500000,  'days': {'lead':65,'member':45,'reviewer':25}},
    'Mobile App Redesign Phase 1':         {'total': 280000,  'days': {'lead':42,'member':32,'reviewer':15}},
    'Real-Time Fraud Detection v3':        {'total': 620000,  'days': {'lead':40,'member':30,'reviewer':15}},
    'SOC2 Type II Renewal':                {'total': 160000,  'days': {'lead':30,'member':22,'reviewer':12}},
    'Legacy Auth Migration':               {'total': 380000,  'days': {'lead':50,'member':38,'reviewer':18}},
    'Data Warehouse Rebuild':              {'total': 540000,  'days': {'lead':55,'member':40,'reviewer':20}},
    'Infrastructure Modernization':        {'total': 480000,  'days': {'lead':40,'member':30,'reviewer':15}},
    'API Gateway Consolidation':           {'total': 190000,  'days': {'lead':30,'member':22,'reviewer':12}},
    'Design System 4.0':                   {'total': 295000,  'days': {'lead':32,'member':22,'reviewer':12}},
    'Enterprise Onboarding Automation':    {'total': 345000,  'days': {'lead':32,'member':22,'reviewer':12}},
    'Kubernetes Cost Optimization':        {'total': 85000,   'days': {'lead':25,'member':18,'reviewer':10}},
    'Customer 360 Data Platform':          {'total': 750000,  'days': {'lead':50,'member':35,'reviewer':18}},
    'Mobile App Redesign Phase 2':         {'total': 195000,  'days': {'lead':0, 'member':0, 'reviewer':0}},
    'Internal Developer Portal':           {'total': 220000,  'days': {'lead':0, 'member':0, 'reviewer':0}},
    'Customer Health Score Dashboard':     {'total': 185000,  'days': {'lead':42,'member':30,'reviewer':15}},
    'CI/CD Pipeline Modernization':        {'total': 120000,  'days': {'lead':38,'member':28,'reviewer':14}},
    'GDPR Compliance Audit':               {'total': 140000,  'days': {'lead':35,'member':25,'reviewer':12}},
    'Blockchain Supply Chain PoC':         {'total': 90000,   'days': {'lead':10,'member':8, 'reviewer':4}},
}

print(f"\nUpdating {len(projects)} projects...\n")

for proj in projects:
    pid    = proj['id']
    pname  = proj['name']
    cfg    = BUDGET_CONFIG.get(pname, {'total': 250000, 'days': {'lead':30,'member':22,'reviewer':12}})
    total  = cfg['total']
    dmap   = cfg['days']

    proj_members = proj.get('members', [])
    if not proj_members:
        req('PUT', f'/projects/{pid}', {'total_budget': total}, T)
        print(f"  ~ {pname[:45]} — budget set ${total:,.0f} (no members)")
        continue

    updated = []
    spent   = 0
    for pm in proj_members:
        mfull = member_map.get(pm.get('member_name',''), {})
        role  = pm.get('role','member')
        rate  = mfull.get('daily_rate',0) or RATES.get(mfull.get('role',''), RATES['default'])
        days  = dmap.get(role, dmap.get('member', 20))
        cost  = rate * days
        spent += cost
        updated.append({
            'member_id':      pm.get('member_id',''),
            'member_name':    pm.get('member_name',''),
            'role':           role,
            'member_type':    pm.get('member_type', mfull.get('employment_type','direct')),
            'daily_rate':     rate,
            'days_allocated': days,
            'cost':           cost,
        })

    req('PUT', f'/projects/{pid}', {
        'total_budget': total,
        'spent_budget': spent,
        'members':      updated,
    }, T)

    pct  = round((spent/total)*100) if total else 0
    icon = '🔴' if pct > 100 else '🟡' if pct >= 80 else '🟢' if pct > 0 else '⬜'
    print(f"  {icon} {pname[:42]:<42} ${spent:>9,.0f} / ${total:>9,.0f} ({pct}%)")

projects_fresh = req('GET', '/projects', token=T) or []
total_b = sum(p.get('total_budget',0) or 0 for p in projects_fresh)
total_s = sum(p.get('spent_budget',0)  or 0 for p in projects_fresh)
util    = round((total_s/total_b)*100) if total_b else 0

print(f"\n✅ Done!")
print(f"   Projects:     {len(projects_fresh)}")
print(f"   Total budget: ${total_b:,.0f}")
print(f"   Total spent:  ${total_s:,.0f}")
print(f"   Utilization:  {util}%")
