import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { websocketRoutes } from './routes/websocket.js';
import { errorHandler } from './middleware/error-handler.js';

export async function createServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    },
    trustProxy: true
  });

  // Register security plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"]
      }
    }
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10)
  });

  // Register WebSocket support
  await app.register(websocket);

  // Register error handler
  app.setErrorHandler(errorHandler);

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(websocketRoutes);

  return app;
}
