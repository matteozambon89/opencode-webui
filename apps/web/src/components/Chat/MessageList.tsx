import { useRef, useEffect, type FC } from 'react';
import { User, Bot, Lightbulb, Wrench, AlertCircle } from 'lucide-react';
import type { ChatMessage } from '@opencode/shared';
import { PhaseBubble } from './PhaseBubble';

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  streamingPhases?: import('@opencode/shared').MessagePhase[];
  isStreaming: boolean;
}

export const MessageList: FC<MessageListProps> = ({ 
  messages, 
  streamingContent,
  streamingPhases = [],
  isStreaming 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, isStreaming]);

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Welcome to OpenCode</p>
          <p className="text-sm">Create a session and start a conversation</p>
        </div>
      </div>
    );
  }

  // Filter out any invalid messages
  const invalidMessages = messages.filter((message) => 
    message == null || typeof message !== 'object' || !('content' in message)
  );
  if (invalidMessages.length > 0) {
    console.warn('[MessageList] Filtered out invalid messages:', invalidMessages);
  }
  const validMessages = messages.filter((message): message is ChatMessage => 
    message != null && typeof message === 'object' && 'content' in message
  );

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4">
      {validMessages.map((message) => {
        // Handle system/error messages
        if (message.role === 'system') {
          return (
            <div key={message.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="max-w-[80%] bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-800">
                <p className="whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        }
        
        // For assistant messages with phases, render each phase separately
        if (message.role === 'assistant' && message.phases && message.phases.length > 0) {
          return (
            <div key={message.id} className="space-y-3">
              {message.phases.map((phase) => (
                <PhaseBubble key={phase.id} phase={phase} />
              ))}
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* Agent Mode Badge for User Messages */}
              {message.role === 'user' && message.agentMode && (
                <div className="flex items-center gap-1 mb-1 opacity-90">
                  {message.agentMode === 'plan' ? (
                    <>
                      <Lightbulb className="w-3 h-3" />
                      <span className="text-xs font-medium">Plan Mode</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3 h-3" />
                      <span className="text-xs font-medium">Build Mode</span>
                    </>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        );
      })}
      
      {/* Streaming phases */}
      {streamingPhases.length > 0 && (
        <div className="space-y-3">
          {streamingPhases.map((phase) => (
            <PhaseBubble key={phase.id} phase={phase} />
          ))}
        </div>
      )}

      {/* Streaming content (fallback for legacy or if no phases) */}
      {streamingContent && streamingPhases.length === 0 && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="max-w-[80%] bg-gray-100 rounded-lg px-4 py-2">
            <p className="whitespace-pre-wrap">{streamingContent}</p>
            <span className="text-xs text-gray-500 mt-1 block">
              {new Date().toLocaleTimeString()} • Streaming...
            </span>
          </div>
        </div>
      )}
      
      {/* Typing indicator (only when streaming with no content yet) */}
      {isStreaming && !streamingContent && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </div>
  );
};
