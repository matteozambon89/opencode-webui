import type { MessageType } from '../schemas/bridge.js';

// Re-export MessageType as BridgeMessageType for backwards compatibility
export type BridgeMessageType = MessageType;

// Legacy type - will be deprecated in favor of BridgeMessage from schemas
/** @deprecated Use BridgeMessage from schemas/bridge instead */
export interface LegacyBridgeMessage {
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
  model?: string;
}

// Chat Message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCallDisplay[];
  agentMode?: 'plan' | 'build';
  phases?: MessagePhase[]; // Array of phases for assistant messages (thinking, tools, response)
}

export interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

// Message Phases - for displaying agent thinking and tool execution
export interface ThoughtPhase {
  type: 'thought';
  id: string;
  content: string;
  timestamp: Date;
  isExpanded?: boolean;
}

export interface ToolCallPhase {
  type: 'tool_call';
  id: string;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  output?: string;
  error?: string;
  timestamp: Date;
}

export interface ResponsePhase {
  type: 'response';
  id: string;
  content: string;
  timestamp: Date;
}

export type MessagePhase = ThoughtPhase | ToolCallPhase | ResponsePhase;

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

// Auth Method
export interface AuthMethod {
  id: string;
  name: string;
  description: string;
}
