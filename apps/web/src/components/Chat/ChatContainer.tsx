import type { FC } from 'react';
import { AlertCircle, Terminal } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useACP } from '../../context/ACPContext';

export const ChatContainer: FC = () => {
  const { messages, streamingContent, streamingPhases, isStreaming, sendPrompt, cancelPrompt, currentSessionId, agentMode, setAgentMode, canSendMessage, requiresAuth, authMethods } = useACP();

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
          streamingPhases={streamingPhases}
          isStreaming={isStreaming}
        />
      </div>
      {requiresAuth && (
        <div className="mx-4 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-800 mb-1">
                Authentication Required
              </h4>
              <p className="text-sm text-amber-700 mb-2">
                The OpenCode agent requires authentication before it can process messages.
              </p>
              {authMethods.length > 0 && (
                <div className="mb-2">
                  <p className="text-sm text-amber-700 font-medium mb-1">Available methods:</p>
                  <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
                    {authMethods.map((method) => (
                      <li key={method.id}>{method.description}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 p-2 bg-amber-100 rounded text-sm text-amber-800">
                <Terminal className="w-4 h-4" />
                <code className="font-mono">opencode auth login</code>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-gray-200 p-4">
        <ChatInput
          onSendMessage={handleSendMessage}
          onCancel={handleCancel}
          isStreaming={isStreaming}
          disabled={!canSendMessage}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          showAgentModeToggle={true}
        />
      </div>
    </div>
  );
};
