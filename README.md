# OpenCode Web UI with ACP

A browser-based remote GUI for [OpenCode](https://opencode.ai) that leverages the Agent Client Protocol (ACP) to enable real-time streaming interactions from any web browser.

## Architecture

This project consists of three main components:

1. **Bridge Server** (`apps/bridge/`): Node.js server that translates between ACP's JSON-RPC over stdio and WebSocket for browser consumption
2. **Web Frontend** (`apps/web/`): React-based chat interface for interacting with OpenCode
3. **Shared Types** (`packages/shared/`): TypeScript type definitions shared between frontend and backend

```
Browser → WebSocket → Bridge Server → opencode acp (stdio)
```

## Quick Start

### Prerequisites

- Node.js 22+ with pnpm
- OpenCode CLI installed (`opencode --version`)

### Installation

```bash
# Install dependencies
pnpm install

# Build shared packages
pnpm --filter @opencode/shared build

# Start bridge server
pnpm --filter @opencode/bridge dev

# In another terminal, start web frontend
pnpm --filter @opencode/web dev
```

### Using Docker

```bash
# Start all services
pnpm docker:up

# Or start development version with hot reload
pnpm docker:dev
```

### Demo Login

Use the following credentials to log in:
- **Username**: `demo`
- **Password**: `demo`

## Development

### Project Structure

```
.
├── apps/
│   ├── bridge/          # Bridge server (Node.js + Fastify)
│   └── web/             # React frontend (Vite)
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── config/          # Shared ESLint + TS configs
├── docker-compose.yml   # Docker orchestration
└── package.json         # Root monorepo config
```

### Available Scripts

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm typecheck` - Run TypeScript checks
- `pnpm lint` - Run ESLint
- `pnpm docker:up` - Start Docker containers
- `pnpm docker:down` - Stop Docker containers

## Features

- ✅ Real-time WebSocket communication
- ✅ ACP protocol support (initialize, session/new, session/prompt, session/cancel)
- ✅ Streaming message display
- ✅ Session management
- ✅ JWT authentication (demo mode)
- ✅ File upload/download support
- ✅ Docker containerization

## Security

This project implements security best practices:

- JWT-based authentication
- CORS protection
- Helmet security headers
- Rate limiting
- Input validation with Zod
- No secrets committed to code

**Note**: This is a demo implementation. For production use:
- Change the JWT secret (`JWT_SECRET` env var)
- Implement proper user authentication
- Use HTTPS/WSS
- Add session persistence (Redis/Database)

## License

MIT License - see [LICENSE](./LICENSE) file

## Resources

- [ACP Protocol Specification](https://agentclientprotocol.com/)
- [OpenCode Documentation](https://opencode.ai/docs/)
- [Implementation Plan](./docs/plans/2026-02-01-implementation-plan.md)
