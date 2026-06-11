# ACME Inc. — Project Management Platform

A centralized project management and tracking platform built for the Citi Coding Workshop. Provides real-time visibility into project health, resource utilization, delivery progress, and budget tracking across the organization.

**Live URL:** https://d3njdoiji9c3r2.cloudfront.net

---

## Business Problem

ACME Inc. operates multiple projects across different departments but lacked visibility into project progress, resource allocation, and delivery timelines. Project managers struggled to track deliverables, identify bottlenecks, and communicate status to stakeholders — leading to missed deadlines, resource conflicts, and difficulty forecasting completion dates.

### Business Questions Answered

| Question | Where |
|----------|-------|
| What is the current status of each active project? | Dashboard → Active Projects |
| Which projects are at risk of missing their deadlines? | Dashboard → At Risk card + RAG badges |
| How are resources allocated across projects? | Resources page → Utilization bars |
| What are the key deliverables and their completion status? | Project Detail → Deliverables checklist |
| Which team members are over-allocated? | Dashboard → Over-Allocated panel |
| What is the dependency chain between deliverables? | Project Detail → Deliverables |
| How much budget has been consumed versus planned? | Dashboard → Portfolio Budget + Project Detail |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 | Component-based UI |
| UI Library | Material UI v9 (dark theme) | Pre-built components |
| Routing | React Router v6 | Client-side navigation |
| HTTP Client | Axios | API calls with JWT interceptors |
| Build Tool | Vite | Compile and bundle |
| Frontend Tests | Vitest + React Testing Library | Component testing |
| Backend | Python 3.11 | Business logic |
| Compute | AWS Lambda | Serverless function execution |
| Auth | PyJWT + PBKDF2-SHA256 | Tokens and password hashing |
| Database Driver | pymongo | MongoDB queries |
| Database | AWS DocumentDB | JSON document storage |
| CDN | AWS CloudFront | HTTPS routing and caching |
| Static Storage | AWS S3 | React build files |
| Infrastructure | Terraform | Infrastructure as code |
| Version Control | Git + GitHub | Source management |
| Deployment | Shell Scripts | Automated deploy pipeline |

---

## Architecture

```
Browser
	 │  HTTPS
	 ▼
CloudFront (CDN)
	 ├── /* ──────────────────► S3 (React app)
	 └── /api/team-service/* ─► Lambda (Python)
																		│
																		▼
														 DocumentDB (MongoDB)
```

---

## Features

### Project Management
- **Kanban board** and list view with drag-friendly status lanes
- **RAG status badges** (Red/Amber/Green) auto-computed per project from schedule, budget, and progress
- **Inline status editing** — click any status chip to change without opening an edit dialog
- **Smart due date labels** — "5d left", "2d overdue" with urgency color coding
- **Deliverable checklist** — click to cycle pending → in progress → done, auto-updates progress bar
- **Budget tracking** — total vs spent per project with % utilization bar
- **Budget variance** — employee vs contractor cost breakdown
- **Column sorting** on all table views
- **Pagination** with configurable page size on all tables
- **CSV export** for projects and resources

### Dashboard
- **6 KPI cards** answering all business questions: Active, At Risk, Overdue, Over Budget, Over-Allocated, Total
- **Portfolio budget bar** — total spend across all active projects
- **Active projects list** — sorted by urgency (overdue first, at-risk second)
- **Pipeline breakdown** — project counts by status
- **Over-allocated members panel** — members on 2+ active projects with utilization bars
- **Global search** — teams, projects, members, achievements

### Resource Management
- **Utilization bars** per member — colored by load level (grey/green/yellow/red)
- **Over-allocation detection** — members on 2+ projects flagged automatically
- **Project badges** on each member row — click to navigate to project
- **Employee vs contractor** classification with visual distinction

### Security & Access Control
- **JWT authentication** — 60-minute access tokens + 7-day refresh tokens
- **4 RBAC roles** — Viewer, Contributor, Manager, Admin
- **PBKDF2-SHA256 password hashing** — 260,000 iterations, NIST SP 800-132 compliant
- **Brute force protection** — 5 failed attempts triggers 15-minute lockout
- **Soft delete** — nothing permanently removed, full recovery possible
- **Audit log** — every mutation logged with actor, action, and timestamp

### Team Health Constraints
- Every team requires a designated leader
- Teams below 5 members flagged as understaffed
- Contractor ratio warnings at >20% and >50%
- Health badges with tooltip details on Teams page

---

## Project Health States

| State | Trigger | RAG |
|-------|---------|-----|
| On Track | Within budget and schedule | 🟢 Green |
| At Risk | Due within 14 days AND progress <70% | 🟡 Amber |
| Over Budget | Spent >80% of budget | 🟡 Amber / 🔴 Red |
| Overdue | Past due date, not completed | 🔴 Red |
| On Hold | Status set to on_hold | 🟡 Amber |
| Completed | Status set to completed | 🟢 Green |
| Cancelled | Status set to cancelled | — |

---

## Data Model

```
DocumentDB — acme database
├── users          accounts, roles, last login
├── teams          departments, locations, health constraints
├── members        resources with daily rates and employment type
├── projects       status, budget, members, deliverables, progress
├── achievements   monthly team wins
├── audit_log      every mutation with actor and timestamp
└── team_notes     notes per team
```

### Project Schema (key fields)
```json
{
	"name":          "Infrastructure Modernization",
	"status":        "in_progress",
	"priority":      "high",
	"owner_name":    "Sarah Chen",
	"start_date":    "2026-04-07",
	"due_date":      "2026-07-29",
	"progress":      65,
	"total_budget":  480000,
	"spent_budget":  316800,
	"currency":      "USD",
	"members": [
		{
			"member_name":    "Sarah Chen",
			"role":           "lead",
			"member_type":    "direct",
			"daily_rate":     950,
			"days_allocated": 40,
			"cost":           38000
		}
	],
	"deliverables": [
		{ "title": "Architecture design doc", "status": "done" },
		{ "title": "API gateway deployed",    "status": "in_progress" }
	]
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/register` | Create account |
| GET | `/auth/me` | Current user info |
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project detail |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Soft delete project |
| POST | `/projects/:id/members` | Add member to project |
| DELETE | `/projects/:id/members/:mid` | Remove member |
| POST | `/projects/:id/deliverables` | Add deliverable |
| PUT | `/projects/:id/deliverables/:did` | Update deliverable status |
| DELETE | `/projects/:id/deliverables/:did` | Remove deliverable |
| GET | `/members` | List all members |
| POST | `/members` | Create member |
| PUT | `/members/:id` | Update member |
| DELETE | `/members/:id` | Soft delete member |
| GET | `/teams` | List teams with health |
| POST | `/teams` | Create team |
| GET | `/teams/:id/health` | Team health report |
| GET | `/pipeline` | Project counts by status |
| GET | `/stats` | Dashboard KPI stats |
| GET | `/resources/allocation` | Member utilization data |
| GET | `/search?q=` | Global search |
| GET | `/audit` | Audit log (admin only) |
| GET | `/activity` | Activity feed |
| GET | `/achievements` | List achievements |

---

## Default Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin — full access |
| `manager1` | `manager123` | Manager — CRUD |
| `contrib1` | `contrib123` | Contributor — create/edit |
| `viewer1` | `viewer123` | Viewer — read only |

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- AWS CLI configured

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # run tests
npm run build      # production build
```

### Backend
```bash
cd backend/team-service
pip install -r requirements.txt
python3 function.py   # local Lambda handler
pytest test_function.py -v
```

### Environment Variables
```bash
# frontend/.env
VITE_API_URL=https://d3njdoiji9c3r2.cloudfront.net

# backend — set in Lambda console or .env
MONGODB_URI=mongodb://...
JWT_SECRET=your-secret-key
```

---

## Deployment

```bash
# Deploy backend (Lambda)
./bin/deploy-backend.sh aws

# Deploy frontend (S3 + CloudFront)
./bin/deploy-frontend.sh aws

# Reseed all data
python3 seed_all.py https://d3njdoiji9c3r2.cloudfront.net

# Push to GitHub
git add .
git commit -m "your message"
git push
```

---

## Tests

```bash
# Backend — 20 tests
cd backend/team-service
pytest test_function.py -v

# Frontend — 12 tests
cd frontend
npm test -- --run
```

### Test Coverage
- Authentication (login, invalid credentials, JWT)
- RBAC (viewer read-only, contributor create, manager delete)
- Team CRUD (list, create validation, not found)
- Member validation (missing team, invalid ID)
- Achievement filters
- Health checks and CORS

---

## Infrastructure (Terraform)

```
AWS Resources:
├── S3 Bucket          coding-workshop-website-96948cfc
├── CloudFront         d3njdoiji9c3r2.cloudfront.net
├── Lambda Function    coding-workshop-team-service-96948cfc
└── DocumentDB         AWS-managed MongoDB cluster
```

Participant ID: `96948cfc`

---

## Repository

**GitHub:** https://github.com/dadmostafa/coding-workshop-participant

**Workshop:** Citi Coding Workshop — Full Stack Web Application
