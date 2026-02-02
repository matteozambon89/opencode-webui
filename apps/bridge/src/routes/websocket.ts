import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import type { JSONRPCNotification } from '@opencode/shared';
import type { WebSocket } from 'ws';
import { verifyToken } from './auth.js';
import { logger } from '../utils/logger.js';
import { acpHandler } from '../modules/protocol-handler/index.js';
import { v4 as uuidv4 } from 'uuid';

// Store active WebSocket connections
const connections = new Map<string, WebSocketConnection>();

interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId: string;
  username: string;
  sessionIds: Set<string>;
  isAlive: boolean;
}

export async function websocketRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  
  app.get('/ws', { websocket: true }, (socket, req: FastifyRequest) => {
    // Verify JWT from query parameter
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    
    if (!token) {
      logger.warn('WebSocket connection attempted without token');
      socket.close(1008, 'Authentication required');
      return;
    }
    
    const user = verifyToken(token);
    if (!user) {
      logger.warn('WebSocket connection attempted with invalid token');
      socket.close(1008, 'Invalid token');
      return;
    }
    
    const connectionId = uuidv4();
    const wsConnection: WebSocketConnection = {
      id: connectionId,
      socket: socket,
      userId: user.userId,
      username: user.username,
      sessionIds: new Set(),
      isAlive: true
    };
    
    connections.set(connectionId, wsConnection);
    logger.info(`WebSocket connected: ${connectionId} (user: ${user.username})`);
    
    // Send connection success message
    socket.send(JSON.stringify({
      type: 'connection_status',
      payload: { status: 'connected', connectionId }
    }));
    
    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(connectionId, message);
      } catch (error) {
        logger.error(error);
        socket.send(JSON.stringify({
          type: 'error',
          error: { code: 'INVALID_MESSAGE', message: 'Invalid JSON message' }
        }));
      }
    });
    
    // Handle ping/pong for connection health
    socket.on('ping', () => {
      wsConnection.isAlive = true;
    });
    
    // Handle close
    socket.on('close', () => {
      logger.info(`WebSocket disconnected: ${connectionId}`);
      connections.delete(connectionId);
      
      // Clean up associated sessions
      wsConnection.sessionIds.forEach(sessionId => {
        acpHandler.closeSession(sessionId);
      });
    });
    
    // Set up heartbeat check
    const heartbeatInterval = setInterval(() => {
      if (!wsConnection.isAlive) {
        logger.warn(`Connection ${connectionId} timed out`);
        socket.terminate();
        clearInterval(heartbeatInterval);
        return;
      }
      
      wsConnection.isAlive = false;
      socket.ping();
    }, 30000);
    
    // Clean up interval on close
    socket.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  });
}

async function handleMessage(connectionId: string, message: BridgeClientMessage): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    logger.info(`Connection not found: ${connectionId}`);
    return;
  }
  
  const { type, payload } = message;
  
  try {
    switch (type) {
      case 'acp:initialize': {
        const result = await acpHandler.initialize(
          connectionId,
          connection.userId,
          payload
        );
        
        if (result.success && result.protocolVersion) {
          connection.socket.send(JSON.stringify({
            type: 'acp:initialized',
            payload: {
              protocolVersion: result.protocolVersion,
              agentCapabilities: result.agentCapabilities
            }
          }));
        } else {
          connection.socket.send(JSON.stringify({
            type: 'acp:error',
            error: { code: 'INIT_FAILED', message: result.error || 'Initialization failed' }
          }));
        }
        break;
      }
      
      case 'acp:session:new': {
        const result = await acpHandler.createSession(
          connectionId,
          connection.userId,
          payload
        );
        
        if (result.success && result.sessionId) {
          connection.sessionIds.add(result.sessionId);
          
          // Register notification handler for this session
          acpHandler.onNotification(result.sessionId, (notification) => {
            handleSessionNotification(connectionId, result.sessionId!, notification);
          });
          
          connection.socket.send(JSON.stringify({
            type: 'acp:session:created',
            payload: { sessionId: result.sessionId }
          }));
        } else {
          connection.socket.send(JSON.stringify({
            type: 'acp:error',
            error: { code: 'SESSION_CREATE_FAILED', message: result.error || 'Failed to create session' }
          }));
        }
        break;
      }
      
      case 'acp:session:prompt': {
        const { sessionId, content } = payload;
        const result = await acpHandler.sendPrompt(sessionId, content);
        
        if (!result.success) {
          connection.socket.send(JSON.stringify({
            type: 'acp:error',
            error: { code: 'PROMPT_FAILED', message: result.error || 'Failed to send prompt' }
          }));
        }
        // Successful prompts get responses via notifications (streaming)
        break;
      }
      
      case 'acp:session:cancel': {
        const { sessionId } = payload;
        await acpHandler.cancelSession(sessionId);
        connection.socket.send(JSON.stringify({
          type: 'acp:session:cancelled',
          payload: { sessionId }
        }));
        break;
      }
      
      case 'acp:session:close': {
        const { sessionId } = payload;
        await acpHandler.closeSession(sessionId);
        connection.sessionIds.delete(sessionId);
        connection.socket.send(JSON.stringify({
          type: 'acp:session:closed',
          payload: { sessionId }
        }));
        break;
      }
      
      case 'ping': {
        connection.socket.send(JSON.stringify({ type: 'pong' }));
        break;
      }
      
      default: {
        logger.warn(`Unknown message type: ${type}`);
        connection.socket.send(JSON.stringify({
          type: 'error',
          error: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${type}` }
        }));
      }
    }
  } catch (error) {
    logger.error(error);
    connection.socket.send(JSON.stringify({
      type: 'error',
      error: { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Internal server error' 
      }
    }));
  }
}

function handleSessionNotification(
  connectionId: string, 
  sessionId: string, 
  notification: JSONRPCNotification
): void {
  const connection = connections.get(connectionId);
  if (!connection) {
    return;
  }
  
  // Forward session/update notifications to the client
  if (notification.method === 'session/update') {
    connection.socket.send(JSON.stringify({
      type: 'acp:session:update',
      payload: {
        sessionId,
        update: notification.params
      }
    }));
  } else if (notification.method === 'session/prompt') {
    // This is the final response to a prompt
    connection.socket.send(JSON.stringify({
      type: 'acp:session:completed',
      payload: {
        sessionId,
        result: notification.params
      }
    }));
  } else {
    // Other notifications
    connection.socket.send(JSON.stringify({
      type: 'acp:notification',
      payload: {
        sessionId,
        method: notification.method,
        params: notification.params
      }
    }));
  }
}

export function getConnection(connectionId: string): WebSocketConnection | undefined {
  return connections.get(connectionId);
}

export function broadcastToConnection(connectionId: string, message: unknown): void {
  const connection = connections.get(connectionId);
  if (connection && connection.socket.readyState === 1) { // WebSocket.OPEN
    connection.socket.send(JSON.stringify(message));
  }
}

// Message types from client
type BridgeClientMessage =
  | { type: 'acp:initialize'; payload: { protocolVersion: number; clientInfo: { name: string; version: string }; capabilities?: unknown } }
  | { type: 'acp:session:new'; payload?: { cwd?: string } }
  | { type: 'acp:session:prompt'; payload: { sessionId: string; content: Array<{ type: string; text?: string }> } }
  | { type: 'acp:session:cancel'; payload: { sessionId: string } }
  | { type: 'acp:session:close'; payload: { sessionId: string } }
  | { type: 'ping'; payload?: never };
