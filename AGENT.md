# OpenCode Web UI with ACP - Agent Instructions

## Project Overview

A secure, containerized web UI for OpenCode using the Agent Context Protocol (ACP). This monorepo contains a bridge server (Node.js) and a React frontend, built with security as the primary concern.

## Architecture

```
├── apps/
│   ├── bridge/          # Node.js bridge server (ACP protocol handler)
│   └── web/             # React frontend (Vite + TypeScript)
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── config/          # Shared configuration (ESLint, TS, etc.)
├── docker-compose.yml   # Local development orchestration
└── Dockerfile.*         # Container definitions
```

## Technology Stack

### Bridge Server (`apps/bridge/`)
- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript
- **Protocol**: ACP (Agent Context Protocol) over WebSocket/SSE
- **Security**: Helmet, CORS, Rate limiting, Input validation
- **Testing**: Vitest

### Web Frontend (`apps/web/`)
- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript
- **Testing**: Vitest + React Testing Library
- **Styling**: CSS Modules / Tailwind (TBD)

### Infrastructure
- **Container**: Docker + Docker Compose
- **Package Manager**: pnpm (workspaces)
- **CI/CD**: GitHub Actions

## Development Commands

### Prerequisites
- Node.js 20+ with pnpm
- Docker and Docker Compose

### Setup
```bash
# Install dependencies
pnpm install

# Start all services (development)
pnpm dev

# Start with Docker
pnpm docker:up

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
```

### Service-Specific Commands

```bash
# Bridge server only
pnpm --filter bridge dev
pnpm --filter bridge test
pnpm --filter bridge build

# Web frontend only
pnpm --filter web dev
pnpm --filter web test
pnpm --filter web build
```

## Security Guidelines

### Non-Negotiable Principles

1. **No secrets in code**: Use environment variables, Docker secrets, or secure vaults
2. **Input validation**: All external inputs validated with Zod or similar
3. **CSP headers**: Strict Content Security Policy enforced
4. **No eval() or dynamic code execution**
5. **Dependency auditing**: Run `pnpm audit` before any deployment
6. **Least privilege**: Containers run as non-root users
7. **HTTPS only**: All communications encrypted (dev uses self-signed certs)

### Security Checklist

Before any code is committed:
- [ ] No hardcoded credentials or API keys
- [ ] All user inputs validated
- [ ] No `console.log` with sensitive data
- [ ] Error messages don't leak stack traces or internals
- [ ] Dependencies have no critical vulnerabilities
- [ ] CORS configured correctly (not `*` in production)
- [ ] Rate limiting enabled on all endpoints

### Docker Security

- Multi-stage builds to minimize image size
- Non-root user in containers (`USER node`)
- Read-only filesystems where possible
- No sensitive data in image layers
- Health checks configured

## Code Conventions

### TypeScript
- Strict mode enabled
- Explicit return types on exported functions
- No `any` type (use `unknown` with type guards)
- Interface over type for object definitions

### React
- Functional components with hooks
- Props destructured in function parameters
- Custom hooks for reusable logic
- Error boundaries for error handling

### Testing
- Unit tests for utilities and hooks
- Integration tests for API endpoints
- Component tests for React components
- Coverage threshold: 80% minimum

### File Naming
- Components: PascalCase (`UserProfile.tsx`)
- Utilities: camelCase (`formatDate.ts`)
- Styles: ComponentName.module.css
- Tests: ComponentName.test.ts(x)

## ACP Protocol Implementation

The bridge server implements the Agent Context Protocol for communication between the OpenCode CLI and the web UI.

### Message Format
```typescript
interface ACPMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  action: string;
  payload: unknown;
  timestamp: number;
}
```

### Security Model
- Authentication: Token-based (JWT)
- Authorization: Role-based access control
- Message signing: Optional HMAC verification
- Connection: WebSocket with reconnection logic

## Environment Variables

### Bridge Server
```bash
# Required
PORT=3001
JWT_SECRET=<generate-strong-secret>
CORS_ORIGIN=http://localhost:5173

# Optional
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### Web Frontend
```bash
# Required
VITE_BRIDGE_URL=ws://localhost:3001

# Optional
VITE_LOG_LEVEL=info
```

## Container Development

### Services

1. **bridge**: Node.js server with hot reload
2. **web**: Vite dev server with HMR
3. **reverse-proxy** (optional): Nginx for HTTPS in dev

### Volumes
- Source code mounted for development
- `node_modules` in named volumes for performance

### Networks
- Internal network for service-to-service communication
- External network if integrating with other services

## Linting & Formatting

```bash
# Check all files
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix

# Format with Prettier
pnpm format

# Check formatting
pnpm format:check
```

Configuration extends from `packages/config/` for consistency.

## Deployment

### Production Build

```bash
# Build all containers
pnpm docker:build

# Start production stack
pnpm docker:prod
```

### Health Checks

Both services expose health endpoints:
- Bridge: `GET /health`
- Web: Static file serving (Nginx/traefik handles health)

## Troubleshooting

### Common Issues

**Port conflicts**: Change ports in `.env` or `docker-compose.yml`

**Hot reload not working**: Check Docker volume mounts

**Tests failing**: Ensure `node_modules` are installed in all packages

**Type errors**: Run `pnpm typecheck` to identify issues

## Additional Notes

- Keep dependencies minimal and audited
- Prefer native APIs over heavy libraries
- Document all security decisions
- Regular dependency updates (automated via Dependabot)
- All endpoints must be rate-limited
- Use parameterized queries (if database added later)

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Docker Node.js Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Plan Storage Guidelines

When drafting plans for implementation:
- Store all plans in the `docs/plans/` directory
- This must happen **before** requesting user approval to proceed with the plan
- Use the naming format: `YYYY-MM-DD-descriptive-plan-name.md`
- Plans should be detailed enough to be re-referenced if the conversation thread is lost

### Plan Status Workflow

Track plan status in the todo list:
- **Draft**: Plan is being written and stored in `docs/plans/`
- **Pending Approval**: Plan is ready and awaiting user review
- **Approved**: User has given the go-ahead to proceed
- **In Progress**: Implementation is underway
- **Completed**: Implementation successfully finished and validated

Update the todo item status immediately when the user approves (change to "approved") and again when work is successfully completed (change to "completed").
