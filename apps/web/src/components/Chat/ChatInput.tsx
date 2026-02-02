import { useState, useRef, type FC, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { Send, Square, Paperclip, Lightbulb, Wrench } from 'lucide-react';
import type { AgentMode } from '@opencode/shared';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  agentMode: AgentMode;
  onAgentModeChange: (mode: AgentMode) => void;
  showAgentModeToggle?: boolean;
}

export const ChatInput: FC<ChatInputProps> = ({
  onSendMessage,
  onCancel,
  isStreaming,
  disabled = false,
  agentMode,
  onAgentModeChange,
  showAgentModeToggle = true
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isStreaming && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
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
    <div className="space-y-2">
      {showAgentModeToggle && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-500 font-medium">Mode:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => onAgentModeChange('plan')}
              disabled={isStreaming || disabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                agentMode === 'plan'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              <Lightbulb className="w-4 h-4" />
              Plan
            </button>
            <button
              type="button"
              onClick={() => onAgentModeChange('build')}
              disabled={isStreaming || disabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                agentMode === 'build'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              <Wrench className="w-4 h-4" />
              Build
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Create a session and select a model to start chatting..." : "Type your message... (Shift+Enter for new line)"}
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
    </div>
  );
};
