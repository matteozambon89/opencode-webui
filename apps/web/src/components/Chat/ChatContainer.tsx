import React from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useACP } from '../../context/ACPContext';

export const ChatContainer: React.FC = () => {
  const { messages, streamingContent, isStreaming, sendPrompt, cancelPrompt, currentSessionId } = useACP();

  const handleSendMessage = async (content: string) => {
    if (!currentSessionId) {
      alert('Please create a new session first');
      return;
    }
    await sendPrompt(content);
  };

  const handleCancel = () => {
    cancelPrompt();
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
          streamingContent={streamingContent} 
          isStreaming={isStreaming} 
        />
      </div>
      <div className="border-t border-gray-200 p-4">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          onCancel={handleCancel}
          isStreaming={isStreaming} 
          disabled={!currentSessionId}
        />
      </div>
    </div>
  );
};
