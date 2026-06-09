## Running Locally

```bash
# Setup environment
source ~/.bashrc
./bin/start-dev.sh

# App runs at:
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

## Deploying to AWS

```bash
# Backend (Lambda + DocumentDB)
./bin/deploy-backend.sh aws

# Frontend (S3 + CloudFront)
./bin/deploy-frontend.sh aws
```

## Running Tests

```bash
# Backend tests
cd backend/team-service
pytest test_function.py -v

# Frontend tests
cd frontend
npm test
```

## Seeding Sample Data

```bash
python3 seed_data.py https://d3njdoiji9c3r2.cloudfront.net
```

## Self Assessment

### What I built
A complete team management platform for ACME Inc. with a Python serverless backend on AWS Lambda, MongoDB-compatible database on AWS DocumentDB, and a React frontend deployed via CloudFront. The app supports full CRUD operations across four entities (teams, members, achievements, metadata) with JWT authentication and four-tier role-based access control.

### Requirements implemented
- All 7 business questions are answered on the dashboard
- Full CRUD for all entities with proper HTTP status codes
- JWT authentication with password hashing and token expiry
- RBAC with Admin, Manager, Contributor, and Viewer roles
- Search and filter functionality
- Responsive design
- 20 backend tests, 12 frontend tests

### Known issues
- JWT token refresh not implemented - users re-login after 8 hours
- 3 backend tests have a mock compatibility issue with pymongo sort syntax

### What I learned
- AWS serverless architecture with Lambda and DocumentDB
- Terraform infrastructure as code
- JWT authentication implementation from scratch
- React Context for global state management
- Deploying full-stack apps via CI/CD scripts
