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

export interface SessionInfo {
  sessionId: string;
  connectionId: string;
  userId: string;
  cwd?: string;
  isInitialized: boolean;
  status: 'active' | 'closed';
}
