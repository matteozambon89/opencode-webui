import type { JSONRPCMessage } from '@opencode/shared';
import type { Interface } from 'readline';

export interface OpenCodeProcess {
  sessionId: string;
  process: import('child_process').ChildProcess;
  status: 'initializing' | 'ready' | 'error' | 'closed';
  cwd?: string;
  model?: string;
  readline?: Interface;
}

export interface ProcessMessageHandler {
  onMessage: (message: JSONRPCMessage) => void;
  onError: (error: Error) => void;
  onClose: (code: number | null) => void;
  onStderr?: (data: string) => void;
}

export type ProcessStatus = OpenCodeProcess['status'];
