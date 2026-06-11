# Coding Workshop - Testing Guide

> [Main Guide](./README.md) | [Validation Guide](./validation.md) | [Evaluation Guide](./evaluation.md) | **Testing Guide** | [Implementation Guide](./implementation.md)

## Overview

This guide provides comprehensive testing strategies for the coding workshop,
covering backend testing, frontend testing, and performance testing.

### Backend Testing

1. Unit Tests: Test individual Lambda handlers in isolation with mocks.
2. Integration Tests: Test deployed API endpoints backed by the real database.
3. Error Handling Tests: Validate 4xx/5xx scenarios for CRUD flows.

```sh
# Unit + error handling tests
cd backend/team-service
pytest test_function.py -v

# Coverage gate for backend components (80%+)
pip install -r requirements-dev.txt
pytest test_function.py --cov=function --cov=auth --cov-report=term-missing --cov-fail-under=80

# Real API integration tests (set RUN_INTEGRATION=1 explicitly)
RUN_INTEGRATION=1 \
API_BASE_URL=https://d3njdoiji9c3r2.cloudfront.net \
pytest test_integration_api.py -v
```

### Frontend Testing

1. Component Tests: React component behavior and rendering.
2. API Integration Tests: API service layer tested with mocked responses.
3. End-to-End Tests: Critical user flows executed in a browser.

```sh
cd frontend

# Unit/component + mocked API tests
npm test -- --run

# Frontend coverage gate (80%+)
npm run test:coverage

# E2E flow (login -> dashboard)
CYPRESS_BASE_URL=http://localhost:3000 npm run e2e
```

### Performance Testing

1. Load Testing: Simulate concurrent traffic against authentication and core read endpoints.
2. Performance Monitoring: Capture latency percentiles, RPS, and error rates in a report.

```sh
API_BASE_URL=https://d3njdoiji9c3r2.cloudfront.net \
LOAD_TEST_USERNAME=admin \
LOAD_TEST_PASSWORD=admin123 \
npx artillery run tests/performance/artillery-load.yml
```

Record outputs in `docs/performance-test-results.md`.

### Test Coverage Goals

* Backend Components: 80%+ code coverage (enforced by `--cov-fail-under=80`)
* Frontend Components: 80%+ code coverage (configured in Vitest coverage thresholds)
* API Endpoints: 90%+ coverage for CRUD endpoints (unit + integration suite target)
* Error Handling: 90%+ coverage for validation/error cases
* Critical User Paths: 100% E2E coverage for defined smoke paths

### Notes

1. Integration tests are opt-in so normal local test runs remain fast.
2. E2E tests assume seeded demo credentials are available.
3. Performance runs should be executed against a stable deployed environment, not while deploying.

## Navigation Links

<nav aria-label="breadcrumb">
  <ol>
    <li><a href="./README.md">Main Guide</a></li>
    <li><a href="./validation.md">Validation Guide</a></li>
    <li><a href="./evaluation.md">Evaluation Guide</a></li>
    <li aria-current="page">Testing Guide</li>
    <li><a href="./implementation.md">Implementation Guide</a></li>
  </ol>
</nav>
