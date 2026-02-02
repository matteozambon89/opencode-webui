import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
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
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch {
    return null;
  }
}
