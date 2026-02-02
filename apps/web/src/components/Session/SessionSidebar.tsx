import type { FC, MouseEvent } from 'react';
import { Plus, MessageSquare, X, Cpu } from 'lucide-react';
import { useACP } from '../../context/ACPContext';

export const SessionSidebar: FC = () => {
  const { sessions, currentSessionId, createSession, closeSession, switchSession, isInitialized, availableModels, selectedModel, setSelectedModel } = useACP();

  const handleNewSession = async () => {
    if (!isInitialized) {
      alert('Not connected to ACP server');
      return;
    }
    await createSession(undefined, selectedModel || undefined);
  };

  const handleCloseSession = (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    closeSession(sessionId);
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 space-y-3">
        {/* Model Selector */}
        {availableModels.length > 0 ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              Model
            </label>
            <select
              value={selectedModel || ''}
              onChange={(e) => setSelectedModel(e.target.value || null)}
              disabled={!isInitialized}
              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Select a model...</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
            <p className="font-medium mb-1">Using default model</p>
            <p>OpenCode will use the configured default model.</p>
          </div>
        )}

        <button
          onClick={handleNewSession}
          disabled={!isInitialized}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="text-center p-4 text-gray-500">
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Click "New Session" to start</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer group ${
                session.id === currentSessionId
                  ? 'bg-primary-50 border border-primary-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">{session.name}</span>
                </div>
                <button
                  onClick={(e) => handleCloseSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                  title="Close session"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>{session.messageCount} messages</span>
                <span>{session.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Sessions are stored in memory only</p>
        {!isInitialized && <p className="text-red-500 mt-1">Connecting to ACP...</p>}
      </div>
    </div>
  );
};
