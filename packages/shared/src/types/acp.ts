// Import types from schemas for internal use
import type {
  ContentBlock,
  ToolCall,
  ToolCallUpdate
} from '../schemas/bridge.js';

// Re-export specific types needed by consumers
export type { AgentMode } from '../schemas/bridge.js';
export type { ContentBlock } from '../schemas/bridge.js';
export type { TextContent } from '../schemas/bridge.js';
export type { ImageContent } from '../schemas/bridge.js';
export type { ResourceContent } from '../schemas/bridge.js';
export type { ToolCall } from '../schemas/bridge.js';
export type { ToolCallUpdate } from '../schemas/bridge.js';
export type { ErrorDetails } from '../schemas/bridge.js';

// JSON-RPC 2.0 Message Types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// ACP Protocol Version
export const ACP_PROTOCOL_VERSION = 1;

// Client Capabilities
export interface ClientCapabilities {
  fileSystem?: {
    readTextFile?: boolean;
    writeTextFile?: boolean;
  };
  terminal?: {
    create?: boolean;
    output?: boolean;
    waitForExit?: boolean;
    kill?: boolean;
    release?: boolean;
  };
  prompts?: {
    audio?: boolean;
    image?: boolean;
    embeddedContext?: boolean;
  };
}

// Agent Capabilities
export interface AgentCapabilities {
  sessions?: {
    new?: boolean;
    load?: boolean;
  };
  mcp?: {
    http?: boolean;
    sse?: boolean;
  };
  prompts?: {
    audio?: boolean;
    image?: boolean;
    embeddedContext?: boolean;
  };
}

// Model Info
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

// Initialize
export interface InitializeParams {
  protocolVersion: number;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: ClientCapabilities;
  authenticationMethods?: string[];
}

export interface InitializeResult {
  protocolVersion: number;
  agentCapabilities: AgentCapabilities;
  meta?: {
    name: string;
    version: string;
  };
  authenticationMethods?: string[];
  availableModels?: string[];
}

// Session Management
export interface SessionNewParams {
  cwd?: string;
  mcpServers?: MCPServerConfig[];
  model?: string;
}

export interface SessionNewResult {
  sessionId: string;
  models?: {
    currentModelId: string;
    availableModels: Array<{
      modelId: string;
      name: string;
    }>;
  };
  modes?: {
    currentModeId: string;
    availableModes: Array<{
      id: string;
      name: string;
      description: string;
    }>;
  };
}

export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
}

// Additional Content Types (not in schemas)
export interface AudioContent {
  type: 'audio';
  source: {
    type: 'base64';
    mediaType: string;
    data: string;
  };
}

export interface ResourceLinkContent {
  type: 'resource_link';
  uri: string;
}

// Session Updates (Streaming) - Legacy format for internal use
export interface AgentMessageChunk {
  role: 'assistant';
  content: ContentBlock[];
}

export interface AgentThoughtChunk {
  thought: string;
}



export type SessionUpdateKind = 
  | 'agent_message_chunk' 
  | 'agent_thought_chunk' 
  | 'tool_call' 
  | 'tool_call_update' 
  | 'plan';

export interface SessionUpdate {
  kind: SessionUpdateKind;
  content: AgentMessageChunk | AgentThoughtChunk | ToolCall | ToolCallUpdate | { steps: Array<{ id: string; description: string }> };
}

export interface SessionUpdateNotification {
  sessionId: string;
  update: SessionUpdate;
}

// Cancel
export interface SessionCancelParams {
  sessionId: string;
}

// File System Operations
export interface ReadFileRequest {
  path: string;
}

export interface ReadFileResult {
  content: string;
  mimeType?: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  mimeType?: string;
}

export interface WriteFileResult {
  success: boolean;
}

// Terminal Operations
export interface TerminalCreateRequest {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface TerminalCreateResult {
  terminalId: string;
}

export interface TerminalOutputRequest {
  terminalId: string;
}

export interface TerminalOutputResult {
  output: string;
  exitCode?: number;
}
