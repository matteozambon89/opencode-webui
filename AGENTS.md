# OpenCode Web UI with ACP - Agent Instructions

## Quick Start

```bash
pnpm install        # Install dependencies
pnpm dev            # Start all services (development)
pnpm docker:up      # Start with Docker
```

## Build/Lint/Test Commands

```bash
# Tests
pnpm test                           # Run all tests
pnpm test:watch                     # Run tests in watch mode
pnpm --filter @opencode/bridge test -- src/server.test.ts     # Single test file
pnpm --filter @opencode/bridge test -- -t "pattern"           # Tests by pattern
pnpm --filter @opencode/bridge test -- --coverage             # With coverage

# Linting
pnpm lint                           # Check all files
pnpm lint:fix                       # Fix auto-fixable issues
pnpm --filter @opencode/bridge lint # Lint specific package

# Type Checking & Building
pnpm typecheck                      # Type check all packages
pnpm build                          # Build all packages
pnpm --filter @opencode/bridge build # Build specific package

# E2E Tests
pnpm test:e2e:install               # Install Playwright browsers (first time)
pnpm test:e2e                       # Run E2E tests
pnpm test:e2e:ui                    # Run with UI mode
pnpm --filter @opencode/e2e test:headed  # Run in headed mode
```

## Project Structure

```
├── apps/
│   ├── bridge/          # Node.js bridge server (Fastify + WebSocket)
│   └── web/             # React frontend (Vite + TypeScript)
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── config/          # Shared ESLint, TS configs
└── tests/e2e/           # Playwright end-to-end tests
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** - no implicit any
- Use `interface` for object definitions, `type` for unions/aliases
- Explicit return types on exported functions
- Avoid `any` - use `unknown` with type guards instead

### Imports

- Group: external → internal → relative
- Use `import type` for type-only imports
- Use workspace aliases: `@opencode/shared`, `@opencode/config`
- Web app uses `@/` alias for `src/` directory

```typescript
import { useState } from 'react';
import type { FastifyInstance } from 'fastify';
import { ACPMessage } from '@opencode/shared';
import { logger } from '@/utils/logger';
```

### Naming Conventions

- Components: PascalCase (`ChatContainer.tsx`)
- Hooks: camelCase with `use` prefix (`useWebSocket.ts`)
- Utilities: camelCase (`formatDate.ts`)
- Types/Interfaces: PascalCase (`interface ACPMessage`)
- Constants: SCREAMING_SNAKE_CASE
- Test files: `ComponentName.test.ts(x)`

### React Components

- Functional components with hooks
- Props destructured in function parameters
- Use custom hooks for reusable logic

```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  // component logic
}
```

### Error Handling

- Use try/catch for async operations
- Log errors with context (no sensitive data)
- Return typed error responses
- Fastify error handler registered globally

### File Structure

```typescript
// 1. Imports
// 2. Types/Interfaces
// 3. Constants
// 4. Helper functions
// 5. Main export (component/function)
```

## Testing Guidelines

- Unit tests: `src/**/*.test.ts(x)` (not in `tests/` directory)
- Coverage threshold: 80% (lines, functions, branches, statements)
- Vitest globals enabled (imports optional)
- React tests use `@testing-library/react` + `jsdom`
- Mock external dependencies appropriately

## Security Guidelines

- No secrets in code - use environment variables
- Validate all inputs with Zod
- CSP headers via Helmet, CORS per environment
- Rate limiting on all endpoints
- Containers run as non-root users
- No `eval()` or dynamic code execution

## Environment Variables

### Bridge Server

```bash
PORT=3001
JWT_SECRET=<generate-strong-secret>
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

### Web Frontend

```bash
VITE_BRIDGE_URL=ws://localhost:3001
VITE_LOG_LEVEL=info
```

## Package Scripts Reference

| Package | Dev | Test | Build | Lint |
|---------|-----|------|-------|------|
| `@opencode/bridge` | `tsx watch src/index.ts` | `vitest run` | `tsc` | `eslint src/**/*.ts` |
| `@opencode/web` | `vite` | `vitest run` | `tsc && vite build` | `eslint src/**/*.tsx` |
| `@opencode/shared` | `tsc --watch` | - | `tsc` | - |
| `@opencode/e2e` | - | `playwright test` | - | - |

## Commit Guidelines

### When to Commit

**Mode-Based Commit Strategy:**

| Mode | Commit Behavior |
|------|----------------|
| **Plan Mode** | Do NOT commit. Planning is for analysis and creating implementation plans only. |
| **Build/Implementation** | Commit frequently after completing each logical unit of work. |

**During Build/Implementation:**
- Commit after completing each logical unit of work (atomic commits)
- Commit when tests pass and linting is clean
- Commit before switching contexts or tasks
- Make commits small and focused - break large changes into multiple commits
- Do not commit secrets, credentials, or .env files

**What Constitutes a "Logical Unit of Work":**
- Single bug fix
- One feature or enhancement
- A coherent refactoring
- Related test additions
- Documentation updates for a specific change

### Commit Message Format

Use conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Examples:**
```
feat(bridge): add WebSocket reconnection logic

fix(web): resolve message list scroll issue

docs: update API documentation for auth endpoints

test(bridge): add unit tests for process manager
```

### Commit Best Practices

- Keep commits small and focused on a single change
- Write clear, descriptive messages explaining the "why" not just the "what"
- Run `pnpm lint` and `pnpm test` before committing
- Stage only relevant files - review changes with `git diff`
- Break large changes into multiple commits by logical component

### Git Safety Rules

- NEVER update git config (user.name, user.email)
- NEVER run destructive commands (`push --force`, `reset --hard`) unless explicitly requested
- NEVER skip hooks (`--no-verify`, `--no-gpg-sign`)
- NEVER amend pushed commits
- NEVER commit if there are no changes (avoid empty commits)

## Docker Commands

```bash
pnpm docker:up        # Start services
pnpm docker:down      # Stop services
pnpm docker:build     # Build containers
pnpm docker:dev       # Start with dev profile
```

## Notes

- Use pnpm workspaces - install from root
- ESLint config: `packages/config/eslint.config.js`
- TypeScript config: `packages/config/tsconfig.base.json`
- Store plans in `docs/plans/YYYY-MM-DD-plan-name.md` (during build mode)
- **NEVER use screenshot option with Playwright**
- **NEVER read or write .env files**
- **UI Layout**: Chat interface has file upload button on the **left**, send button on the **right**
