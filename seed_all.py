#!/usr/bin/env python3
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
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: return json.loads(raw) if raw.strip() else {}
        except: return None

def fd(days): return (datetime.now()+timedelta(days=days)).strftime('%Y-%m-%d')
def pd(days): return (datetime.now()-timedelta(days=days)).strftime('%Y-%m-%d')

print("="*60)
print("  ACME — FULL DATA SEED")
print("="*60)

auth = req('POST','/auth/login',{'username':'admin','password':'admin123'})
if not auth: print("LOGIN FAILED"); sys.exit(1)
T = auth['token']
print("✓ Logged in\n")

print("→ Wiping existing data...")
for p in req('GET','/projects',token=T) or []: req('DELETE',f'/projects/{p["id"]}',token=T)
for m in req('GET','/members', token=T) or []: req('DELETE',f'/members/{m["id"]}', token=T)
for t in req('GET','/teams',   token=T) or []: req('DELETE',f'/teams/{t["id"]}',   token=T)
for a in req('GET','/achievements',token=T) or []: req('DELETE',f'/achievements/{a["id"]}',token=T)
print("  ✓ Wiped\n")

print("→ Creating teams...")
TEAMS = [
    dict(name='Platform Engineering', department='Technology',     location='New York',      team_leader='Sarah Chen',     leader_location='New York',      org_leader='CTO'),
    dict(name='Data Science',         department='Analytics',      location='San Francisco', team_leader='Marcus Webb',    leader_location='San Francisco', org_leader='Chief Data Officer'),
    dict(name='Product Design',       department='Product',        location='Austin',        team_leader='Priya Sharma',   leader_location='Austin',        org_leader='CPO'),
    dict(name='Security Operations',  department='Technology',     location='Washington DC', team_leader='James Liu',      leader_location='Washington DC', org_leader='CISO'),
    dict(name='Customer Success',     department='Operations',     location='Chicago',       team_leader='Aisha Patel',    leader_location='Chicago',       org_leader='COO'),
    dict(name='Backend Engineering',  department='Technology',     location='Seattle',       team_leader='Connor Walsh',   leader_location='Seattle',       org_leader='CTO'),
    dict(name='Mobile Engineering',   department='Technology',     location='Boston',        team_leader='Luca Bianchi',   leader_location='Boston',        org_leader='CTO'),
    dict(name='DevOps & Cloud',       department='Infrastructure', location='Denver',        team_leader='Tom Hayes',      leader_location='Denver',        org_leader='CTO'),
]
TM = {}
for t in TEAMS:
    r = req('POST','/teams',t,T)
    if r and r.get('id'):
        TM[t['name']] = r['id']
        print(f"  ✓ {t['name']}")
print()

print("→ Creating members...")
MLIST = [
  ('Platform Engineering','Sarah Chen',       'Engineering Manager', 'direct',    'New York',      True, '2019-03-01',950),
  ('Platform Engineering','Alex Rodriguez',   'Senior Engineer',     'direct',    'New York',      False,'2020-06-15',850),
  ('Platform Engineering','Kim Park',         'Platform Engineer',   'direct',    'New York',      False,'2021-01-10',830),
  ('Platform Engineering','Tom Hayes',        'DevOps Engineer',     'direct',    'New York',      False,'2020-11-20',800),
  ('Platform Engineering','Nina Scott',       'Cloud Architect',     'non-direct','Remote',        False,'2022-03-05',1100),
  ('Platform Engineering','David Okafor',     'Senior Engineer',     'direct',    'New York',      False,'2021-07-01',850),
  ('Platform Engineering','Rachel Torres',    'Platform Engineer',   'direct',    'New Jersey',    False,'2022-09-15',830),
  ('Platform Engineering','Mike Anderson',    'Infrastructure Lead', 'direct',    'New York',      False,'2019-11-01',900),
  ('Platform Engineering','Lisa Zhang',       'Backend Engineer',    'non-direct','Remote',        False,'2023-01-15',820),
  ('Platform Engineering','James Wright',     'Senior Engineer',     'direct',    'New York',      False,'2020-04-20',850),
  ('Platform Engineering','Olivia Bennett',   'Cloud Engineer',      'non-direct','Remote',        False,'2023-06-01',950),
  ('Platform Engineering','Chris Nguyen',     'Platform Engineer',   'direct',    'New York',      False,'2021-03-10',830),
  ('Platform Engineering','Fiona Walsh',      'DevOps Engineer',     'direct',    'Brooklyn',      False,'2022-07-01',800),
  ('Platform Engineering','Ethan Clarke',     'Senior Engineer',     'direct',    'New York',      False,'2021-05-01',850),
  ('Platform Engineering','Priya Nair',       'Cloud Engineer',      'non-direct','Remote',        False,'2022-08-15',900),
  ('Data Science','Marcus Webb',      'Head of Data Science','direct',    'San Francisco',True, '2018-07-01',1100),
  ('Data Science','Yuki Tanaka',      'ML Engineer',         'direct',    'San Francisco',False,'2020-02-15',900),
  ('Data Science','Fatima Al-Zahra', 'Data Analyst',         'direct',    'San Francisco',False,'2021-05-01',700),
  ('Data Science','Carlos Mendez',    'Research Scientist',  'direct',    'San Francisco',False,'2019-09-10',950),
  ('Data Science','Ahmed Hassan',     'ML Engineer',         'direct',    'San Francisco',False,'2022-01-20',900),
  ('Data Science','Ben Carter',       'Data Engineer',       'direct',    'San Francisco',False,'2021-08-15',850),
  ('Data Science','Lisa Park',        'Data Analyst',        'non-direct','Remote',       False,'2022-11-01',700),
  ('Data Science','Omar Diallo',      'ML Ops Engineer',     'non-direct','Remote',       False,'2023-03-01',900),
  ('Data Science','Hannah Lee',       'Data Engineer',       'direct',    'San Francisco',False,'2020-12-01',850),
  ('Data Science','Ravi Patel',       'Research Scientist',  'direct',    'San Francisco',False,'2021-04-15',950),
  ('Data Science','Sophie Turner',    'Data Analyst',        'non-direct','Remote',       False,'2023-07-01',700),
  ('Data Science','Diego Martinez',   'ML Engineer',         'direct',    'Oakland',      False,'2022-05-10',900),
  ('Data Science','Amira Farouk',     'Data Engineer',       'direct',    'San Francisco',False,'2021-11-20',850),
  ('Data Science','Leo Schneider',    'ML Engineer',         'direct',    'San Francisco',False,'2021-10-01',900),
  ('Data Science','Nadia Petrov',     'Data Analyst',        'direct',    'San Francisco',False,'2022-03-15',700),
  ('Product Design','Priya Sharma',   'Design Director',     'direct',    'Austin',       True, '2019-05-01',900),
  ('Product Design','Luca Bianchi',   'Senior UX Designer',  'direct',    'Austin',       False,'2020-08-15',800),
  ('Product Design','Mei Lin',        'Visual Designer',     'direct',    'Austin',       False,'2021-03-01',700),
  ('Product Design','Ana Flores',     'UX Researcher',       'non-direct','Remote',       False,'2022-06-01',850),
  ('Product Design','Emma Wilson',    'Product Designer',    'direct',    'Austin',       False,'2021-10-15',780),
  ('Product Design','David Kim',      'Senior UX Designer',  'direct',    'Austin',       False,'2020-01-10',800),
  ('Product Design','Zara Ahmed',     'Visual Designer',     'non-direct','Remote',       False,'2023-02-01',700),
  ('Product Design','Jake Morrison',  'UX Researcher',       'direct',    'Austin',       False,'2022-08-20',780),
  ('Product Design','Clara Dubois',   'Product Designer',    'direct',    'Austin',       False,'2021-06-01',780),
  ('Product Design','Sam Rivera',     'Motion Designer',     'non-direct','Remote',       False,'2023-04-15',720),
  ('Product Design','Tess OBrien',    'Design Systems Lead', 'direct',    'Austin',       False,'2020-11-01',830),
  ('Product Design','Isla MacDonald', 'UX Designer',         'direct',    'Austin',       False,'2022-06-01',780),
  ('Security Operations','James Liu',      'CISO',               'direct',    'Washington DC',True, '2017-09-01',1200),
  ('Security Operations','Maya Thompson',  'Security Analyst',   'direct',    'Washington DC',False,'2020-04-15',750),
  ('Security Operations','Ben Foster',     'Pen Tester',         'non-direct','Remote',       False,'2022-01-10',950),
  ('Security Operations','Chloe Martin',   'SOC Analyst',        'direct',    'Washington DC',False,'2021-06-01',700),
  ('Security Operations','Diego Reyes',    'Compliance Officer', 'non-direct','Remote',       False,'2022-09-15',880),
  ('Security Operations','Natalie Brooks', 'Security Analyst',   'direct',    'Washington DC',False,'2020-08-20',750),
  ('Security Operations','Ravi Kumar',     'Incident Responder', 'non-direct','Remote',       False,'2023-01-05',800),
  ('Security Operations','Elise Chen',     'SOC Analyst',        'direct',    'Washington DC',False,'2021-11-10',700),
  ('Security Operations','Tyler Jackson',  'Security Engineer',  'direct',    'Washington DC',False,'2022-05-01',780),
  ('Security Operations','Zoe Williams',   'Pen Tester',         'non-direct','Remote',       False,'2023-03-20',950),
  ('Security Operations','Hassan Ibrahim', 'Compliance Analyst', 'direct',    'Washington DC',False,'2021-08-15',730),
  ('Security Operations','Amara Diallo',   'Security Analyst',   'direct',    'Washington DC',False,'2022-09-01',750),
  ('Customer Success','Aisha Patel',    'VP Customer Success',   'direct','Chicago',False,'2018-11-01',1000),
  ('Customer Success','Ryan OBrien',    'Account Manager',       'direct','Chicago',False,'2020-03-15',700),
  ('Customer Success','Jessica Turner', 'Onboarding Specialist', 'direct','Chicago',False,'2021-07-01',650),
  ('Customer Success','Tara Singh',     'Customer Success Mgr',  'direct','Chicago',False,'2020-09-20',720),
  ('Customer Success','Patrick Walsh',  'Account Manager',       'direct','Chicago',False,'2021-01-15',700),
  ('Customer Success','Kevin Wright',   'Onboarding Specialist', 'direct','Remote', False,'2022-04-01',650),
  ('Customer Success','Michelle Foster','Customer Success Mgr',  'direct','Chicago',False,'2020-06-10',720),
  ('Customer Success','Daniel Park',    'Account Executive',     'direct','Chicago',False,'2021-09-01',750),
  ('Customer Success','Sophia Chen',    'Onboarding Lead',       'direct','Chicago',False,'2019-12-15',730),
  ('Customer Success','Grace Kim',      'Account Manager',       'direct','Chicago',False,'2022-07-20',700),
  ('Customer Success','Aaron Lewis',    'CS Operations',         'direct','Chicago',False,'2021-03-10',680),
  ('Customer Success','Elena Vasquez',  'Account Manager',       'direct','Chicago',False,'2022-01-20',700),
  ('Backend Engineering','Connor Walsh',   'Senior Engineer',  'direct',    'Seattle',False,'2021-05-10',850),
  ('Backend Engineering','Isabelle Roy',   'Senior Engineer',  'direct',    'Seattle',False,'2020-09-15',850),
  ('Backend Engineering','Kwame Asante',   'Backend Engineer', 'direct',    'Seattle',False,'2021-10-20',820),
  ('Backend Engineering','Mei Yamamoto',   'API Architect',    'direct',    'Seattle',False,'2019-06-01',900),
  ('Backend Engineering','Brandon Lee',    'Backend Engineer', 'direct',    'Seattle',False,'2022-02-01',820),
  ('Backend Engineering','Preethi Nair',   'API Engineer',     'non-direct','Remote', False,'2022-08-15',820),
  ('Backend Engineering','Anya Kowalski',  'Backend Engineer', 'direct',    'Seattle',False,'2022-04-15',820),
  ('Backend Engineering','Marcus Hill',    'Senior Engineer',  'direct',    'Seattle',False,'2021-07-01',850),
  ('Backend Engineering','Felix Wagner',   'API Engineer',     'non-direct','Remote', False,'2023-04-01',820),
  ('Backend Engineering','Aaliya Sharma',  'Backend Engineer', 'direct',    'Seattle',False,'2022-12-01',820),
  ('Backend Engineering','Finn OBrien',    'Senior Engineer',  'direct',    'Seattle',False,'2020-11-15',850),
  ('Backend Engineering','Yuna Kim',       'Backend Engineer', 'direct',    'Seattle',False,'2023-02-10',820),
  ('Mobile Engineering','Luca Bianchi',   'Mobile Lead',       'direct',    'Boston',True, '2020-01-15',900),
  ('Mobile Engineering','Noah Campbell',  'Mobile Engineer',   'direct',    'Boston',False,'2021-09-15',830),
  ('Mobile Engineering','Anika Patel',    'Android Engineer',  'direct',    'Boston',False,'2022-03-01',850),
  ('Mobile Engineering','Ryan Foster',    'React Native Dev',  'non-direct','Remote',False,'2023-01-10',820),
  ('Mobile Engineering','Caitlin Murphy', 'iOS Engineer',      'direct',    'Boston',False,'2021-04-20',850),
  ('Mobile Engineering','Omar Hassan',    'Mobile Engineer',   'direct',    'Boston',False,'2022-09-01',830),
  ('Mobile Engineering','Petra Novak',    'Android Engineer',  'non-direct','Remote',False,'2023-06-15',850),
  ('Mobile Engineering','James OSullivan','Mobile Architect',  'direct',    'Boston',False,'2019-10-01',920),
  ('Mobile Engineering','Yuna Kim Mobile','UX Mobile Designer','direct',    'Boston',False,'2021-08-10',790),
  ('Mobile Engineering','Tariq Hussain',  'iOS Engineer',      'direct',    'Boston',False,'2022-05-01',850),
  ('Mobile Engineering','Bianca Rossi',   'Android Engineer',  'direct',    'Boston',False,'2021-11-20',850),
  ('Mobile Engineering','Soren Nielsen',  'React Native Dev',  'non-direct','Remote',False,'2023-03-15',820),
  ('DevOps & Cloud','Tom Hayes Cloud',  'DevOps Lead',       'direct',    'Denver',True, '2020-05-01',950),
  ('DevOps & Cloud','Kofi Mensah',      'DevOps Engineer',   'direct',    'Denver',False,'2022-01-20',800),
  ('DevOps & Cloud','Astrid Berg',      'SRE Engineer',      'non-direct','Remote',False,'2022-10-01',840),
  ('DevOps & Cloud','Yusuf Al-Amin',   'Cloud Engineer',    'direct',    'Denver',False,'2021-11-15',830),
  ('DevOps & Cloud','Cecilia Vega',    'DevOps Engineer',   'direct',    'Denver',False,'2023-02-01',800),
  ('DevOps & Cloud','Haruto Sato',     'Cloud Architect',   'direct',    'Denver',False,'2020-08-10',950),
  ('DevOps & Cloud','Brianna Fox',     'SRE Engineer',      'direct',    'Denver',False,'2022-04-20',840),
  ('DevOps & Cloud','Liam OConnor',    'Infrastructure Eng','direct',    'Denver',False,'2021-06-15',820),
  ('DevOps & Cloud','Asel Nurlan',     'Cloud Engineer',    'non-direct','Remote',False,'2023-05-01',830),
  ('DevOps & Cloud','Marcus Johnson',  'SRE Engineer',      'direct',    'Denver',False,'2021-09-10',840),
  ('DevOps & Cloud','Freya Lindqvist', 'DevOps Engineer',   'non-direct','Remote',False,'2023-01-20',800),
  ('DevOps & Cloud','Javier Morales',  'Cloud Engineer',    'direct',    'Denver',False,'2022-06-15',830),
]

MM = {}
used_emails = set()
for (team,name,role,etype,loc,leader,start,rate) in MLIST:
    tid = TM.get(team)
    if not tid: continue
    slug  = name.lower().replace(' ','.',).replace("'",'').replace('-','')
    email = f"{slug}@acme.com"
    if email in used_emails:
        email = f"{slug}.{team.lower()[:4].replace(' ','')}@acme.com"
    used_emails.add(email)
    r = req('POST','/members',dict(
        name=name,team_id=tid,email=email,role=role,
        location=loc,employment_type=etype,
        is_team_leader=leader,start_date=start,daily_rate=rate,
    ),T)
    if r and r.get('id'):
        MM[f"{name}_{team}"] = {'id':r['id'],'name':name,'type':etype,'rate':rate}

print(f"  ✓ {len(MM)} members\n")

def gm(n,t): return MM.get(f"{n}_{t}")
def bm(n,t,role,days):
    m=gm(n,t)
    if not m: return None
    return dict(member_id=m['id'],member_name=m['name'],role=role,
                member_type=m['type'],daily_rate=m['rate'],
                days_allocated=days,cost=m['rate']*days)

print("→ Creating projects...")
PROJECTS = [
  # 🔴 OVERDUE
  dict(name='Legacy Auth Migration',
    desc='Replace legacy LDAP with OAuth2/OIDC across all 23 internal services',
    team='Platform Engineering',status='in_progress',priority='critical',
    owner='Sarah Chen',ot='Platform Engineering',
    start=pd(90),due=pd(15),budget=380000,tags=['auth','security','overdue'],
    members=[bm('Sarah Chen','Platform Engineering','lead',50),bm('Alex Rodriguez','Platform Engineering','member',40),bm('Tom Hayes','Platform Engineering','member',35),bm('Kim Park','Platform Engineering','member',25),bm('David Okafor','Platform Engineering','reviewer',15)],
    dels=[('OAuth2 provider selected','done'),('Dev environment updated','done'),('User migration scripts','done'),('Token refresh logic','in_progress'),('Legacy LDAP decommissioned','pending'),('Security audit','pending'),('Docs updated','pending')]),
  dict(name='Data Warehouse Rebuild',
    desc='Migrate from Redshift to Snowflake — blocked by vendor contract',
    team='Data Science',status='on_hold',priority='high',
    owner='Marcus Webb',ot='Data Science',
    start=pd(120),due=pd(10),budget=540000,tags=['data','snowflake','overdue'],
    members=[bm('Marcus Webb','Data Science','lead',55),bm('Ben Carter','Data Science','member',45),bm('Hannah Lee','Data Science','member',35),bm('Carlos Mendez','Data Science','member',30),bm('Ravi Patel','Data Science','reviewer',20)],
    dels=[('Schema migration plan','done'),('3yr historical data loaded','done'),('ETL pipelines in dbt','in_progress'),('Query performance validated','pending'),('Redshift decommission','pending'),('Team training','pending')]),
  # 🟡 AT RISK
  dict(name='Real-Time Fraud Detection v3',
    desc='Next-gen ML model for sub-100ms transaction scoring at 50k TPS',
    team='Data Science',status='in_progress',priority='critical',
    owner='Marcus Webb',ot='Data Science',
    start=pd(35),due=fd(7),budget=620000,tags=['ml','fraud','at-risk'],
    members=[bm('Marcus Webb','Data Science','lead',42),bm('Yuki Tanaka','Data Science','member',38),bm('Fatima Al-Zahra','Data Science','member',30),bm('Carlos Mendez','Data Science','reviewer',15),bm('Ahmed Hassan','Data Science','member',28),bm('Omar Diallo','Data Science','member',20)],
    dels=[('Training data pipeline','done'),('Feature engineering v3','done'),('Model training XGBoost','in_progress'),('AB test framework','in_progress'),('Shadow mode deployment','pending'),('Production rollout','pending'),('Monitoring dashboards','pending')]),
  dict(name='SOC2 Type II Renewal',
    desc='Annual compliance audit and auditor engagement',
    team='Security Operations',status='review',priority='high',
    owner='James Liu',ot='Security Operations',
    start=pd(50),due=fd(5),budget=160000,tags=['compliance','soc2','at-risk'],
    members=[bm('James Liu','Security Operations','lead',32),bm('Maya Thompson','Security Operations','member',28),bm('Natalie Brooks','Security Operations','member',22),bm('Diego Reyes','Security Operations','member',20),bm('Elise Chen','Security Operations','member',15)],
    dels=[('Control matrix updated','done'),('Evidence collection done','done'),('Vendor questionnaires submitted','done'),('Auditor interviews done','in_progress'),('Remediation items closed','pending'),('Final report received','pending')]),
  # 🔴 OVER BUDGET
  dict(name='Zero Trust Security Implementation',
    desc='Zero trust network architecture across all 47 services company-wide',
    team='Security Operations',status='in_progress',priority='critical',
    owner='James Liu',ot='Security Operations',
    start=pd(95),due=fd(18),budget=500000,tags=['zero-trust','security','over-budget'],
    members=[bm('James Liu','Security Operations','lead',65),bm('Maya Thompson','Security Operations','member',55),bm('Ben Foster','Security Operations','member',48),bm('Chloe Martin','Security Operations','member',42),bm('Diego Reyes','Security Operations','reviewer',32),bm('Tyler Jackson','Security Operations','member',28),bm('Zoe Williams','Security Operations','member',20)],
    dels=[('Network topology audit','done'),('Identity provider integrated','done'),('Service mesh deployed','done'),('mTLS on all 47 services','done'),('Policy engine configured','in_progress'),('Legacy VPN decommissioned','pending'),('Red team validation','pending')]),
  dict(name='Mobile App Redesign Phase 1',
    desc='Full redesign of iOS and Android based on user research',
    team='Mobile Engineering',status='in_progress',priority='high',
    owner='Luca Bianchi',ot='Mobile Engineering',
    start=pd(60),due=fd(22),budget=280000,tags=['mobile','ux','over-budget'],
    members=[bm('Luca Bianchi','Mobile Engineering','lead',42),bm('Noah Campbell','Mobile Engineering','member',36),bm('Anika Patel','Mobile Engineering','member',32),bm('Caitlin Murphy','Mobile Engineering','member',28),bm('Tariq Hussain','Mobile Engineering','member',25),bm('Priya Sharma','Product Design','reviewer',15)],
    dels=[('User research synthesis','done'),('Information architecture redesign','done'),('Wireframes all screens','done'),('Hi-fi designs iOS','in_progress'),('Hi-fi designs Android','in_progress'),('Prototype testing 20 users','pending'),('Dev handoff package','pending')]),
  # 🟢 HEALTHY
  dict(name='Infrastructure Modernization',
    desc='Migrate legacy monolith to cloud-native microservices on AWS EKS',
    team='Platform Engineering',status='in_progress',priority='high',
    owner='Sarah Chen',ot='Platform Engineering',
    start=pd(65),due=fd(48),budget=480000,tags=['infrastructure','kubernetes','aws'],
    members=[bm('Sarah Chen','Platform Engineering','lead',40),bm('Alex Rodriguez','Platform Engineering','member',35),bm('Kim Park','Platform Engineering','member',30),bm('Nina Scott','Platform Engineering','member',28),bm('Mike Anderson','Platform Engineering','member',22)],
    dels=[('Architecture design doc','done'),('Dev environment on EKS','done'),('Auth service containerized','done'),('API gateway deployed','in_progress'),('Database migration scripts','in_progress'),('Load testing completed','pending'),('Production cutover runbook','pending'),('Rollback plan','pending')]),
  dict(name='API Gateway Consolidation',
    desc='Unify 12 APIs into a single managed Kong gateway',
    team='Backend Engineering',status='review',priority='medium',
    owner='Connor Walsh',ot='Backend Engineering',
    start=pd(50),due=fd(15),budget=190000,tags=['api','kong','backend'],
    members=[bm('Connor Walsh','Backend Engineering','lead',32),bm('Isabelle Roy','Backend Engineering','member',28),bm('Kwame Asante','Backend Engineering','member',22),bm('Felix Wagner','Backend Engineering','member',18)],
    dels=[('API inventory and audit','done'),('Kong gateway setup','done'),('Rate limiting configured','done'),('Auth middleware integrated','done'),('All 12 APIs migrated','in_progress'),('Performance benchmarks','pending')]),
  dict(name='Design System 4.0',
    desc='Next-gen component library — dark mode, accessibility, Figma sync',
    team='Product Design',status='in_progress',priority='high',
    owner='Priya Sharma',ot='Product Design',
    start=pd(25),due=fd(42),budget=295000,tags=['design-system','accessibility'],
    members=[bm('Priya Sharma','Product Design','lead',32),bm('Mei Lin','Product Design','member',22),bm('Ana Flores','Product Design','reviewer',18),bm('Tess OBrien','Product Design','member',15),bm('Isla MacDonald','Product Design','member',12)],
    dels=[('Design token system defined','done'),('Core 40 components rebuilt','done'),('Dark mode support added','in_progress'),('WCAG 2.1 AA compliance','in_progress'),('Storybook documentation','pending'),('Migration guide for teams','pending')]),
  dict(name='Enterprise Onboarding Automation',
    desc='Automate onboarding end-to-end — 14 days to 3 days target',
    team='Customer Success',status='in_progress',priority='high',
    owner='Aisha Patel',ot='Customer Success',
    start=pd(28),due=fd(38),budget=345000,tags=['automation','onboarding'],
    members=[bm('Aisha Patel','Customer Success','lead',32),bm('Ryan OBrien','Customer Success','member',26),bm('Patrick Walsh','Customer Success','member',22),bm('Kevin Wright','Customer Success','member',20),bm('Sophia Chen','Customer Success','reviewer',15)],
    dels=[('Current process mapped','done'),('Automation platform selected','done'),('Provisioning workflows built','in_progress'),('SSO integration complete','in_progress'),('Training material automation','pending'),('Pilot with 5 customers','pending'),('Full rollout','pending')]),
  dict(name='Kubernetes Cost Optimization',
    desc='Reduce AWS spend 35% via right-sizing and spot instances',
    team='DevOps & Cloud',status='in_progress',priority='medium',
    owner='Tom Hayes Cloud',ot='DevOps & Cloud',
    start=pd(20),due=fd(55),budget=85000,tags=['kubernetes','cost','aws'],
    members=[bm('Tom Hayes Cloud','DevOps & Cloud','lead',25),bm('Kofi Mensah','DevOps & Cloud','member',20),bm('Haruto Sato','DevOps & Cloud','member',18),bm('Brianna Fox','DevOps & Cloud','reviewer',10)],
    dels=[('Cost baseline established','done'),('Right-sizing analysis done','done'),('Spot migration non-prod','in_progress'),('Autoscaling policies configured','in_progress'),('Spot migration production','pending'),('Cost dashboards live','pending')]),
  dict(name='GraphQL API Migration',
    desc='Migrate 8 REST endpoints to GraphQL — reduce over-fetching 60%',
    team='Backend Engineering',status='in_progress',priority='medium',
    owner='Mei Yamamoto',ot='Backend Engineering',
    start=pd(30),due=fd(35),budget=145000,tags=['graphql','api','backend'],
    members=[bm('Mei Yamamoto','Backend Engineering','lead',28),bm('Brandon Lee','Backend Engineering','member',22),bm('Anya Kowalski','Backend Engineering','member',18),bm('Marcus Hill','Backend Engineering','member',15)],
    dels=[('Schema design and review','done'),('Auth service migrated','done'),('User service migrated','in_progress'),('Product service migrated','in_progress'),('Remaining 5 services','pending'),('Performance testing','pending'),('Client SDK updated','pending')]),
  # 📋 PLANNING
  dict(name='Customer 360 Data Platform',
    desc='Unified customer data lake for self-serve analytics',
    team='Data Science',status='planning',priority='high',
    owner='Yuki Tanaka',ot='Data Science',
    start=fd(7),due=fd(95),budget=750000,tags=['data-lake','analytics'],
    members=[bm('Yuki Tanaka','Data Science','lead',50),bm('Ben Carter','Data Science','member',40),bm('Sophie Turner','Data Science','member',35),bm('Diego Martinez','Data Science','member',30),bm('Amira Farouk','Data Science','member',28)],
    dels=[('Requirements approved','done'),('Data source inventory','in_progress'),('Schema design','pending'),('ETL pipelines CRM','pending'),('ETL pipelines Product','pending'),('Data quality framework','pending'),('Self-serve query layer','pending'),('User training and docs','pending')]),
  dict(name='React Native Mobile Rewrite',
    desc='Rewrite iOS and Android in React Native for unified codebase',
    team='Mobile Engineering',status='planning',priority='high',
    owner='James OSullivan',ot='Mobile Engineering',
    start=fd(14),due=fd(180),budget=680000,tags=['react-native','mobile'],
    members=[bm('James OSullivan','Mobile Engineering','lead',45),bm('Ryan Foster','Mobile Engineering','member',35),bm('Soren Nielsen','Mobile Engineering','member',30),bm('Petra Novak','Mobile Engineering','member',28)],
    dels=[('Technical feasibility study','done'),('Architecture decision record','in_progress'),('Core navigation shell','pending'),('Auth flow','pending'),('Feature parity iOS','pending'),('Feature parity Android','pending'),('Performance benchmarking','pending'),('App Store submission','pending')]),
  # 📦 BACKLOG
  dict(name='Mobile App Redesign Phase 2',
    desc='Account settings and notifications — after Phase 1 completion',
    team='Mobile Engineering',status='backlog',priority='medium',
    owner='Luca Bianchi',ot='Mobile Engineering',
    start=fd(30),due=fd(90),budget=195000,tags=['mobile','phase2'],
    members=[bm('Luca Bianchi','Mobile Engineering','lead',0),bm('Noah Campbell','Mobile Engineering','member',0),bm('Ryan Foster','Mobile Engineering','member',0)],
    dels=[('Phase 1 retrospective','pending'),('User research','pending'),('Wireframes','pending'),('Hi-fi designs','pending'),('Development','pending')]),
  dict(name='Internal Developer Portal',
    desc='Self-service portal — infra provisioning, runbooks, on-call',
    team='Platform Engineering',status='backlog',priority='low',
    owner='Alex Rodriguez',ot='Platform Engineering',
    start=fd(45),due=fd(120),budget=220000,tags=['developer-experience','backstage'],
    members=[bm('Alex Rodriguez','Platform Engineering','lead',0),bm('Rachel Torres','Platform Engineering','member',0),bm('James Wright','Platform Engineering','member',0),bm('Lisa Zhang','Platform Engineering','member',0)],
    dels=[('Technology selection','pending'),('MVP scope defined','pending'),('Infrastructure catalog','pending'),('Runbooks integration','pending'),('On-call integration','pending'),('Launch campaign','pending')]),
  # ✅ COMPLETED
  dict(name='Customer Health Score Dashboard',
    desc='Real-time health scoring for 847 enterprise accounts',
    team='Customer Success',status='completed',priority='medium',
    owner='Ryan OBrien',ot='Customer Success',
    start=pd(120),due=pd(3),budget=185000,tags=['dashboard','analytics'],
    members=[bm('Ryan OBrien','Customer Success','lead',42),bm('Jessica Turner','Customer Success','member',32),bm('Tara Singh','Customer Success','member',26),bm('Michelle Foster','Customer Success','reviewer',18)],
    dels=[('Health score algorithm','done'),('Data connectors built','done'),('Dashboard UI shipped','done'),('Alert rules configured','done'),('CS team training','done'),('All 847 accounts onboarded','done')]),
  dict(name='CI/CD Pipeline Modernization',
    desc='Jenkins to GitHub Actions — build times 22min to 4min',
    team='DevOps & Cloud',status='completed',priority='medium',
    owner='Tom Hayes Cloud',ot='DevOps & Cloud',
    start=pd(90),due=pd(10),budget=120000,tags=['cicd','github-actions'],
    members=[bm('Tom Hayes Cloud','DevOps & Cloud','lead',38),bm('Astrid Berg','DevOps & Cloud','member',30),bm('Yusuf Al-Amin','DevOps & Cloud','member',25),bm('Cecilia Vega','DevOps & Cloud','member',22)],
    dels=[('Jenkins audit 87 pipelines','done'),('GitHub Actions templates','done'),('Migration tier 1','done'),('Migration tier 2','done'),('Migration tier 3','done'),('Jenkins decommissioned','done'),('Team docs published','done')]),
  dict(name='GDPR Compliance Audit',
    desc='Full GDPR readiness — data mapping, consent flows, DPA updates',
    team='Security Operations',status='completed',priority='high',
    owner='Maya Thompson',ot='Security Operations',
    start=pd(75),due=pd(5),budget=140000,tags=['gdpr','compliance'],
    members=[bm('Maya Thompson','Security Operations','lead',35),bm('Hassan Ibrahim','Security Operations','member',28),bm('Amara Diallo','Security Operations','member',22),bm('Ravi Kumar','Security Operations','member',18)],
    dels=[('Data inventory and mapping','done'),('Consent flow audit','done'),('DPA updated all vendors','done'),('Privacy policy updated','done'),('Staff training done','done'),('DPO sign-off received','done')]),
  # ⏸ ON HOLD
  dict(name='AI Customer Support Bot',
    desc='LLM-powered support bot to deflect 40% of tier-1 tickets — paused pending AI policy review',
    team='Customer Success',status='on_hold',priority='medium',
    owner='Aisha Patel',ot='Customer Success',
    start=pd(40),due=fd(60),budget=310000,tags=['ai','chatbot','on-hold'],
    members=[bm('Aisha Patel','Customer Success','lead',20),bm('Daniel Park','Customer Success','member',15),bm('Grace Kim','Customer Success','member',12),bm('Leo Schneider','Data Science','member',18)],
    dels=[('Use case definition','done'),('LLM vendor evaluation','done'),('Prototype built','done'),('Legal and compliance review','in_progress'),('Integration with helpdesk','pending'),('Training data preparation','pending'),('Production deployment','pending')]),
  # 🚫 CANCELLED
  dict(name='Blockchain Supply Chain PoC',
    desc='PoC for blockchain supply chain tracking — cancelled after exec review',
    team='Platform Engineering',status='cancelled',priority='low',
    owner='Sarah Chen',ot='Platform Engineering',
    start=pd(45),due=fd(60),budget=90000,tags=['blockchain','poc','cancelled'],
    members=[bm('Sarah Chen','Platform Engineering','lead',10),bm('James Wright','Platform Engineering','member',8),bm('Lisa Zhang','Platform Engineering','member',6)],
    dels=[('Technology research','done'),('Vendor shortlist','done'),('PoC scope document','in_progress'),('Technical build','pending')]),
]

for proj in PROJECTS:
    tid = TM.get(proj['team'])
    if not tid: print(f"  ✗ No team: {proj['team']}"); continue
    od  = gm(proj['owner'],proj['ot'])
    vm  = [m for m in proj['members'] if m]
    sp  = sum(m['cost'] for m in vm)
    dl  = proj['dels']
    t   = len(dl)
    dn  = sum(1 for d in dl if d[1]=='done')
    ip  = sum(1 for d in dl if d[1]=='in_progress')
    pg  = round(((dn*100)+(ip*50))/t) if t else 0
    r   = req('POST','/projects',dict(
        name=proj['name'],description=proj['desc'],
        team_id=tid,status=proj['status'],priority=proj['priority'],
        owner_id=od['id'] if od else '',owner_name=proj['owner'],
        start_date=proj['start'],due_date=proj['due'],
        progress=pg,total_budget=proj['budget'],spent_budget=sp,
        currency='USD',tags=proj['tags'],members=vm,deliverables=[],
    ),T)
    if not r or not r.get('id'): print(f"  ✗ Failed: {proj['name']}"); continue
    pid = r['id']
    for (title,status) in dl:
        dr = req('POST',f'/projects/{pid}/deliverables',{'title':title},T)
        if dr and dr.get('item') and status!='pending':
            req('PUT',f'/projects/{pid}/deliverables/{dr["item"]["id"]}',{'status':status},T)
    from datetime import datetime as DT
    ts  = DT.now().strftime('%Y-%m-%d')
    bp  = round((sp/proj['budget'])*100) if proj['budget'] else 0
    ov  = proj['due']<ts and proj['status'] not in ['completed','cancelled','on_hold']
    try: dl2=(DT.strptime(proj['due'],'%Y-%m-%d')-DT.now()).days
    except: dl2=999
    ar  = 0<=dl2<=14 and pg<70 and proj['status'] not in ['completed','cancelled','backlog','on_hold']
    fg  = ('🔴 OVERDUE' if ov else '🔴 OVER BUDGET' if bp>100 else '🟡 AT RISK' if ar else
           '✅ DONE' if proj['status']=='completed' else '⬜ BACKLOG' if proj['status']=='backlog' else
           '🚫 CANCEL' if proj['status']=='cancelled' else '⏸ ON HOLD' if proj['status']=='on_hold' else
           '🔵 PLAN' if proj['status']=='planning' else '🟢 HEALTHY')
    print(f"  {fg} {proj['name'][:40]:<40} {pg:>3}% | ${sp:>8,.0f}/${proj['budget']:>8,.0f} ({bp}%)")

print("\n→ Creating achievements...")
ACHIEVEMENTS=[
  ('Platform Engineering','Zero Downtime Migration','Migrated auth service with zero downtime during peak hours','high',5,2025),
  ('Platform Engineering','Cost Reduction 28pct','28% AWS spend reduction through right-sizing','medium',3,2025),
  ('Platform Engineering','99.99% Uptime Q2','Maintained 99.99% uptime across all production services','high',6,2025),
  ('Platform Engineering','Microservices 47 Services','All 47 services on EKS with full observability','high',2,2026),
  ('Data Science','Fraud Model v2 Launch','New model reduced false positives 43% — saves $2.1M/yr','high',4,2025),
  ('Data Science','Data Quality 99.8pct','99.8% data quality across all production pipelines','medium',2,2025),
  ('Data Science','Real-Time ML Pipeline','First real-time inference at 50k events/second','high',1,2026),
  ('Data Science','Customer 360 PoC Success','PoC validated with 3 business units — green-lit','medium',4,2026),
  ('Product Design','Design System 3.0 Shipped','Adopted by 6 teams — reduced design time 40%','high',1,2025),
  ('Product Design','Accessibility WCAG AA','WCAG 2.1 AA compliance on all customer surfaces','medium',6,2025),
  ('Product Design','App Store Rating 4.8','iOS and Android both hit 4.8 stars after redesign','high',3,2025),
  ('Security Operations','Zero Critical Incidents Q2','Zero critical incidents — first in company history','high',4,2025),
  ('Security Operations','ISO 27001 Certified','ISO 27001 covering all production systems','high',3,2025),
  ('Security Operations','SOC2 Type I Achieved','SOC2 Type I ahead of schedule','medium',3,2026),
  ('Customer Success','NPS Score 72','Record NPS of 72 — up from 48 prior quarter','high',5,2025),
  ('Customer Success','Onboarding Time Halved','Average onboarding 14 days to 7 days','medium',2,2025),
  ('Customer Success','NRR 140pct','Net Revenue Retention hit 140% via expansion','high',4,2026),
  ('Backend Engineering','P99 Latency Under 50ms','All APIs under 50ms P99 — exceeds SLA 2x','high',6,2025),
  ('Backend Engineering','GraphQL Migration 8 APIs','8 REST endpoints migrated — data fetching -60%','medium',4,2025),
  ('Mobile Engineering','Crash Rate 0.08pct','Industry-leading crash rate on iOS and Android','high',5,2025),
  ('Mobile Engineering','Launch Day Record Downloads','847k downloads on launch day — company record','high',2,2026),
  ('DevOps & Cloud','CI/CD Build Time 4min','Build times from 22min to 4min with GitHub Actions','high',1,2025),
  ('DevOps & Cloud','Kubernetes Cost -35pct','35% infra cost reduction via K8s right-sizing','high',5,2025),
  ('DevOps & Cloud','DR Test 15min RTO','Disaster recovery test hit 15-minute RTO','medium',2,2026),
]
ac=0
for (team,title,desc,impact,month,year) in ACHIEVEMENTS:
    tid=TM.get(team)
    if not tid: continue
    r=req('POST','/achievements',dict(team_id=tid,title=title,description=desc,impact=impact,month=month,year=year),T)
    if r and r.get('id'): ac+=1
print(f"  ✓ {ac} achievements")

pf=req('GET','/projects',token=T) or []
mf=req('GET','/members', token=T) or []
tb=sum(p.get('total_budget',0) or 0 for p in pf)
ts=sum(p.get('spent_budget',0)  or 0 for p in pf)
ut=round((ts/tb)*100) if tb else 0
st={}
for p in pf: st[p['status']]=st.get(p['status'],0)+1
print(f"""
{'='*60}
  SEED COMPLETE
{'='*60}
  Teams:        {len(TM)}
  Members:      {len(mf)}
  Projects:     {len(pf)}
  Achievements: {ac}

  Portfolio budget: ${tb:,.0f}
  Portfolio spent:  ${ts:,.0f}
  Utilization:      {ut}%

  By status:""")
for s,c in sorted(st.items()): print(f"    {s:<15} {c}")
print(f"\n  {BASE.replace('/api/team-service','')}")
