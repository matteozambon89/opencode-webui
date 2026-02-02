import React, { useRef, useEffect } from 'react';
import { User, Bot } from 'lucide-react';
import type { ChatMessage } from '@opencode/shared/types/websocket';

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  streamingContent, 
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

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
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
            <p className="whitespace-pre-wrap">{message.content}</p>
            <span className="text-xs opacity-70 mt-1 block">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
      
      {/* Streaming content */}
      {streamingContent && (
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
