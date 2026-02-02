import React, { useState, useRef } from 'react';
import { Send, Square, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onCancel, 
  isStreaming,
  disabled = false 
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isStreaming && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileUpload = () => {
    // TODO: Implement file upload
    alert('File upload coming soon!');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Create a session to start chatting..." : "Type your message... (Shift+Enter for new line)"}
          disabled={isStreaming || disabled}
          className="input min-h-[44px] max-h-[200px] resize-none pr-10 disabled:opacity-50"
          rows={1}
        />
        <button
          type="button"
          onClick={handleFileUpload}
          disabled={isStreaming || disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <Paperclip className="w-5 h-5" />
        </button>
      </div>
      
      {isStreaming ? (
        <button
          type="button"
          onClick={onCancel}
          className="btn bg-red-100 text-red-700 hover:bg-red-200 flex-shrink-0"
        >
          <Square className="w-5 h-5 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="btn-primary flex-shrink-0 disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      )}
    </form>
  );
};
