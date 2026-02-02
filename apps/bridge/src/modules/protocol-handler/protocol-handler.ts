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
import type { SessionInfo } from './types.js';

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
  ): Promise<{ success: boolean; sessionId?: string; availableModels?: string[]; currentModel?: string; error?: string }> {
    const sessionId = uuidv4();

    logger.info({ cwd: params?.cwd, model: params?.model }, `Creating ACP session ${sessionId}`);

    try {
      // Spawn OpenCode process
      await processManager.spawnProcess(sessionId, params?.cwd);

      // Register handler
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
        session.sessionId = sessionResult.sessionId;
        // Update the sessions map with the correct ID
        this.sessions.delete(sessionId);
        this.sessions.set(sessionResult.sessionId, session);
      }

      session.isInitialized = true;
      processManager.updateStatus(sessionId, 'ready');

      // Extract available models from the response
      const availableModels = sessionResult.models?.availableModels?.map(m => m.modelId) || [];
      const currentModel = sessionResult.models?.currentModelId;

      logger.info({ 
        sessionId: sessionResult.sessionId || sessionId, 
        modelCount: availableModels.length,
        currentModel 
      }, `ACP session created successfully`);

      return {
        success: true,
        sessionId: sessionResult.sessionId || sessionId,
        availableModels,
        currentModel,
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
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'closed') {
      return { success: false, error: 'Session is closed' };
    }

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'session/prompt',
      params: {
        sessionId,
        content,
        ...(agentMode ? { agentMode } : {}),
      },
    };

    try {
      // Send the request but don't wait for the final response
      // The streaming updates will come via notifications
      processManager.sendMessage(sessionId, request);
      return { success: true };
    } catch (error) {
      logger.error(error);
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
    }

    // It's a notification - forward to handler
    if ('method' in message && !('id' in message)) {
      const handler = this.notificationHandlers.get(sessionId);
      if (handler) {
        handler(message as JSONRPCNotification);
      }
    }
  }

  private handleProcessError(sessionId: string, error: Error): void {
    logger.error(error);
    
    // Reject all pending requests for this session
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (this.getSessionIdFromRequestId(id) === sessionId) {
        clearTimeout(pending.timeout);
        pending.reject(error);
        this.pendingRequests.delete(id);
      }
    }
  }

  private handleProcessClose(sessionId: string, code: number | null): void {
    logger.info(`Process closed for session ${sessionId} with code ${code}`);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'closed';
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
