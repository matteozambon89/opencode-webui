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

// Agent Mode
export type AgentMode = 'plan' | 'build';

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

// Content Blocks
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    mediaType: string;
    data: string;
  };
}

export interface AudioContent {
  type: 'audio';
  source: {
    type: 'base64';
    mediaType: string;
    data: string;
  };
}

export interface ResourceContent {
  type: 'resource';
  uri: string;
  mimeType?: string;
  text?: string;
}

export interface ResourceLinkContent {
  type: 'resource_link';
  uri: string;
}

export type ContentBlock = 
  | TextContent 
  | ImageContent 
  | AudioContent 
  | ResourceContent 
  | ResourceLinkContent;

// Prompt
export interface SessionPromptParams {
  sessionId: string;
  content: ContentBlock[];
  agentMode?: AgentMode;
}

export interface SessionPromptResult {
  content: ContentBlock[];
  stopReason: 'done' | 'cancelled' | 'error' | 'length';
}

// Session Updates (Streaming)
export interface AgentMessageChunk {
  role: 'assistant';
  content: ContentBlock[];
}

export interface AgentThoughtChunk {
  thought: string;
}

export interface ToolCall {
  toolCallId: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallUpdate {
  toolCallId: string;
  output: string;
}

export interface PlanStep {
  steps: string[];
}

export type SessionUpdateKind = 
  | 'agent_message_chunk' 
  | 'agent_thought_chunk' 
  | 'tool_call' 
  | 'tool_call_update' 
  | 'plan';

export interface SessionUpdate {
  kind: SessionUpdateKind;
  content: AgentMessageChunk | AgentThoughtChunk | ToolCall | ToolCallUpdate | PlanStep;
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
