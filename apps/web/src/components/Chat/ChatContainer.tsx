import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export const ChatContainer: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSendMessage = async (content: string) => {
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    // TODO: Implement actual ACP communication via WebSocket
    // For now, simulate a response
    setTimeout(() => {
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: `Received: ${content}\n\n(This is a placeholder response. ACP protocol integration is in progress.)`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(false);
    }, 1000);
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isStreaming={isStreaming} />
      </div>
      <div className="border-t border-gray-200 p-4">
        <ChatInput onSendMessage={handleSendMessage} isStreaming={isStreaming} />
      </div>
    </div>
  );
};
