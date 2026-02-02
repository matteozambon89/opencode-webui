import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import type { ChatMessage, Session } from '@opencode/shared/types/websocket';

interface ACPContextType {
  sessions: Session[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  createSession: (cwd?: string) => Promise<string | null>;
  sendPrompt: (content: string) => Promise<void>;
  cancelPrompt: () => void;
  closeSession: (sessionId: string) => void;
  switchSession: (sessionId: string) => void;
  isInitialized: boolean;
}

const ACPContext = createContext<ACPContextType | undefined>(undefined);

interface ACPProviderProps {
  children: React.ReactNode;
}

export const ACPProvider: React.FC<ACPProviderProps> = ({ children }) => {
  const { sendMessage, lastMessage, connectionStatus, connectionId } = useWebSocket();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'acp:initialized': {
        setIsInitialized(true);
        break;
      }

      case 'acp:session:created': {
        const { sessionId } = lastMessage.payload as { sessionId: string };
        const newSession: Session = {
          id: sessionId,
          name: `Session ${sessions.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
          status: 'active',
        };
        setSessions((prev) => [...prev, newSession]);
        setCurrentSessionId(sessionId);
        break;
      }

      case 'acp:session:update': {
        const { update } = lastMessage.payload as { update: { kind: string; content: unknown } };
        
        if (update.kind === 'agent_message_chunk') {
          const content = (update.content as { content: Array<{ type: string; text?: string }> }).content;
          const text = content.map(c => c.text || '').join('');
          setStreamingContent((prev) => prev + text);
        } else if (update.kind === 'agent_thought_chunk') {
          // Could display thinking/reasoning in UI
          console.log('Agent thinking:', (update.content as { thought: string }).thought);
        }
        break;
      }

      case 'acp:session:completed': {
        const { result } = lastMessage.payload as { 
          result: { 
            content: Array<{ type: string; text?: string }>; 
            stopReason: string;
          } 
        };
        
        const finalText = result.content.map(c => c.text || '').join('');
        
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: streamingContent + finalText,
          timestamp: new Date(),
          isStreaming: false,
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent('');
        setIsStreaming(false);
        
        // Update session message count
        if (currentSessionId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date() }
                : s
            )
          );
        }
        break;
      }

      case 'acp:error': {
        console.error('ACP error:', lastMessage.error);
        setIsStreaming(false);
        break;
      }
    }
  }, [lastMessage, streamingContent, currentSessionId, sessions.length]);

  // Initialize ACP when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && connectionId && !isInitialized) {
      sendMessage({
        type: 'acp:initialize',
        payload: {
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
            terminal: {
              create: true,
              output: true,
              waitForExit: true,
              kill: true,
              release: true,
            },
          },
        },
      });
    }
  }, [connectionStatus, connectionId, isInitialized, sendMessage]);

  const createSession = useCallback(async (cwd?: string): Promise<string | null> => {
    if (!isInitialized) {
      console.error('ACP not initialized');
      return null;
    }

    sendMessage({
      type: 'acp:session:new',
      payload: cwd ? { cwd } : undefined,
    });

    // Return null here - the session ID will come via acp:session:created
    return null;
  }, [isInitialized, sendMessage]);

  const sendPrompt = useCallback(async (content: string): Promise<void> => {
    if (!currentSessionId || !isInitialized) {
      console.error('No active session or not initialized');
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');

    // Send to ACP
    sendMessage({
      type: 'acp:session:prompt',
      payload: {
        sessionId: currentSessionId,
        content: [{ type: 'text', text: content }],
      },
    });
  }, [currentSessionId, isInitialized, sendMessage]);

  const cancelPrompt = useCallback(() => {
    if (!currentSessionId) return;
    
    sendMessage({
      type: 'acp:session:cancel',
      payload: { sessionId: currentSessionId },
    });
    
    setIsStreaming(false);
  }, [currentSessionId, sendMessage]);

  const closeSession = useCallback((sessionId: string) => {
    sendMessage({
      type: 'acp:session:close',
      payload: { sessionId },
    });

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId, sendMessage]);

  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    // In a real implementation, you'd load the session's message history
    setMessages([]);
  }, []);

  const value: ACPContextType = {
    sessions,
    currentSessionId,
    messages,
    streamingContent,
    isStreaming,
    createSession,
    sendPrompt,
    cancelPrompt,
    closeSession,
    switchSession,
    isInitialized,
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
