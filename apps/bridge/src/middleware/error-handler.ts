import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error(error);
  
  // Don't leak internal errors in production
  const isDev = process.env.NODE_ENV === 'development';
  
  if (error.statusCode) {
    reply.status(error.statusCode).send({
      error: error.message,
      ...(isDev && { stack: error.stack })
    });
  } else {
    reply.status(500).send({
      error: 'Internal Server Error',
      ...(isDev && { message: error.message, stack: error.stack })
    });
  }
}
