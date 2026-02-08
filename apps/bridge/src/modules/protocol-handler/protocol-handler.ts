import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { processManager } from '../process-manager/index.js';
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCMessage,
  InitializeResult,
  SessionNewResult,
} from '@opencode/shared';
import type { SessionInfo, AuthMethod } from './types.js';

// Pending requests waiting for response
interface PendingRequest {
  resolve: (response: JSONRPCResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class ACPProtocolHandler {
  private sessions = new Map<string, SessionInfo>();
  private pendingRequests = new Map<string, PendingRequest>();
  private notificationHandlers = new Map<string, (notification: JSONRPCNotification) => void>();
  private requestTimeout = 30000; // 30 seconds

  async initialize(
    connectionId: string,
    userId: string,
    params: {
      protocolVersion: number;
      clientInfo: { name: string; version: string };
      capabilities?: unknown;
    }
  ): Promise<{
    success: boolean;
    protocolVersion?: number;
    agentCapabilities?: unknown;
    availableModels?: string[];
    error?: string;
  }> {
    // For now, we'll create a session directly since OpenCode ACP doesn't require authentication
    // We'll spawn the process and send initialize
    const sessionId = uuidv4();
    
    logger.info(`Initializing ACP session ${sessionId} for connection ${connectionId}`);

    try {
      // Spawn OpenCode process
      await processManager.spawnProcess(sessionId);

      // Register handler for this session
      processManager.registerHandler(sessionId, {
        onMessage: (message) => this.handleProcessMessage(sessionId, message),
        onError: (error) => this.handleProcessError(sessionId, error),
        onClose: (code) => this.handleProcessClose(sessionId, code),
      });

      // Create session info
      const session: SessionInfo = {
        sessionId,
        connectionId,
        userId,
        isInitialized: false,
        status: 'active',
      };
      this.sessions.set(sessionId, session);

      // Send initialize request
      const initRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'initialize',
        params: {
          protocolVersion: params.protocolVersion,
          clientInfo: params.clientInfo,
          capabilities: params.capabilities || {},
        },
      };

      const response = await this.sendRequestAndWait(sessionId, initRequest);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Mark as initialized
      session.isInitialized = true;
      processManager.updateStatus(sessionId, 'ready');

      logger.info(`ACP session ${sessionId} initialized successfully`);

      const result = response.result as InitializeResult;
      return {
        success: true,
        protocolVersion: result?.protocolVersion,
        agentCapabilities: result?.agentCapabilities,
        availableModels: result?.availableModels,
      };
    } catch (error) {
      logger.error(error);
      
      // Clean up
      await this.closeSession(sessionId);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createSession(
    connectionId: string,
    userId: string,
    params?: { cwd?: string; model?: string }
  ): Promise<{ success: boolean; sessionId?: string; availableModels?: string[]; currentModel?: string; authMethods?: AuthMethod[]; requiresAuth?: boolean; error?: string }> {
    let sessionId = uuidv4();

    logger.info({ cwd: params?.cwd, model: params?.model }, `Creating ACP session ${sessionId}`);

    try {
      // Spawn OpenCode process
      await processManager.spawnProcess(sessionId, params?.cwd);

      // Register handler
      processManager.registerHandler(sessionId, {
        onMessage: (message) => this.handleProcessMessage(sessionId, message),
        onError: (error) => this.handleProcessError(sessionId, error),
        onClose: (code) => this.handleProcessClose(sessionId, code),
        onStderr: (data) => this.handleProcessStderr(sessionId, data),
      });

      // Create session info
      const session: SessionInfo = {
        sessionId,
        connectionId,
        userId,
        cwd: params?.cwd,
        model: params?.model,
        isInitialized: false,
        status: 'active',
      };
      this.sessions.set(sessionId, session);

      // Step 1: Send initialize request
      const initRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'initialize',
        params: {
          protocolVersion: 1,
          clientInfo: { name: 'opencode-bridge', version: '1.0.0' },
          capabilities: {},
        },
      };

      const initResponse = await this.sendRequestAndWait(sessionId, initRequest);

      if (initResponse.error) {
        throw new Error(`Initialize failed: ${initResponse.error.message}`);
      }

      // Extract auth methods from initialize response
      // Note: authMethods indicate available authentication options, not that auth is required
      const initResult = initResponse.result as InitializeResult & { authMethods?: Array<{ id: string; name: string; description: string }> };
      if (initResult.authMethods && initResult.authMethods.length > 0) {
        session.authMethods = initResult.authMethods.map((auth) => ({
          id: auth.id,
          name: auth.name,
          description: auth.description,
        }));
        // Only require auth if explicitly indicated (e.g., via env var check or error)
        // When OPENCODE_API_KEY is set, auth is already satisfied even though methods are listed
        logger.info(`Session ${sessionId} has available auth methods: ${initResult.authMethods.map((a) => a.name).join(', ')}`);
      }

      // Step 2: Send session/new request with required parameters
      const sessionNewRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'session/new',
        params: {
          cwd: params?.cwd || process.cwd(),
          mcpServers: [],
          ...(params?.model ? { model: params.model } : {}),
        },
      };

      const sessionResponse = await this.sendRequestAndWait(sessionId, sessionNewRequest);

      if (sessionResponse.error) {
        throw new Error(`Session creation failed: ${sessionResponse.error.message}`);
      }

      const sessionResult = sessionResponse.result as SessionNewResult;
      
      // Update session with OpenCode's session ID if different
      if (sessionResult.sessionId && sessionResult.sessionId !== sessionId) {
        const newSessionId = sessionResult.sessionId;
        logger.info(`Session ID changed from ${sessionId} to ${newSessionId}, migrating process...`);
        
        // Update session info
        session.sessionId = newSessionId;
        
        // Update the sessions map with the correct ID
        this.sessions.delete(sessionId);
        this.sessions.set(newSessionId, session);
        
        // CRITICAL: Migrate the process in processManager to use the new sessionId
        processManager.migrateProcess(sessionId, newSessionId);
        
        // CRITICAL: Re-register handlers with the NEW sessionId
        // The original handlers (lines 127-131) captured the OLD sessionId by value in their closures
        processManager.registerHandler(newSessionId, {
          onMessage: (message) => this.handleProcessMessage(newSessionId, message),
          onError: (error) => this.handleProcessError(newSessionId, error),
          onClose: (code) => this.handleProcessClose(newSessionId, code),
        });
        
        // Update the sessionId variable for subsequent operations
        sessionId = newSessionId;
      }

      session.isInitialized = true;
      processManager.updateStatus(sessionId, 'ready');

      // Extract available models from the response
      const availableModels = sessionResult.models?.availableModels?.map(m => m.modelId) || [];
      const currentModel = sessionResult.models?.currentModelId;

      logger.info({ 
        sessionId: sessionResult.sessionId || sessionId, 
        modelCount: availableModels.length,
        currentModel,
        authMethods: session.authMethods,
        requiresAuth: session.requiresAuth
      }, `ACP session created successfully`);

      return {
        success: true,
        sessionId: sessionResult.sessionId || sessionId,
        availableModels,
        currentModel,
        authMethods: session.authMethods,
        requiresAuth: session.requiresAuth,
      };
    } catch (error) {
      logger.error(error);
      await this.closeSession(sessionId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendPrompt(
    sessionId: string,
    content: Array<{ type: string; text?: string }>,
    agentMode?: 'plan' | 'build'
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error(`sendPrompt: Session not found: ${sessionId}`);
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'closed') {
      logger.error(`sendPrompt: Session is closed: ${sessionId}`);
      return { success: false, error: 'Session is closed' };
    }

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'session/prompt',
      params: {
        sessionId,
        prompt: content,
        ...(agentMode ? { agentMode } : {}),
      },
    };

    logger.info(`sendPrompt [${sessionId}]: Sending session/prompt request with ${content.length} content blocks`);
    logger.debug(`Request payload: ${JSON.stringify(request)}`);

    try {
      // Send the request but don't wait for the final response
      // The streaming updates will come via notifications
      processManager.sendMessage(sessionId, request);
      logger.info(`sendPrompt [${sessionId}]: Request sent successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`sendPrompt [${sessionId}] error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send prompt',
      };
    }
  }

  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'closed') {
      return;
    }

    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method: 'session/cancel',
      params: { sessionId },
    };

    try {
      processManager.sendMessage(sessionId, notification);
    } catch (error) {
      logger.error(error);
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.status = 'closed';

    // Clean up pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (this.getSessionIdFromRequestId(id) === sessionId) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Session closed'));
        this.pendingRequests.delete(id);
      }
    }

    // Kill the process
    await processManager.killProcess(sessionId);
    
    // Clean up
    this.sessions.delete(sessionId);
    
    logger.info(`Session ${sessionId} closed`);
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getConnectionSessions(connectionId: string): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.connectionId === connectionId
    );
  }

  onNotification(sessionId: string, handler: (notification: JSONRPCNotification) => void): void {
    this.notificationHandlers.set(sessionId, handler);
  }

  removeNotificationHandler(sessionId: string): void {
    this.notificationHandlers.delete(sessionId);
  }

  private async sendRequestAndWait(
    sessionId: string,
    request: JSONRPCRequest
  ): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(String(request.id));
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      this.pendingRequests.set(String(request.id), {
        resolve,
        reject,
        timeout,
      });

      try {
        processManager.sendMessage(sessionId, request);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(String(request.id));
        reject(error);
      }
    });
  }

  private handleProcessMessage(sessionId: string, message: JSONRPCMessage): void {
    const msgId = (message as {id?: string}).id;
    const msgMethod = (message as {method?: string}).method;
    logger.info(`handleProcessMessage [${sessionId}]: hasId=${'id' in message}, id=${msgId}, hasMethod=${'method' in message}, method=${msgMethod}`);

    // Check if it's a response to a pending request
    if ('id' in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(String(message.id));
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(String(message.id));
        
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message as JSONRPCResponse);
        }
        return;
      }
      
      // Response with id but not in pending requests - forward to handler as notification
      // This handles async responses from OpenCode (e.g., session/prompt responses)
      logger.info(`Forwarding async response [${sessionId}]: id=${msgId}`);
      const handler = this.notificationHandlers.get(sessionId);
      if (handler) {
        // Convert response to notification format for the handler
        const response = message as JSONRPCResponse;
        logger.info(`Full response [${sessionId}]: ${JSON.stringify(message)}`);
        const notification = {
          jsonrpc: '2.0',
          method: 'session/prompt',
          params: response.result || { content: [], stopReason: 'unknown' },
        } as JSONRPCNotification;
        handler(notification);
      } else {
        logger.warn(`No notification handler found for session ${sessionId}, available handlers: ${Array.from(this.notificationHandlers.keys()).join(', ')}`);
      }
      return;
    }

    // It's a notification - forward to handler
    if ('method' in message && !('id' in message)) {
      logger.info(`Forwarding notification [${sessionId}]: method=${msgMethod}`);
      const handler = this.notificationHandlers.get(sessionId);
      if (handler) {
        handler(message as JSONRPCNotification);
      } else {
        logger.warn(`No notification handler found for session ${sessionId}, available handlers: ${Array.from(this.notificationHandlers.keys()).join(', ')}`);
      }
    }
  }

  private handleProcessError(sessionId: string, error: Error): void {
    logger.error(error);

    // Broadcast error to UI via stderr handler
    this.handleProcessStderr(sessionId, `Process error: ${error.message}`);

    // Reject all pending requests for this session
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (this.getSessionIdFromRequestId(id) === sessionId) {
        clearTimeout(pending.timeout);
        pending.reject(error);
        this.pendingRequests.delete(id);
      }
    }
  }

  private handleProcessStderr(sessionId: string, data: string): void {
    logger.warn(`OpenCode stderr error [${sessionId}]: ${data}`);
    
    // Extract error message from stderr
    let errorMessage = 'An error occurred while processing your request';
    
    if (data.includes('Rate limit exceeded')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (data.includes('Unauthorized') || data.includes('401')) {
      errorMessage = 'Authentication failed. Please check your API key.';
    } else if (data.includes('403')) {
      errorMessage = 'Access denied. Please check your permissions.';
    } else if (data.includes('Invalid API key')) {
      errorMessage = 'Invalid API key. Please check your configuration.';
    } else if (data.includes('quota exceeded')) {
      errorMessage = 'API quota exceeded. Please check your usage limits.';
    } else if (data.includes('AI_APICallError')) {
      // Try to extract more specific error details
      const match = data.match(/message[=:]([^,\n]+)/i);
      if (match) {
        errorMessage = match[1].trim();
      }
    }
    
    // Forward error as notification to handler
    const handler = this.notificationHandlers.get(sessionId);
    if (handler) {
      const notification: JSONRPCNotification = {
        jsonrpc: '2.0',
        method: 'session/error',
        params: {
          sessionId,
          error: {
            code: 'API_ERROR',
            message: errorMessage,
            details: data
          }
        }
      };
      handler(notification);
    }
  }

  private handleProcessClose(sessionId: string, code: number | null): void {
    logger.info(`Process closed for session ${sessionId} with code ${code}`);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'closed';
    }

    // Broadcast error to UI if process exited with non-zero code or unexpectedly
    if (code !== 0 && code !== null) {
      this.handleProcessStderr(sessionId, `Process exited with code ${code}`);
    } else if (code === null) {
      this.handleProcessStderr(sessionId, 'Process terminated unexpectedly');
    }

    // Clean up
    this.closeSession(sessionId);
  }

  private getSessionIdFromRequestId(_requestId: string): string | undefined {
    // Find session by checking pending requests
    // This is a simplification - in production, track request -> session mapping
    for (const [sessionId, session] of this.sessions.entries()) {
      // Check if this session has pending requests
      for (const _id of this.pendingRequests.keys()) {
        // We need to track which session a request belongs to
        // For now, return the first active session
        if (session.status === 'active') {
          return sessionId;
        }
      }
    }
    return undefined;
  }
}

// Singleton instance
export const acpHandler = new ACPProtocolHandler();
