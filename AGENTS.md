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
│   │   ├── src/
│   │   │   ├── server.ts              # Fastify server setup
│   │   │   ├── routes/                # HTTP routes (auth, health)
│   │   │   ├── websocket/             # WebSocket handlers
│   │   │   ├── acp/                   # ACP protocol handler
│   │   │   │   ├── ACPProtocolHandler.ts    # Main ACP translator
│   │   │   │   └── OpenCodeProcessManager.ts # Process management
│   │   │   ├── types.ts               # TypeScript types
│   │   │   └── utils/                 # Utilities (logger, etc.)
│   └── web/             # React frontend (Vite + TypeScript)
│       ├── src/
│       │   ├── components/            # React components
│       │   ├── contexts/              # React contexts
│       │   │   ├── WebSocketContext.tsx   # WebSocket connection
│       │   │   └── ACPContext.tsx         # ACP state management
│       │   ├── hooks/                 # Custom React hooks
│       │   ├── pages/                 # Route pages
│       │   ├── types.ts               # TypeScript types
│       │   └── utils/                 # Utilities
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── config/          # Shared ESLint, TS configs
└── tests/e2e/           # Playwright end-to-end tests
```

## ACP Context Architecture

The frontend uses a layered context architecture for state management:

```
App.tsx
├── WebSocketProvider (connection management)
│   └── Manages: WebSocket connection, auth tokens, reconnection
│   └── Exposes: sendMessage, connectionStatus, isAuthenticated
│   └── ACPProvider (ACP protocol state)
│       └── Manages: sessions, messages, streaming state, agent mode
│       └── Exposes: sendPrompt, switchSession, setAgentMode, messages
│       └── Layout
│           ├── SessionSidebar (session list)
│           └── ChatPage
│               └── ChatContainer
│                   ├── MessageList (render messages)
│                   └── ChatInput (user input)
```

### Context Responsibilities

**WebSocketContext** (`apps/web/src/contexts/WebSocketContext.tsx`):
- WebSocket connection lifecycle
- JWT token management and refresh
- Message sending/receiving
- Connection status tracking
- Automatic reconnection with exponential backoff

**ACPContext** (`apps/web/src/contexts/ACPContext.tsx`):
- Session management (create, switch, close)
- Message state per session
- Streaming content accumulation
- Agent mode (plan/build) toggle
- Model selection
- Permission request handling

### Message Flow

```
1. User sends message → ChatInput calls sendPrompt() from ACPContext
2. ACPContext → Sends WebSocket message via WebSocketContext
3. Bridge receives → Translates to ACP JSON-RPC
4. OpenCode process → Streams responses via stdout
5. Bridge → Translates back to WebSocket messages
6. ACPContext → Processes updates, accumulates streaming content
7. MessageList/PhaseBubble → Renders updates
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

### Unit Tests

- Location: `src/**/*.test.ts(x)` (not in `tests/` directory)
- Framework: Vitest with globals enabled (imports optional)
- Coverage threshold: 80% (lines, functions, branches, statements)

### React Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('should call onSend when form is submitted', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Hello' }
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

### Context Testing

Wrap components with necessary providers:

```typescript
import { render } from '@testing-library/react';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WebSocketProvider>{children}</WebSocketProvider>
);

render(<MyComponent />, { wrapper });
```

### Mocking

- Mock external dependencies (APIs, WebSocket)
- Use `vi.mock()` for module mocks
- Reset mocks in `beforeEach`

## Common Debugging Patterns

### WebSocket Connection Issues

1. Check browser DevTools → Network → WS tab
2. Verify `VITE_BRIDGE_URL` environment variable
3. Check bridge server logs for connection attempts
4. Ensure JWT token is valid (check `localStorage`)

### ACP Message Flow Debugging

1. Enable debug logging: `LOG_LEVEL=debug` (bridge), `VITE_LOG_LEVEL=debug` (web)
2. Check browser console for outgoing/incoming WebSocket messages
3. Check bridge logs for JSON-RPC translation
4. Verify OpenCode process is running: `ps aux | grep opencode`

### Common Issues

**"WebSocket connection failed"**:
- Bridge server not running on port 3001
- CORS origin mismatch (check `CORS_ORIGIN` env var)
- JWT token expired (clear localStorage, re-login)

**"Messages not appearing"**:
- Check ACPContext state with React DevTools
- Verify message type handlers in ACPProtocolHandler
- Check for errors in message parsing

**"Session creation fails"**:
- OpenCode binary not in PATH
- Verify `opencode --version` works
- Check bridge logs for spawn errors

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

### Environment Setup

1. Copy `.env.example` files in `apps/bridge/` and `apps/web/`
2. Generate a strong JWT secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
3. Update CORS origin to match your web frontend URL

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
