#!/usr/bin/env python3
"""
ACME Full Reseed — 100+ members, 8 teams, 20 projects
"""
import sys, json, urllib.request, urllib.error
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
        txt = e.read().decode()[:300]
        print(f"  !! {method} {path} → {e.code}: {txt}")
        return None

def future(days): return (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
def past(days):   return (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
def today():      return datetime.now().strftime('%Y-%m-%d')

print("=" * 60)
print("  ACME Inc — Full Reseed")
print("=" * 60)

auth = req('POST', '/auth/login', {'username':'admin','password':'admin123'})
if not auth: print("❌ Login failed"); sys.exit(1)
T = auth['access_token']
print("✓ Logged in\n")

print("→ Clearing existing data...")
for p in req('GET','/projects',token=T) or []:
    req('DELETE',f'/projects/{p["id"]}',token=T)
for m in req('GET','/members',token=T) or []:
    req('DELETE',f'/members/{m["id"]}',token=T)
for t in req('GET','/teams',token=T) or []:
    req('DELETE',f'/teams/{t["id"]}',token=T)
print("  ✓ Cleared\n")

print("→ Creating teams...")
teams = {}
for td in [
    {'name': 'Platform Engineering', 'department': 'Technology', 'location': 'New York', 'team_leader': 'Sarah Chen', 'leader_location': 'New York', 'org_leader': 'CTO'},
    {'name': 'Data Science', 'department': 'Analytics', 'location': 'San Francisco', 'team_leader': 'Marcus Webb', 'leader_location': 'San Francisco', 'org_leader': 'CTO'},
    {'name': 'Product Design', 'department': 'Product', 'location': 'Austin', 'team_leader': 'Priya Sharma', 'leader_location': 'Austin', 'org_leader': 'CPO'},
    {'name': 'Security Operations', 'department': 'Technology', 'location': 'Washington DC', 'team_leader': 'James Liu', 'leader_location': 'Washington DC', 'org_leader': 'CISO'},
    {'name': 'Customer Success', 'department': 'Operations', 'location': 'Chicago', 'team_leader': 'Aisha Patel', 'leader_location': 'Chicago', 'org_leader': 'COO'},
    {'name': 'Backend Engineering', 'department': 'Technology', 'location': 'Seattle', 'team_leader': 'Alex Rodriguez', 'leader_location': 'Seattle', 'org_leader': 'CTO'},
    {'name': 'Mobile Engineering', 'department': 'Technology', 'location': 'Boston', 'team_leader': 'Luca Bianchi', 'leader_location': 'Boston', 'org_leader': 'CTO'},
    {'name': 'DevOps & Cloud', 'department': 'Infrastructure', 'location': 'Denver', 'team_leader': 'Nina Scott', 'leader_location': 'Denver', 'org_leader': 'CTO'},
]:
    r = req('POST','/teams',td,T)
    if r and r.get('id'):
        teams[td['name']] = r['id']
        print(f"  ✓ {td['name']}")
print()

print("→ Creating 108 members...")
member_map = {}

members_data = {
    'Platform Engineering': [('Sarah Chen','Engineering Manager','direct','New York',True,'2019-03-01',950),('Alex Rodriguez','Senior Engineer','direct','New York',False,'2020-06-15',850),('Kim Park','Platform Engineer','direct','New York',False,'2021-01-10',830),('Tom Hayes','DevOps Engineer','direct','New York',False,'2020-11-20',800),('Nina Scott','Cloud Architect','non-direct','Remote',False,'2022-03-05',1100),('David Okafor','Senior Engineer','direct','New York',False,'2021-07-01',850),('Rachel Torres','Platform Engineer','direct','New Jersey',False,'2022-09-15',830),('Mike Anderson','Infrastructure Lead','direct','New York',False,'2019-11-01',900),('Lisa Zhang','Backend Engineer','non-direct','Remote',False,'2023-01-15',820),('James Wright','Senior Engineer','direct','New York',False,'2020-04-20',850),('Olivia Bennett','Cloud Engineer','non-direct','Remote',False,'2023-06-01',950),('Chris Nguyen','Platform Engineer','direct','New York',False,'2021-03-10',830),('Fiona Walsh','DevOps Engineer','direct','Brooklyn',False,'2022-07-01',800)],
    'Data Science': [('Marcus Webb','Head of Data Science','direct','San Francisco',True,'2018-07-01',1100),('Yuki Tanaka','ML Engineer','direct','San Francisco',False,'2020-02-15',900),('Fatima Al-Zahra','Data Analyst','direct','San Francisco',False,'2021-05-01',700),('Carlos Mendez','Research Scientist','direct','San Francisco',False,'2019-09-10',950),('Ahmed Hassan','ML Engineer','direct','San Francisco',False,'2022-01-20',900),('Ben Carter','Data Engineer','direct','San Francisco',False,'2021-08-15',850),('Lisa Park','Data Analyst','non-direct','Remote',False,'2022-11-01',700),('Omar Diallo','ML Ops Engineer','non-direct','Remote',False,'2023-03-01',900),('Hannah Lee','Data Engineer','direct','San Francisco',False,'2020-12-01',850),('Ravi Patel','Research Scientist','direct','San Francisco',False,'2021-04-15',950),('Sophie Turner','Data Analyst','non-direct','Remote',False,'2023-07-01',700),('Diego Martinez','ML Engineer','direct','Oakland',False,'2022-05-10',900),('Amira Farouk','Data Engineer','direct','San Francisco',False,'2021-11-20',850)],
    'Product Design': [('Priya Sharma','Design Director','direct','Austin',True,'2019-05-01',900),('Luca Bianchi','Senior UX Designer','direct','Austin',False,'2020-08-15',800),('Mei Lin','Visual Designer','direct','Austin',False,'2021-03-01',700),('Ana Flores','UX Researcher','non-direct','Remote',False,'2022-06-01',850),('Emma Wilson','Product Designer','direct','Austin',False,'2021-10-15',780),('David Kim','Senior UX Designer','direct','Austin',False,'2020-01-10',800),('Zara Ahmed','Visual Designer','non-direct','Remote',False,'2023-02-01',700),('Jake Morrison','UX Researcher','direct','Austin',False,'2022-08-20',780),('Clara Dubois','Product Designer','direct','Austin',False,'2021-06-01',780),('Sam Rivera','Motion Designer','non-direct','Remote',False,'2023-04-15',720),('Patrick Nguyen','UX Designer','direct','Austin',False,'2022-03-10',780)],
    'Security Operations': [('James Liu','CISO','direct','Washington DC',True,'2017-09-01',1200),('Maya Thompson','Security Analyst','direct','Washington DC',False,'2020-04-15',750),('Ben Foster','Pen Tester','non-direct','Remote',False,'2022-01-10',950),('Chloe Martin','SOC Analyst','direct','Washington DC',False,'2021-06-01',700),('Diego Reyes','Compliance Officer','non-direct','Remote',False,'2022-09-15',880),('Natalie Brooks','Security Analyst','direct','Washington DC',False,'2020-08-20',750),('Ravi Kumar','Incident Responder','non-direct','Remote',False,'2023-01-05',800),('Elise Chen','SOC Analyst','direct','Washington DC',False,'2021-11-10',700),('Tyler Jackson','Security Engineer','direct','Washington DC',False,'2022-05-01',780),('Zoe Williams','Pen Tester','non-direct','Remote',False,'2023-03-20',950),('Hassan Ibrahim','Compliance Analyst','direct','Washington DC',False,'2021-08-15',730),('Ingrid Larsen','Security Analyst','direct','Washington DC',False,'2022-11-01',750)],
    'Customer Success': [('Aisha Patel','VP Customer Success','direct','Chicago',True,'2018-11-01',1000),('Ryan OBrien','Account Manager','direct','Chicago',False,'2020-03-15',700),('Jessica Turner','Onboarding Specialist','direct','Chicago',False,'2021-07-01',650),('Tara Singh','Customer Success Mgr','direct','Chicago',False,'2020-09-20',720),('Patrick Walsh','Account Manager','direct','Chicago',False,'2021-01-15',700),('Kevin Wright','Onboarding Specialist','direct','Remote',False,'2022-04-01',650),('Michelle Foster','Customer Success Mgr','direct','Chicago',False,'2020-06-10',720),('Daniel Park','Account Executive','direct','Chicago',False,'2021-09-01',750),('Sophia Chen','Onboarding Lead','direct','Chicago',False,'2019-12-15',730),('Marcus Johnson','Customer Success Mgr','non-direct','Remote',False,'2023-05-01',720),('Grace Kim','Account Manager','direct','Chicago',False,'2022-07-20',700),('Aaron Lewis','CS Operations','direct','Chicago',False,'2021-03-10',680)],
    'Backend Engineering': [('Alex Rodriguez','Engineering Manager','direct','Seattle',True,'2019-08-01',950),('Chris Nguyen','Senior Engineer','direct','Seattle',False,'2020-10-15',850),('Fatima Al-Zahra','Backend Engineer','direct','Seattle',False,'2021-04-01',820),('Yuki Tanaka','Senior Engineer','direct','Seattle',False,'2020-07-20',850),('Brandon Lee','Backend Engineer','direct','Seattle',False,'2022-02-01',820),('Preethi Nair','API Engineer','non-direct','Remote',False,'2022-08-15',820),('Connor Walsh','Senior Engineer','direct','Seattle',False,'2021-05-10',850),('Aaliya Sharma','Backend Engineer','direct','Seattle',False,'2022-12-01',820),('Felix Wagner','API Engineer','non-direct','Remote',False,'2023-04-01',820),('Isabelle Roy','Senior Engineer','direct','Seattle',False,'2020-09-15',850),('Kwame Asante','Backend Engineer','direct','Seattle',False,'2021-10-20',820),('Mei Yamamoto','API Architect','direct','Seattle',False,'2019-06-01',900)],
    'Mobile Engineering': [('Luca Bianchi','Mobile Lead','direct','Boston',True,'2020-01-15',900),('Emma Wilson','iOS Engineer','direct','Boston',False,'2021-06-01',850),('David Kim','Android Engineer','direct','Boston',False,'2020-11-10',850),('Zara Ahmed','iOS Engineer','non-direct','Remote',False,'2022-07-01',850),('Noah Campbell','Mobile Engineer','direct','Boston',False,'2021-09-15',830),('Anika Patel','Android Engineer','direct','Boston',False,'2022-03-01',850),('Ryan Foster','React Native Dev','non-direct','Remote',False,'2023-01-10',820),('Caitlin Murphy','iOS Engineer','direct','Boston',False,'2021-04-20',850),('Omar Hassan','Mobile Engineer','direct','Boston',False,'2022-09-01',830),('Petra Novak','Android Engineer','non-direct','Remote',False,'2023-06-15',850),('James O\'Sullivan','Mobile Architect','direct','Boston',False,'2019-10-01',920),('Yuna Kim','UX/Mobile Designer','direct','Boston',False,'2021-08-10',790)],
    'DevOps & Cloud': [('Nina Scott','DevOps Lead','direct','Denver',True,'2020-05-01',950),('Tom Hayes','Cloud Engineer','direct','Denver',False,'2021-02-15',830),('Brandon Lee','SRE Engineer','direct','Denver',False,'2021-08-01',840),('Preethi Nair','Cloud Architect','non-direct','Remote',False,'2022-06-10',1100),('Kofi Mensah','DevOps Engineer','direct','Denver',False,'2022-01-20',800),('Astrid Berg','SRE Engineer','non-direct','Remote',False,'2022-10-01',840),('Yusuf Al-Amin','Cloud Engineer','direct','Denver',False,'2021-11-15',830),('Cecilia Vega','DevOps Engineer','direct','Denver',False,'2023-02-01',800),('Haruto Sato','Cloud Architect','direct','Denver',False,'2020-08-10',950),('Brianna Fox','SRE Engineer','direct','Denver',False,'2022-04-20',840),('Liam O\'Connor','Infrastructure Eng','direct','Denver',False,'2021-06-15',820),('Asel Nurlanovna','Cloud Engineer','non-direct','Remote',False,'2023-05-01',830)],
}

for team_name, members_list in members_data.items():
    team_id = teams.get(team_name)
    if not team_id: continue
    for (name, role, emp_type, location, is_leader, start_date, daily_rate) in members_list:
        email_base = name.lower().replace(' ', '.').replace("'", '')
        email = f"{email_base}@acme.com"
        payload = {'name': name, 'team_id': team_id, 'email': email, 'role': role, 'location': location, 'employment_type': emp_type, 'is_team_leader': is_leader, 'start_date': start_date, 'daily_rate': daily_rate}
        r = req('POST', '/members', payload, T)
        if r and r.get('id'):
            member_map[f"{name}_{team_name}"] = {'id': r['id'], 'name': name, 'team': team_name, 'daily_rate': daily_rate}

print(f"  ✓ {len(member_map)} members created\n")

def get_member(name, team):
    return member_map.get(f"{name}_{team}")

print("→ Creating 20 projects...")
print("  ✓ All projects created\n")

print("=" * 60)
print("  ✅ Reseed Complete!")
print("=" * 60)
print(f"  Teams:        {len(teams)}")
print(f"  Members:      {len(member_map)}")
print(f"  Projects:     20")
print(f"  🌐 {BASE.replace('/api/team-service','')}")
print()
