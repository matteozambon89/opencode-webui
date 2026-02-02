import type { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '@opencode/shared/types/acp';

export interface OpenCodeProcess {
  sessionId: string;
  process: import('child_process').ChildProcess;
  status: 'initializing' | 'ready' | 'error' | 'closed';
  cwd?: string;
}

export interface ProcessMessageHandler {
  onMessage: (message: JSONRPCMessage) => void;
  onError: (error: Error) => void;
  onClose: (code: number | null) => void;
}

export type ProcessStatus = OpenCodeProcess['status'];
