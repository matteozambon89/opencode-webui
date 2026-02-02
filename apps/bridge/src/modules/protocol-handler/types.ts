import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCError,
  InitializeParams,
  InitializeResult,
  SessionNewParams,
  SessionNewResult,
  SessionPromptParams,
  SessionPromptResult,
  SessionCancelParams,
  SessionUpdateNotification,
} from '@opencode/shared/types/acp';

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
