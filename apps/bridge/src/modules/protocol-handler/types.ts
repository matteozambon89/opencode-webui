import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCError,
} from '@opencode/shared';

export interface ACPMessageHandler {
  onRequest: (request: JSONRPCRequest) => Promise<JSONRPCResponse>;
  onNotification: (notification: JSONRPCNotification) => void;
  onError: (error: JSONRPCError) => void;
}

export interface AuthMethod {
  id: string;
  name: string;
  description: string;
}

export interface SessionInfo {
  sessionId: string;
  connectionId: string;
  userId: string;
  cwd?: string;
  model?: string;
  isInitialized: boolean;
  status: 'active' | 'closed';
  authMethods?: AuthMethod[];
  requiresAuth?: boolean;
}
