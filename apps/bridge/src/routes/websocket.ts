import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import type { JSONRPCNotification } from '@opencode/shared';
import type { WebSocket } from 'ws';
import { verifyToken } from './auth.js';
import { logger } from '../utils/logger.js';
import { acpHandler } from '../modules/protocol-handler/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  createMessage,
  createErrorMessage,
  validateMessage,
  isValidMessageType,
  type MessageType
} from '@opencode/shared';

// Store active WebSocket connections
const connections = new Map<string, WebSocketConnection>();

// Track pending requests for correlation
const pendingRequests = new Map<string, {
  connectionId: string;
  requestType: string;
  startTime: number;
}>();

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
    
    // Send connection success message using new protocol
    socket.send(JSON.stringify(createMessage('connection:established:success', {
      connectionId,
      protocolVersion: '1.0.0'
    })));
    
    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(connectionId, message);
      } catch (error) {
        logger.error(error);
        socket.send(JSON.stringify(createErrorMessage(
          'system:error' as MessageType,
          'INVALID_MESSAGE',
          'Invalid JSON message'
        )));
      }
    });
    
    // Handle incoming pong responses from client
    socket.on('pong', () => {
      wsConnection.isAlive = true;
    });
    
    // Mark as alive when any message is received (application-level activity)
    socket.on('message', () => {
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
      
      // Clean up pending requests for this connection
      for (const [requestId, request] of pendingRequests.entries()) {
        if (request.connectionId === connectionId) {
          pendingRequests.delete(requestId);
        }
      }
    });
    
    // Set up heartbeat check (every 25 seconds)
    const heartbeatInterval = setInterval(() => {
      if (!wsConnection.isAlive) {
        logger.warn(`Connection ${connectionId} timed out - no activity detected`);
        socket.terminate();
        clearInterval(heartbeatInterval);
        return;
      }
      
      // Reset isAlive and send ping to client
      wsConnection.isAlive = false;
      try {
        socket.ping();
        logger.debug(`Sent ping to connection ${connectionId}`);
      } catch (err) {
        logger.error(`Failed to send ping to ${connectionId}`);
      }
    }, 25000);
    
    // Clean up interval on close
    socket.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  });
}

async function handleMessage(connectionId: string, message: { id?: string; type?: string; payload?: unknown }): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    logger.info(`Connection not found: ${connectionId}`);
    return;
  }
  
  // Validate base message structure
  if (!message.type) {
    connection.socket.send(JSON.stringify(createErrorMessage(
      'system:error' as MessageType,
      'INVALID_MESSAGE',
      'Message must have a type field'
    )));
    return;
  }
  
  // Check if message type is valid
  if (!isValidMessageType(message.type)) {
    connection.socket.send(JSON.stringify(createErrorMessage(
      'system:error' as MessageType,
      'UNKNOWN_TYPE',
      `Unknown message type: ${message.type}`
    )));
    return;
  }
  
  const { type, payload, id: messageId } = message;
  
  try {
    switch (type) {
      case 'connection:heartbeat:request': {
        // Validate the message
        const validation = validateMessage('connection:heartbeat:request', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        const startTime = Date.now();
        connection.socket.send(JSON.stringify(createMessage('connection:heartbeat:success', {
          latency: Date.now() - startTime
        })));
        break;
      }
      
      case 'acp:initialize:request': {
        // Validate the message
        const validation = validateMessage('acp:initialize:request', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        const result = await acpHandler.initialize(
          connectionId,
          connection.userId,
          payload as { protocolVersion: number; clientInfo: { name: string; version: string }; capabilities?: unknown }
        );
        
        if (result.success && result.protocolVersion) {
          connection.socket.send(JSON.stringify(createMessage('acp:initialize:success', {
            protocolVersion: result.protocolVersion,
            agentCapabilities: result.agentCapabilities,
            availableModels: result.availableModels || []
          })));
        } else {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'ACP_INIT_FAILED',
            result.error || 'Initialization failed'
          )));
        }
        break;
      }
      
      case 'acp:session:create:request': {
        // Validate the message
        const validation = validateMessage('acp:session:create:request', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        const result = await acpHandler.createSession(
          connectionId,
          connection.userId,
          payload as { cwd?: string; model?: string }
        );

        if (result.success && result.sessionId) {
          connection.sessionIds.add(result.sessionId);

          // Register notification handler for this session
          acpHandler.onNotification(result.sessionId, (notification) => {
            handleSessionNotification(connectionId, result.sessionId!, notification);
          });

          logger.info(`[WebSocket] Sending acp:session:create:success with authMethods: ${JSON.stringify(result.authMethods)}, requiresAuth: ${result.requiresAuth}`);
          connection.socket.send(JSON.stringify(createMessage('acp:session:create:success', {
            sessionId: result.sessionId,
            availableModels: result.availableModels || [],
            currentModel: result.currentModel || '',
            modes: {
              currentModeId: 'build', // Default mode
              availableModes: [
                { id: 'ask', name: 'Ask' },
                { id: 'build', name: 'Build' }
              ]
            }
          })));
        } else {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'SESSION_CREATE_FAILED',
            result.error || 'Failed to create session'
          )));
        }
        break;
      }
      
      case 'acp:prompt:send:request': {
        // Validate the message
        const validation = validateMessage('acp:prompt:send:request', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        logger.info(`[WebSocket] Received acp:prompt:send:request from frontend`);
        const typedPayload = payload as { sessionId: string; content: Array<{ type: string; text?: string }>; agentMode?: 'plan' | 'build' };
        const { sessionId, content, agentMode } = typedPayload;
        logger.info(`[WebSocket] Prompt details: sessionId=${sessionId}, agentMode=${agentMode}, contentBlocks=${content.length}`);
        
        // Track this request for correlation
        const requestId = messageId || uuidv4();
        pendingRequests.set(requestId, {
          connectionId,
          requestType: type,
          startTime: Date.now()
        });
        
        const result = await acpHandler.sendPrompt(sessionId, content, agentMode);
        
        if (!result.success) {
          logger.error(`[WebSocket] Failed to send prompt: ${result.error}`);
          pendingRequests.delete(requestId);
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'PROMPT_FAILED',
            result.error || 'Failed to send prompt'
          )));
        } else {
          logger.info(`[WebSocket] Prompt sent successfully to OpenCode`);
          // Send acceptance confirmation
          connection.socket.send(JSON.stringify(createMessage('acp:prompt:send:success', {
            requestId,
            status: 'accepted'
          })));
        }
        // Successful prompts get responses via notifications (streaming)
        break;
      }
      
      case 'acp:prompt:cancel:request': {
        // Validate the message
        const validation = validateMessage('acp:prompt:cancel:request', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        const typedPayload = payload as { sessionId: string };
        const { sessionId } = typedPayload;
        await acpHandler.cancelSession(sessionId);
        connection.socket.send(JSON.stringify(createMessage('acp:prompt:cancel:success', {
          sessionId
        })));
        break;
      }
      
      case 'acp:session:close:request': {
        // Validate the message
        const validation = validateMessage('acp:session:close:request', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        const typedPayload = payload as { sessionId: string };
        const { sessionId } = typedPayload;
        await acpHandler.closeSession(sessionId);
        connection.sessionIds.delete(sessionId);
        connection.socket.send(JSON.stringify(createMessage('acp:session:close:success', {
          sessionId
        })));
        break;
      }
      
      case 'acp:permission:response': {
        // Validate the message
        const validation = validateMessage('acp:permission:response', message);
        if (!validation.success) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'INVALID_PARAMS',
            'Message validation failed',
            validation.error.errors
          )));
          return;
        }
        
        // TODO: Implement permission response handling
        logger.info(`[WebSocket] Received permission response: ${JSON.stringify(payload)}`);
        break;
      }
      
      default: {
        logger.warn(`Unhandled message type: ${type}`);
        connection.socket.send(JSON.stringify(createErrorMessage(
          'system:error' as MessageType,
          'UNKNOWN_TYPE',
          `Unhandled message type: ${type}`
        )));
      }
    }
  } catch (error) {
    logger.error(error);
    connection.socket.send(JSON.stringify(createErrorMessage(
      'system:error' as MessageType,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error'
    )));
  }
}

function handleSessionNotification(
  connectionId: string, 
  sessionId: string, 
  notification: JSONRPCNotification
): void {
  logger.info(`handleSessionNotification [${connectionId}/${sessionId}]: method=${notification.method}`);
  
  const connection = connections.get(connectionId);
  if (!connection) {
    logger.warn(`Connection not found: ${connectionId}`);
    return;
  }
  
  // Find the most recent pending prompt request for this session to correlate
  let correlatedRequestId: string | undefined;
  for (const [requestId, request] of pendingRequests.entries()) {
    if (request.connectionId === connectionId) {
      correlatedRequestId = requestId;
      break;
    }
  }
  
  // Forward session/update notifications to the client using new protocol
  if (notification.method === 'session/update') {
    logger.info(`Forwarding session/update as acp:prompt:update to frontend [${sessionId}]`);
    const params = notification.params as { update?: unknown };
    connection.socket.send(JSON.stringify(createMessage('acp:prompt:update', {
      sessionId,
      requestId: correlatedRequestId || 'unknown',
      update: params.update
    })));
  } else if (notification.method === 'session/error') {
    // Forward error notifications from stderr using new protocol
    logger.info(`Forwarding session/error as acp:session:error to frontend [${sessionId}]`);
    const errorParams = notification.params as { error: { code: string; message: string; details?: string } };
    connection.socket.send(JSON.stringify({
      ...createMessage('acp:session:error', { sessionId }),
      error: errorParams.error
    }));
  } else if (notification.method === 'session/prompt') {
    // This is the final response to a prompt
    logger.info(`Forwarding session/prompt as acp:prompt:complete to frontend [${sessionId}]`);
    const promptParams = notification.params as { content?: unknown; stopReason?: string };
    
    // Clean up pending request
    if (correlatedRequestId) {
      pendingRequests.delete(correlatedRequestId);
    }
    
    connection.socket.send(JSON.stringify(createMessage('acp:prompt:complete', {
      sessionId,
      requestId: correlatedRequestId || 'unknown',
      result: {
        content: promptParams.content || [],
        stopReason: (promptParams.stopReason as 'end_turn' | 'tool_use' | 'cancelled' | 'error') || 'end_turn'
      }
    })));
  } else {
    // Other notifications - could be permission requests or other events
    logger.info(`Forwarding other notification to frontend [${sessionId}]: ${notification.method}`);
    
    // Handle permission requests specifically
    if (notification.method === 'session/request_permission') {
      const permParams = notification.params as {
        toolCall?: { toolCallId: string; toolName: string; arguments: Record<string, unknown> };
        options?: Array<{ optionId: string; title: string; description: string }>;
      };
      
      connection.socket.send(JSON.stringify(createMessage('acp:permission:request', {
        sessionId,
        requestId: correlatedRequestId || uuidv4(),
        toolCall: permParams.toolCall || { toolCallId: '', toolName: '', arguments: {} },
        options: permParams.options || [
          { optionId: 'allow_once', title: 'Allow Once', description: 'Allow this operation' },
          { optionId: 'deny', title: 'Deny', description: 'Do not allow' }
        ]
      })));
    } else {
      // Generic notification (deprecated - should use specific types)
      logger.warn(`Received unhandled notification type: ${notification.method}`);
    }
  }
}
