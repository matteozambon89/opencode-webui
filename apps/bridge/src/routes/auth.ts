import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-in-production';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];
const REFRESH_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours grace period for refresh

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  token: z.string().min(1)
});

// Demo user (in production, use a database)
const DEMO_USER = {
  username: 'demo',
  password: 'demo',
  id: 'demo-user-001'
};

export async function authRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Login endpoint
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Demo authentication
      if (body.username === DEMO_USER.username && body.password === DEMO_USER.password) {
        const token = jwt.sign(
          { userId: DEMO_USER.id, username: DEMO_USER.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        
        logger.info(`User logged in: ${body.username}`);
        
        return {
          success: true,
          token,
          user: {
            id: DEMO_USER.id,
            username: DEMO_USER.username
          }
        };
      }
      
      return reply.status(401).send({
        success: false,
        error: 'Invalid credentials'
      });
    } catch (error) {
      logger.error(error);
      return reply.status(400).send({
        success: false,
        error: 'Invalid request'
      });
    }
  });

  // Verify token endpoint
  app.get('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: 'No token provided'
        });
      }
      
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      
      return {
        success: true,
        user: {
          id: decoded.userId,
          username: decoded.username
        }
      };
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid token'
      });
    }
  });

  // Refresh token endpoint
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = refreshSchema.parse(request.body);
      const { token } = body;
      
      // Try to verify token - if expired but within grace period, allow refresh
      let decoded: { userId: string; username: string } | null = null;
      
      try {
        // First try normal verification (valid token)
        decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError && error.expiredAt) {
          // Check if expired within grace period
          const now = Date.now();
          const expiredAt = error.expiredAt.getTime();
          const timeSinceExpiry = now - expiredAt;
          
          if (timeSinceExpiry <= REFRESH_GRACE_PERIOD_MS) {
            // Token expired but within grace period - decode without verification
            decoded = jwt.decode(token) as { userId: string; username: string };
            logger.info(`Token refresh granted within grace period for user: ${decoded?.username || 'unknown'}`);
          } else {
            // Token expired beyond grace period
            logger.warn(`Token refresh denied - expired ${Math.round(timeSinceExpiry / (24 * 60 * 60 * 1000))} days ago`);
            return reply.status(401).send({
              success: false,
              error: 'Token expired beyond grace period'
            });
          }
        } else {
          // Other JWT errors (invalid signature, malformed, etc.)
          logger.warn(`Token refresh denied - invalid token: ${error instanceof Error ? error.message : 'unknown error'}`);
          return reply.status(401).send({
            success: false,
            error: 'Invalid token'
          });
        }
      }
      
      if (!decoded || !decoded.userId) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid token data'
        });
      }
      
      // Issue new token
      const newToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      logger.info(`Token refreshed successfully for user: ${decoded.username}`);
      
      return {
        success: true,
        token: newToken,
        user: {
          id: decoded.userId,
          username: decoded.username
        }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request: token required'
        });
      }
      
      logger.error(`Token refresh error: ${error}`);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`Token expired at ${error.expiredAt?.toISOString()}`);
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`JWT validation error: ${error.message}`);
    } else {
      logger.warn(`Token verification failed: ${error}`);
    }
    return null;
  }
}
