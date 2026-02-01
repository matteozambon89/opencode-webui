// WebSocket Message Types for Bridge Communication
export type BridgeMessageType = 
  | 'acp_request'
  | 'acp_response'
  | 'acp_notification'
  | 'error'
  | 'connection_status'
  | 'file_upload'
  | 'file_download';

export interface BridgeMessage {
  type: BridgeMessageType;
  id?: string;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

// Connection Status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Session State
export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  status: 'active' | 'closed';
  cwd?: string;
}

// Chat Message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCallDisplay[];
}

export interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

// Streaming Content
export interface StreamingContent {
  sessionId: string;
  text: string;
  thoughts: string[];
  toolCalls: ToolCallDisplay[];
  isComplete: boolean;
}

// File Upload/Download
export interface FileUploadPayload {
  sessionId: string;
  filename: string;
  content: string; // base64
  mimeType: string;
}

export interface FileDownloadPayload {
  sessionId: string;
  path: string;
}

export interface FileDownloadResult {
  filename: string;
  content: string; // base64
  mimeType: string;
}
