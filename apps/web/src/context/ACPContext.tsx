import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode, type FC } from 'react';
import { useWebSocket } from './WebSocketContext';
import type { ChatMessage, Session, AgentMode, MessagePhase, ThoughtPhase, ToolCallPhase, ResponsePhase } from '@opencode/shared';
import type { AuthMethod } from '@opencode/shared';

interface ACPContextType {
  sessions: Session[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  streamingContent: string;
  streamingPhases: MessagePhase[];
  isStreaming: boolean;
  createSession: (cwd?: string, model?: string) => Promise<string | null>;
  sendPrompt: (content: string) => Promise<void>;
  cancelPrompt: () => void;
  closeSession: (sessionId: string) => void;
  switchSession: (sessionId: string) => void;
  isInitialized: boolean;
  // Agent mode
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;
  // Model selection
  availableModels: string[];
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
  // Validation
  canSendMessage: boolean;
  // Authentication
  authMethods: AuthMethod[];
  requiresAuth: boolean;
  // Permission requests
  pendingPermissionRequest: {
    requestId: string;
    toolCall: { toolName: string; arguments: Record<string, unknown> };
    options: Array<{ optionId: string; title: string; description: string }>;
  } | null;
  respondToPermission: (optionId: string) => void;
}

const ACPContext = createContext<ACPContextType | undefined>(undefined);

interface ACPProviderProps {
  children: ReactNode;
}

export const ACPProvider: FC<ACPProviderProps> = ({ children }) => {
  const { sendMessage, lastMessage, connectionStatus, connectionId } = useWebSocket();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionMessages, setSessionMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingPhases, setStreamingPhases] = useState<MessagePhase[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Agent mode state
  const [agentMode, setAgentMode] = useState<AgentMode>('build');

  // Model selection state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Authentication state (for future use)
  const [authMethods] = useState<AuthMethod[]>([]);
  const [requiresAuth] = useState(false);

  // Permission request state
  const [pendingPermissionRequest, setPendingPermissionRequest] = useState<ACPContextType['pendingPermissionRequest']>(null);

  // Track processed message IDs to prevent duplicate processing
  const processedMessageIds = useRef<Set<string>>(new Set());
  const MAX_PROCESSED_IDS = 1000; // Limit to prevent memory leak

  // Ref to track streaming content for access in callbacks
  const streamingContentRef = useRef<string>('');
  
  // Ref to track current messages for access in callbacks
  const messagesRef = useRef<ChatMessage[]>([]);
  
  // Ref to track session messages for access in callbacks
  const sessionMessagesRef = useRef<Map<string, ChatMessage[]>>(new Map());
  
  // Ref to track prompt timeout
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const PROMPT_TIMEOUT_MS = 60000; // 60 seconds timeout for prompts

  // Ref to track phases during streaming
  const phasesRef = useRef<MessagePhase[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionMessagesRef.current = sessionMessages;
  }, [sessionMessages]);

  // Load messages when switching sessions
  useEffect(() => {
    if (currentSessionId) {
      // Use ref to access latest sessionMessages state to avoid stale closure
      const savedMessages = sessionMessagesRef.current.get(currentSessionId);
      if (savedMessages) {
        setMessages(savedMessages);
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('[ACPContext] Received message:', lastMessage.type, lastMessage);

    // Skip if this message has already been processed
    if (lastMessage.id && processedMessageIds.current.has(lastMessage.id)) {
      console.log('[ACPContext] Skipping already processed message:', lastMessage.id);
      return;
    }

    // Mark message as processed
    if (lastMessage.id) {
      processedMessageIds.current.add(lastMessage.id);
      // Prevent memory leak by limiting set size
      if (processedMessageIds.current.size > MAX_PROCESSED_IDS) {
        const iterator = processedMessageIds.current.values();
        const firstId = iterator.next().value;
        if (firstId) {
          processedMessageIds.current.delete(firstId);
        }
      }
    }

    const message = lastMessage;

    switch (message.type) {
      case 'acp:initialize:success': {
        setIsInitialized(true);
        // Note: Models are now extracted from acp:session:create:success, not acp:initialize:success
        break;
      }

      case 'acp:initialize:error': {
        console.error('[ACPContext] Initialize error:', message.error);
        // Show error to user
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `Initialization error: ${message.error?.message || 'Unknown error'}`,
          timestamp: new Date(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, errorMsg]);
        break;
      }

      case 'acp:session:create:success': {
        const createPayload = message.payload as {
          sessionId: string;
          availableModels?: string[];
          currentModel?: string;
        };
        const { sessionId, availableModels: models, currentModel } = createPayload;

        console.log('[ACPContext] acp:session:create:success payload:', { sessionId, models, currentModel });

        // Update available models
        if (models && models.length > 0) {
          setAvailableModels(models);
          // Auto-select current model or first available if none selected
          if (!selectedModel) {
            setSelectedModel(currentModel || models[0]);
          }
        }

        setSessions((prev) => {
          // Check if session already exists to prevent duplicates
          if (prev.some(s => s.id === sessionId)) {
            return prev;
          }
          const newSession: Session = {
            id: sessionId,
            name: `Session ${prev.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            messageCount: 0,
            status: 'active',
          };
          return [...prev, newSession];
        });
        setCurrentSessionId(sessionId);
        break;
      }

      case 'acp:session:create:error': {
        console.error('[ACPContext] Session creation error:', message.error);
        // Show error to user
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `Session creation error: ${message.error?.message || 'Unknown error'}`,
          timestamp: new Date(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, errorMsg]);
        break;
      }

      case 'acp:prompt:update': {
        console.log('[ACPContext] Received acp:prompt:update:', message.payload);
        const payload = message.payload as {
          sessionId: string;
          update: {
            kind: string;
            content?: { type: string; text?: string; thought?: string };
            toolCall?: { toolCallId: string; toolName: string; status: string; arguments?: Record<string, unknown>; output?: string; error?: string };
          };
        };

        const update = payload.update;
        const updateKind = update.kind;
        console.log('[ACPContext] Extracted updateKind:', updateKind);

        if (updateKind === 'agent_message_chunk') {
          console.log('[ACPContext] Processing agent_message_chunk');
          const content = update.content;
          if (content?.text) {
            console.log('[ACPContext] Appending text:', content.text.substring(0, 50));
            setStreamingContent((prev) => {
              const newContent = prev + content.text;
              streamingContentRef.current = newContent;
              return newContent;
            });

            // Add or update response phase
            const existingResponsePhase = phasesRef.current.find(
              (p): p is ResponsePhase => p.type === 'response'
            );
            if (existingResponsePhase) {
              existingResponsePhase.content += content.text;
            } else {
              const responsePhase: ResponsePhase = {
                type: 'response',
                id: crypto.randomUUID(),
                content: content.text,
                timestamp: new Date(),
              };
              phasesRef.current.push(responsePhase);
            }
            // Update state to trigger re-render
            setStreamingPhases([...phasesRef.current]);
          }
        } else if (updateKind === 'thought_chunk') {
          console.log('[ACPContext] Processing thought_chunk');
          const content = update.content;
          if (content?.thought) {
            // Add or update thought phase
            const existingThoughtPhase = phasesRef.current.find(
              (p): p is ThoughtPhase => p.type === 'thought'
            );
            if (existingThoughtPhase) {
              existingThoughtPhase.content += content.thought;
            } else {
              const thoughtPhase: ThoughtPhase = {
                type: 'thought',
                id: crypto.randomUUID(),
                content: content.thought,
                timestamp: new Date(),
                isExpanded: false, // Collapsed by default
              };
              phasesRef.current.push(thoughtPhase);
            }
            // Update state to trigger re-render
            setStreamingPhases([...phasesRef.current]);
          }
        } else if (updateKind === 'tool_call') {
          console.log('[ACPContext] Processing tool_call:', update.toolCall);
          const toolCall = update.toolCall;
          if (toolCall) {
            const toolPhase: ToolCallPhase = {
              type: 'tool_call',
              id: crypto.randomUUID(),
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              arguments: toolCall.arguments || {},
              status: (toolCall.status as 'pending' | 'executing') || 'pending',
              timestamp: new Date(),
            };
            phasesRef.current.push(toolPhase);
            // Update state to trigger re-render
            setStreamingPhases([...phasesRef.current]);
          }
        } else if (updateKind === 'tool_call_update') {
          console.log('[ACPContext] Processing tool_call_update:', update.toolCall);
          const toolCall = update.toolCall;
          if (toolCall) {
            const existingToolPhase = phasesRef.current.find(
              (p): p is ToolCallPhase => p.type === 'tool_call' && p.toolCallId === toolCall.toolCallId
            );
            if (existingToolPhase) {
              existingToolPhase.status = (toolCall.status as 'completed' | 'error') || 'completed';
              if (toolCall.output) {
                existingToolPhase.output = toolCall.output;
              }
              if (toolCall.error) {
                existingToolPhase.error = toolCall.error;
              }
              // Update state to trigger re-render
              setStreamingPhases([...phasesRef.current]);
            }
          }
        }
        break;
      }

      case 'acp:prompt:complete': {
        console.log('[ACPContext] Received acp:prompt:complete:', message.payload);
        const payload = message.payload as { 
          sessionId: string;
          result: { 
            content: Array<{ type: string; text?: string }>; 
            stopReason: string;
          };
        };
        const { result, sessionId: completedSessionId } = payload;
        
        const resultText = result.content?.map(c => c.text || '').join('') || '';
        
        // Use functional updates to access current state and combine with streaming content
        let finalAssistantMessage: ChatMessage | null = null;
        let didUpdateExistingMessage = false;
        
        setMessages((prevMessages) => {
          // Get the accumulated streaming content at this moment
          const currentStreamingContent = streamingContentRef.current;
          const currentPhases = [...phasesRef.current];

          // Use result text if available, otherwise use accumulated streaming content
          const finalText = resultText || currentStreamingContent || 'No response received';

          console.log('[ACPContext] Creating final message with content:', finalText.substring(0, 100));
          console.log('[ACPContext] Message phases:', currentPhases.length);

          // If no response phase exists but we have text, create one
          const hasResponsePhase = currentPhases.some((p): p is ResponsePhase => p.type === 'response');
          if (!hasResponsePhase && finalText) {
            const responsePhase: ResponsePhase = {
              type: 'response',
              id: crypto.randomUUID(),
              content: finalText,
              timestamp: new Date(),
            };
            currentPhases.push(responsePhase);
          }

          // Find if we already have a streaming message for this session
          const streamingMsg = prevMessages.find(m => m.isStreaming && m.role === 'assistant');
          if (streamingMsg) {
            // Update existing streaming message
            didUpdateExistingMessage = true;
            finalAssistantMessage = {
              ...streamingMsg,
              content: finalText,
              isStreaming: false,
              phases: currentPhases,
            };
            return prevMessages.map(m =>
              m.id === streamingMsg.id
                ? finalAssistantMessage!
                : m
            );
          }
          // Add new assistant message
          finalAssistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: finalText,
            timestamp: new Date(),
            isStreaming: false,
            phases: currentPhases,
          };
          return [...prevMessages, finalAssistantMessage];
        });
        
        // Also save to sessionMessages for persistence when switching sessions
        if (completedSessionId && finalAssistantMessage) {
          setSessionMessages((prev) => {
            const sessionMsgs = prev.get(completedSessionId) || [];
            let updatedMsgs: ChatMessage[];
            if (didUpdateExistingMessage) {
              // Update existing message in sessionMessages
              updatedMsgs = sessionMsgs.map(m => 
                m.id === finalAssistantMessage!.id 
                  ? finalAssistantMessage!
                  : m
              );
            } else {
              // Add new message to sessionMessages
              updatedMsgs = [...sessionMsgs, finalAssistantMessage!];
            }
            console.log('[ACPContext] Saved message to sessionMessages for session:', completedSessionId, 'Message count:', updatedMsgs.length);
            return new Map(prev).set(completedSessionId, updatedMsgs);
          });
        }
        
        setStreamingContent('');
        streamingContentRef.current = '';
        phasesRef.current = []; // Clear phases
        setStreamingPhases([]);
        setIsStreaming(false);

        // Clear the prompt timeout
        if (promptTimeoutRef.current) {
          clearTimeout(promptTimeoutRef.current);
          promptTimeoutRef.current = null;
        }
        
        console.log('[ACPContext] Prompt completed, set isStreaming=false');
        
        // Update session message count
        if (completedSessionId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === completedSessionId
                ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date() }
                : s
            )
          );
        }
        break;
      }

      case 'acp:prompt:error': {
        console.error('[ACPContext] Prompt error:', message.error);
        
        // Clear the prompt timeout
        if (promptTimeoutRef.current) {
          clearTimeout(promptTimeoutRef.current);
          promptTimeoutRef.current = null;
        }
        
        // Add error message to chat so user knows what happened
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `Error: ${message.error?.message || 'An unknown error occurred'}`,
          timestamp: new Date(),
          isStreaming: false,
        };
        
        setMessages((prev) => [...prev, errorMessage]);
        setStreamingContent('');
        streamingContentRef.current = '';
        phasesRef.current = []; // Clear phases on error
        setStreamingPhases([]);
        setIsStreaming(false);
        break;
      }

      case 'acp:prompt:cancel:success': {
        console.log('[ACPContext] Prompt cancelled successfully');
        setIsStreaming(false);
        setStreamingContent('');
        streamingContentRef.current = '';
        phasesRef.current = []; // Clear phases on cancel
        setStreamingPhases([]);

        // Clear the prompt timeout
        if (promptTimeoutRef.current) {
          clearTimeout(promptTimeoutRef.current);
          promptTimeoutRef.current = null;
        }

        // Add cancellation message
        const cancelMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: 'Prompt cancelled by user',
          timestamp: new Date(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, cancelMessage]);
        break;
      }

      case 'acp:session:close:success': {
        console.log('[ACPContext] Session closed successfully');
        const payload = message.payload as { sessionId: string };
        const { sessionId } = payload;
        
        // Remove from sessions list
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        
        // Clean up session messages
        setSessionMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(sessionId);
          return newMap;
        });
        
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        break;
      }

      case 'acp:session:error': {
        console.error('[ACPContext] Session error:', message.error);
        const sessionErrorPayload = message.payload as { sessionId: string };
        console.log('[ACPContext] Session error for session:', sessionErrorPayload.sessionId);
        
        // Show error to user
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `Session error: ${message.error?.message || 'An unknown error occurred'}`,
          timestamp: new Date(),
          isStreaming: false,
        };
        
        setMessages((prev) => [...prev, errorMessage]);
        break;
      }

      case 'acp:permission:request': {
        console.log('[ACPContext] Permission request received:', message.payload);
        const payload = message.payload as {
          sessionId: string;
          requestId: string;
          toolCall: { toolCallId: string; toolName: string; arguments: Record<string, unknown> };
          options: Array<{ optionId: string; title: string; description: string }>;
        };
        
        setPendingPermissionRequest({
          requestId: payload.requestId,
          toolCall: payload.toolCall,
          options: payload.options,
        });
        break;
      }

      case 'system:error': {
        console.error('[ACPContext] System error:', message.error);
        
        // Show error to user
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `System error: ${message.error?.message || 'An unknown error occurred'}`,
          timestamp: new Date(),
          isStreaming: false,
        };
        
        setMessages((prev) => [...prev, errorMessage]);
        break;
      }
    }
  }, [lastMessage, currentSessionId, selectedModel]);

  // Initialize ACP when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && connectionId && !isInitialized) {
      sendMessage('acp:initialize:request', {
        protocolVersion: 1,
        clientInfo: {
          name: 'opencode-web-ui',
          version: '1.0.0',
        },
        capabilities: {
          fileSystem: {
            readTextFile: true,
            writeTextFile: true,
          },
          terminal: true,
        },
      });
    }
  }, [connectionStatus, connectionId, isInitialized, sendMessage]);

  // Cleanup prompt timeout on unmount
  useEffect(() => {
    return () => {
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
      }
    };
  }, []);

  const createSession = useCallback(async (cwd?: string, model?: string): Promise<string | null> => {
    const payload: { cwd?: string; model?: string } = {};
    if (cwd) payload.cwd = cwd;
    if (model) payload.model = model;

    sendMessage('acp:session:create:request', Object.keys(payload).length > 0 ? payload : undefined);

    // Return null here - the session ID will come via acp:session:create:success
    return null;
  }, [sendMessage]);

  const sendPrompt = useCallback(async (content: string): Promise<void> => {
    if (!currentSessionId || !isInitialized) {
      console.error('No active session or not initialized');
      return;
    }

    console.log(`[ACPContext] sendPrompt called: sessionId=${currentSessionId}, content="${content.substring(0, 50)}...", agentMode=${agentMode}`);

    // Add user message with agent mode
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      agentMode,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';
    phasesRef.current = []; // Clear phases for new prompt
    setStreamingPhases([]);

    console.log('[ACPContext] Set isStreaming=true, streamingContent cleared');

    // Clear any existing timeout
    if (promptTimeoutRef.current) {
      clearTimeout(promptTimeoutRef.current);
    }
    
    // Set timeout for prompt response
    promptTimeoutRef.current = setTimeout(() => {
      console.error('[ACPContext] Prompt timed out after', PROMPT_TIMEOUT_MS, 'ms');
      
      // Add timeout error message
      const timeoutMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Error: Request timed out. The agent did not respond within the expected time. This may be due to authentication issues or the agent being unavailable.',
        timestamp: new Date(),
        isStreaming: false,
      };
      
      setMessages((prev) => [...prev, timeoutMessage]);
      setStreamingContent('');
      streamingContentRef.current = '';
      setIsStreaming(false);
    }, PROMPT_TIMEOUT_MS);

    // Send to ACP with agent mode
    sendMessage('acp:prompt:send:request', {
      sessionId: currentSessionId,
      content: [{ type: 'text', text: content }],
      agentMode,
    });
  }, [currentSessionId, isInitialized, sendMessage, agentMode]);

  const cancelPrompt = useCallback(() => {
    if (!currentSessionId) return;
    
    // Clear the prompt timeout
    if (promptTimeoutRef.current) {
      clearTimeout(promptTimeoutRef.current);
      promptTimeoutRef.current = null;
    }
    
    sendMessage('acp:prompt:cancel:request', { sessionId: currentSessionId });
    
    setIsStreaming(false);
  }, [currentSessionId, sendMessage]);

  const closeSession = useCallback((sessionId: string) => {
    sendMessage('acp:session:close:request', { sessionId });

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    
    // Clean up session messages
    setSessionMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
    
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId, sendMessage]);

  const switchSession = useCallback((sessionId: string) => {
    // First save current session's messages using ref to avoid stale closure
    if (currentSessionId) {
      // Save both messages and streaming content (if any)
      const currentMessages = messagesRef.current;
      const currentStreamingContent = streamingContentRef.current;
      
      // If there's streaming content, we need to save it too
      // We can store it in a separate map or append it to the last message
      let messagesToSave = currentMessages;
      if (currentStreamingContent && isStreaming) {
        // Check if there's already a streaming message
        const streamingMsg = currentMessages.find(m => m.isStreaming && m.role === 'assistant');
        if (streamingMsg) {
          // Update the streaming message with current content
          messagesToSave = currentMessages.map(m => 
            m.id === streamingMsg.id 
              ? { ...m, content: currentStreamingContent }
              : m
          );
        } else {
          // Add a new streaming message
          messagesToSave = [...currentMessages, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: currentStreamingContent,
            timestamp: new Date(),
            isStreaming: true,
          }];
        }
      }
      
      setSessionMessages(prev => new Map(prev).set(currentSessionId, messagesToSave));
      console.log('[ACPContext] Saved session messages on switch:', currentSessionId, 'Count:', messagesToSave.length);
    }

    // Then switch to new session - messages will be loaded by useEffect
    setCurrentSessionId(sessionId);
  }, [currentSessionId, isStreaming]);

  const respondToPermission = useCallback((optionId: string) => {
    if (!pendingPermissionRequest || !currentSessionId) return;
    
    sendMessage('acp:permission:response', {
      sessionId: currentSessionId,
      requestId: pendingPermissionRequest.requestId,
      outcome: {
        outcome: 'selected',
        optionId,
      },
    });
    
    setPendingPermissionRequest(null);
  }, [pendingPermissionRequest, currentSessionId, sendMessage]);

  // Computed property: can send message when initialized, has session, and agent mode is set
  const canSendMessage = isInitialized && !!currentSessionId && !!agentMode;

  const value: ACPContextType = {
    sessions,
    currentSessionId,
    messages,
    streamingContent,
    streamingPhases,
    isStreaming,
    createSession,
    sendPrompt,
    cancelPrompt,
    closeSession,
    switchSession,
    isInitialized,
    // Agent mode
    agentMode,
    setAgentMode,
    // Model selection
    availableModels,
    selectedModel,
    setSelectedModel,
    // Validation
    canSendMessage,
    // Authentication
    authMethods,
    requiresAuth,
    // Permission requests
    pendingPermissionRequest,
    respondToPermission,
  };

  return <ACPContext.Provider value={value}>{children}</ACPContext.Provider>;
};

export function useACP(): ACPContextType {
  const context = useContext(ACPContext);
  if (context === undefined) {
    throw new Error('useACP must be used within an ACPProvider');
  }
  return context;
}
