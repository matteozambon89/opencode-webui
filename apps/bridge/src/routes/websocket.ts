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

    // Handle close - consolidated cleanup
    socket.on('close', () => {
      logger.info(`WebSocket disconnected: ${connectionId}`);

      // Clear heartbeat interval
      clearInterval(heartbeatInterval);

      // Remove connection
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

        // Validate session ownership
        const session = acpHandler.getSession(sessionId);
        if (!session) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'SESSION_NOT_FOUND',
            'Session not found'
          )));
          return;
        }
        if (session.connectionId !== connectionId) {
          connection.socket.send(JSON.stringify(createErrorMessage(
            type as MessageType,
            'UNAUTHORIZED',
            'Session does not belong to this connection'
          )));
          return;
        }

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
          // Clean up pending request on success - responses come via notifications
          pendingRequests.delete(requestId);
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

/**
 * Translates ACP session/update payload to internal Bridge format
 * Maps field names and structures from ACP to internal format
 */
function translateACPUpdate(acpUpdate: unknown): unknown {
  if (typeof acpUpdate !== 'object' || acpUpdate === null) {
    return acpUpdate;
  }

  const update = acpUpdate as Record<string, unknown>;
  const sessionUpdate = update.sessionUpdate as string | undefined;

  if (!sessionUpdate) {
    logger.warn('ACP update missing sessionUpdate field');
    return update;
  }

  logger.info(`Translating ACP update type: ${sessionUpdate}`);

  switch (sessionUpdate) {
    case 'agent_message_chunk': {
      // ACP: {sessionUpdate, content: {type, text}}
      // Internal: {kind, content: {type, text}}
      const content = update.content as Record<string, unknown> | undefined;
      return {
        kind: 'agent_message_chunk',
        content: content || { type: 'text', text: '' }
      };
    }

    case 'agent_thought_chunk':
    case 'thought_chunk': {
      // ACP: {sessionUpdate, content: {type, text}}
      // Internal: {kind, content: {thought}}
      const content = update.content as Record<string, unknown> | undefined;
      const text = content?.text as string | undefined;
      return {
        kind: 'thought_chunk',
        content: { thought: text || '' }
      };
    }

    case 'tool_call': {
      // ACP: {sessionUpdate, toolCall: {...}}
      // Internal: {kind, toolCall: {...}}
      const toolCall = update.toolCall as Record<string, unknown> | undefined;
      return {
        kind: 'tool_call',
        toolCall: {
          toolCallId: toolCall?.toolCallId || '',
          toolName: toolCall?.toolName || '',
          arguments: toolCall?.arguments || {},
          status: toolCall?.status || 'pending'
        }
      };
    }

    case 'tool_call_update': {
      // ACP: {sessionUpdate, toolCall: {..., result}}
      // Internal: {kind, toolCall: {..., output/error}}
      const toolCall = update.toolCall as Record<string, unknown> | undefined;
      const result = toolCall?.result as Record<string, unknown> | undefined;
      const status = toolCall?.status as string | undefined;

      return {
        kind: 'tool_call_update',
        toolCall: {
          toolCallId: toolCall?.toolCallId || '',
          status: status === 'error' ? 'error' : 'completed',
          output: result?.content as string | undefined,
          error: status === 'error' ? (result?.error as string | undefined) : undefined
        }
      };
    }

    case 'plan': {
      // ACP: {sessionUpdate, plan: {steps: []}}
      // Internal: {kind, plan: {steps: []}}
      const plan = update.plan as Record<string, unknown> | undefined;
      return {
        kind: 'plan',
        plan: {
          steps: Array.isArray(plan?.steps) ? plan.steps : []
        }
      };
    }

    case 'available_commands': {
      // ACP: {sessionUpdate, availableCommands: []}
      // Internal: {kind, availableCommands: []}
      return {
        kind: 'available_commands',
        availableCommands: Array.isArray(update.availableCommands) ? update.availableCommands : []
      };
    }

    case 'current_mode_update': {
      // ACP: {sessionUpdate, currentMode: ''}
      // Internal: {kind, currentMode: ''}
      return {
        kind: 'current_mode_update',
        currentMode: update.currentMode as string | undefined
      };
    }

    case 'config_options': {
      // ACP: {sessionUpdate, configOptions: []}
      // Internal: {kind, configOptions: []}
      return {
        kind: 'config_options',
        configOptions: Array.isArray(update.configOptions) ? update.configOptions : []
      };
    }

    default: {
      logger.warn(`Unknown ACP sessionUpdate type: ${sessionUpdate}`);
      return {
        kind: sessionUpdate,
        ...update
      };
    }
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
    const params = typeof notification.params === 'object' && notification.params !== null
      ? notification.params as { update?: unknown }
      : { update: undefined };

    // Translate ACP format to internal format
    const translatedUpdate = translateACPUpdate(params.update);
    logger.info(`Translated update: ${JSON.stringify(translatedUpdate).substring(0, 200)}`);

    connection.socket.send(JSON.stringify(createMessage('acp:prompt:update', {
      sessionId,
      requestId: correlatedRequestId || 'unknown',
      update: translatedUpdate
    })));
  } else if (notification.method === 'session/error') {
    // Forward error notifications from stderr using new protocol
    logger.info(`Forwarding session/error as acp:session:error to frontend [${sessionId}]`);
    const params = typeof notification.params === 'object' && notification.params !== null
      ? notification.params as Record<string, unknown>
      : {};
    const errorParams = typeof params.error === 'object' && params.error !== null
      ? params.error as { code: string; message: string; details?: string }
      : { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
    connection.socket.send(JSON.stringify({
      ...createMessage('acp:session:error', { sessionId }),
      error: errorParams
    }));
  } else if (notification.method === 'session/prompt') {
    // This is the final response to a prompt
    logger.info(`Forwarding session/prompt as acp:prompt:complete to frontend [${sessionId}]`);
    const params = typeof notification.params === 'object' && notification.params !== null
      ? notification.params as Record<string, unknown>
      : {};
    const promptParams = {
      content: params.content,
      stopReason: typeof params.stopReason === 'string' ? params.stopReason : 'end_turn'
    };

    // Clean up pending request
    if (correlatedRequestId) {
      pendingRequests.delete(correlatedRequestId);
    }

    connection.socket.send(JSON.stringify(createMessage('acp:prompt:complete', {
      sessionId,
      requestId: correlatedRequestId || 'unknown',
      result: {
        content: Array.isArray(promptParams.content) ? promptParams.content : [],
        stopReason: ['end_turn', 'tool_use', 'cancelled', 'error'].includes(promptParams.stopReason)
          ? promptParams.stopReason as 'end_turn' | 'tool_use' | 'cancelled' | 'error'
          : 'end_turn'
      }
    })));
  } else {
    // Other notifications - could be permission requests or other events
    logger.info(`Forwarding other notification to frontend [${sessionId}]: ${notification.method}`);

    // Handle permission requests specifically
    if (notification.method === 'session/request_permission') {
      const permParams = typeof notification.params === 'object' && notification.params !== null
        ? notification.params as Record<string, unknown>
        : {};
      const toolCall = typeof permParams.toolCall === 'object' && permParams.toolCall !== null
        ? permParams.toolCall as { toolCallId: string; toolName: string; arguments: Record<string, unknown> }
        : { toolCallId: '', toolName: '', arguments: {} };
      const options = Array.isArray(permParams.options)
        ? permParams.options as Array<{ optionId: string; title: string; description: string }>
        : [
            { optionId: 'allow_once', title: 'Allow Once', description: 'Allow this operation' },
            { optionId: 'deny', title: 'Deny', description: 'Do not allow' }
          ];

      connection.socket.send(JSON.stringify(createMessage('acp:permission:request', {
        sessionId,
        requestId: correlatedRequestId || uuidv4(),
        toolCall,
        options
      })));
    } else {
      // Generic notification (deprecated - should use specific types)
      logger.warn(`Received unhandled notification type: ${notification.method}`);
    }
  }
}
