import { z } from 'zod';

// Base schemas
export const UUID = z.string().uuid();
export const Timestamp = z.number().int().positive();

// Error schema
export const ErrorDetails = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

// Content block schemas
export const TextContent = z.object({
  type: z.literal('text'),
  text: z.string()
});

export const ImageContent = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    mediaType: z.string(),
    data: z.string()
  })
});

export const ResourceContent = z.object({
  type: z.literal('resource'),
  uri: z.string(),
  mimeType: z.string().optional(),
  text: z.string().optional()
});

export const ContentBlock = z.discriminatedUnion('type', [
  TextContent,
  ImageContent,
  ResourceContent
]);

// Agent Mode
export const AgentMode = z.enum(['plan', 'build']);

// Message type enum - following domain:action:status pattern
export const MessageType = z.enum([
  // Connection
  'connection:established:success',
  'connection:heartbeat:request',
  'connection:heartbeat:success',
  
  // ACP Initialize
  'acp:initialize:request',
  'acp:initialize:success',
  'acp:initialize:error',
  
  // Session
  'acp:session:create:request',
  'acp:session:create:success',
  'acp:session:create:error',
  'acp:session:load:request',
  'acp:session:load:success',
  'acp:session:load:error',
  'acp:session:close:request',
  'acp:session:close:success',
  'acp:session:close:error',
  'acp:session:error',
  
  // Prompt
  'acp:prompt:send:request',
  'acp:prompt:send:success',
  'acp:prompt:send:error',
  'acp:prompt:update',
  'acp:prompt:complete',
  'acp:prompt:error',
  'acp:prompt:cancel:request',
  'acp:prompt:cancel:success',
  'acp:prompt:cancel:error',
  
  // Permission
  'acp:permission:request',
  'acp:permission:response',
  
  // System
  'system:error'
]);

// Base message schema
export const BridgeMessage = z.object({
  id: UUID,
  type: MessageType,
  timestamp: Timestamp,
  payload: z.unknown().optional(),
  error: ErrorDetails.optional()
});

// Connection schemas
export const ConnectionEstablishedSuccess = BridgeMessage.extend({
  type: z.literal('connection:established:success'),
  payload: z.object({
    connectionId: z.string(),
    protocolVersion: z.string()
  })
});

export const ConnectionHeartbeatRequest = BridgeMessage.omit({ payload: true }).extend({
  type: z.literal('connection:heartbeat:request')
});

export const ConnectionHeartbeatSuccess = BridgeMessage.extend({
  type: z.literal('connection:heartbeat:success'),
  payload: z.object({
    latency: z.number()
  })
});

// Initialize schemas
export const AcpInitializeRequest = BridgeMessage.extend({
  type: z.literal('acp:initialize:request'),
  payload: z.object({
    protocolVersion: z.number(),
    clientInfo: z.object({
      name: z.string(),
      version: z.string()
    }),
    capabilities: z.object({
      fileSystem: z.object({
        readTextFile: z.boolean(),
        writeTextFile: z.boolean()
      }).optional(),
      terminal: z.boolean().optional(),
      prompts: z.object({
        audio: z.boolean().optional(),
        image: z.boolean().optional(),
        embeddedContext: z.boolean().optional()
      }).optional()
    }).optional()
  })
});

export const AcpInitializeSuccess = BridgeMessage.extend({
  type: z.literal('acp:initialize:success'),
  payload: z.object({
    protocolVersion: z.number(),
    agentCapabilities: z.object({
      sessions: z.object({
        new: z.boolean().optional(),
        load: z.boolean().optional()
      }).optional(),
      mcp: z.object({
        http: z.boolean().optional(),
        sse: z.boolean().optional()
      }).optional(),
      prompts: z.object({
        audio: z.boolean().optional(),
        image: z.boolean().optional(),
        embeddedContext: z.boolean().optional()
      }).optional()
    }),
    availableModels: z.array(z.string()),
    authenticationMethods: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string()
    })).optional()
  })
});

export const AcpInitializeError = BridgeMessage.extend({
  type: z.literal('acp:initialize:error'),
  error: ErrorDetails
});

// Session schemas
export const AcpSessionCreateRequest = BridgeMessage.extend({
  type: z.literal('acp:session:create:request'),
  payload: z.object({
    cwd: z.string().optional(),
    model: z.string().optional()
  })
});

export const AcpSessionCreateSuccess = BridgeMessage.extend({
  type: z.literal('acp:session:create:success'),
  payload: z.object({
    sessionId: z.string(),
    availableModels: z.array(z.string()),
    currentModel: z.string(),
    modes: z.object({
      currentModeId: z.string(),
      availableModes: z.array(z.object({
        id: z.string(),
        name: z.string()
      }))
    })
  })
});

export const AcpSessionCreateError = BridgeMessage.extend({
  type: z.literal('acp:session:create:error'),
  error: ErrorDetails
});

export const AcpSessionLoadRequest = BridgeMessage.extend({
  type: z.literal('acp:session:load:request'),
  payload: z.object({
    sessionId: z.string(),
    cwd: z.string().optional()
  })
});

export const AcpSessionLoadSuccess = BridgeMessage.extend({
  type: z.literal('acp:session:load:success'),
  payload: z.object({
    sessionId: z.string(),
    availableModels: z.array(z.string()),
    currentModel: z.string(),
    modes: z.object({
      currentModeId: z.string(),
      availableModes: z.array(z.object({
        id: z.string(),
        name: z.string()
      }))
    })
  })
});

export const AcpSessionLoadError = BridgeMessage.extend({
  type: z.literal('acp:session:load:error'),
  error: ErrorDetails
});

export const AcpSessionCloseRequest = BridgeMessage.extend({
  type: z.literal('acp:session:close:request'),
  payload: z.object({
    sessionId: z.string()
  })
});

export const AcpSessionCloseSuccess = BridgeMessage.extend({
  type: z.literal('acp:session:close:success'),
  payload: z.object({
    sessionId: z.string()
  })
});

export const AcpSessionCloseError = BridgeMessage.extend({
  type: z.literal('acp:session:close:error'),
  error: ErrorDetails
});

export const AcpSessionError = BridgeMessage.extend({
  type: z.literal('acp:session:error'),
  payload: z.object({
    sessionId: z.string()
  }),
  error: ErrorDetails
});

// Prompt schemas
export const AcpPromptSendRequest = BridgeMessage.extend({
  type: z.literal('acp:prompt:send:request'),
  payload: z.object({
    sessionId: z.string(),
    content: z.array(ContentBlock),
    agentMode: z.enum(['plan', 'build']).optional()
  })
});

export const AcpPromptSendSuccess = BridgeMessage.extend({
  type: z.literal('acp:prompt:send:success'),
  payload: z.object({
    requestId: z.string(),
    status: z.literal('accepted')
  })
});

export const AcpPromptSendError = BridgeMessage.extend({
  type: z.literal('acp:prompt:send:error'),
  error: ErrorDetails
});

// Update types
export const AgentMessageChunkSchema = z.object({
  kind: z.literal('agent_message_chunk'),
  content: ContentBlock
});

export const ThoughtChunkSchema = z.object({
  kind: z.literal('thought_chunk'),
  content: z.object({
    thought: z.string()
  })
});

export const ToolCallSchema = z.object({
  kind: z.literal('tool_call'),
  toolCall: z.object({
    toolCallId: z.string(),
    toolName: z.string(),
    arguments: z.record(z.unknown()),
    status: z.enum(['pending', 'executing'])
  })
});

export const ToolCallUpdateSchema = z.object({
  kind: z.literal('tool_call_update'),
  toolCall: z.object({
    toolCallId: z.string(),
    status: z.enum(['completed', 'error']),
    output: z.string().optional(),
    error: z.string().optional()
  })
});

export const PromptUpdateKind = z.discriminatedUnion('kind', [
  AgentMessageChunkSchema,
  ThoughtChunkSchema,
  ToolCallSchema,
  ToolCallUpdateSchema
]);

export const AcpPromptUpdate = BridgeMessage.extend({
  type: z.literal('acp:prompt:update'),
  payload: z.object({
    sessionId: z.string(),
    requestId: z.string(),
    update: PromptUpdateKind
  })
});

export const AcpPromptComplete = BridgeMessage.extend({
  type: z.literal('acp:prompt:complete'),
  payload: z.object({
    sessionId: z.string(),
    requestId: z.string(),
    result: z.object({
      content: z.array(ContentBlock),
      stopReason: z.enum(['end_turn', 'tool_use', 'cancelled', 'error'])
    })
  })
});

export const AcpPromptError = BridgeMessage.extend({
  type: z.literal('acp:prompt:error'),
  error: ErrorDetails
});

// Cancel schemas
export const AcpPromptCancelRequest = BridgeMessage.extend({
  type: z.literal('acp:prompt:cancel:request'),
  payload: z.object({
    sessionId: z.string()
  })
});

export const AcpPromptCancelSuccess = BridgeMessage.extend({
  type: z.literal('acp:prompt:cancel:success'),
  payload: z.object({
    sessionId: z.string()
  })
});

export const AcpPromptCancelError = BridgeMessage.extend({
  type: z.literal('acp:prompt:cancel:error'),
  error: ErrorDetails
});

// Permission schemas
export const AcpPermissionRequest = BridgeMessage.extend({
  type: z.literal('acp:permission:request'),
  payload: z.object({
    sessionId: z.string(),
    requestId: z.string(),
    toolCall: z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      arguments: z.record(z.unknown())
    }),
    options: z.array(z.object({
      optionId: z.string(),
      title: z.string(),
      description: z.string()
    }))
  })
});

export const AcpPermissionResponse = BridgeMessage.extend({
  type: z.literal('acp:permission:response'),
  payload: z.object({
    sessionId: z.string(),
    requestId: z.string(),
    outcome: z.object({
      outcome: z.enum(['selected', 'cancelled', 'timeout']),
      optionId: z.string().optional()
    })
  })
});

// System schemas
export const SystemError = BridgeMessage.extend({
  type: z.literal('system:error'),
  error: ErrorDetails
});

// Schema registry
export const Schemas = {
  // Connection
  'connection:established:success': ConnectionEstablishedSuccess,
  'connection:heartbeat:request': ConnectionHeartbeatRequest,
  'connection:heartbeat:success': ConnectionHeartbeatSuccess,
  
  // Initialize
  'acp:initialize:request': AcpInitializeRequest,
  'acp:initialize:success': AcpInitializeSuccess,
  'acp:initialize:error': AcpInitializeError,
  
  // Session
  'acp:session:create:request': AcpSessionCreateRequest,
  'acp:session:create:success': AcpSessionCreateSuccess,
  'acp:session:create:error': AcpSessionCreateError,
  'acp:session:load:request': AcpSessionLoadRequest,
  'acp:session:load:success': AcpSessionLoadSuccess,
  'acp:session:load:error': AcpSessionLoadError,
  'acp:session:close:request': AcpSessionCloseRequest,
  'acp:session:close:success': AcpSessionCloseSuccess,
  'acp:session:close:error': AcpSessionCloseError,
  'acp:session:error': AcpSessionError,
  
  // Prompt
  'acp:prompt:send:request': AcpPromptSendRequest,
  'acp:prompt:send:success': AcpPromptSendSuccess,
  'acp:prompt:send:error': AcpPromptSendError,
  'acp:prompt:update': AcpPromptUpdate,
  'acp:prompt:complete': AcpPromptComplete,
  'acp:prompt:error': AcpPromptError,
  'acp:prompt:cancel:request': AcpPromptCancelRequest,
  'acp:prompt:cancel:success': AcpPromptCancelSuccess,
  'acp:prompt:cancel:error': AcpPromptCancelError,
  
  // Permission
  'acp:permission:request': AcpPermissionRequest,
  'acp:permission:response': AcpPermissionResponse,
  
  // System
  'system:error': SystemError
};

// Type exports
export type MessageType = z.infer<typeof MessageType>;
export type ErrorDetails = z.infer<typeof ErrorDetails>;
export type ContentBlock = z.infer<typeof ContentBlock>;
export type BridgeMessage = z.infer<typeof BridgeMessage>;
export type AgentMode = z.infer<typeof AgentMode>;

// Content block type exports
export type TextContent = z.infer<typeof TextContent>;
export type ImageContent = z.infer<typeof ImageContent>;
export type ResourceContent = z.infer<typeof ResourceContent>;

// Tool type exports
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolCallUpdate = z.infer<typeof ToolCallUpdateSchema>;

// Specific message type exports
export type ConnectionEstablishedSuccessMessage = z.infer<typeof ConnectionEstablishedSuccess>;
export type AcpInitializeRequestMessage = z.infer<typeof AcpInitializeRequest>;
export type AcpInitializeSuccessMessage = z.infer<typeof AcpInitializeSuccess>;
export type AcpSessionCreateRequestMessage = z.infer<typeof AcpSessionCreateRequest>;
export type AcpSessionCreateSuccessMessage = z.infer<typeof AcpSessionCreateSuccess>;
export type AcpPromptSendRequestMessage = z.infer<typeof AcpPromptSendRequest>;
export type AcpPromptSendSuccessMessage = z.infer<typeof AcpPromptSendSuccess>;
export type AcpPromptUpdateMessage = z.infer<typeof AcpPromptUpdate>;
export type AcpPromptCompleteMessage = z.infer<typeof AcpPromptComplete>;
export type AcpPermissionRequestMessage = z.infer<typeof AcpPermissionRequest>;
export type AcpPermissionResponseMessage = z.infer<typeof AcpPermissionResponse>;
