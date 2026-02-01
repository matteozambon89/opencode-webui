import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import { verifyToken } from './auth.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Store active WebSocket connections
const connections = new Map<string, WebSocketConnection>();

interface WebSocketConnection {
  id: string;
  socket: SocketStream;
  userId: string;
  username: string;
  sessionIds: Set<string>;
  isAlive: boolean;
}

export async function websocketRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  
  app.get('/ws', { websocket: true }, (connection: SocketStream, req: FastifyRequest) => {
    // Verify JWT from query parameter
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    
    if (!token) {
      logger.warn('WebSocket connection attempted without token');
      connection.socket.close(1008, 'Authentication required');
      return;
    }
    
    const user = verifyToken(token);
    if (!user) {
      logger.warn('WebSocket connection attempted with invalid token');
      connection.socket.close(1008, 'Invalid token');
      return;
    }
    
    const connectionId = uuidv4();
    const wsConnection: WebSocketConnection = {
      id: connectionId,
      socket: connection,
      userId: user.userId,
      username: user.username,
      sessionIds: new Set(),
      isAlive: true
    };
    
    connections.set(connectionId, wsConnection);
    logger.info(`WebSocket connected: ${connectionId} (user: ${user.username})`);
    
    // Send connection success message
    connection.socket.send(JSON.stringify({
      type: 'connection_status',
      payload: { status: 'connected', connectionId }
    }));
    
    // Handle incoming messages
    connection.socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(connectionId, message);
      } catch (error) {
        logger.error('Invalid WebSocket message:', error);
        connection.socket.send(JSON.stringify({
          type: 'error',
          error: { code: 'INVALID_MESSAGE', message: 'Invalid JSON message' }
        }));
      }
    });
    
    // Handle ping/pong for connection health
    connection.socket.on('ping', () => {
      wsConnection.isAlive = true;
    });
    
    // Handle close
    connection.socket.on('close', () => {
      logger.info(`WebSocket disconnected: ${connectionId}`);
      connections.delete(connectionId);
      
      // Clean up associated sessions
      wsConnection.sessionIds.forEach(sessionId => {
        // TODO: Close OpenCode processes for this session
        logger.info(`Cleaning up session: ${sessionId}`);
      });
    });
    
    // Set up heartbeat check
    const heartbeatInterval = setInterval(() => {
      if (!wsConnection.isAlive) {
        logger.warn(`Connection ${connectionId} timed out`);
        connection.socket.terminate();
        clearInterval(heartbeatInterval);
        return;
      }
      
      wsConnection.isAlive = false;
      connection.socket.ping();
    }, 30000);
    
    // Clean up interval on close
    connection.socket.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  });
}

async function handleMessage(connectionId: string, message: unknown): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    logger.error(`Connection not found: ${connectionId}`);
    return;
  }
  
  // TODO: Route message to appropriate ACP handler
  logger.info(`Received message from ${connectionId}:`, message);
  
  // Echo for now (will be replaced with ACP protocol handling)
  connection.socket.send(JSON.stringify({
    type: 'acp_response',
    payload: { echo: message }
  }));
}

export function getConnection(connectionId: string): WebSocketConnection | undefined {
  return connections.get(connectionId);
}

export function broadcastToConnection(connectionId: string, message: unknown): void {
  const connection = connections.get(connectionId);
  if (connection && connection.socket.socket.readyState === 1) { // WebSocket.OPEN
    connection.socket.socket.send(JSON.stringify(message));
  }
}
