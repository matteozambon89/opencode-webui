# End-to-End Tests for OpenCode Web UI

This package contains comprehensive end-to-end tests for the OpenCode Web UI application using Playwright.

## Overview

The test suite validates:
- **Authentication Flow** - Login/logout, token persistence, error handling
- **WebSocket Connection** - Real-time connectivity, reconnection, heartbeat
- **Session Management** - Create, switch, close sessions
- **Chat & Streaming** - Send messages, receive streaming responses, cancel operations
- **Full Integration** - Complete user workflows

## Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local development)

## Quick Start

### Option 1: Run tests with Docker (Recommended)

```bash
# Install Playwright browsers (one-time setup)
pnpm test:e2e:install

# Run all tests with Docker
cd tests/e2e
pnpm test
```

### Option 2: Run tests against running services

```bash
# Start services manually
pnpm docker:up

# Wait for services to be ready (~10 seconds)

# Run tests
cd tests/e2e
pnpm test
```

## Test Commands

```bash
# Run all tests (headless)
pnpm test

# Run tests with UI mode (interactive debugging)
pnpm test:ui

# Run tests in headed mode (see browser)
pnpm test:headed

# Run tests in debug mode
pnpm test:debug

# View test report
pnpm report
```

## Test Configuration

Tests run **sequentially** (not parallel) and **don't cleanup** sessions after tests.

### Environment Variables

- `TEST_BASE_URL` - Web app URL (default: `http://localhost:5173`)
- `DEBUG` - Enable debug logging

### Test Timeouts

- Per test: **120 seconds** (for OpenCode responses)
- Assertions: **60 seconds**
- Actions: **30 seconds**

## Test Structure

```
tests/e2e/
├── tests/
│   ├── auth.spec.ts        # Authentication tests
│   ├── websocket.spec.ts   # WebSocket connection tests
│   ├── session.spec.ts     # Session management tests
│   ├── chat.spec.ts        # Chat & streaming tests
│   └── full-flow.spec.ts   # Complete integration test
├── utils/
│   ├── logger.ts           # Test logging utilities
│   └── test-helpers.ts     # Helper functions
├── playwright.config.ts    # Playwright configuration
├── docker-compose.test.yml # Test environment
├── global-setup.ts         # Start Docker before tests
└── global-teardown.ts      # Stop Docker after tests
```

## Writing Tests

### Test Template

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  // Login first
  await page.goto('/');
  await page.locator('#username').fill('demo');
  await page.locator('#password').fill('demo');
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // Wait for ACP initialization
  await page.waitForTimeout(3000);
  
  // Your test here
  await expect(page.getByText('Expected content')).toBeVisible();
});
```

### Test Data

Tests use unique identifiers to avoid collisions:

```typescript
import { generateUniqueId } from '../utils/test-helpers';

const testId = generateUniqueId(); // timestamp-random
```

## Troubleshooting

### Services Not Ready

If tests fail with connection errors, increase wait times:

```typescript
await page.waitForTimeout(5000); // Increase from 3000
```

### OpenCode CLI Not Found

The bridge Docker image includes OpenCode CLI. If missing, rebuild:

```bash
docker-compose -f tests/e2e/docker-compose.test.yml build --no-cache
```

### Test Timeouts

Tests may timeout waiting for OpenCode responses. This is normal. Check:
- Bridge logs: `docker logs opencode-bridge-1`
- OpenCode process is running inside container

### Debugging Failed Tests

1. Run with UI mode: `pnpm test:ui`
2. Check screenshots in `test-results/`
3. Watch video recordings in `test-results/`
4. View HTML report: `pnpm report`

## Test Artifacts

After test runs, check:

- `playwright-report/` - HTML test report
- `test-results/` - Screenshots and videos on failure
- Console output - Logs from global setup/teardown

## Architecture

### Test Flow

1. **Global Setup**: Start Docker containers (bridge + web)
2. **Test Execution**: Run tests sequentially against services
3. **Global Teardown**: Stop Docker containers

### Docker Services

- **Bridge** (port 3001): Fastify server with OpenCode CLI
- **Web** (port 5173): Nginx serving React app

### ACP Protocol

Tests interact with the real ACP protocol:
- WebSocket connection with JWT authentication
- JSON-RPC 2.0 messages
- Streaming responses from OpenCode

## CI/CD Integration

The test suite is designed to work in CI environments. Set:

```bash
export CI=true
```

This enables:
- Screenshot on failure
- Video recording
- HTML reporting
- Retry on failure (2 retries)

## Notes

- **No Cleanup**: Sessions persist during test runs (by design)
- **Sequential**: Tests run one at a time to avoid conflicts
- **Real OpenCode**: Tests use actual OpenCode CLI for authentic responses
- **Long Timeouts**: Tests account for OpenCode response latency (10-60s)

## License

MIT License - see LICENSE file in root
